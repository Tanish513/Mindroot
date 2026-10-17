import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';

process.env.NODE_ENV = 'test';

import {
  app,
  io,
  inMemorySessions,
  syncWithDatabasePromise,
  prisma,
  getSessionJoinWindow,
  shouldSendJoinReminder,
  JOIN_WINDOW_MINUTES,
  GRACE_MINUTES
} from '../src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

function createToken(payload: { id: string; email: string; role: string; tokenVersion?: number }) {
  return jwt.sign(
    { userId: payload.id, id: payload.id, email: payload.email, role: payload.role, tokenVersion: payload.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runLiveRoomAccessTests() {
  console.log('\n====================================================');
  console.log('🧪 RUNNING LIVE ROOM ACCESS & JOIN WINDOW INTEGRATION TESTS');
  console.log('====================================================\n');

  if (syncWithDatabasePromise) {
    await syncWithDatabasePromise;
  }

  // =========================================================================
  // UNIT TESTS: getSessionJoinWindow and shouldSendJoinReminder (Item 19)
  // =========================================================================
  console.log('--- PART 1: Unit Testing Shared Window Helper & Reminders ---');

  // Test 1.1: Null / missing / invalid date
  assert.strictEqual(getSessionJoinWindow(null), null, 'null session must return null');
  assert.strictEqual(getSessionJoinWindow({}), null, 'session without date must return null');
  assert.strictEqual(getSessionJoinWindow({ scheduledAt: 'not-a-valid-date' }), null, 'invalid date must return null');

  // Test 1.2: Window boundary calculations
  const baseTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
  const dummySession = {
    id: 'unit-test-session',
    status: 'confirmed',
    scheduledAt: new Date(baseTime).toISOString(),
    durationMin: 60
  };

  // When now is 30 mins before start (early for student, ok for teacher)
  const earlyNow = baseTime - 30 * 60 * 1000;
  const earlyWindow = getSessionJoinWindow(dummySession, earlyNow);
  assert(earlyWindow !== null, 'earlyWindow must not be null');
  assert.strictEqual(earlyWindow.isEarlyForStudent, true, '30m before must be early for student');
  assert.strictEqual(earlyWindow.canStudentJoin, false, 'Student cannot join 30m before');
  assert.strictEqual(earlyWindow.canTeacherJoin, true, 'Teacher can join early');
  assert.strictEqual(earlyWindow.hasEnded, false, 'Session has not ended');

  // When now is 5 mins before start (inside default 10m window)
  const insideWindowNow = baseTime - 5 * 60 * 1000;
  const insideWindow = getSessionJoinWindow(dummySession, insideWindowNow);
  assert(insideWindow !== null, 'insideWindow must not be null');
  assert.strictEqual(insideWindow.isEarlyForStudent, false, '5m before is inside window');
  assert.strictEqual(insideWindow.canStudentJoin, true, 'Student can join inside window');
  assert.strictEqual(insideWindow.canTeacherJoin, true, 'Teacher can join inside window');
  assert.strictEqual(insideWindow.hasEnded, false, 'Session has not ended');

  // When now is halfway through the session
  const duringSessionNow = baseTime + 30 * 60 * 1000;
  const duringWindow = getSessionJoinWindow(dummySession, duringSessionNow);
  assert(duringWindow !== null);
  assert.strictEqual(duringWindow.canStudentJoin, true, 'Student can join during session');
  assert.strictEqual(duringWindow.canTeacherJoin, true, 'Teacher can join during session');
  assert.strictEqual(duringWindow.hasEnded, false);

  // When now is 10 mins after scheduled end (inside 15m grace period)
  const graceNow = baseTime + 60 * 60 * 1000 + 10 * 60 * 1000;
  const graceWindow = getSessionJoinWindow(dummySession, graceNow);
  assert(graceWindow !== null);
  assert.strictEqual(graceWindow.hasEnded, false, 'Session within grace period has not ended');
  assert.strictEqual(graceWindow.canStudentJoin, true, 'Can join within grace period');

  // When now is past scheduled end + grace (e.g. 20m after end)
  const endedNow = baseTime + 60 * 60 * 1000 + 20 * 60 * 1000;
  const endedWindow = getSessionJoinWindow(dummySession, endedNow);
  assert(endedWindow !== null);
  assert.strictEqual(endedWindow.hasEnded, true, 'Session past grace period has ended');
  assert.strictEqual(endedWindow.canStudentJoin, false, 'Student cannot join ended session');
  assert.strictEqual(endedWindow.canTeacherJoin, false, 'Teacher cannot join ended session');

  // Test 1.3: shouldSendJoinReminder agreement with getSessionJoinWindow
  assert.strictEqual(shouldSendJoinReminder(null), false, 'null session should not send reminder');
  assert.strictEqual(shouldSendJoinReminder({ status: 'pending', scheduledAt: new Date(baseTime).toISOString() }), false, 'pending session should not send reminder');
  assert.strictEqual(shouldSendJoinReminder({ status: 'cancelled', scheduledAt: new Date(baseTime).toISOString() }), false, 'cancelled session should not send reminder');
  assert.strictEqual(shouldSendJoinReminder({ status: 'confirmed', scheduledAt: new Date(baseTime).toISOString(), reminderEmailSent: true }), false, 'already sent reminder should not send again');

  // Session has ended: both window and reminder must agree (no reminder for ended session)
  assert.strictEqual(shouldSendJoinReminder(dummySession, endedNow), false, 'Ended session should never send reminder');

  // Session 20 mins before start: should send reminder
  const reminderNow = baseTime - 20 * 60 * 1000;
  assert.strictEqual(shouldSendJoinReminder(dummySession, reminderNow, 30 * 60 * 1000), true, 'Confirmed session 20m before must trigger reminder');

  console.log('✅ Unit tests for getSessionJoinWindow and shouldSendJoinReminder PASSED');

  // =========================================================================
  // INTEGRATION TESTS: Real Socket.io join-room Rejections & Acceptances
  // =========================================================================
  console.log('\n--- PART 2: Socket.io join-room Authorization & Timing Tests ---');

  const serverInstance = http.createServer(app);
  io.attach(serverInstance);

  await new Promise<void>((resolve) => serverInstance.listen(0, resolve));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const activeSockets: ClientSocketType[] = [];

  const teacherId = 'teacher-access-1';
  const studentId = 'student-access-1';
  const outsiderId = 'outsider-access-1';

  const teacherToken = createToken({ id: teacherId, email: 'teacher@access.com', role: 'teacher' });
  const studentToken = createToken({ id: studentId, email: 'student@access.com', role: 'student' });
  const outsiderToken = createToken({ id: outsiderId, email: 'outsider@access.com', role: 'student' });

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

  try {
    const teacherSocket = await connectClient(teacherToken);
    const studentSocket = await connectClient(studentToken);
    const outsiderSocket = await connectClient(outsiderToken);

    const emitJoinAndWait = (
      socket: ClientSocketType,
      roomId: string,
      options: { timeoutMs?: number } = {}
    ): Promise<{ status: 'accepted'; data: any } | { status: 'rejected'; error: any }> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.off('room-participants', onParticipants);
          socket.off('room-error', onRoomError);
          reject(new Error(`Timed out waiting for join-room response on room ${roomId}`));
        }, options.timeoutMs || 4000);

        const onParticipants = (data: any) => {
          clearTimeout(timeout);
          socket.off('room-participants', onParticipants);
          socket.off('room-error', onRoomError);
          resolve({ status: 'accepted', data });
        };

        const onRoomError = (error: any) => {
          clearTimeout(timeout);
          socket.off('room-participants', onParticipants);
          socket.off('room-error', onRoomError);
          resolve({ status: 'rejected', error });
        };

        socket.on('room-participants', onParticipants);
        socket.on('room-error', onRoomError);
        socket.emit('join-room', { roomId, userId: (socket as any).userId });
      });
    };

    // -----------------------------------------------------------------------
    // ITEM 16: join-room rejections
    // -----------------------------------------------------------------------

    // 16.a Nonexistent session -> SESSION_NOT_FOUND
    const nonExistentRes = await emitJoinAndWait(studentSocket, 'session-does-not-exist-999');
    assert.strictEqual(nonExistentRes.status, 'rejected');
    assert.strictEqual((nonExistentRes as any).error.code, 'SESSION_NOT_FOUND');
    console.log('✅ 16.a Rejection: Nonexistent session returns SESSION_NOT_FOUND');

    // Setup sessions in memory for rejection test cases
    const testNow = Date.now();
    const confirmedEarlySession = {
      id: 'session-test-early',
      teacherId,
      studentId,
      status: 'confirmed',
      scheduledAt: new Date(testNow + 40 * 60 * 1000).toISOString(), // 40m in future
      durationMin: 60
    };
    const pendingSession = {
      id: 'session-test-pending',
      teacherId,
      studentId,
      status: 'pending',
      scheduledAt: new Date(testNow + 5 * 60 * 1000).toISOString(),
      durationMin: 60
    };
    const declinedSession = {
      id: 'session-test-declined',
      teacherId,
      studentId,
      status: 'declined',
      scheduledAt: new Date(testNow + 5 * 60 * 1000).toISOString(),
      durationMin: 60
    };
    const cancelledSession = {
      id: 'session-test-cancelled',
      teacherId,
      studentId,
      status: 'cancelled',
      scheduledAt: new Date(testNow + 5 * 60 * 1000).toISOString(),
      durationMin: 60
    };
    const completedSession = {
      id: 'session-test-completed',
      teacherId,
      studentId,
      status: 'completed',
      scheduledAt: new Date(testNow - 120 * 60 * 1000).toISOString(),
      durationMin: 60
    };
    const endedSession = {
      id: 'session-test-ended',
      teacherId,
      studentId,
      status: 'confirmed',
      scheduledAt: new Date(testNow - 100 * 60 * 1000).toISOString(), // 100m ago, dur 60m + 15m grace = ended 25m ago
      durationMin: 60
    };

    inMemorySessions.push(
      confirmedEarlySession,
      pendingSession,
      declinedSession,
      cancelledSession,
      completedSession,
      endedSession
    );

    // 16.b Non-participant outsider -> NOT_PARTICIPANT
    const outsiderRes = await emitJoinAndWait(outsiderSocket, confirmedEarlySession.id);
    assert.strictEqual(outsiderRes.status, 'rejected');
    assert.strictEqual((outsiderRes as any).error.code, 'NOT_PARTICIPANT');
    console.log('✅ 16.b Rejection: Non-participant returns NOT_PARTICIPANT');

    // 16.c Pending session -> SESSION_NOT_CONFIRMED
    const pendingRes = await emitJoinAndWait(studentSocket, pendingSession.id);
    assert.strictEqual(pendingRes.status, 'rejected');
    assert.strictEqual((pendingRes as any).error.code, 'SESSION_NOT_CONFIRMED');
    console.log('✅ 16.c Rejection: Pending session returns SESSION_NOT_CONFIRMED');

    // 16.d Declined session -> SESSION_NOT_CONFIRMED
    const declinedRes = await emitJoinAndWait(studentSocket, declinedSession.id);
    assert.strictEqual(declinedRes.status, 'rejected');
    assert.strictEqual((declinedRes as any).error.code, 'SESSION_NOT_CONFIRMED');
    console.log('✅ 16.d Rejection: Declined session returns SESSION_NOT_CONFIRMED');

    // 16.e Cancelled session -> SESSION_NOT_CONFIRMED
    const cancelledRes = await emitJoinAndWait(studentSocket, cancelledSession.id);
    assert.strictEqual(cancelledRes.status, 'rejected');
    assert.strictEqual((cancelledRes as any).error.code, 'SESSION_NOT_CONFIRMED');
    console.log('✅ 16.e Rejection: Cancelled session returns SESSION_NOT_CONFIRMED');

    // 16.f Completed session -> SESSION_NOT_CONFIRMED
    const completedRes = await emitJoinAndWait(studentSocket, completedSession.id);
    assert.strictEqual(completedRes.status, 'rejected');
    assert.strictEqual((completedRes as any).error.code, 'SESSION_NOT_CONFIRMED');
    console.log('✅ 16.f Rejection: Completed session returns SESSION_NOT_CONFIRMED');

    // 16.g Student too early (40m before start) -> TOO_EARLY with startsAt
    const tooEarlyRes = await emitJoinAndWait(studentSocket, confirmedEarlySession.id);
    assert.strictEqual(tooEarlyRes.status, 'rejected');
    assert.strictEqual((tooEarlyRes as any).error.code, 'TOO_EARLY');
    assert.strictEqual((tooEarlyRes as any).error.startsAt, confirmedEarlySession.scheduledAt);
    console.log('✅ 16.g Rejection: Student too early returns TOO_EARLY with startsAt');

    // 16.h Session after end + grace -> SESSION_ENDED
    const endedRes = await emitJoinAndWait(studentSocket, endedSession.id);
    assert.strictEqual(endedRes.status, 'rejected');
    assert.strictEqual((endedRes as any).error.code, 'SESSION_ENDED');
    console.log('✅ 16.h Rejection: Session after end + grace returns SESSION_ENDED');

    // -----------------------------------------------------------------------
    // ITEM 17: join-room acceptances
    // -----------------------------------------------------------------------

    // Setup active joinable session (5 mins in future, within 10m window)
    const joinableSession = {
      id: 'session-test-joinable',
      teacherId,
      studentId,
      status: 'confirmed',
      scheduledAt: new Date(testNow + 5 * 60 * 1000).toISOString(),
      durationMin: 60
    };
    inMemorySessions.push(joinableSession);

    // 17.a Student inside window -> Accepted
    const studentAccepted = await emitJoinAndWait(studentSocket, joinableSession.id);
    assert.strictEqual(studentAccepted.status, 'accepted');
    console.log('✅ 17.a Acceptance: Student inside join window successfully joins');

    // 17.b Teacher before window (on 40m early session) -> Accepted (teacher early limit exemption)
    const teacherEarlyAccepted = await emitJoinAndWait(teacherSocket, confirmedEarlySession.id);
    assert.strictEqual(teacherEarlyAccepted.status, 'accepted');
    console.log('✅ 17.b Acceptance: Teacher before join window successfully joins (exempt)');

    // 17.c Teacher inside window -> Accepted
    const teacherInsideAccepted = await emitJoinAndWait(teacherSocket, joinableSession.id);
    assert.strictEqual(teacherInsideAccepted.status, 'accepted');
    console.log('✅ 17.c Acceptance: Teacher inside join window successfully joins');

    // -----------------------------------------------------------------------
    // ITEM 18: Practice Room demoMode gating
    // -----------------------------------------------------------------------

    // 18.a In non-demo mode (DEMO_MODE=false) -> DEMO_ONLY rejection
    process.env.DEMO_MODE = 'false';
    const practiceNonDemo = await emitJoinAndWait(studentSocket, 'practice');
    assert.strictEqual(practiceNonDemo.status, 'rejected');
    assert.strictEqual((practiceNonDemo as any).error.code, 'DEMO_ONLY');
    console.log('✅ 18.a Practice Room: In non-demo mode, rejected with DEMO_ONLY');

    // 18.b In demo mode (DEMO_MODE=true) -> Accepted, labeled Practice Room, no session mutation
    process.env.DEMO_MODE = 'true';
    const sessionsCountBefore = inMemorySessions.length;
    const practiceDemo = await emitJoinAndWait(studentSocket, 'practice');
    assert.strictEqual(practiceDemo.status, 'accepted');
    assert.strictEqual((practiceDemo as any).data.isPractice, true);
    assert.strictEqual((practiceDemo as any).data.roomLabel, 'Practice Room');
    assert.strictEqual(inMemorySessions.length, sessionsCountBefore, 'Practice room must not mutate in-memory sessions');
    console.log('✅ 18.b Practice Room: In demo mode, accepted with isPractice=true, zero session mutation');

    console.log('\n====================================================');
    console.log('🎉 ALL LIVE ROOM ACCESS & JOIN WINDOW TESTS PASSED (100%)');
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

runLiveRoomAccessTests().catch((err) => {
  console.error('\n❌ LIVE ROOM ACCESS TEST FAILED:', err);
  process.exitCode = 1;
});
