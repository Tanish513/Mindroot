import type { AddressInfo } from 'net';
import assert from 'assert';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
delete process.env.DIRECT_URL;
delete process.env.DEMO_MODE;
delete process.env.ADMIN_PASSWORD;
delete process.env.ADMIN_EMAIL;

import {
  app,
  server,
  io,
  inMemoryUsers,
  syncWithDatabasePromise
} from '../src/index';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

async function runAdminAuthHardeningTests() {
  console.log('========================================================================');
  console.log('🧪 Starting Admin Auth Hardening & Token Version Strictness Suite');
  console.log('========================================================================\n');

  if (syncWithDatabasePromise) await syncWithDatabasePromise;

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    const ts = Date.now();

    // =========================================================================
    // PART 1: ADMIN LOGIN BYPASS VULNERABILITY GATING
    // =========================================================================
    console.log('\n--- PART 1: ADMIN CREDENTIAL GATING OUTSIDE DEMO MODE ---');

    // 1. Outside DEMO_MODE (DEMO_MODE unset/undefined, no explicit env ADMIN_PASSWORD)
    delete process.env.DEMO_MODE;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_EMAIL;

    const noDemoLogin1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin',
        password: 'admin123'
      })
    });
    assert.strictEqual(
      noDemoLogin1.status,
      401,
      'When DEMO_MODE is unset, default admin credentials ("admin" / "admin123") must NOT issue JWT (expected 401)'
    );
    const noDemoJson1 = await noDemoLogin1.json();
    assert.strictEqual(noDemoJson1.token, undefined, 'No admin token must be issued outside DEMO_MODE');
    console.log('✅ Admin login with "admin" / "admin123" rejected with 401 when DEMO_MODE is unset.');

    const noDemoLogin2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user-admin',
        password: 'admin@123'
      })
    });
    assert.strictEqual(
      noDemoLogin2.status,
      401,
      'When DEMO_MODE is unset, "user-admin" / "admin@123" must NOT issue JWT (expected 401)'
    );
    console.log('✅ Admin login with "user-admin" / "admin@123" rejected with 401 when DEMO_MODE is unset.');

    // 2. Inside DEMO_MODE=true
    process.env.DEMO_MODE = 'true';

    const demoLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin',
        password: 'admin123'
      })
    });
    assert.strictEqual(demoLogin.status, 200, 'When DEMO_MODE=true, demo admin login must succeed with 200');
    const demoJson = await demoLogin.json();
    assert.ok(demoJson.token, 'Demo admin login must return JWT');
    assert.strictEqual(demoJson.user?.role, 'admin', 'Demo admin user role must be admin');
    console.log('✅ Admin login with "admin" / "admin123" succeeds with 200 and admin role when DEMO_MODE=true.');

    // Reset DEMO_MODE
    delete process.env.DEMO_MODE;

    // =========================================================================
    // PART 2: STRICT TOKENVERSION MATCHING ON HTTP (requireAuth)
    // =========================================================================
    console.log('\n--- PART 2: STRICT TOKENVERSION MATCHING ON HTTP ---');

    const testUser = {
      id: `tv-user-${ts}`,
      name: 'Token Version User',
      email: `tv.user.${ts}@example.com`,
      role: 'student',
      tokenVersion: 2
    };
    inMemoryUsers.push(testUser as any);

    // (a) Exact match (tokenVersion === 2) -> 200 OK
    const exactToken = jwt.sign(
      { userId: testUser.id, name: testUser.name, role: testUser.role, tokenVersion: 2 },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );
    const exactRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${exactToken}` }
    });
    assert.strictEqual(exactRes.status, 200, 'Exact tokenVersion match must be accepted (200)');
    console.log('✅ Matching tokenVersion (2 === 2) accepted with 200.');

    // (b) Stale lower tokenVersion (tokenVersion === 1 < 2) -> 401
    const staleToken = jwt.sign(
      { userId: testUser.id, name: testUser.name, role: testUser.role, tokenVersion: 1 },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );
    const staleRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${staleToken}` }
    });
    assert.strictEqual(staleRes.status, 401, 'Stale lower tokenVersion must be rejected (401)');
    const staleJson = await staleRes.json();
    assert.ok(staleJson.error?.includes('Stale tokenVersion'), 'Error must note stale tokenVersion');
    console.log('✅ Stale tokenVersion (1 < 2) rejected with 401.');

    // (c) Future higher tokenVersion (tokenVersion === 99 > 2) -> 401
    const futureToken = jwt.sign(
      { userId: testUser.id, name: testUser.name, role: testUser.role, tokenVersion: 99 },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );
    const futureRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${futureToken}` }
    });
    assert.strictEqual(futureRes.status, 401, 'Future tokenVersion must be rejected with 401');
    const futureJson = await futureRes.json();
    assert.ok(futureJson.error?.includes('Stale tokenVersion'), 'Error must reject non-matching tokenVersion');
    console.log('✅ Future tokenVersion (99 > 2) rejected with 401.');

    // (d) Missing tokenVersion claim -> 401
    const missingClaimToken = jwt.sign(
      { userId: testUser.id, name: testUser.name, role: testUser.role },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );
    const missingClaimRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${missingClaimToken}` }
    });
    assert.strictEqual(missingClaimRes.status, 401, 'Missing tokenVersion claim must be rejected (401)');
    console.log('✅ Missing tokenVersion claim rejected with 401.');

    // =========================================================================
    // PART 3: STRICT TOKENVERSION MATCHING ON WEBSOCKET HANDSHAKE
    // =========================================================================
    console.log('\n--- PART 3: STRICT TOKENVERSION MATCHING ON WEBSOCKET HANDSHAKE ---');

    // (a) Exact match connects cleanly
    const wsExact = await new Promise<ClientSocketType>((resolve, reject) => {
      const sock = ClientSocket(baseUrl, {
        auth: { token: exactToken },
        transports: ['websocket'],
        reconnection: false
      });
      sock.on('connect', () => resolve(sock));
      sock.on('connect_error', (err) => reject(err));
    });
    assert.ok(wsExact.connected, 'WebSocket must connect with matching tokenVersion');
    wsExact.disconnect();
    console.log('✅ WebSocket connects with matching tokenVersion (2 === 2).');

    // (b) Stale lower tokenVersion is rejected at handshake
    await new Promise<void>((resolve, reject) => {
      const sock = ClientSocket(baseUrl, {
        auth: { token: staleToken },
        transports: ['websocket'],
        reconnection: false
      });
      sock.on('connect', () => {
        sock.disconnect();
        reject(new Error('Stale tokenVersion socket should not connect'));
      });
      sock.on('connect_error', (err) => {
        assert.ok(err.message.includes('tokenVersion'), `Handshake error message expected: ${err.message}`);
        sock.disconnect();
        resolve();
      });
    });
    console.log('✅ WebSocket handshake rejects stale tokenVersion (1 < 2).');

    // (c) Future higher tokenVersion is rejected at handshake
    await new Promise<void>((resolve, reject) => {
      const sock = ClientSocket(baseUrl, {
        auth: { token: futureToken },
        transports: ['websocket'],
        reconnection: false
      });
      sock.on('connect', () => {
        sock.disconnect();
        reject(new Error('Future tokenVersion socket should not connect'));
      });
      sock.on('connect_error', (err) => {
        assert.ok(err.message.includes('tokenVersion'), `Handshake error message expected: ${err.message}`);
        sock.disconnect();
        resolve();
      });
    });
    console.log('✅ WebSocket handshake rejects signed future tokenVersion (99 > 2).');

    console.log('\n========================================================================');
    console.log('🎉 ALL ADMIN AUTH HARDENING & TOKEN VERSION TESTS PASSED SUCCESSFULLY');
    console.log('========================================================================\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runAdminAuthHardeningTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  });
