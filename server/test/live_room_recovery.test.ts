import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';

process.env.NODE_ENV = 'test';

import {
  app,
  io,
  inMemoryUsers,
  inMemorySessions,
  syncWithDatabasePromise,
  prisma
} from '../src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

function createToken(payload: { id: string; email: string; role: string; tokenVersion?: number }) {
  return jwt.sign(
    { userId: payload.id, id: payload.id, email: payload.email, role: payload.role, tokenVersion: payload.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runLiveRoomRecoveryTests() {
  console.log('\n====================================================');
  console.log('🧪 RUNNING LIVE ROOM STATE RECOVERY & LIMITS TESTS');
  console.log('====================================================\n');

  if (syncWithDatabasePromise) {
    await syncWithDatabasePromise;
  }

  const serverInstance = http.createServer(app);
  io.attach(serverInstance);

  await new Promise<void>((resolve) => serverInstance.listen(0, resolve));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const activeSockets: ClientSocketType[] = [];

  const hostToken = createToken({ id: 'live-host-1', email: 'host1@test.com', role: 'teacher' });
  const peerToken = createToken({ id: 'live-peer-1', email: 'peer1@test.com', role: 'student' });

  try {
    // 1. Host joins room and emits whiteboard, notes, and code updates
    const hostSocket = ClientSocket(baseUrl, {
      auth: { token: hostToken },
      transports: ['websocket'],
      forceNew: true
    });
    activeSockets.push(hostSocket);

    await new Promise<void>((resolve, reject) => {
      hostSocket.on('connect', () => resolve());
      hostSocket.on('connect_error', reject);
    });

    const testRoom = 'room-recovery-test-' + Date.now();
    hostSocket.emit('join-room', { roomId: testRoom, role: 'teacher', name: 'Host Teacher' });

    // Wait a brief moment for join
    await new Promise(r => setTimeout(r, 100));

    // Emit whiteboard stroke
    hostSocket.emit('whiteboard-update', {
      roomId: testRoom,
      type: 'stroke',
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      color: '#ff0000',
      width: 4
    });

    // Emit notes update
    hostSocket.emit('study-notes-update', {
      roomId: testRoom,
      notes: '# Live Cohort Recovery Notes\n- Topic: Distributed Systems'
    });

    // Emit code update via room-event
    hostSocket.emit('room-event', {
      roomId: testRoom,
      event: {
        type: 'code',
        value: 'console.log("Recovered live code!");'
      }
    });

    await new Promise(r => setTimeout(r, 150));

    // 2. Late Joiner (Peer) connects and receives room-state-sync with full state
    const peerSocket = ClientSocket(baseUrl, {
      auth: { token: peerToken },
      transports: ['websocket'],
      forceNew: true
    });
    activeSockets.push(peerSocket);

    await new Promise<void>((resolve, reject) => {
      peerSocket.on('connect', () => resolve());
      peerSocket.on('connect_error', reject);
    });

    const syncPromise = new Promise<any>((resolve) => {
      peerSocket.on('room-state-sync', (state) => {
        resolve(state);
      });
    });

    peerSocket.emit('join-room', { roomId: testRoom, role: 'student', name: 'Late Student' });

    const syncedState = await Promise.race([
      syncPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for room-state-sync')), 2000))
    ]);

    assert(syncedState, 'Late joiner must receive room-state-sync');
    assert.strictEqual(syncedState.notes, '# Live Cohort Recovery Notes\n- Topic: Distributed Systems', 'Synced notes must match host state');
    assert.strictEqual(syncedState.code, 'console.log("Recovered live code!");', 'Synced code must match host state');
    assert(
      (Array.isArray(syncedState.whiteboardElements) && syncedState.whiteboardElements.length >= 1) ||
      (Array.isArray(syncedState.whiteboardStrokes) && syncedState.whiteboardStrokes.length >= 1),
      'Whiteboard elements/strokes must be retained in room-state-sync'
    );
    console.log('✅ TEST ITEM 12 (Live room state recovery on late join/reconnect) PASSED');

    // 3. Size limit check: Oversized whiteboard payload (>256KB) should trigger room-error
    const errorPromise = new Promise<any>((resolve) => {
      hostSocket.on('room-error', (err) => resolve(err));
    });

    const oversizedData = 'A'.repeat(300 * 1024); // 300 KB > 256 KB limit
    hostSocket.emit('whiteboard-update', {
      roomId: testRoom,
      data: oversizedData
    });

    const errorReceived = await Promise.race([
      errorPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for PAYLOAD_TOO_LARGE')), 2000))
    ]);

    assert.strictEqual(errorReceived.code, 'PAYLOAD_TOO_LARGE', 'Oversized payload must be rejected with PAYLOAD_TOO_LARGE');
    console.log('✅ TEST ITEM 11 (Payload size limits on socket events) PASSED');

    // 4. Rate limit check: spamming chat-message (>10 msgs/s) triggers RATE_LIMIT_EXCEEDED
    let rateLimitError: any = null;
    const rateLimitPromise = new Promise<any>((resolve) => {
      peerSocket.on('room-error', (err) => {
        if (err.code === 'RATE_LIMIT_EXCEEDED') resolve(err);
      });
    });

    for (let i = 0; i < 20; i++) {
      peerSocket.emit('chat-message', {
        roomId: testRoom,
        text: `Message ${i}`
      });
    }

    rateLimitError = await Promise.race([
      rateLimitPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for RATE_LIMIT_EXCEEDED')), 2000))
    ]);

    assert.strictEqual(rateLimitError.code, 'RATE_LIMIT_EXCEEDED', 'Spamming socket events must trigger RATE_LIMIT_EXCEEDED');
    console.log('✅ TEST ITEM 11 (Rate limits on socket events) PASSED');

    console.log('\n====================================================');
    console.log('🎉 ALL LIVE ROOM RECOVERY & LIMITS TESTS PASSED!');
    console.log('====================================================\n');
  } finally {
    activeSockets.forEach(s => {
      try { s.disconnect(); } catch {}
    });
    if ((serverInstance as any).closeAllConnections) {
      (serverInstance as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
    if (prisma && process.env.DATABASE_URL) {
      try {
        await prisma.$disconnect();
      } catch {}
    }
  }
}

runLiveRoomRecoveryTests().catch((err) => {
  console.error('\n❌ LIVE ROOM RECOVERY TEST FAILED:', err);
  process.exitCode = 1;
});
