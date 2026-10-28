import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';

import {
  app,
  inMemoryUsers,
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

async function runVisitStreakTests() {
  console.log('====================================================');
  console.log('🧪 Starting Daily Visit & Streak Verification Tests');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // TEST 1: First visit records once
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: First visit records once ---');
    const user1Id = `user-visit-1-${timestamp}`;
    const user1 = {
      id: user1Id,
      name: 'First Visitor',
      email: `${user1Id}@test.com`,
      role: 'student',
      streak: 0,
      lastActiveDate: '',
      streakHistory: []
    };
    inMemoryUsers.push(user1);
    const token1 = createToken(user1Id);

    const res1 = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token1}`
      },
      body: JSON.stringify({ tz: 'Asia/Kolkata' })
    });
    assert.strictEqual(res1.status, 200, `First visit should return HTTP 200, got ${res1.status}`);
    const data1 = await res1.json();
    assert.strictEqual(data1.success, true, 'Visit response should be success: true');
    assert.strictEqual(data1.isFirstVisitToday, true, 'isFirstVisitToday should be true on first visit');
    assert.ok(data1.todayStr, 'todayStr should be returned');
    assert.strictEqual(data1.streak, 1, 'Streak should be incremented to 1');

    // Verify in-memory user record
    assert.strictEqual(user1.streak, 1, 'In-memory streak should be 1');
    assert.strictEqual(user1.lastActiveDate, data1.todayStr, 'lastActiveDate should match todayStr');
    assert.strictEqual(user1.streakHistory.length, 1, 'streakHistory should have 1 entry');
    assert.strictEqual(user1.streakHistory[0].date, data1.todayStr);
    assert.ok(user1.streakHistory[0].activities.includes('visit'), 'streakHistory should include "visit" activity');
    console.log('✅ TEST 1 PASSED: First visit recorded once, streak initialized to 1, isFirstVisitToday: true');

    // -------------------------------------------------------------
    // TEST 2: A second visit the same day does not duplicate
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Second visit the same day does not duplicate ---');
    const res2 = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token1}`
      },
      body: JSON.stringify({ tz: 'Asia/Kolkata' })
    });
    assert.strictEqual(res2.status, 200, `Second visit should return HTTP 200, got ${res2.status}`);
    const data2 = await res2.json();
    assert.strictEqual(data2.success, true, 'Visit response should be success: true');
    assert.strictEqual(data2.isFirstVisitToday, false, 'isFirstVisitToday should be false on second visit');
    assert.strictEqual(data2.streak, 1, 'Streak should remain 1 on same day');

    // Verify in-memory user record not duplicated
    assert.strictEqual(user1.streak, 1, 'In-memory streak should still be 1');
    assert.strictEqual(user1.streakHistory.length, 1, 'streakHistory length should still be 1');
    const visitCount = user1.streakHistory[0].activities.filter((a: string) => a === 'visit').length;
    assert.strictEqual(visitCount, 1, 'activities should not contain duplicate "visit"');
    console.log('✅ TEST 2 PASSED: Second visit does not duplicate record or streak, isFirstVisitToday: false');

    // -------------------------------------------------------------
    // TEST 3: 10 Concurrent visits create one record
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: 10 Concurrent visits create one record ---');
    const user3Id = `user-visit-concurrent-${timestamp}`;
    const user3 = {
      id: user3Id,
      name: 'Concurrent Visitor',
      email: `${user3Id}@test.com`,
      role: 'student',
      streak: 0,
      lastActiveDate: '',
      streakHistory: []
    };
    inMemoryUsers.push(user3);
    const token3 = createToken(user3Id);

    const concurrentRequests = Array.from({ length: 10 }, () =>
      fetch(`${baseUrl}/api/users/${user3Id}/visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token3}`
        },
        body: JSON.stringify({ tz: 'Asia/Kolkata' })
      })
    );

    const responses = await Promise.all(concurrentRequests);
    const results = await Promise.all(responses.map(r => r.json()));

    assert.ok(responses.every(r => r.status === 200), 'All 10 concurrent requests must return HTTP 200');
    assert.ok(results.every(d => d.success === true), 'All 10 results must have success: true');

    const firstVisitCount = results.filter(d => d.isFirstVisitToday === true).length;
    const nonFirstVisitCount = results.filter(d => d.isFirstVisitToday === false).length;

    assert.strictEqual(firstVisitCount, 1, `Exactly 1 response should have isFirstVisitToday: true, got ${firstVisitCount}`);
    assert.strictEqual(nonFirstVisitCount, 9, `Exactly 9 responses should have isFirstVisitToday: false, got ${nonFirstVisitCount}`);

    // Verify user3 in-memory record has exactly 1 streakHistory entry and 1 'visit'
    assert.strictEqual(user3.streakHistory.length, 1, 'User streakHistory must have exactly 1 date entry');
    const user3Visits = user3.streakHistory[0].activities.filter((a: string) => a === 'visit').length;
    assert.strictEqual(user3Visits, 1, 'User activities must contain "visit" exactly once');
    assert.strictEqual(user3.streak, 1, 'User streak must be exactly 1');
    console.log('✅ TEST 3 PASSED: Mutex serialization guaranteed exactly 1 first visit and 9 idempotent follow-ups; exactly 1 record created');

    // -------------------------------------------------------------
    // TEST 4: Local date boundary handled
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Local date boundary handled ---');
    const user4Id = `user-visit-tz-${timestamp}`;
    const user4 = {
      id: user4Id,
      name: 'Timezone Visitor',
      email: `${user4Id}@test.com`,
      role: 'student',
      streak: 0,
      lastActiveDate: '',
      streakHistory: []
    };
    inMemoryUsers.push(user4);
    const token4 = createToken(user4Id);

    // Test with specific timezones
    const resAuckland = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token4}`
      },
      body: JSON.stringify({ tz: 'Pacific/Auckland' })
    });
    assert.strictEqual(resAuckland.status, 200);
    const dataAuckland = await resAuckland.json();
    assert.ok(dataAuckland.todayStr, 'Auckland dateStr should be present');

    const expectedAucklandStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    assert.strictEqual(dataAuckland.todayStr, expectedAucklandStr, `Auckland date should match calculated ${expectedAucklandStr}`);

    const resHonolulu = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token4}`
      },
      body: JSON.stringify({ tz: 'Pacific/Honolulu' })
    });
    assert.strictEqual(resHonolulu.status, 200);
    const dataHonolulu = await resHonolulu.json();
    const expectedHonoluluStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Honolulu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    assert.strictEqual(dataHonolulu.todayStr, expectedHonoluluStr, `Honolulu date should match calculated ${expectedHonoluluStr}`);
    console.log(`✅ TEST 4 PASSED: Local date boundary cleanly respected across timezones (Auckland=${expectedAucklandStr}, Honolulu=${expectedHonoluluStr})`);

    // -------------------------------------------------------------
    // TEST 5: Unauthenticated request rejected
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Unauthenticated and unauthorized requests rejected ---');
    // Missing token
    const resUnauth = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tz: 'Asia/Kolkata' })
    });
    assert.strictEqual(resUnauth.status, 401, `Unauthenticated request should return 401, got ${resUnauth.status}`);

    // Forbidden cross-user attempt
    const resForbidden = await fetch(`${baseUrl}/api/users/${user1Id}/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token3}` // token3 trying to visit for user1Id
      },
      body: JSON.stringify({ tz: 'Asia/Kolkata' })
    });
    assert.strictEqual(resForbidden.status, 403, `Cross-user visit without admin role should return 403, got ${resForbidden.status}`);
    console.log('✅ TEST 5 PASSED: Unauthenticated returns 401, cross-user visit returns 403');

    console.log('\n====================================================');
    console.log('🎉 ALL 5 DAILY VISIT & STREAK TESTS PASSED (5/5)');
    console.log('====================================================');
  } finally {
    serverInstance.close();
  }
}

runVisitStreakTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
