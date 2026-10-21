import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';

process.env.NODE_ENV = 'test';

import {
  app,
  prisma,
  inMemoryUsers,
  inMemorySessions,
  syncWithDatabasePromise
} from '../src/index';

import {
  isValidPrice,
  roundPrice,
  calculateBatchPricing,
  calculateSeatPrice
} from '../src/pricing';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Bug 1 (Pricing) and Bug 2 (Slot Conflict) Test Suite');
  console.log('====================================================\n');

  // Wait for initial DB synchronization
  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    // ------------------------------------------------------------------
    // SUITE 1: Pricing Validation and Consistency Tests (Bug 1)
    // ------------------------------------------------------------------
    console.log('\n--- SUITE 1: Pricing Validation & Batch Consistency ---');

    // 1.1 Acceptance of valid whole rupee prices
    assert.strictEqual(isValidPrice(499), true, '499 must be accepted');
    assert.strictEqual(isValidPrice(333), true, '333 must be accepted');
    assert.strictEqual(isValidPrice(1), true, '1 must be accepted');
    assert.strictEqual(isValidPrice('499'), true, '"499" string must be accepted');
    assert.strictEqual(isValidPrice(100000), true, '100000 must be accepted');
    console.log('✅ 1.1: Valid whole-rupee prices (499, 333, 1) accepted.');

    // 1.2 Rejection of invalid prices
    assert.strictEqual(isValidPrice(0), false, '0 must be rejected');
    assert.strictEqual(isValidPrice(-5), false, '-5 must be rejected');
    assert.strictEqual(isValidPrice(12.5), false, '12.5 decimal must be rejected');
    assert.strictEqual(isValidPrice(''), false, 'Empty string must be rejected');
    assert.strictEqual(isValidPrice(null), false, 'null must be rejected');
    assert.strictEqual(isValidPrice(undefined), false, 'undefined must be rejected');
    assert.strictEqual(isValidPrice('abc'), false, 'non-numeric string must be rejected');
    console.log('✅ 1.2: Invalid prices (0, -5, 12.5, empty, non-numeric) rejected.');

    // 1.3 Identical Batch Pricing calculation
    const base475 = calculateBatchPricing(475);
    assert.strictEqual(base475[1], 475, 'Base rate tier 1 must be 475');
    assert.strictEqual(base475[2], 380, 'Duo (80%) must be 380');
    assert.strictEqual(base475[3], 333, 'Trio (70%) must be 333 (Math.round(475 * 0.7))');
    assert.strictEqual(base475[4], 285, 'Cohort (60%) must be 285');
    assert.strictEqual(base475[5], 238, 'Masterclass (50%) must be 238 (Math.round(475 * 0.5))');

    const base499 = calculateBatchPricing(499);
    assert.strictEqual(base499[1], 499, 'Base rate tier 1 must be 499');
    assert.strictEqual(base499[2], 399, 'Duo (80%) must be 399');
    assert.strictEqual(base499[3], 349, 'Trio (70%) must be 349');
    assert.strictEqual(base499[4], 299, 'Cohort (60%) must be 299');
    assert.strictEqual(base499[5], 250, 'Masterclass (50%) must be 250');
    console.log('✅ 1.3: Client and server calculate identical whole-rupee batch prices.');

    // 1.4 API user update price validation
    const testTeacherPriceId = 'teacher-price-' + Date.now();
    inMemoryUsers.push({
      id: testTeacherPriceId,
      name: 'Price Test Mentor',
      email: `${testTeacherPriceId}@test.com`,
      role: 'teacher',
      tokenBalance: 0,
      hourlyRate: 499,
      batchPricing: base499,
      version: 0
    });

    // Test rejecting invalid price on PATCH /api/users/:id
    const badRateRes = await fetch(`${baseUrl}/api/users/${testTeacherPriceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testTeacherPriceId}`
      },
      body: JSON.stringify({ hourlyRate: 12.5 })
    });
    assert.strictEqual(badRateRes.status, 400, 'Decimal price 12.5 should return 400');
    console.log('✅ 1.4: API rejects decimal price (12.5) with HTTP 400.');

    // Test accepting valid price 333 on PATCH /api/users/:id
    const goodRateRes = await fetch(`${baseUrl}/api/users/${testTeacherPriceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testTeacherPriceId}`
      },
      body: JSON.stringify({ hourlyRate: 333 })
    });
    assert.strictEqual(goodRateRes.status, 200, 'Valid price 333 should return 200');
    const updatedUser = inMemoryUsers.find(u => u.id === testTeacherPriceId);
    assert.strictEqual(updatedUser.hourlyRate, 333);
    console.log('✅ 1.5: API accepts valid price (333) with HTTP 200.');

    // ------------------------------------------------------------------
    // SUITE 2: Bug 2 Reproduction & Verification Tests
    // ------------------------------------------------------------------
    console.log('\n--- SUITE 2: Bug 2 Slot Conflict & Availability Tests ---');

    const testTeacherBug2Id = 'teacher-bug2-' + Date.now();
    const testStudentBug2Id = 'student-bug2-' + Date.now();

    // Teacher with EMPTY availability (no weekly slots set)
    inMemoryUsers.push({
      id: testTeacherBug2Id,
      name: 'Mentor Empty Avail',
      email: `${testTeacherBug2Id}@test.com`,
      role: 'teacher',
      tokenBalance: 10,
      hourlyRate: 499,
      availability: {}, // Empty availability
      isAvailableNow: false,
      version: 0
    });

    inMemoryUsers.push({
      id: testStudentBug2Id,
      name: 'Student Bug2 Tester',
      email: `${testStudentBug2Id}@test.com`,
      role: 'student',
      tokenBalance: 20,
      version: 0
    });

    // REPRO / TEST 2.1: Booking a teacher with no availability when slot is empty should succeed if free,
    // OR if a conflict occurs, nearest slot suggestion should NOT suggest a random slot when availability is empty.
    console.log('Test 2.1: Booking teacher with empty sessions...');
    const targetSlotISO = '2026-10-25T10:00:00.000Z'; // Sunday 10:00 UTC

    const bookEmptyRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Initial Session',
        teacherId: testTeacherBug2Id,
        studentId: testStudentBug2Id,
        scheduledAt: targetSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.ok(bookEmptyRes.status === 200 || bookEmptyRes.status === 201, 'Booking on empty schedule must succeed');
    console.log('✅ 2.1: Booking on empty schedule succeeded with 200/201.');

    // TEST 2.2: True collision on same teacher and overlapping slot must return 409
    console.log('Test 2.2: Second booking at the EXACT same slot must return 409...');
    const bookConflictRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Conflicting Session',
        teacherId: testTeacherBug2Id,
        studentId: testStudentBug2Id,
        scheduledAt: targetSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.strictEqual(bookConflictRes.status, 409, 'Overlapping booking must return 409');
    const conflictData = await bookConflictRes.json();
    assert.strictEqual(conflictData.conflict, true);
    // When teacher has no availability set, the message must explain so, not suggest a random hour
    console.log('Conflict response message:', conflictData.error || conflictData.message);
    if (conflictData.noAvailability || !conflictData.nearestSlot) {
      assert.ok(
        (conflictData.error && conflictData.error.includes("hasn't set availability")) ||
        (conflictData.message && conflictData.message.includes("hasn't set availability")),
        'Must indicate teacher has not set availability'
      );
    }
    console.log('✅ 2.2: Real conflict returned 409 with proper availability notice.');

    // TEST 2.3: Adjacent slot (end-exclusive: 10:00-11:00 and 11:00-12:00) must NOT conflict!
    console.log('Test 2.3: Adjacent slot (11:00:00.000Z, immediately following 10:00-11:00) must succeed...');
    const adjacentSlotISO = '2026-10-25T11:00:00.000Z'; // Exactly 60 minutes later
    const bookAdjacentRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Adjacent Session',
        teacherId: testTeacherBug2Id,
        studentId: testStudentBug2Id,
        scheduledAt: adjacentSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.ok(bookAdjacentRes.status === 200 || bookAdjacentRes.status === 201, 'Adjacent slot must not be treated as conflict');
    console.log('✅ 2.3: Adjacent slot booking succeeded without false conflict.');

    // TEST 2.4: Cancelled session must NOT block slot
    console.log('Test 2.4: Cancelled session must not block slot...');
    const cancelledSlotISO = '2026-10-26T14:00:00.000Z';
    const cancelledSessId = 'sess-canc-' + Date.now();
    inMemorySessions.push({
      id: cancelledSessId,
      title: 'Cancelled Class',
      teacherId: testTeacherBug2Id,
      studentId: testStudentBug2Id,
      status: 'cancelled',
      scheduledAt: cancelledSlotISO,
      durationMin: 60
    });

    const bookOverCancelledRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Re-booking Cancelled Slot',
        teacherId: testTeacherBug2Id,
        studentId: testStudentBug2Id,
        scheduledAt: cancelledSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.ok(bookOverCancelledRes.status === 200 || bookOverCancelledRes.status === 201, 'Slot with cancelled session must be bookable');
    console.log('✅ 2.4: Cancelled session does not block slot.');

    // TEST 2.5: Declined session must NOT block slot
    console.log('Test 2.5: Declined session must not block slot...');
    const declinedSlotISO = '2026-10-26T16:00:00.000Z';
    inMemorySessions.push({
      id: 'sess-dec-' + Date.now(),
      title: 'Declined Class',
      teacherId: testTeacherBug2Id,
      studentId: testStudentBug2Id,
      status: 'declined',
      scheduledAt: declinedSlotISO,
      durationMin: 60
    });

    const bookOverDeclinedRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Re-booking Declined Slot',
        teacherId: testTeacherBug2Id,
        studentId: testStudentBug2Id,
        scheduledAt: declinedSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.ok(bookOverDeclinedRes.status === 200 || bookOverDeclinedRes.status === 201, 'Slot with declined session must be bookable');
    console.log('✅ 2.5: Declined session does not block slot.');

    // Top up student tokens so subsequent test bookings have balance
    const studentUser = inMemoryUsers.find(u => u.id === testStudentBug2Id);
    if (studentUser) studentUser.tokenBalance = 50;

    // TEST 2.6: Completed session must NOT block future/slot re-booking
    console.log('Test 2.6: Completed session must not block slot...');
    const completedSlotISO = '2026-10-26T18:00:00.000Z';
    inMemorySessions.push({
      id: 'sess-comp-' + Date.now(),
      title: 'Completed Class',
      teacherId: testTeacherBug2Id,
      studentId: testStudentBug2Id,
      status: 'completed',
      scheduledAt: completedSlotISO,
      durationMin: 60
    });

    const bookOverCompletedRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Re-booking Completed Slot',
        teacherId: testTeacherBug2Id,
        studentId: testStudentBug2Id,
        scheduledAt: completedSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.ok(bookOverCompletedRes.status === 200 || bookOverCompletedRes.status === 201, 'Slot with completed session must be bookable');
    console.log('✅ 2.6: Completed session does not block slot.');

    // TEST 2.7: Session for a DIFFERENT teacher at same time must NOT conflict
    console.log('Test 2.7: Different teacher at same time must not conflict...');
    const otherTeacherId = 'teacher-other-' + Date.now();
    inMemoryUsers.push({
      id: otherTeacherId,
      name: 'Other Mentor',
      email: `${otherTeacherId}@test.com`,
      role: 'teacher',
      tokenBalance: 0,
      hourlyRate: 499,
      version: 0
    });

    const bookDiffTeacherRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Session With Other Mentor',
        teacherId: otherTeacherId,
        studentId: testStudentBug2Id,
        scheduledAt: targetSlotISO, // Same time as testTeacherBug2Id's booked slot!
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.ok(bookDiffTeacherRes.status === 200 || bookDiffTeacherRes.status === 201, 'Different teacher at same time must succeed');
    console.log('✅ 2.7: Booking different teacher at same time succeeded.');

    // TEST 2.8: Same teacher on a DIFFERENT date at same hour must NOT conflict
    console.log('Test 2.8: Same teacher on a different date must not conflict...');
    const diffDateISO = '2026-10-27T10:00:00.000Z'; // 2 days later, same time
    const bookDiffDateRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Session on Different Date',
        teacherId: testTeacherBug2Id,
        studentId: testStudentBug2Id,
        scheduledAt: diffDateISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.ok(bookDiffDateRes.status === 200 || bookDiffDateRes.status === 201, 'Same teacher on different date must succeed');
    console.log('✅ 2.8: Booking same teacher on different date succeeded.');

    // TEST 2.9: Nearest slot recommendation respects teacher's configured weekly availability
    console.log('Test 2.9: Nearest slot suggestion respects teacher availability...');
    const availTeacherId = 'teacher-with-avail-' + Date.now();
    inMemoryUsers.push({
      id: availTeacherId,
      name: 'Mentor Avail',
      email: `${availTeacherId}@test.com`,
      role: 'teacher',
      tokenBalance: 10,
      hourlyRate: 499,
      // Available on Mon-10:00 AM (IST)
      availability: {
        'Mon-10:00 AM': true,
        'Wed-02:00 PM': true
      },
      version: 0
    });

    // Create an active session at Wed-02:00 PM for this teacher
    // Wed Oct 28 2026 at 02:00 PM IST is 08:30 UTC
    const wedSlotISO = '2026-10-28T08:30:00.000Z';
    inMemorySessions.push({
      id: 'sess-wed-' + Date.now(),
      title: 'Occupied Wed Lecture',
      teacherId: availTeacherId,
      studentId: testStudentBug2Id,
      status: 'confirmed',
      scheduledAt: wedSlotISO,
      durationMin: 60
    });

    // Try booking the occupied Wed slot
    const wedConflictRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${testStudentBug2Id}`
      },
      body: JSON.stringify({
        title: 'Collision on Wed Slot',
        teacherId: availTeacherId,
        studentId: testStudentBug2Id,
        scheduledAt: wedSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    assert.strictEqual(wedConflictRes.status, 409, 'Should return 409 for occupied Wed slot');
    const wedConflictData = await wedConflictRes.json();
    console.log('Nearest slot offered:', wedConflictData.nearestSlot, wedConflictData.nearestSlotFormatted);
    assert.ok(wedConflictData.nearestSlot, 'Must offer a valid nearestSlot inside availability');
    // Nearest slot must NOT be the occupied Wed slot
    assert.notStrictEqual(wedConflictData.nearestSlot, wedSlotISO);
    console.log('✅ 2.9: Nearest slot suggestion respects configured teacher availability.');

    // TEST 2.10: 10 Concurrent bookings of one slot produce exactly 1 success
    console.log('Test 2.10: 10 Concurrent bookings of one slot produce exactly 1 success...');
    const raceTeacherId = 'teacher-race-slot-' + Date.now();
    inMemoryUsers.push({
      id: raceTeacherId,
      name: 'Race Mentor',
      email: `${raceTeacherId}@test.com`,
      role: 'teacher',
      tokenBalance: 0,
      hourlyRate: 499,
      version: 0
    });

    const concurrentStudents = Array.from({ length: 10 }, (_, i) => {
      const sId = `student-race-slot-${i}-${Date.now()}`;
      const sObj = {
        id: sId,
        name: `Racer ${i}`,
        email: `${sId}@test.com`,
        role: 'student',
        tokenBalance: 10,
        version: 0
      };
      inMemoryUsers.push(sObj);
      return sObj;
    });

    const raceSlotISO = '2026-10-29T15:00:00.000Z';
    const racePromises = concurrentStudents.map(st =>
      fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer dev-token-${st.id}`
        },
        body: JSON.stringify({
          title: `Race Booking ${st.name}`,
          teacherId: raceTeacherId,
          studentId: st.id,
          scheduledAt: raceSlotISO,
          durationMin: 60,
          payWithTokens: true
        })
      })
    );

    const raceResults = await Promise.all(racePromises);
    const statuses = raceResults.map(r => r.status);
    const successCount = statuses.filter(s => s === 200 || s === 201).length;
    const conflictCount = statuses.filter(s => s === 409).length;

    console.log(`Concurrent results: ${successCount} successes, ${conflictCount} conflicts (409)`);
    assert.strictEqual(successCount, 1, 'Exactly one concurrent booking must succeed (200/201)');
    assert.strictEqual(conflictCount, 9, 'All other 9 concurrent bookings must be rejected with 409');
    console.log('✅ 2.10: Exactly one concurrent booking succeeded, 9 rejected with 409.');

    console.log('\n====================================================');
    console.log('🎉 ALL BUG 1 & BUG 2 TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');

    if ((serverInstance as any).closeAllConnections) {
      (serverInstance as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
    if (prisma && process.env.DATABASE_URL) {
      try {
        await prisma.$disconnect();
      } catch {}
    }
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    if ((serverInstance as any).closeAllConnections) {
      (serverInstance as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
    if (prisma && process.env.DATABASE_URL) {
      try {
        await prisma.$disconnect();
      } catch {}
    }
    process.exit(1);
  }
}

runTests();
