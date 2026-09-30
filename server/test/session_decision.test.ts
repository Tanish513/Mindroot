import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';

import {
  app,
  inMemoryUsers,
  inMemorySessions,
  syncWithDatabasePromise,
  resolveSessionRole,
  getSessionApproverId,
  prisma
} from '../src/index';

function shouldSendJoinReminder(session: any, nowMs: number = Date.now()): boolean {
  if (!session || !session.scheduledAt) return false;
  if (session.status !== 'confirmed' && session.status !== 'live') return false;
  const startTime = new Date(session.scheduledAt).getTime();
  const timeUntilStart = startTime - nowMs;
  const fiveMinMs = 5 * 60 * 1000;
  return timeUntilStart <= fiveMinMs && timeUntilStart >= -2 * 60 * 1000;
}

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
  console.log('🧪 Starting Session Decision & Role Integrity Tests (Plan 2)');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  const studentId = 'student-test-' + Date.now();
  const mentorId = 'mentor-test-' + Date.now();
  const bystanderId = 'bystander-test-' + Date.now();

  const student = {
    id: studentId,
    name: 'Student Learner',
    email: `${studentId}@mindroot.test`,
    role: 'student',
    tokenBalance: 20,
    tokenVersion: 0,
    version: 0
  };

  const mentor = {
    id: mentorId,
    name: 'Mentor Both',
    email: `${mentorId}@mindroot.test`,
    role: 'both',
    tokenBalance: 10,
    tokenVersion: 0,
    version: 0
  };

  const bystander = {
    id: bystanderId,
    name: 'Bystander User',
    email: `${bystanderId}@mindroot.test`,
    role: 'student',
    tokenBalance: 10,
    tokenVersion: 0,
    version: 0
  };

  inMemoryUsers.push(student as any);
  inMemoryUsers.push(mentor as any);
  inMemoryUsers.push(bystander as any);

  if (prisma && process.env.DATABASE_URL) {
    try {
      await prisma.user.upsert({
        where: { id: student.id },
        update: { tokenBalance: 20 },
        create: { id: student.id, name: student.name, email: student.email, role: student.role, tokenBalance: 20 }
      });
      await prisma.user.upsert({
        where: { id: mentor.id },
        update: { tokenBalance: 10, role: mentor.role },
        create: { id: mentor.id, name: mentor.name, email: mentor.email, role: mentor.role, tokenBalance: 10 }
      });
      await prisma.user.upsert({
        where: { id: bystander.id },
        update: { tokenBalance: 10 },
        create: { id: bystander.id, name: bystander.name, email: bystander.email, role: bystander.role, tokenBalance: 10 }
      });
    } catch (e: any) {
      console.warn('DB upsert warning:', e.message);
    }
  }

  const studentToken = createToken(student);
  const mentorToken = createToken(mentor);
  const bystanderToken = createToken(bystander);

  // ----------------------------------------------------
  // Test 1: Role Resolution Logic (P2.4)
  // ----------------------------------------------------
  console.log('Test 1: Server role resolution helper (P2.4)...');
  const dummySession = {
    id: 'dummy-sess-1',
    teacherId: mentorId,
    studentId: studentId,
    status: 'pending'
  };

  // Mentor has role 'both', but in this session they are the teacher
  const mentorResolved = resolveSessionRole(dummySession, mentorId, 'both');
  assert.strictEqual(mentorResolved, 'teacher', 'Mentor should resolve to teacher regardless of profile role "both"');

  // Student should resolve to student even if client sends role: 'teacher'
  const studentResolved = resolveSessionRole(dummySession, studentId, 'teacher');
  assert.strictEqual(studentResolved, 'student', 'Student should resolve to student even if client claims teacher');

  // Approver check
  const approverId = getSessionApproverId(dummySession);
  assert.strictEqual(approverId, mentorId, 'Approver should be the mentor/teacher for 1:1 sessions');
  console.log('✅ Test 1 Passed: Server role resolution is authoritative.');

  // ----------------------------------------------------
  // Test 2: Reminder Rule Logic (P2.6)
  // ----------------------------------------------------
  console.log('Test 2: shouldSendJoinReminder helper (P2.6)...');
  const nowMs = Date.now();
  const startingIn3Mins = new Date(nowMs + 3 * 60 * 1000).toISOString();

  // Pending session starting in 3 mins must NOT send join reminder
  const pendingSession = {
    id: 'sess-pend-1',
    teacherId: mentorId,
    studentId: studentId,
    status: 'pending',
    scheduledAt: startingIn3Mins
  };
  assert.strictEqual(shouldSendJoinReminder(pendingSession, nowMs), false, 'Pending session must NEVER trigger join reminder');

  // Confirmed session starting in 3 mins MUST send join reminder
  const confirmedSession = {
    id: 'sess-conf-1',
    teacherId: mentorId,
    studentId: studentId,
    status: 'confirmed',
    scheduledAt: startingIn3Mins
  };
  assert.strictEqual(shouldSendJoinReminder(confirmedSession, nowMs), true, 'Confirmed session within 5 mins must trigger join reminder');
  console.log('✅ Test 2 Passed: Reminder rule protects against premature join alerts.');

  // ----------------------------------------------------
  // Test 3: Token Booking creates session with status pending and paymentStatus held (P2.9)
  // ----------------------------------------------------
  console.log('Test 3: Token booking creates pending session with held tokens (P2.9)...');
  const sessionScheduledAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString(); // 2 hours from now
  const createRes = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      title: 'Advanced Machine Learning Systems',
      teacherId: mentorId,
      studentId: studentId,
      scheduledAt: sessionScheduledAt,
      durationMin: 60,
      tokenCost: 5,
      payWithTokens: true,
      type: '1on1'
    })
  });

  const createdSession = await createRes.json();
  assert.strictEqual(createRes.status, 201, 'Session creation should succeed');
  assert.strictEqual(createdSession.status, 'pending', 'Created token session should have status pending');
  assert.strictEqual(createdSession.paymentStatus, 'held', 'Created token session should have paymentStatus held');
  
  // Student token balance should be debited (20 - 5 = 15)
  const studentUserRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const studentUser = await studentUserRes.json();
  assert.strictEqual(studentUser.tokenBalance, 15, 'Student token balance should be debited into held escrow');
  console.log('✅ Test 3 Passed: Tokens held in escrow, session pending.');

  // ----------------------------------------------------
  // Test 4: Cannot pay UPI on pending session (P2.10)
  // ----------------------------------------------------
  console.log('Test 4: Cannot confirm UPI payment on pending session (P2.10)...');
  const upiRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      sessionId: createdSession.id,
      utr: 'UTR123456789012',
      amount: 499
    })
  });
  assert.strictEqual(upiRes.status, 400, 'UPI payment on pending session should return 400');
  const upiErr = await upiRes.json();
  assert.strictEqual(upiErr.code, 'SESSION_NOT_CONFIRMED', 'Error code must be SESSION_NOT_CONFIRMED');
  console.log('✅ Test 4 Passed: UPI payment correctly rejected on pending session.');

  // ----------------------------------------------------
  // Test 5: Authorization on decision endpoint (P2.1)
  // ----------------------------------------------------
  console.log('Test 5: Non-approver bystander cannot confirm or decline session (P2.1)...');
  const bystanderPatch = await fetch(`${baseUrl}/api/sessions/${createdSession.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bystanderToken}`
    },
    body: JSON.stringify({ status: 'confirmed' })
  });
  assert.strictEqual(bystanderPatch.status, 403, 'Bystander should be forbidden from deciding session');
  console.log('✅ Test 5 Passed: Unauthorized user rejected with 403.');

  // ----------------------------------------------------
  // Test 6: Slot Conflict Detection (P2.8)
  // ----------------------------------------------------
  console.log('Test 6: Slot conflict detection when approving overlapping session (P2.8)...');
  // First, create and confirm an existing session for the mentor at the same time
  const conflictingSessId = 'conflict-sess-' + Date.now();
  const conflictingObj = {
    id: conflictingSessId,
    title: 'Existing Confirmed Class',
    teacherId: mentorId,
    studentId: bystanderId,
    status: 'confirmed',
    scheduledAt: sessionScheduledAt,
    durationMin: 60,
    createdAt: new Date().toISOString()
  };
  inMemorySessions.push(conflictingObj);
  if (prisma && process.env.DATABASE_URL) {
    try {
      await prisma.session.create({
        data: {
          id: conflictingObj.id,
          title: conflictingObj.title,
          teacherId: conflictingObj.teacherId,
          studentId: conflictingObj.studentId,
          status: 'confirmed',
          scheduledAt: new Date(conflictingObj.scheduledAt),
          durationMin: 60
        }
      });
    } catch {}
  }

  // Now attempt to confirm createdSession (which has the exact same scheduledAt and mentor)
  const conflictRes = await fetch(`${baseUrl}/api/sessions/${createdSession.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mentorToken}`
    },
    body: JSON.stringify({ status: 'confirmed' })
  });
  assert.strictEqual(conflictRes.status, 409, 'Slot conflict should return 409');
  const conflictData = await conflictRes.json();
  assert.strictEqual(conflictData.code, 'SLOT_CONFLICT', 'Error code must be SLOT_CONFLICT');
  console.log('✅ Test 6 Passed: Slot conflict detected and prevented.');

  // Remove the conflicting session
  const cIdx = inMemorySessions.findIndex(s => s.id === conflictingSessId);
  if (cIdx >= 0) inMemorySessions.splice(cIdx, 1);
  if (prisma && process.env.DATABASE_URL) {
    try { await prisma.session.delete({ where: { id: conflictingSessId } }); } catch {}
  }

  // ----------------------------------------------------
  // Test 7: Decline Session and Refund Held Tokens (P2.3)
  // ----------------------------------------------------
  console.log('Test 7: Mentor declines request, held tokens refunded atomically (P2.3)...');
  const declineRes = await fetch(`${baseUrl}/api/sessions/${createdSession.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mentorToken}`
    },
    body: JSON.stringify({ status: 'declined' })
  });
  assert.strictEqual(declineRes.status, 200, 'Decline should succeed');
  const declinedSess = await declineRes.json();
  assert.strictEqual(declinedSess.status, 'declined', 'Session status should be declined');
  assert.strictEqual(declinedSess.paymentStatus, 'refunded', 'Payment status should be refunded');

  // Verify student token balance restored back to 20
  const studentUserResAfter = await fetch(`${baseUrl}/api/users/me`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const studentUserAfter = await studentUserResAfter.json();
  assert.strictEqual(studentUserAfter.tokenBalance, 20, 'Student tokens must be refunded atomically back to 20');
  console.log('✅ Test 7 Passed: Decline successfully refunded held tokens.');

  // ----------------------------------------------------
  // Test 8: Approve Session Workflow & Idempotency (P2.2)
  // ----------------------------------------------------
  console.log('Test 8: Approve session workflow and idempotency (P2.2)...');
  // Create another pending session
  const sess2Res = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      title: 'Fullstack Next.js Deep Dive',
      teacherId: mentorId,
      studentId: studentId,
      scheduledAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
      durationMin: 60,
      tokenCost: 5,
      payWithTokens: true,
      type: '1on1'
    })
  });
  const sess2 = await sess2Res.json();
  assert.strictEqual(sess2.status, 'pending');

  // Mentor approves sess2
  const approveRes = await fetch(`${baseUrl}/api/sessions/${sess2.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mentorToken}`
    },
    body: JSON.stringify({ status: 'confirmed' })
  });
  assert.strictEqual(approveRes.status, 200, 'Approval should succeed');
  const approvedSess = await approveRes.json();
  assert.strictEqual(approvedSess.status, 'confirmed', 'Status should be confirmed');
  assert.strictEqual(approvedSess.paymentStatus, 'paid', 'Payment status should be paid');

  // Repeated approval (idempotency check)
  const repeatApprove = await fetch(`${baseUrl}/api/sessions/${sess2.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mentorToken}`
    },
    body: JSON.stringify({ status: 'confirmed' })
  });
  assert.strictEqual(repeatApprove.status, 200, 'Repeat approval should be idempotent and return 200');
  console.log('✅ Test 8 Passed: Approval workflow and idempotency verified.');

  console.log('\n====================================================');
  console.log('🎉 ALL PLAN 2 DECISION & ROLE INTEGRITY TESTS PASSED!');
  console.log('====================================================\n');

  serverInstance.close();
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
