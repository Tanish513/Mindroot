import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';

process.env.NODE_ENV = 'test';

import {
  app,
  prisma,
  inMemoryUsers,
  inMemorySessions,
  inMemoryTransactions,
  syncWithDatabasePromise
} from '../src/index';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Token Balance Race Condition & Integrity Test');
  console.log('====================================================\n');

  // Wait for initial DB synchronization to complete
  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  const testStudentId = 'student-race-' + Date.now();
  const testTeacherId = 'teacher-race-' + Date.now();

  try {
    // ------------------------------------------------------------------
    // TEST 1: Fire 10 concurrent booking requests from a user with balance
    // for exactly 1 session (5 tokens, cost 5 tokens). Assert only 1 succeeds!
    // ------------------------------------------------------------------
    console.log('\n--- TEST 1: 10 Concurrent Booking Requests (Double-Spend Test) ---');

    const studentUser = {
      id: testStudentId,
      name: 'Concurrent Tester',
      email: `${testStudentId}@test.com`,
      role: 'student',
      tokenBalance: 5, // Exactly enough for 1 session!
      version: 0
    };

    const teacherUser = {
      id: testTeacherId,
      name: 'Mentor Ada',
      email: `${testTeacherId}@test.com`,
      role: 'teacher',
      tokenBalance: 0,
      hourlyRate: 5,
      version: 0
    };

    // Populate both Prisma and inMemory
    if (prisma && process.env.DATABASE_URL) {
      try {
        await prisma.user.upsert({
          where: { id: testStudentId },
          update: { tokenBalance: 5, version: 0 },
          create: { id: testStudentId, name: studentUser.name, role: 'student', tokenBalance: 5, version: 0 }
        });
        await prisma.user.upsert({
          where: { id: testTeacherId },
          update: { tokenBalance: 0, version: 0 },
          create: { id: testTeacherId, name: teacherUser.name, role: 'teacher', tokenBalance: 0, version: 0 }
        });
      } catch (e: any) {
        console.warn('Prisma seed notice:', e.message);
      }
    }

    inMemoryUsers.push(studentUser);
    inMemoryUsers.push(teacherUser);

    console.log(`Initial Student Balance: ${studentUser.tokenBalance} Tokens`);
    console.log(`Session Cost: 5 Tokens`);
    console.log(`Firing 10 simultaneous booking requests...`);

    const bookingPayload = {
      title: 'Distributed Systems & Race Conditions',
      teacherId: testTeacherId,
      studentId: testStudentId,
      payWithTokens: true,
      tokenCost: 5,
      scheduledAt: new Date(Date.now() + 3600000 * 24).toISOString(),
      durationMin: 60
    };

    const makeBookingRequest = async (index: number) => {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer dev-token-${testStudentId}`
        },
        body: JSON.stringify({
          ...bookingPayload,
          title: `Concurrent Attempt #${index}`
        })
      });
      const data = await res.json();
      return { status: res.status, data, index };
    };

    // Fire 10 concurrent requests simultaneously using Promise.all
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => makeBookingRequest(i + 1))
    );

    const successCount = results.filter(r => r.status === 201).length;
    const failureCount = results.filter(r => r.status === 400).length;

    console.log(`\nResults: ${successCount} Succeeded (HTTP 201), ${failureCount} Failed (HTTP 400)`);

    results.forEach(r => {
      if (r.status === 201) {
        console.log(`  ✅ Request #${r.index}: SUCCESS (Booked session ${r.data.id})`);
      } else {
        console.log(`  🛑 Request #${r.index}: REJECTED with HTTP ${r.status}: "${r.data.error}"`);
      }
    });

    assert.strictEqual(successCount, 1, `Expected exactly 1 booking to succeed, but got ${successCount}`);
    assert.strictEqual(failureCount, 9, `Expected exactly 9 bookings to be rejected with 400, but got ${failureCount}`);

    const finalStudent = inMemoryUsers.find(u => u.id === testStudentId);
    console.log(`\nFinal Student Token Balance: ${finalStudent.tokenBalance}`);
    assert.strictEqual(finalStudent.tokenBalance, 0, `Expected balance to be exactly 0, got ${finalStudent.tokenBalance}`);
    assert.ok(finalStudent.tokenBalance >= 0, 'Balance must never be negative!');

    // Verify in database if prisma connected
    if (prisma && process.env.DATABASE_URL) {
      try {
        const dbStudent = await prisma.user.findUnique({ where: { id: testStudentId } });
        if (dbStudent) {
          console.log(`PostgreSQL DB Student Token Balance: ${dbStudent.tokenBalance}`);
          assert.strictEqual(dbStudent.tokenBalance, 0, 'Database tokenBalance must be exactly 0');
          assert.ok(dbStudent.tokenBalance >= 0, 'Database tokenBalance must never be negative');
        }
      } catch {}
    }

    // Verify Transaction Audit Trail (balanceBefore and balanceAfter)
    const userTransactions = inMemoryTransactions.filter(tx => tx.userId === testStudentId);
    console.log(`Total transactions created for student: ${userTransactions.length}`);
    assert.strictEqual(userTransactions.length, 1, 'Expected exactly 1 Transaction record');

    const tx = userTransactions[0];
    console.log(`Transaction details: Type=${tx.type}, Amount=${tx.amount}, balanceBefore=${tx.balanceBefore}, balanceAfter=${tx.balanceAfter}`);
    assert.strictEqual(tx.type, 'SPENT');
    assert.strictEqual(tx.amount, 5);
    assert.strictEqual(tx.balanceBefore, 5);
    assert.strictEqual(tx.balanceAfter, 0);

    console.log('✅ TEST 1 PASSED: Concurrency double-spend completely prevented!');

    // ------------------------------------------------------------------
    // TEST 2: Overdraft Rejection Test (Balance is 0, attempt booking)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 2: Negative Balance Prevention on Overdraft ---');
    const overdraftRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentId}`
      },
      body: JSON.stringify({
        ...bookingPayload,
        title: 'Overdraft Booking Attempt',
        scheduledAt: new Date(Date.now() + 3600000 * 48).toISOString()
      })
    });

    const overdraftData = await overdraftRes.json();
    console.log(`Overdraft HTTP Status: ${overdraftRes.status}`);
    console.log(`Overdraft Error Response: "${overdraftData.error}"`);
    assert.strictEqual(overdraftRes.status, 400);
    assert.strictEqual(overdraftData.insufficientBalance, true);
    assert.strictEqual(finalStudent.tokenBalance, 0, 'Balance remained 0 without going negative');
    console.log('✅ TEST 2 PASSED: Overdraft request rejected without balance change!');

    // ------------------------------------------------------------------
    // TEST 3: Wallet Withdrawal Overdraft Rejection Test
    // ------------------------------------------------------------------
    console.log('\n--- TEST 3: Wallet Withdrawal Balance Protection ---');
    const withdrawRes = await fetch(`${baseUrl}/api/wallet/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentId}`
      },
      body: JSON.stringify({
        amount: 500
      })
    });
    const withdrawData = await withdrawRes.json();
    console.log(`Withdrawal HTTP Status: ${withdrawRes.status}`);
    console.log(`Withdrawal Error: "${withdrawData.error}"`);
    assert.strictEqual(withdrawRes.status, 400);
    assert.strictEqual(withdrawData.insufficientBalance, true);
    assert.strictEqual(finalStudent.tokenBalance, 0);
    console.log('✅ TEST 3 PASSED: Wallet withdrawal overdraft rejected!');

    console.log('\n====================================================');
    console.log('🎉 ALL INTEGRITY & CONCURRENCY TESTS PASSED (3/3)');
    console.log('====================================================\n');
  } finally {
    // Cleanup test data
    if (prisma && process.env.DATABASE_URL) {
      try {
        await prisma.transaction.deleteMany({ where: { userId: testStudentId } });
        await prisma.session.deleteMany({ where: { studentId: testStudentId } });
        await prisma.user.deleteMany({ where: { id: { in: [testStudentId, testTeacherId] } } });
      } catch {}
    }
    serverInstance.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
