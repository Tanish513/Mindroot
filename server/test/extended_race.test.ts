import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';

import {
  app,
  inMemoryUsers,
  inMemorySessions,
  inMemoryUsedUtrs,
  syncWithDatabasePromise
} from '../src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

function createToken(userId: string, role = 'student') {
  return jwt.sign(
    { userId, id: userId, email: `${userId}@test.com`, role, tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runExtendedRaceTests() {
  console.log('====================================================');
  console.log('🧪 Starting Extended Concurrency & Idempotency Tests');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    // -------------------------------------------------------------
    // TEST 1: 10 Concurrent Join Requests for a 1-Capacity Session
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: 10 Concurrent Joins on 1-Capacity Session ---');
    const sessionId = 'cap-session-' + Date.now();
    const mentorId = 'mentor-cap-' + Date.now();

    const mentorUser = {
      id: mentorId,
      name: 'Dr. Turing',
      email: `${mentorId}@test.com`,
      role: 'teacher',
      tokenBalance: 0,
      inrWalletBalance: 0,
      version: 0
    };
    inMemoryUsers.push(mentorUser);

    const testSession = {
      id: sessionId,
      title: 'Exclusive 1-on-1 Masterclass',
      teacherId: mentorId,
      maxCapacity: 1,
      students: [],
      status: 'confirmed',
      paymentStatus: 'pending'
    };
    inMemorySessions.push(testSession);

    // Create 10 distinct student accounts
    const studentIds = Array.from({ length: 10 }, (_, i) => `student-join-${Date.now()}-${i}`);
    studentIds.forEach(id => {
      inMemoryUsers.push({
        id,
        name: `Student ${id.slice(-2)}`,
        email: `${id}@test.com`,
        role: 'student',
        tokenBalance: 5,
        version: 0
      });
    });

    console.log(`Firing 10 simultaneous join requests for session with maxCapacity: 1...`);
    const joinResults = await Promise.all(
      studentIds.map(async (studentId, idx) => {
        const token = createToken(studentId);
        const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({})
        });
        const data = await res.json();
        return { status: res.status, data, studentId, idx };
      })
    );

    const successfulJoins = joinResults.filter(r => r.status === 200);
    const rejectedJoins = joinResults.filter(r => r.status === 400);

    console.log(`Results: ${successfulJoins.length} Joined (HTTP 200), ${rejectedJoins.length} Rejected (HTTP 400)`);
    assert.strictEqual(successfulJoins.length, 1, `Expected exactly 1 student to join, but got ${successfulJoins.length}`);
    assert.strictEqual(rejectedJoins.length, 9, `Expected exactly 9 students to be rejected, but got ${rejectedJoins.length}`);
    assert.strictEqual(testSession.students.length, 1, `Session should have exactly 1 student, got ${testSession.students.length}`);
    console.log('✅ TEST 1 PASSED: Overbooking prevented! Exactly 1 succeeded, 9 rejected!');

    // -------------------------------------------------------------
    // TEST 2: 10 Concurrent Streak Reward Claims
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: 10 Concurrent Streak Reward Claims ---');
    const streakUserId = 'streak-user-' + Date.now();
    const streakUser = {
      id: streakUserId,
      name: 'Streak Tester',
      email: `${streakUserId}@test.com`,
      role: 'student',
      streak: 7,
      lastClaimedStreakMilestone: 0,
      rewardPoints: 0,
      version: 0
    };
    inMemoryUsers.push(streakUser);
    const streakToken = createToken(streakUserId);

    console.log(`Firing 10 simultaneous claim requests for user with 7-day streak...`);
    const claimResults = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const res = await fetch(`${baseUrl}/api/users/${streakUserId}/claim-streak-reward`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${streakToken}`
          }
        });
        const data = await res.json();
        return { status: res.status, data, i };
      })
    );

    const successfulClaims = claimResults.filter(r => r.status === 200);
    const rejectedClaims = claimResults.filter(r => r.status === 400);

    console.log(`Results: ${successfulClaims.length} Claimed (HTTP 200), ${rejectedClaims.length} Rejected (HTTP 400)`);
    assert.strictEqual(successfulClaims.length, 1, `Expected exactly 1 claim to succeed, got ${successfulClaims.length}`);
    assert.strictEqual(rejectedClaims.length, 9, `Expected exactly 9 claims to be rejected, got ${rejectedClaims.length}`);
    assert.strictEqual(streakUser.rewardPoints, 20, `Reward points should be exactly 20, got ${streakUser.rewardPoints}`);
    assert.strictEqual(streakUser.lastClaimedStreakMilestone, 1, `Milestone should be 1`);
    console.log('✅ TEST 2 PASSED: Double reward claim prevented! Points credited exactly once (+20)!');

    // -------------------------------------------------------------
    // TEST 3: Duplicate UPI UTR Submission Prevention (HTTP 409)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Duplicate UPI UTR Verification ---');
    const testUtr = 'UTR_TEST_' + Date.now();
    const studentToken = createToken(studentIds[0]);

    const firstUpiRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        sessionId,
        teacherId: mentorId,
        amount: 499,
        utr: testUtr,
        isDemo: false
      })
    });
    console.log(`First UTR submission status: ${firstUpiRes.status}`);
    assert.strictEqual(firstUpiRes.status, 200, 'First UTR submission should be accepted');

    const duplicateUpiRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        sessionId,
        teacherId: mentorId,
        amount: 499,
        utr: testUtr,
        isDemo: false
      })
    });
    console.log(`Duplicate UTR submission status: ${duplicateUpiRes.status}`);
    const dupData = await duplicateUpiRes.json();
    console.log(`Duplicate UTR error message: "${dupData.error}"`);
    assert.strictEqual(duplicateUpiRes.status, 409, 'Duplicate UTR must return HTTP 409 Conflict!');
    console.log('✅ TEST 3 PASSED: Duplicate UTR rejected with HTTP 409 Conflict!');

    // -------------------------------------------------------------
    // TEST 4: Double-Click Payment Confirmation Idempotency
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Double-Click Confirm-Payment Idempotency ---');
    const paymentSessionId = 'pay-sess-' + Date.now();
    const payMentorId = 'pay-mentor-' + Date.now();

    const payMentor = {
      id: payMentorId,
      name: 'Mentor Ramanujan',
      email: `${payMentorId}@test.com`,
      role: 'teacher',
      inrWalletBalance: 0,
      totalEarned: 0,
      hourlyRate: 499,
      version: 0
    };
    inMemoryUsers.push(payMentor);

    const paymentSession = {
      id: paymentSessionId,
      title: 'Number Theory Session',
      teacherId: payMentorId,
      studentId: studentIds[0],
      amount: 499,
      paymentStatus: 'pending',
      status: 'pending'
    };
    inMemorySessions.push(paymentSession);

    const mentorToken = createToken(payMentorId, 'teacher');

    console.log(`Firing 2 simultaneous confirm-payment requests (simulated double-click)...`);
    const confirmResults = await Promise.all([
      fetch(`${baseUrl}/api/sessions/${paymentSessionId}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mentorToken}`
        }
      }).then(r => r.json()),
      fetch(`${baseUrl}/api/sessions/${paymentSessionId}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mentorToken}`
        }
      }).then(r => r.json())
    ]);

    console.log(`Response 1: success=${confirmResults[0].success}, alreadyProcessed=${confirmResults[0].alreadyProcessed}`);
    console.log(`Response 2: success=${confirmResults[1].success}, alreadyProcessed=${confirmResults[1].alreadyProcessed}`);
    console.log(`Final Mentor INR Wallet Balance: ₹${payMentor.inrWalletBalance}`);
    console.log(`Final Mentor Total Earned: ₹${payMentor.totalEarned}`);

    assert.strictEqual(payMentor.inrWalletBalance, 499, 'Mentor INR wallet must be credited exactly once (₹499)!');
    assert.strictEqual(payMentor.totalEarned, 499, 'Mentor totalEarned must be exactly ₹499!');
    assert.ok(
      confirmResults[0].alreadyProcessed || confirmResults[1].alreadyProcessed,
      'At least one response should be flagged as alreadyProcessed: true'
    );
    console.log('✅ TEST 4 PASSED: Idempotent payment confirmation credited wallet exactly once!');

    console.log('\n====================================================');
    console.log('🎉 ALL EXTENDED CONCURRENCY & RACE TESTS PASSED (4/4)');
    console.log('====================================================\n');
  } finally {
    serverInstance.close();
    process.exit(0);
  }
}

runExtendedRaceTests().catch(err => {
  console.error('\n❌ EXTENDED RACE TEST FAILED:', err);
  process.exit(1);
});
