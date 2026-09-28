import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';

import {
  app,
  prisma,
  inMemoryUsers,
  inMemorySessions,
  syncWithDatabasePromise
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
  console.log('====================================================');
  console.log('🧪 Starting Cross-User Auth & State Machine Tests');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  const userAId = 'user-a-' + Date.now();
  const userBId = 'user-b-' + Date.now();
  const teacherId = 'teacher-' + Date.now();
  const sessionId = 'session-' + Date.now();

  const userA = {
    id: userAId,
    name: 'User Alpha',
    email: `${userAId}@test.com`,
    role: 'student',
    tokenBalance: 10,
    tokenVersion: 0,
    version: 0
  };

  const userB = {
    id: userBId,
    name: 'User Beta',
    email: `${userBId}@test.com`,
    role: 'student',
    tokenBalance: 10,
    tokenVersion: 0,
    version: 0
  };

  const teacher = {
    id: teacherId,
    name: 'Teacher Charlie',
    email: `${teacherId}@test.com`,
    role: 'teacher',
    tokenBalance: 0,
    tokenVersion: 0,
    version: 0
  };

  const testSession = {
    id: sessionId,
    title: 'State Machine Testing Session',
    teacherId: teacherId,
    studentId: userAId,
    status: 'confirmed',
    paymentStatus: 'paid',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    durationMin: 60
  };

  inMemoryUsers.push(userA);
  inMemoryUsers.push(userB);
  inMemoryUsers.push(teacher);
  inMemorySessions.push(testSession);

  if (prisma && process.env.DATABASE_URL) {
    try {
      await prisma.user.createMany({
        data: [
          { id: userA.id, name: userA.name, email: userA.email, role: userA.role, tokenBalance: 10, tokenVersion: 0 },
          { id: userB.id, name: userB.name, email: userB.email, role: userB.role, tokenBalance: 10, tokenVersion: 0 },
          { id: teacher.id, name: teacher.name, email: teacher.email, role: teacher.role, tokenBalance: 0, tokenVersion: 0 }
        ]
      });
      await prisma.session.create({
        data: {
          id: testSession.id,
          title: testSession.title,
          teacherId: testSession.teacherId,
          studentId: testSession.studentId,
          status: 'confirmed',
          paymentStatus: 'paid',
          scheduledAt: new Date(testSession.scheduledAt),
          durationMin: 60
        }
      });
    } catch (e: any) {
      console.warn('Prisma seed warning (continuing with in-memory):', e.message);
    }
  }

  const tokenA = createToken(userA);
  const tokenB = createToken(userB);
  const tokenTeacher = createToken(teacher);

  try {
    // -------------------------------------------------------------
    // TEST 1: User A attempts to edit User B (Must return HTTP 403)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Cross-User Resource Protection ---');
    const crossEditRes = await fetch(`${baseUrl}/api/users/${userBId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ bio: 'Hacked by Alpha' })
    });
    console.log(`Cross-user PATCH status: ${crossEditRes.status}`);
    assert.strictEqual(crossEditRes.status, 403, 'User A must not be allowed to modify User B!');
    console.log('✅ TEST 1 PASSED: Cross-user modification rejected with 403!');

    // -------------------------------------------------------------
    // TEST 2: User A attempts to elevate privileged fields on self
    // (role, tokenBalance, streak) -> Must return HTTP 403
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Privilege Escalation Prevention on PATCH /api/users/:id ---');
    const escalateRes = await fetch(`${baseUrl}/api/users/${userAId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ role: 'admin', tokenBalance: 999999 })
    });
    console.log(`Escalation PATCH status: ${escalateRes.status}`);
    assert.strictEqual(escalateRes.status, 403, 'Non-admin user cannot modify privileged fields!');
    const escalateData = await escalateRes.json();
    console.log(`Escalation response message: "${escalateData.error}"`);
    console.log('✅ TEST 2 PASSED: Privilege escalation rejected with 403!');

    // -------------------------------------------------------------
    // TEST 3: Student attempts to mark session completed
    // (Only teacher or admin can mark completed) -> Must return 403
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Session Completion Authorization ---');
    const studentCompleteRes = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    console.log(`Student completing session status: ${studentCompleteRes.status}`);
    assert.strictEqual(studentCompleteRes.status, 403, 'Student cannot mark a session completed!');
    console.log('✅ TEST 3 PASSED: Student completion rejected with 403!');

    // -------------------------------------------------------------
    // TEST 4: Teacher completes session, then attempts invalid transition
    // ('completed' -> 'confirmed') -> Must return 400
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Session State Machine Transition Guard ---');
    const teacherCompleteRes = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenTeacher}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    console.log(`Teacher marking completed status: ${teacherCompleteRes.status}`);
    assert.strictEqual(teacherCompleteRes.status, 200, 'Teacher must be able to mark session completed');

    const invalidTransitionRes = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenTeacher}`
      },
      body: JSON.stringify({ status: 'confirmed' })
    });
    console.log(`Invalid transition status: ${invalidTransitionRes.status}`);
    assert.strictEqual(invalidTransitionRes.status, 400, 'Reverting a completed session to confirmed must return 400!');
    const invalidData = await invalidTransitionRes.json();
    console.log(`Invalid transition message: "${invalidData.error}"`);
    console.log('✅ TEST 4 PASSED: Invalid state transition rejected with 400!');

    console.log('\n====================================================');
    console.log('🎉 ALL CROSS-USER & STATE MACHINE TESTS PASSED (4/4)');
    console.log('====================================================\n');
  } finally {
    if (prisma && process.env.DATABASE_URL) {
      try {
        await prisma.session.deleteMany({ where: { id: sessionId } });
        await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId, teacherId] } } });
      } catch {}
    }
    serverInstance.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
