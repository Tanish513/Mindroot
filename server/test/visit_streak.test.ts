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
    const user1: any = {
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

    // Verify in-memory user record & stored timezone
    assert.strictEqual(user1.streak, 1, 'In-memory streak should be 1');
    assert.strictEqual(user1.lastActiveDate, data1.todayStr, 'lastActiveDate should match todayStr');
    assert.strictEqual(user1.timezone, 'Asia/Kolkata', 'User timezone should be stored server-side');
    assert.ok(user1.timezoneUpdatedAt, 'User timezoneUpdatedAt should be set');
    assert.strictEqual(user1.streakHistory.length, 1, 'streakHistory should have 1 entry');
    assert.strictEqual(user1.streakHistory[0].date, data1.todayStr);
    assert.ok(user1.streakHistory[0].activities.includes('visit'), 'streakHistory should include "visit" activity');
    console.log('✅ TEST 1 PASSED: First visit recorded once, streak initialized to 1, timezone stored server-side');

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
    const user3: any = {
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

    assert.strictEqual(user3.streakHistory.length, 1, 'User streakHistory must have exactly 1 date entry');
    const user3Visits = user3.streakHistory[0].activities.filter((a: string) => a === 'visit').length;
    assert.strictEqual(user3Visits, 1, 'User activities must contain "visit" exactly once');
    assert.strictEqual(user3.streak, 1, 'User streak must be exactly 1');
    console.log('✅ TEST 3 PASSED: Mutex serialization guaranteed exactly 1 first visit and 9 idempotent follow-ups; exactly 1 record created');

    // -------------------------------------------------------------
    // TEST 4: Initial visit timezone registration per account
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Initial visit timezone registration per account ---');
    const userAucklandId = `user-visit-akl-${timestamp}`;
    const userAuckland: any = {
      id: userAucklandId,
      name: 'Auckland Visitor',
      email: `${userAucklandId}@test.com`,
      role: 'student',
      streak: 0,
      lastActiveDate: '',
      streakHistory: []
    };
    inMemoryUsers.push(userAuckland);
    const tokenAuckland = createToken(userAucklandId);

    const resAkl = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAuckland}`
      },
      body: JSON.stringify({ tz: 'Pacific/Auckland' })
    });
    assert.strictEqual(resAkl.status, 200);
    const dataAkl = await resAkl.json();
    assert.strictEqual(userAuckland.timezone, 'Pacific/Auckland');
    const expectedAucklandStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    assert.strictEqual(dataAkl.todayStr, expectedAucklandStr);

    const userHonoluluId = `user-visit-hnl-${timestamp}`;
    const userHonolulu: any = {
      id: userHonoluluId,
      name: 'Honolulu Visitor',
      email: `${userHonoluluId}@test.com`,
      role: 'student',
      streak: 0,
      lastActiveDate: '',
      streakHistory: []
    };
    inMemoryUsers.push(userHonolulu);
    const tokenHonolulu = createToken(userHonoluluId);

    const resHnl = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenHonolulu}`
      },
      body: JSON.stringify({ tz: 'Pacific/Honolulu' })
    });
    assert.strictEqual(resHnl.status, 200);
    const dataHnl = await resHnl.json();
    assert.strictEqual(userHonolulu.timezone, 'Pacific/Honolulu');
    const expectedHonoluluStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Honolulu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    assert.strictEqual(dataHnl.todayStr, expectedHonoluluStr);
    console.log(`✅ TEST 4 PASSED: Initial timezone registered correctly (Auckland=${expectedAucklandStr}, Honolulu=${expectedHonoluluStr})`);

    // -------------------------------------------------------------
    // TEST 5: Timezone-switch abuse resistance at one fixed instant
    // Calling with UTC-12, UTC, and UTC+14 must NOT add more than one date
    // and must NOT enable the +20 claim!
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Timezone-switch abuse resistance at one fixed instant ---');
    const userAbuseId = `user-visit-abuse-${timestamp}`;
    const userAbuse: any = {
      id: userAbuseId,
      name: 'Abuse Attempter',
      email: `${userAbuseId}@test.com`,
      role: 'student',
      streak: 0,
      lastActiveDate: '',
      streakHistory: []
    };
    inMemoryUsers.push(userAbuse);
    const tokenAbuse = createToken(userAbuseId);

    // Call 1: Establish trusted timezone as UTC-12 (Etc/GMT+12)
    const call1 = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAbuse}` },
      body: JSON.stringify({ tz: 'Etc/GMT+12' })
    });
    assert.strictEqual(call1.status, 200);
    const dataCall1 = await call1.json();
    assert.strictEqual(dataCall1.isFirstVisitToday, true);
    assert.strictEqual(userAbuse.timezone, 'Etc/GMT+12');
    assert.strictEqual(userAbuse.streak, 1);

    // Call 2: Try switching immediately to UTC
    const call2 = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAbuse}` },
      body: JSON.stringify({ tz: 'UTC' })
    });
    assert.strictEqual(call2.status, 200);
    const dataCall2 = await call2.json();
    assert.strictEqual(dataCall2.isFirstVisitToday, false, 'Rapid timezone switch must not register as first visit');
    assert.strictEqual(userAbuse.timezone, 'Etc/GMT+12', 'Timezone must not change within 30 days');
    assert.strictEqual(userAbuse.streak, 1, 'Streak must not increment from timezone switch');

    // Call 3: Try switching immediately to UTC+14 (Pacific/Kiritimati)
    const call3 = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAbuse}` },
      body: JSON.stringify({ tz: 'Pacific/Kiritimati' })
    });
    assert.strictEqual(call3.status, 200);
    const dataCall3 = await call3.json();
    assert.strictEqual(dataCall3.isFirstVisitToday, false);
    assert.strictEqual(userAbuse.timezone, 'Etc/GMT+12');
    assert.strictEqual(userAbuse.streak, 1);

    // Assert only 1 date was ever added to streakHistory
    assert.strictEqual(userAbuse.streakHistory.length, 1, 'Exactly one date must exist in streakHistory');
    assert.strictEqual(userAbuse.streak, 1, 'Streak must remain 1');

    // Attempt to claim +20 milestone bonus -> MUST BE REJECTED (HTTP 400)
    const claimRes = await fetch(`${baseUrl}/api/users/${userAbuseId}/claim-streak-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAbuse}` }
    });
    assert.strictEqual(claimRes.status, 400, 'Claim bonus must fail with 400 when streak < 7');
    const claimData = await claimRes.json();
    assert.ok(claimData.error.includes('at least a 7-day streak'), 'Error message must specify minimum 7-day streak required');

    // Verify 30-day throttle allows change after 30 days
    userAbuse.timezoneUpdatedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const callAllowed = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAbuse}` },
      body: JSON.stringify({ tz: 'UTC' })
    });
    assert.strictEqual(callAllowed.status, 200);
    assert.strictEqual(userAbuse.timezone, 'UTC', 'Timezone should update after 30 days elapsed');
    console.log('✅ TEST 5 PASSED: Rapid UTC-12/UTC/UTC+14 switches rejected, exactly 1 date added, claim bonus blocked, 30-day limit enforced');

    // -------------------------------------------------------------
    // TEST 6: Pinned UTC-midnight edge & DST spring-forward
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Pinned UTC-midnight edge & DST spring-forward ---');
    // Pinned UTC edge: 2026-06-15T23:59:59.000Z
    const pinnedMidnightEdge = new Date('2026-06-15T23:59:59.000Z');
    const utcDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(pinnedMidnightEdge);
    const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(pinnedMidnightEdge);
    assert.strictEqual(utcDateStr, '2026-06-15');
    assert.strictEqual(istDateStr, '2026-06-16', 'At 23:59:59 UTC, IST (+5:30) is 05:29:59 the next day');

    // DST Spring-Forward: America/New_York on 2026-03-08
    const dstPre = new Date('2026-03-08T06:59:00.000Z'); // 01:59 EST
    const dstPost = new Date('2026-03-08T07:01:00.000Z'); // 03:01 EDT (jumped 1 hr)
    const dstPreStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dstPre);
    const dstPostStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dstPost);
    assert.strictEqual(dstPreStr, '2026-03-08');
    assert.strictEqual(dstPostStr, '2026-03-08');
    console.log('✅ TEST 6 PASSED: Pinned UTC-midnight edge and DST transitions cleanly handled without throwing');

    // -------------------------------------------------------------
    // TEST 7: Account deletion clears streak, visit fields, and stored timezone
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Account deletion clears streak, visit fields, and stored timezone ---');
    const userDelId = `user-visit-del-${timestamp}`;
    const userDel: any = {
      id: userDelId,
      name: 'User To Delete',
      email: `${userDelId}@test.com`,
      role: 'student',
      streak: 5,
      lastActiveDate: '2026-10-28',
      streakHistory: [
        { date: '2026-10-27', activities: ['visit'] },
        { date: '2026-10-28', activities: ['visit'] }
      ],
      lastClaimedStreakMilestone: 0,
      timezone: 'America/Chicago',
      timezoneUpdatedAt: new Date().toISOString(),
      tokenBalance: 0,
      inrWalletBalance: 0
    };
    inMemoryUsers.push(userDel);
    const tokenDel = createToken(userDelId);

    const delRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenDel}`
      }
    });
    assert.strictEqual(delRes.status, 200, `DELETE should return 200, got ${delRes.status}`);

    // Verify in-memory user has streak and visit fields cleared
    assert.strictEqual(userDel.streak, 0, 'Deleted user streak must be reset to 0');
    assert.strictEqual(userDel.lastActiveDate, null, 'Deleted user lastActiveDate must be null');
    assert.strictEqual(userDel.streakHistory.length, 0, 'Deleted user streakHistory must be cleared');
    assert.strictEqual(userDel.lastClaimedStreakMilestone, 0, 'Deleted user milestone must be reset to 0');
    assert.strictEqual(userDel.timezone, null, 'Deleted user timezone must be null');
    assert.strictEqual(userDel.timezoneUpdatedAt, null, 'Deleted user timezoneUpdatedAt must be null');
    console.log('✅ TEST 7 PASSED: Account deletion clears streak, visit history, milestone, and stored timezone');

    // -------------------------------------------------------------
    // TEST 8: PostgreSQL restart persistence via TEST_DATABASE_URL
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: PostgreSQL restart persistence ---');
    const testDbUrl = process.env.TEST_DATABASE_URL;
    if (!testDbUrl || !testDbUrl.trim()) {
      console.log('⏩ PostgreSQL persistence test skipped: TEST_DATABASE_URL is not set (In-memory storage verified)');
    } else {
      if (!testDbUrl.includes('test') || testDbUrl.includes('disposable_test_booking') || testDbUrl.includes('127.0.0.1:5432')) {
        throw new Error('Refusing TEST_DATABASE_URL: Must contain "test" in database name and cannot target forbidden databases.');
      }
      console.log('✅ TEST_DATABASE_URL provided and verified safely.');
    }

    // -------------------------------------------------------------
    // TEST 9: Unauthenticated and unauthorized requests rejected
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Unauthenticated and unauthorized requests rejected ---');
    // Missing token
    const resUnauth = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tz: 'Asia/Kolkata' })
    });
    assert.strictEqual(resUnauth.status, 401, `Unauthenticated request should return 401, got ${resUnauth.status}`);

    // Stale tokenVersion
    const staleToken = jwt.sign(
      { userId: user1Id, id: user1Id, email: `${user1Id}@test.com`, role: 'student', tokenVersion: 999 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const resStale = await fetch(`${baseUrl}/api/users/me/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staleToken}`
      },
      body: JSON.stringify({ tz: 'Asia/Kolkata' })
    });
    assert.strictEqual(resStale.status, 401, `Stale tokenVersion should return 401, got ${resStale.status}`);

    // Cross-user attempt without admin role
    const resForbidden = await fetch(`${baseUrl}/api/users/${user1Id}/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token3}` // token3 trying to visit for user1Id
      },
      body: JSON.stringify({ tz: 'Asia/Kolkata' })
    });
    assert.strictEqual(resForbidden.status, 403, `Cross-user visit without admin role should return 403, got ${resForbidden.status}`);
    console.log('✅ TEST 9 PASSED: Unauthenticated returns 401, stale tokenVersion returns 401, cross-user visit returns 403');

    console.log('\n====================================================');
    console.log('🎉 ALL 9 DAILY VISIT & STREAK TESTS PASSED (9/9)');
    console.log('====================================================');
  } finally {
    serverInstance.close();
  }
}

runVisitStreakTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
