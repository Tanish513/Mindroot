import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';

process.env.NODE_ENV = 'test';

import {
  app,
  inMemoryUsers,
  inMemorySessions,
  syncWithDatabasePromise
} from '../src/index';

import {
  isSlotConflicting,
  doIntervalsOverlap,
  getTeacherActiveBookings,
  getUtcTimestampFromTz,
  findNearestAvailableSlot
} from '../src/bookingRules';

async function runPrecisionTests() {
  console.log('====================================================');
  console.log('🎯 Starting Slot Availability Precision & Conflict Test Suite');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    // ==================================================================
    // PART 1: Core Interval Overlap & Precision Conflict Unit Tests
    // ==================================================================
    console.log('\n--- PART 1: Core Slot Conflict Logic Tests ---');

    const teacherA = 'teacher-precision-a-' + Date.now();
    const teacherB = 'teacher-precision-b-' + Date.now();

    // Oct 19, 2026 19:00 IST = 13:30 UTC
    const oct19_1900_IST_utc = getUtcTimestampFromTz(2026, 10, 19, 19, 0, 'Asia/Kolkata');
    const oct19_1900_ISO = new Date(oct19_1900_IST_utc).toISOString();

    // 1.1: No bookings -> Available
    const emptyCheck = isSlotConflicting([], teacherA, oct19_1900_IST_utc, 60);
    assert.strictEqual(emptyCheck, undefined, 'No bookings must return undefined (available)');
    console.log('✅ 1.1: No bookings -> Available');

    // 1.2: Confirmed booking at same time -> Booked
    const confirmedSession = {
      id: 'sess-confirmed-1',
      teacherId: teacherA,
      scheduledAt: oct19_1900_ISO,
      durationMin: 60,
      status: 'confirmed'
    };
    const confirmedCheck = isSlotConflicting([confirmedSession], teacherA, oct19_1900_IST_utc, 60);
    assert.ok(confirmedCheck, 'Confirmed booking at same time must conflict');
    assert.strictEqual(confirmedCheck?.id, 'sess-confirmed-1');
    console.log('✅ 1.2: Confirmed booking at same time -> Booked');

    // 1.3: Accepted booking at same time -> Booked
    const acceptedSession = {
      id: 'sess-accepted-1',
      teacherId: teacherA,
      scheduledAt: oct19_1900_ISO,
      durationMin: 60,
      status: 'accepted'
    };
    const acceptedCheck = isSlotConflicting([acceptedSession], teacherA, oct19_1900_IST_utc, 60);
    assert.ok(acceptedCheck, 'Accepted booking at same time must conflict');
    console.log('✅ 1.3: Accepted booking at same time -> Booked');

    // 1.4: Cancelled booking at same time -> Available
    const cancelledSession = {
      id: 'sess-cancelled-1',
      teacherId: teacherA,
      scheduledAt: oct19_1900_ISO,
      durationMin: 60,
      status: 'cancelled'
    };
    const cancelledCheck = isSlotConflicting([cancelledSession], teacherA, oct19_1900_IST_utc, 60);
    assert.strictEqual(cancelledCheck, undefined, 'Cancelled booking at same time must NOT conflict');
    console.log('✅ 1.4: Cancelled booking at same time -> Available');

    // 1.5: Declined booking at same time -> Available
    const declinedSession = {
      id: 'sess-declined-1',
      teacherId: teacherA,
      scheduledAt: oct19_1900_ISO,
      durationMin: 60,
      status: 'declined'
    };
    const declinedCheck = isSlotConflicting([declinedSession], teacherA, oct19_1900_IST_utc, 60);
    assert.strictEqual(declinedCheck, undefined, 'Declined booking must NOT conflict');
    console.log('✅ 1.5: Declined booking at same time -> Available');

    // 1.6: Completed booking at same time -> Available
    const completedSession = {
      id: 'sess-completed-1',
      teacherId: teacherA,
      scheduledAt: oct19_1900_ISO,
      durationMin: 60,
      status: 'completed'
    };
    const completedCheck = isSlotConflicting([completedSession], teacherA, oct19_1900_IST_utc, 60);
    assert.strictEqual(completedCheck, undefined, 'Completed booking must NOT conflict');
    console.log('✅ 1.6: Completed booking at same time -> Available');

    // 1.7: Overlapping but not identical times -> Booked
    // Existing is 19:00 - 20:00 (60m). Requested is 19:15 (15 min in) -> Overlap!
    const oct19_1915_utc = oct19_1900_IST_utc + 15 * 60 * 1000;
    const partialOverlapCheck = isSlotConflicting([confirmedSession], teacherA, oct19_1915_utc, 60);
    assert.ok(partialOverlapCheck, '19:15 request overlapping with 19:00-20:00 session must conflict');
    console.log('✅ 1.7: Overlapping but non-identical times -> Booked');

    // 1.8: Adjacent times -> Available (end-exclusive)
    // Existing is 19:00 - 20:00. Requested is 20:00 - 21:00.
    const oct19_2000_utc = oct19_1900_IST_utc + 60 * 60 * 1000;
    const adjacentCheck = isSlotConflicting([confirmedSession], teacherA, oct19_2000_utc, 60);
    assert.strictEqual(adjacentCheck, undefined, 'Adjacent slot (20:00 after 19:00-20:00) must NOT conflict');
    console.log('✅ 1.8: Adjacent times -> Available (end-exclusive)');

    // 1.9: Another teacher's booking at same time -> Available
    const otherTeacherCheck = isSlotConflicting([confirmedSession], teacherB, oct19_1900_IST_utc, 60);
    assert.strictEqual(otherTeacherCheck, undefined, "Another teacher's booking must NOT block teacherB");
    console.log("✅ 1.9: Another teacher's booking at same time -> Available");

    // 1.10: Timezone edge cases around midnight IST / UTC
    // 23:30 IST on Oct 19 is 18:00 UTC on Oct 19.
    // 00:30 IST on Oct 20 is 19:00 UTC on Oct 19.
    const oct19_2330_IST = getUtcTimestampFromTz(2026, 10, 19, 23, 30, 'Asia/Kolkata');
    const oct20_0030_IST = getUtcTimestampFromTz(2026, 10, 20, 0, 30, 'Asia/Kolkata');

    const midnightSession = {
      id: 'sess-midnight-1',
      teacherId: teacherA,
      scheduledAt: new Date(oct19_2330_IST).toISOString(),
      durationMin: 60, // 23:30 IST to 00:30 IST
      status: 'confirmed'
    };

    // Check request at 23:45 IST (overlaps midnight session)
    const oct19_2345_IST = getUtcTimestampFromTz(2026, 10, 19, 23, 45, 'Asia/Kolkata');
    const midnightOverlap = isSlotConflicting([midnightSession], teacherA, oct19_2345_IST, 60);
    assert.ok(midnightOverlap, 'Request crossing midnight IST overlapping existing session must conflict');

    // Check request at 00:30 IST on next day (adjacent, end-exclusive)
    const nextDayAdjacent = isSlotConflicting([midnightSession], teacherA, oct20_0030_IST, 60);
    assert.strictEqual(nextDayAdjacent, undefined, 'Slot starting exactly at 00:30 IST must be available');
    console.log('✅ 1.10: Timezone edge cases around midnight IST/UTC verified');

    // ==================================================================
    // PART 2: API Endpoints (GET slot-check & booked-slots)
    // ==================================================================
    console.log('\n--- PART 2: API Endpoints (slot-check & booked-slots) ---');

    const apiTeacherId = 'teacher-api-' + Date.now();
    const apiTeacher = {
      id: apiTeacherId,
      name: 'Dr. API Precision',
      role: 'teacher',
      hourlyRate: 499,
      availability: undefined // Test teacher with undefined availability!
    };
    inMemoryUsers.push(apiTeacher);

    // 2.1: GET /api/teachers/:teacherId/slot-check on empty schedule -> available
    const check1Res = await fetch(`${baseUrl}/api/teachers/${apiTeacherId}/slot-check?scheduledAt=${encodeURIComponent(oct19_1900_ISO)}&durationMin=60`);
    const check1Data = await check1Res.json();
    assert.strictEqual(check1Res.status, 200);
    assert.strictEqual(check1Data.available, true);
    assert.strictEqual(check1Data.conflict, false);
    console.log('✅ 2.1: GET slot-check on empty schedule returns available: true');

    // Add a confirmed session in memory for apiTeacherId
    const apiSession = {
      id: 'sess-api-conflict-' + Date.now(),
      title: 'Active Mentoring',
      teacherId: apiTeacherId,
      studentId: 'student-test-1',
      scheduledAt: oct19_1900_ISO,
      durationMin: 60,
      status: 'confirmed'
    };
    inMemorySessions.push(apiSession);

    // 2.2: GET /api/teachers/:teacherId/slot-check on booked slot -> conflict: true
    const check2Res = await fetch(`${baseUrl}/api/teachers/${apiTeacherId}/slot-check?scheduledAt=${encodeURIComponent(oct19_1900_ISO)}&durationMin=60`);
    const check2Data = await check2Res.json();
    assert.strictEqual(check2Res.status, 200);
    assert.strictEqual(check2Data.available, false);
    assert.strictEqual(check2Data.conflict, true);
    assert.strictEqual(check2Data.conflictingSession?.id, apiSession.id);
    console.log('✅ 2.2: GET slot-check on booked slot returns conflict: true with conflictingSession');

    // 2.3: GET /api/teachers/:teacherId/booked-slots -> returns active booking
    const bookedRes = await fetch(`${baseUrl}/api/teachers/${apiTeacherId}/booked-slots`);
    const bookedData = await bookedRes.json();
    assert.strictEqual(bookedRes.status, 200);
    assert.ok(Array.isArray(bookedData.bookedSlots));
    assert.strictEqual(bookedData.bookedSlots.length, 1);
    assert.strictEqual(bookedData.bookedSlots[0].id, apiSession.id);
    console.log('✅ 2.3: GET booked-slots returns active teacher bookings');

    // Cancel the session
    apiSession.status = 'cancelled';

    // 2.4: GET slot-check after cancellation -> available: true
    const check3Res = await fetch(`${baseUrl}/api/teachers/${apiTeacherId}/slot-check?scheduledAt=${encodeURIComponent(oct19_1900_ISO)}&durationMin=60`);
    const check3Data = await check3Res.json();
    assert.strictEqual(check3Res.status, 200);
    assert.strictEqual(check3Data.available, true);
    assert.strictEqual(check3Data.conflict, false);
    console.log('✅ 2.4: GET slot-check after session cancelled returns available: true');

    // ==================================================================
    // PART 3: Server-side Booking Creation (POST /api/sessions) Validation
    // ==================================================================
    console.log('\n--- PART 3: Server-side Booking Creation Validation ---');

    const studentUser = {
      id: 'student-booking-' + Date.now(),
      name: 'Booking Student',
      role: 'student',
      tokenBalance: 50
    };
    inMemoryUsers.push(studentUser);

    const bookingSlotUTC = getUtcTimestampFromTz(2026, 10, 19, 19, 0, 'Asia/Kolkata');
    const bookingSlotISO = new Date(bookingSlotUTC).toISOString();

    // 3.1: Booking teacher with undefined availability succeeds (open schedule)
    const book1Res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${studentUser.id}`
      },
      body: JSON.stringify({
        title: 'New Mentoring Lecture',
        teacherId: apiTeacherId,
        studentId: studentUser.id,
        scheduledAt: bookingSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    const book1Data = await book1Res.json();
    assert.ok(book1Res.status === 200 || book1Res.status === 201, `Expected 200/201, got ${book1Res.status}`);
    console.log('✅ 3.1: Teacher with undefined availability books successfully without false conflict');

    // 3.2: Immediate second booking of same slot rejected with 409 SLOT_CONFLICT
    const book2Res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${studentUser.id}`
      },
      body: JSON.stringify({
        title: 'Duplicate Mentoring Lecture',
        teacherId: apiTeacherId,
        studentId: studentUser.id,
        scheduledAt: bookingSlotISO,
        durationMin: 60,
        payWithTokens: true
      })
    });
    const book2Data = await book2Res.json();
    assert.strictEqual(book2Res.status, 409, 'Duplicate booking must be rejected with HTTP 409');
    assert.strictEqual(book2Data.conflict, true);
    assert.strictEqual(book2Data.code, 'SLOT_CONFLICT');
    console.log('✅ 3.2: Duplicate slot booking rejected with HTTP 409 SLOT_CONFLICT');

    console.log('\n====================================================');
    console.log('🎉 ALL PRECISION SLOT AVAILABILITY TESTS PASSED!');
    console.log('====================================================\n');
  } finally {
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
  }
}

runPrecisionTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
