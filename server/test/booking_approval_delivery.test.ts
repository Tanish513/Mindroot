import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';

process.env.NODE_ENV = 'test';

import {
  app,
  server,
  io,
  inMemoryUsers,
  inMemorySessions,
  syncWithDatabasePromise,
  getSessionApproverId
} from '../src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

function createToken(payload: { id: string; email: string; role: string; tokenVersion?: number }) {
  return jwt.sign(
    { userId: payload.id, id: payload.id, email: payload.email, role: payload.role, tokenVersion: payload.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runBookingApprovalDeliveryTests() {
  console.log('====================================================');
  console.log('🧪 Starting Booking Approval Delivery & Visibility Suite');
  console.log('====================================================\n');

  if (syncWithDatabasePromise) {
    await syncWithDatabasePromise;
  }

  // Start the server on an ephemeral port
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  const activeSockets: ClientSocketType[] = [];

  const connectClient = async (token?: string): Promise<ClientSocketType> => {
    const s = ClientSocket(baseUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
    activeSockets.push(s);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 4000);
      s.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      s.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    return s;
  };

  try {
    const ts = Date.now();

    // Setup Test Users
    const studentUser = {
      id: `student-dlv-${ts}`,
      name: 'Rohan Student',
      email: `rohan.${ts}@example.com`,
      role: 'student',
      tokenBalance: 100
    };

    const teacherUser = {
      id: `teacher-dlv-${ts}`,
      name: 'Prof. Ananya Mentor',
      email: `ananya.${ts}@example.com`,
      role: 'teacher',
      hourlyRate: 500,
      upiId: 'ananya@okaxis'
    };

    const bothUser = {
      id: `both-dlv-${ts}`,
      name: 'Dr. Siddharth Both',
      email: `siddharth.${ts}@example.com`,
      role: 'both',
      hourlyRate: 600,
      upiId: 'siddharth@okaxis'
    };

    const wrongUser = {
      id: `wrong-dlv-${ts}`,
      name: 'Vikram Outsider',
      email: `vikram.${ts}@example.com`,
      role: 'teacher',
      hourlyRate: 400,
      upiId: 'vikram@okaxis'
    };

    inMemoryUsers.push(studentUser as any, teacherUser as any, bothUser as any, wrongUser as any);

    const studentToken = createToken({ id: studentUser.id, email: studentUser.email, role: studentUser.role });
    const teacherToken = createToken({ id: teacherUser.id, email: teacherUser.email, role: teacherUser.role });
    const bothToken = createToken({ id: bothUser.id, email: bothUser.email, role: bothUser.role });
    const wrongToken = createToken({ id: wrongUser.id, email: wrongUser.email, role: wrongUser.role });

    // =========================================================================
    // TEST 1: Teacher Online receives 'session-request-created' event over socket
    // =========================================================================
    console.log('--- TEST 1: Online Teacher receives live socket approval request ---');
    const teacherSocket = await connectClient(teacherToken);
    const wrongSocket = await connectClient(wrongToken);

    let teacherReceivedEvent: any = null;
    let wrongReceivedEvent: any = null;

    teacherSocket.on('session-request-created', (data) => {
      teacherReceivedEvent = data;
    });

    wrongSocket.on('session-request-created', (data) => {
      wrongReceivedEvent = data;
    });

    // Student books session with teacherUser
    const bookRes1 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        teacherId: teacherUser.id,
        title: 'Distributed Systems Deep Dive',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        durationMin: 60,
        maxCapacity: 1
      })
    });

    assert.strictEqual(bookRes1.status, 201, 'Booking creation should succeed with 201');
    const session1 = await bookRes1.json();

    // Wait for socket propagation
    await new Promise((r) => setTimeout(r, 600));

    assert.ok(teacherReceivedEvent, 'Teacher socket must receive session-request-created event');
    assert.strictEqual(teacherReceivedEvent.id, session1.id, 'Received session ID must match created session');
    assert.strictEqual(teacherReceivedEvent.teacherId, teacherUser.id, 'Session teacherId must match teacher');
    assert.strictEqual(wrongReceivedEvent, null, 'Unrelated wrong user MUST NOT receive the approval request');
    console.log('✅ Test 1 Passed: Online teacher received live approval request; wrong user was isolated.');

    // =========================================================================
    // TEST 2: Teacher Offline sees request on next login / REST fetch
    // =========================================================================
    console.log('\n--- TEST 2: Offline Teacher sees pending request on next login ---');
    // Disconnect teacher socket to simulate being offline
    teacherSocket.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    // Student books another session while teacher is completely offline
    const bookRes2 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        teacherId: teacherUser.id,
        title: 'Microservices & Kafka Architecture',
        scheduledAt: new Date(Date.now() + 172800000).toISOString(),
        durationMin: 60,
        maxCapacity: 1
      })
    });

    assert.strictEqual(bookRes2.status, 201, 'Booking 2 should succeed while teacher is offline');
    const session2 = await bookRes2.json();

    // Teacher logs in / connects over REST
    const pendingCountRes = await fetch(`${baseUrl}/api/sessions/pending-count`, {
      headers: { 'Authorization': `Bearer ${teacherToken}` }
    });
    assert.strictEqual(pendingCountRes.status, 200, 'Pending count endpoint should return HTTP 200');
    const pendingData = await pendingCountRes.json();

    assert.strictEqual(pendingData.count, 2, 'Teacher must see both pending requests after logging in');
    const foundSession2 = pendingData.sessions.find((s: any) => s.id === session2.id);
    assert.ok(foundSession2, 'Offline-created session must be present in pending list');
    assert.strictEqual(foundSession2.status, 'pending');

    // Also check standard /api/sessions list for teacher
    const sessionsListRes = await fetch(`${baseUrl}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${teacherToken}` }
    });
    const sessionsList = await sessionsListRes.json();
    const teacherPendingInList = sessionsList.filter((s: any) => s.teacherId === teacherUser.id && s.status === 'pending');
    assert.strictEqual(teacherPendingInList.length, 2, 'All pending sessions must be returned in teacher sessions list');
    console.log('✅ Test 2 Passed: Offline teacher successfully retrieved all pending requests upon login.');

    // =========================================================================
    // TEST 3: "Both" role user in student view sees pending requests
    // =========================================================================
    console.log('\n--- TEST 3: User with role "both" in student view sees requests ---');
    // Student books a session targeting the "both" user as mentor
    const bookResBoth = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        teacherId: bothUser.id,
        title: 'Compiler Design & ASTs',
        scheduledAt: new Date(Date.now() + 259200000).toISOString(),
        durationMin: 60,
        maxCapacity: 1
      })
    });

    assert.strictEqual(bookResBoth.status, 201, 'Booking with bothUser mentor should succeed');
    const sessionBoth = await bookResBoth.json();

    // When "both" user queries pending-count (even while browsing in student view)
    const bothPendingRes = await fetch(`${baseUrl}/api/sessions/pending-count`, {
      headers: { 'Authorization': `Bearer ${bothToken}` }
    });
    assert.strictEqual(bothPendingRes.status, 200);
    const bothPendingData = await bothPendingRes.json();

    assert.strictEqual(bothPendingData.count, 1, 'Both user must see 1 pending request waiting for their mentor approval');
    assert.strictEqual(bothPendingData.sessions[0].id, sessionBoth.id);
    assert.strictEqual(getSessionApproverId(bothPendingData.sessions[0]), bothUser.id);
    console.log('✅ Test 3 Passed: "Both" role user accurately receives pending mentor requests in student view.');

    // =========================================================================
    // TEST 4: Wrong user cannot see or access target mentor requests
    // =========================================================================
    console.log('\n--- TEST 4: Wrong user cannot access target mentor requests ---');
    const wrongPendingRes = await fetch(`${baseUrl}/api/sessions/pending-count`, {
      headers: { 'Authorization': `Bearer ${wrongToken}` }
    });
    assert.strictEqual(wrongPendingRes.status, 200);
    const wrongPendingData = await wrongPendingRes.json();
    assert.strictEqual(wrongPendingData.count, 0, 'Wrong user must have 0 pending approval requests');
    assert.strictEqual(wrongPendingData.sessions.length, 0);

    // Student themselves must also have 0 pending approval requests for themselves
    const studentPendingRes = await fetch(`${baseUrl}/api/sessions/pending-count`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    const studentPendingData = await studentPendingRes.json();
    assert.strictEqual(studentPendingData.count, 0, 'Student is not approver, so pending count is 0');
    console.log('✅ Test 4 Passed: Wrong user and student cannot access target mentor requests.');

    // =========================================================================
    // TEST 5: Token handshake validation and guest upgrade via register-user-sync
    // =========================================================================
    console.log('\n--- TEST 5: Stale/invalid token rejection and guest upgrade ---');
    // 5.1 Invalid token should be rejected at socket handshake
    let rejectedHandshake = false;
    try {
      await connectClient('invalid-token-xyz-123');
    } catch (err: any) {
      rejectedHandshake = true;
      assert.ok(err.message.includes('Authentication error'), 'Must report authentication error for invalid token');
    }
    assert.strictEqual(rejectedHandshake, true, 'Handshake with invalid token must be rejected');

    // 5.2 Guest connection can upgrade room via register-user-sync
    const guestSocket = await connectClient(); // No token -> guest
    let guestUpgraded = false;

    // Emit register-user-sync to upgrade guest socket to teacherUser
    guestSocket.emit('register-user-sync', { id: teacherUser.id, role: 'teacher' });
    await new Promise((r) => setTimeout(r, 400));

    // When student books another session, guestSocket should now receive it because it joined user:teacherUser.id
    guestSocket.on('session-request-created', (data) => {
      if (data && data.teacherId === teacherUser.id) {
        guestUpgraded = true;
      }
    });

    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        teacherId: teacherUser.id,
        title: 'Cloud Native DevOps',
        scheduledAt: new Date(Date.now() + 345600000).toISOString(),
        durationMin: 60,
        maxCapacity: 1
      })
    });

    await new Promise((r) => setTimeout(r, 600));
    assert.strictEqual(guestUpgraded, true, 'Upgraded guest socket must successfully receive session-request-created');
    console.log('✅ Test 5 Passed: Invalid tokens rejected; guest socket successfully upgraded.');

    console.log('\n====================================================');
    console.log('🎉 ALL 5 BOOKING APPROVAL DELIVERY TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');

  } finally {
    for (const s of activeSockets) {
      try { s.disconnect(); } catch {}
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runBookingApprovalDeliveryTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
