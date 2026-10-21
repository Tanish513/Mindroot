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
  getUtcTimestampFromTz
} from '../src/bookingRules';

import {
  normalizeSessionStatus,
  SessionStatus
} from '../src/sessionStatus';

async function runBookingRequestFlowTests() {
  console.log('====================================================');
  console.log('🚀 Starting Booking Request Flow End-to-End Test Suite');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    const timestamp = Date.now();
    const studentUser = {
      id: `student-test-${timestamp}`,
      name: 'Alice Student',
      email: `alice.${timestamp}@gmail.com`,
      role: 'student',
      tokenBalance: 50
    };
    const targetTeacher = {
      id: `teacher-test-${timestamp}`,
      name: 'Bob Mentor',
      email: `bob.${timestamp}@gmail.com`,
      role: 'teacher',
      hourlyRate: 499,
      upiId: 'bob@okaxis',
      availability: { 'Mon-07:00 PM': true, 'Tue-07:00 PM': true }
    };
    const otherTeacher = {
      id: `other-teacher-${timestamp}`,
      name: 'Charlie Mentor',
      email: `charlie.${timestamp}@gmail.com`,
      role: 'teacher',
      hourlyRate: 599,
      upiId: 'charlie@okaxis'
    };

    inMemoryUsers.push(studentUser as any, targetTeacher as any, otherTeacher as any);

    // 1. Verify Status Normalization
    console.log('--- TEST 1: Status Normalization ---');
    assert.strictEqual(normalizeSessionStatus('pending'), SessionStatus.PENDING);
    assert.strictEqual(normalizeSessionStatus('confirmed'), SessionStatus.CONFIRMED);
    assert.strictEqual(normalizeSessionStatus('accepted'), SessionStatus.CONFIRMED);
    assert.strictEqual(normalizeSessionStatus('declined'), SessionStatus.DECLINED);
    assert.strictEqual(normalizeSessionStatus('rejected'), SessionStatus.DECLINED);
    console.log('✅ Test 1 Passed: Session statuses normalized properly.');

    // 2. Student books a session with targetTeacher
    console.log('\n--- TEST 2: Student Write Path Creates Pending Booking ---');
    const scheduledTimeUtc = getUtcTimestampFromTz(2026, 10, 20, 19, 0, 'Asia/Kolkata');
    const scheduledISO = new Date(scheduledTimeUtc).toISOString();

    const bookRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${studentUser.id}`
      },
      body: JSON.stringify({
        teacherId: targetTeacher.id,
        title: 'Java Mentoring',
        scheduledAt: scheduledISO,
        durationMin: 60,
        maxCapacity: 1
      })
    });

    assert.strictEqual(bookRes.status, 201, 'Booking creation should return HTTP 201');
    const createdSession = await bookRes.json();
    assert.strictEqual(createdSession.teacherId, targetTeacher.id, 'Session teacherId must match selected teacher');
    assert.strictEqual(createdSession.studentId, studentUser.id, 'Session studentId must match student');
    assert.strictEqual(createdSession.status, 'pending', 'Initial status must be pending');
    console.log('✅ Test 2 Passed: Student created pending booking for target teacher.');

    // 3. Teacher Read Path: targetTeacher fetches their sessions
    console.log('\n--- TEST 3: Teacher Read Path Filters Correctly ---');
    const teacherSessionsRes = await fetch(`${baseUrl}/api/sessions`, {
      headers: {
        'Authorization': `Bearer dev-token-${targetTeacher.id}`
      }
    });
    assert.strictEqual(teacherSessionsRes.status, 200);
    const teacherSessions = await teacherSessionsRes.json();
    const hasPending = teacherSessions.some((s: any) => s.id === createdSession.id && s.status === 'pending');
    assert.strictEqual(hasPending, true, 'Target teacher must see the pending booking in their sessions query');

    // 4. Other Teacher Read Path: otherTeacher must NOT see this session
    const otherTeacherRes = await fetch(`${baseUrl}/api/sessions`, {
      headers: {
        'Authorization': `Bearer dev-token-${otherTeacher.id}`
      }
    });
    assert.strictEqual(otherTeacherRes.status, 200);
    const otherSessions = await otherTeacherRes.json();
    const otherHasPending = otherSessions.some((s: any) => s.id === createdSession.id);
    assert.strictEqual(otherHasPending, false, 'Other teacher must not see target teacher bookings');
    console.log('✅ Test 3 & 4 Passed: Read path properly scopes to target teacher.');

    // 5. Unauthorized User Cannot Approve or Decline
    console.log('\n--- TEST 5: Security / Authorization on Session Transitions ---');
    const unauthPatch = await fetch(`${baseUrl}/api/sessions/${createdSession.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${otherTeacher.id}`
      },
      body: JSON.stringify({ status: 'confirmed' })
    });
    assert.strictEqual(unauthPatch.status, 403, 'Unauthorized user should be blocked with HTTP 403');
    console.log('✅ Test 5 Passed: Cross-user approval forbidden.');

    // 6. Target Teacher Approves Session
    console.log('\n--- TEST 6: Target Teacher Confirms Pending Booking ---');
    const approvePatch = await fetch(`${baseUrl}/api/sessions/${createdSession.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${targetTeacher.id}`
      },
      body: JSON.stringify({ status: 'confirmed' })
    });
    assert.strictEqual(approvePatch.status, 200, 'Mentor confirmation should return HTTP 200');
    const approvedSession = await approvePatch.json();
    assert.strictEqual(approvedSession.status, 'confirmed', 'Session status should now be confirmed');

    // Slot is now blocked for targetTeacher
    const conflictCheck = isSlotConflicting(inMemorySessions, targetTeacher.id, scheduledTimeUtc, 60);
    assert.ok(conflictCheck, 'Slot must be blocked after confirmation');
    console.log('✅ Test 6 Passed: Target teacher confirmed booking, slot is now reserved.');

    // 7. Teacher Declines / Rejects
    console.log('\n--- TEST 7: Teacher Declines / Rejects Booking and Slot is Freed ---');
    // Create another pending session
    const scheduledTime2 = getUtcTimestampFromTz(2026, 10, 21, 19, 0, 'Asia/Kolkata');
    const book2Res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${studentUser.id}`
      },
      body: JSON.stringify({
        teacherId: targetTeacher.id,
        title: 'Python Mentoring',
        scheduledAt: new Date(scheduledTime2).toISOString(),
        durationMin: 60,
        maxCapacity: 1
      })
    });
    const session2 = await book2Res.json();
    assert.strictEqual(session2.status, 'pending');

    const declinePatch = await fetch(`${baseUrl}/api/sessions/${session2.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${targetTeacher.id}`
      },
      body: JSON.stringify({ status: 'declined' })
    });
    assert.strictEqual(declinePatch.status, 200);
    const declinedSession = await declinePatch.json();
    assert.strictEqual(declinedSession.status, 'declined');

    // Slot should be free
    const conflictCheck2 = isSlotConflicting(inMemorySessions, targetTeacher.id, scheduledTime2, 60);
    assert.strictEqual(conflictCheck2, undefined, 'Declined session must not block slot');
    console.log('✅ Test 7 Passed: Declined session frees slot.');

    console.log('\n====================================================');
    console.log('🎉 All Booking Request Flow Tests Passed Successfully!');
    console.log('====================================================');
  } finally {
    serverInstance.close();
  }
}

runBookingRequestFlowTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
