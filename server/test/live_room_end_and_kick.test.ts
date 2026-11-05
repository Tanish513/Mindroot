import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';

process.env.NODE_ENV = 'test';
process.env.HOST_ABSENCE_TIMEOUT_MS = '600'; // 600ms short timeout for deterministic test

import {
  app,
  io,
  inMemorySessions,
  liveRoomStates,
  liveRoomRegistry,
  syncWithDatabasePromise,
  HOST_ABSENCE_TIMEOUT_MS
} from '../src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

function createToken(payload: { id: string; email: string; role: string; tokenVersion?: number }) {
  return jwt.sign(
    { userId: payload.id, id: payload.id, email: payload.email, role: payload.role, tokenVersion: payload.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n====================================================');
  console.log('🧪 RUNNING P5.21 (END SESSION) & P5.20 (KICK STUDENT) TESTS');
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

  const teacherId = 'teacher-p5-test-1';
  const studentId = 'student-p5-test-1';
  const outsiderId = 'student-p5-test-2';

  const teacherToken = createToken({ id: teacherId, email: 'teacher@test.com', role: 'teacher' });
  const studentToken = createToken({ id: studentId, email: 'student@test.com', role: 'student' });
  const outsiderToken = createToken({ id: outsiderId, email: 'outsider@test.com', role: 'student' });

  const connectClient = async (token: string): Promise<ClientSocketType> => {
    const s = ClientSocket(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true
    });
    activeSockets.push(s);
    await new Promise<void>((resolve, reject) => {
      s.on('connect', () => resolve());
      s.on('connect_error', reject);
    });
    return s;
  };

  const emitJoinAndWait = (socket: ClientSocketType, roomId: string) => {
    return new Promise<{ status: 'accepted' | 'rejected'; error?: any }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for join on ${roomId}`));
      }, 3000);

      const onAccepted = () => {
        cleanup();
        resolve({ status: 'accepted' });
      };
      const onRejected = (err: any) => {
        cleanup();
        resolve({ status: 'rejected', error: err });
      };
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('room-participants', onAccepted);
        socket.off('room-error', onRejected);
      };

      socket.on('room-participants', onAccepted);
      socket.on('room-error', onRejected);
      socket.emit('join-room', { roomId, senderId: (socket as any).id, userName: 'TestUser' });
    });
  };

  try {
    const teacherSocket = await connectClient(teacherToken);
    const studentSocket = await connectClient(studentToken);
    const outsiderSocket = await connectClient(outsiderToken);

    // Setup active session
    const now = Date.now();
    const testSessionId = 'sess-p5-test-live-1';
    const testSession = {
      id: testSessionId,
      teacherId,
      studentId,
      title: 'Full Stack Node Architecture',
      scheduledAt: new Date(now - 5 * 60 * 1000).toISOString(), // 5 mins ago
      durationMin: 60,
      status: 'confirmed'
    };
    inMemorySessions.push(testSession);

    console.log('1. Verifying both Teacher and Student can join...');
    const tJoin = await emitJoinAndWait(teacherSocket, testSessionId);
    assert.strictEqual(tJoin.status, 'accepted', 'Teacher should join successfully');

    const sJoin = await emitJoinAndWait(studentSocket, testSessionId);
    assert.strictEqual(sJoin.status, 'accepted', 'Student should join successfully');
    console.log('  ✅ Both participants joined.');

    // -----------------------------------------------------------------
    // TEST 2: Security - Student cannot forge end-session-room (P5.21)
    // -----------------------------------------------------------------
    console.log('\n2. Testing security: Student attempting to forge end-session-room...');
    const studentEndError = await new Promise<any>((resolve) => {
      studentSocket.once('room-error', (err) => resolve(err));
      studentSocket.emit('end-session-room', { roomId: testSessionId });
    });
    assert.strictEqual(studentEndError.code, 'FORBIDDEN_END_SESSION', 'Server must reject non-host end-session with FORBIDDEN_END_SESSION');
    console.log('  ✅ Forged end-session-room correctly rejected by server.');

    // -----------------------------------------------------------------
    // TEST 3: Security - Student cannot forge kick-student (P5.20)
    // -----------------------------------------------------------------
    console.log('\n3. Testing security: Student attempting to forge kick-student...');
    const studentKickError = await new Promise<any>((resolve) => {
      studentSocket.once('room-error', (err) => resolve(err));
      studentSocket.emit('kick-student', { roomId: testSessionId, targetUserId: teacherId });
    });
    assert.strictEqual(studentKickError.code, 'FORBIDDEN_KICK', 'Server must reject non-host kick with FORBIDDEN_KICK');
    console.log('  ✅ Forged kick-student correctly rejected by server.');

    // -----------------------------------------------------------------
    // TEST 4: Teacher removes student from class (P5.20)
    // -----------------------------------------------------------------
    console.log('\n4. Teacher removing student from class...');
    const kickPromise = new Promise<{ reason: string }>((resolve) => {
      studentSocket.once('kicked-from-room', (data) => resolve(data));
    });
    teacherSocket.emit('kick-student', { roomId: testSessionId, targetUserId: studentId });
    const kickResult = await kickPromise;
    assert.ok(kickResult.reason.includes('removed'), 'Student must receive kicked-from-room event');
    console.log('  ✅ Student received kicked-from-room event.');

    // -----------------------------------------------------------------
    // TEST 5: D-KICK-1 - Removed student cannot rejoin session
    // -----------------------------------------------------------------
    console.log('\n5. Verifying D-KICK-1: Removed student attempting to rejoin...');
    const sRejoin = await emitJoinAndWait(studentSocket, testSessionId);
    assert.strictEqual(sRejoin.status, 'rejected', 'Removed student join must be rejected');
    assert.strictEqual(sRejoin.error?.code, 'BANNED_FROM_SESSION', 'Error code must be BANNED_FROM_SESSION');
    console.log('  ✅ Rejoin prevented with BANNED_FROM_SESSION.');

    // -----------------------------------------------------------------
    // TEST 6: Teacher unbans student (Allow back)
    // -----------------------------------------------------------------
    console.log('\n6. Teacher unbans student (Allow back)...');
    const unbanPromise = new Promise<void>((resolve) => {
      teacherSocket.once('unban-student-success', () => resolve());
    });
    teacherSocket.emit('unban-student', { roomId: testSessionId, targetUserId: studentId });
    await unbanPromise;

    const sRejoinAllowed = await emitJoinAndWait(studentSocket, testSessionId);
    assert.strictEqual(sRejoinAllowed.status, 'accepted', 'Unbanned student can rejoin');
    console.log('  ✅ Unbanned student successfully rejoined room.');

    // -----------------------------------------------------------------
    // TEST 7: Teacher ends session for everyone (P5.21)
    // -----------------------------------------------------------------
    console.log('\n7. Teacher ends session for everyone...');
    const studentEndedPromise = new Promise<any>((resolve) => {
      studentSocket.once('session-ended-by-host', (data) => resolve(data));
    });
    const teacherEndedPromise = new Promise<any>((resolve) => {
      teacherSocket.once('session-ended-by-host', (data) => resolve(data));
    });

    teacherSocket.emit('end-session-room', { roomId: testSessionId });
    const sEnded = await studentEndedPromise;
    const tEnded = await teacherEndedPromise;

    assert.strictEqual(sEnded.roomId, testSessionId);
    assert.strictEqual(sEnded.endedBy, teacherId);
    assert.strictEqual(testSession.status, 'completed', 'Session status must be completed');
    console.log('  ✅ Both participants received session-ended-by-host, session marked completed.');

    // -----------------------------------------------------------------
    // TEST 8: Rejoining completed session fails
    // -----------------------------------------------------------------
    console.log('\n8. Rejoining completed session fails...');
    const sCompletedJoin = await emitJoinAndWait(studentSocket, testSessionId);
    assert.strictEqual(sCompletedJoin.status, 'rejected');
    assert.strictEqual(sCompletedJoin.error?.code, 'SESSION_COMPLETED');
    console.log('  ✅ Rejoining completed session blocked.');

    // -----------------------------------------------------------------
    // TEST 9: D-END-1 - Host absence timeout ends room
    // -----------------------------------------------------------------
    console.log('\n9. Testing D-END-1: Host disconnect notices & absence timeout...');
    const absenceSessionId = 'sess-p5-test-absence-1';
    const absenceSession = {
      id: absenceSessionId,
      teacherId,
      studentId: outsiderId,
      title: 'Absence Timeout Test Session',
      scheduledAt: new Date(now - 2 * 60 * 1000).toISOString(),
      durationMin: 60,
      status: 'confirmed'
    };
    inMemorySessions.push(absenceSession);

    // Reconnect teacher and outsider for new session
    const teacher2 = await connectClient(teacherToken);
    const student2 = await connectClient(outsiderToken);

    await emitJoinAndWait(teacher2, absenceSessionId);
    await emitJoinAndWait(student2, absenceSessionId);

    // Host disconnects (tab close, network drop)
    const hostDisconnectNoticePromise = new Promise<any>((resolve) => {
      student2.once('host-disconnected-notice', (d) => resolve(d));
    });
    const sessionEndedByTimeoutPromise = new Promise<any>((resolve) => {
      student2.once('session-ended-by-host', (d) => resolve(d));
    });

    teacher2.disconnect();

    const notice = await hostDisconnectNoticePromise;
    assert.ok(notice.message.includes('Instructor disconnected'), 'Student receives host-disconnected-notice');
    console.log('  ✅ Student received host-disconnected-notice without room closing immediately.');

    // Wait for the absence timeout to expire (configured to 600ms in test)
    const timeoutEvent = await sessionEndedByTimeoutPromise;
    assert.strictEqual(timeoutEvent.reason, 'host_absence_timeout');
    assert.strictEqual(absenceSession.status, 'completed', 'Absence session status must be completed');
    console.log('  ✅ Host absence timer expired and ended room for everyone.');

    console.log('\n🎉 ALL P5.21 & P5.20 INTEGRATION TESTS PASSED 100%!\n');
  } finally {
    activeSockets.forEach(s => s.disconnect());
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
