import assert from 'assert';
import {
  deductTokensAtomic,
  bookSessionWithTokens,
  creditTokensAtomic
} from '../src/lib/tokenService';

async function runFailClosedTests() {
  console.log('====================================================');
  console.log('🧪 Starting Database Fail-Closed Policy Test');
  console.log('====================================================\n');

  const testUserId = 'test-fail-closed-' + Date.now();
  const testTeacherId = 'test-teacher-' + Date.now();

  const mockUser = {
    id: testUserId,
    name: 'Fail Closed Tester',
    email: `${testUserId}@test.com`,
    tokenBalance: 100,
    inrWalletBalance: 500,
    totalEarned: 0,
    version: 0
  };

  const mockTeacher = {
    id: testTeacherId,
    name: 'Mentor Ada',
    email: `${testTeacherId}@test.com`,
    tokenBalance: 0,
    inrWalletBalance: 0,
    totalEarned: 0,
    hourlyRate: 500,
    version: 0
  };

  const inMemoryUsers = [mockUser, mockTeacher];
  const inMemorySessions: any[] = [];
  const inMemoryTransactions: any[] = [];

  // Mock Prisma that throws database connectivity failures
  const failingPrisma: any = {
    $transaction: async () => {
      throw new Error('Connection lost: FATAL database pool exhausted');
    }
  };

  const deps = {
    prisma: failingPrisma,
    inMemoryUsers,
    inMemorySessions,
    inMemoryTransactions
  };

  // Ensure DATABASE_URL is set so policy engages
  process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';
  delete process.env.ALLOW_UNSAFE_IN_MEMORY_FAILOVER;

  try {
    // -------------------------------------------------------------
    // TEST 1: Default Fail-Closed on deductTokensAtomic (HTTP 503)
    // -------------------------------------------------------------
    console.log('--- TEST 1: Default Fail-Closed on deductTokensAtomic ---');
    let thrownError: any = null;
    try {
      await deductTokensAtomic(deps, {
        userId: testUserId,
        amount: 25,
        reason: 'Test deduction during DB outage'
      });
    } catch (err: any) {
      thrownError = err;
    }

    assert.ok(thrownError, 'deductTokensAtomic MUST throw an error when DB fails!');
    console.log(`Thrown error statusCode: ${thrownError.statusCode}`);
    console.log(`Thrown error message: "${thrownError.message}"`);
    assert.strictEqual(thrownError.statusCode, 503, 'Error status code must be 503 Service Unavailable');
    assert.strictEqual(mockUser.tokenBalance, 100, 'User token balance MUST NOT change during fail-closed rejection!');
    console.log('✅ TEST 1 PASSED: Operation failed closed with 503, memory balance untouched (100 tokens)!');

    // -------------------------------------------------------------
    // TEST 2: Default Fail-Closed on bookSessionWithTokens (HTTP 503)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Default Fail-Closed on bookSessionWithTokens ---');
    thrownError = null;
    try {
      await bookSessionWithTokens(deps, {
        studentId: testUserId,
        teacherId: testTeacherId,
        title: 'Algorithms during Outage',
        scheduledAt: new Date(),
        tokenCost: 10
      });
    } catch (err: any) {
      thrownError = err;
    }

    assert.ok(thrownError, 'bookSessionWithTokens MUST throw an error when DB fails!');
    console.log(`Thrown error statusCode: ${thrownError.statusCode}`);
    console.log(`Thrown error message: "${thrownError.message}"`);
    assert.strictEqual(thrownError.statusCode, 503, 'Error status code must be 503 Service Unavailable');
    assert.strictEqual(mockUser.tokenBalance, 100, 'User token balance MUST NOT be decremented on DB failure!');
    assert.strictEqual(inMemorySessions.length, 0, 'No session must be created in memory on DB failure!');
    console.log('✅ TEST 2 PASSED: Session booking failed closed with 503, zero ghost sessions created!');

    // -------------------------------------------------------------
    // TEST 3: Opt-in Failover when ALLOW_UNSAFE_IN_MEMORY_FAILOVER=true
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Explicit Opt-in In-Memory Failover ---');
    process.env.ALLOW_UNSAFE_IN_MEMORY_FAILOVER = 'true';

    const failoverResult = await deductTokensAtomic(deps, {
      userId: testUserId,
      amount: 15,
      reason: 'Allowed in-memory deduction via opt-in flag'
    });

    console.log(`Failover result success: ${failoverResult.success}`);
    console.log(`Balance after opt-in deduction: ${mockUser.tokenBalance}`);
    assert.strictEqual(mockUser.tokenBalance, 85, 'Balance decremented in memory when explicitly allowed');
    console.log('✅ TEST 3 PASSED: In-memory fallback permitted ONLY when ALLOW_UNSAFE_IN_MEMORY_FAILOVER=true!');

    console.log('\n====================================================');
    console.log('🎉 ALL FAIL-CLOSED LEDGER INTEGRITY TESTS PASSED (3/3)');
    console.log('====================================================\n');
  } finally {
    delete process.env.ALLOW_UNSAFE_IN_MEMORY_FAILOVER;
    process.exit(0);
  }
}

runFailClosedTests().catch(err => {
  console.error('\n❌ FAIL-CLOSED TEST FAILED:', err);
  process.exit(1);
});
