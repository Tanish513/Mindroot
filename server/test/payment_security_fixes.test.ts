import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';

process.env.NODE_ENV = 'test';

import {
  app,
  io,
  inMemoryUsers,
  inMemorySessions,
  inMemoryTransactions,
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

async function runPaymentSecurityTests() {
  console.log('====================================================');
  console.log('🔒 Starting Payment Security & Handshake Verification Suite');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  io.attach(serverInstance);

  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    const timestamp = Date.now();
    const teacherId = `teacher-sec-${timestamp}`;
    const studentId = `student-sec-${timestamp}`;
    const bystanderId = `bystander-sec-${timestamp}`;
    const adminId = `admin-sec-${timestamp}`;

    const teacher = {
      id: teacherId,
      name: 'Dr. Turing',
      email: `${teacherId}@test.com`,
      role: 'teacher',
      hourlyRate: 600,
      upiId: 'turing@okaxis'
    };
    const student = {
      id: studentId,
      name: 'Ada Lovelace',
      email: `${studentId}@test.com`,
      role: 'student',
      tokenBalance: 100
    };
    const bystander = {
      id: bystanderId,
      name: 'Unrelated User',
      email: `${bystanderId}@test.com`,
      role: 'student',
      tokenBalance: 50
    };
    const adminUser = {
      id: adminId,
      name: 'Platform Admin',
      email: `${adminId}@test.com`,
      role: 'admin'
    };

    inMemoryUsers.push(teacher as any, student as any, bystander as any, adminUser as any);

    const teacherToken = createToken(teacherId, 'teacher');
    const studentToken = createToken(studentId, 'student');
    const bystanderToken = createToken(bystanderId, 'student');
    const adminToken = createToken(adminId, 'admin');

    // -------------------------------------------------------------
    // TEST 1: Payment Broadcast Scoped Isolation
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Payment Broadcast Scoped Isolation ---');
    const socketTeacher = ioClient(baseUrl, { auth: { token: teacherToken }, transports: ['websocket'] });
    const socketStudent = ioClient(baseUrl, { auth: { token: studentToken }, transports: ['websocket'] });
    const socketBystander = ioClient(baseUrl, { auth: { token: bystanderToken }, transports: ['websocket'] });

    await Promise.all([
      new Promise<void>((r) => socketTeacher.on('connect', () => r())),
      new Promise<void>((r) => socketStudent.on('connect', () => r())),
      new Promise<void>((r) => socketBystander.on('connect', () => r()))
    ]);

    const sessId1 = `sess-broadcast-${timestamp}`;
    const session1 = {
      id: sessId1,
      title: 'Distributed Consensus',
      teacherId,
      studentId,
      amount: 600,
      paymentStatus: 'pending_mentor_confirmation',
      status: 'confirmed',
      utrNumber: '998877665544'
    };
    inMemorySessions.push(session1 as any);

    let bystanderReceivedPaymentReceived = false;
    let bystanderReceivedPaymentConfirmed = false;
    let studentReceivedPaymentConfirmed = false;
    let teacherReceivedPaymentConfirmed = false;

    socketBystander.on('session-payment-received', () => { bystanderReceivedPaymentReceived = true; });
    socketBystander.on('session-payment-confirmed', () => { bystanderReceivedPaymentConfirmed = true; });
    socketStudent.on('session-payment-confirmed', () => { studentReceivedPaymentConfirmed = true; });
    socketTeacher.on('session-payment-confirmed', () => { teacherReceivedPaymentConfirmed = true; });

    // Teacher confirms payment
    const confirmRes = await fetch(`${baseUrl}/api/sessions/${sessId1}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      }
    });
    assert.strictEqual(confirmRes.status, 200, 'Teacher confirming payment should succeed with 200');

    await new Promise((r) => setTimeout(r, 150));

    assert.strictEqual(teacherReceivedPaymentConfirmed, true, 'Teacher socket must receive payment-confirmed');
    assert.strictEqual(studentReceivedPaymentConfirmed, true, 'Student socket must receive payment-confirmed');
    assert.strictEqual(bystanderReceivedPaymentReceived, false, 'Unrelated socket must NOT receive session-payment-received');
    assert.strictEqual(bystanderReceivedPaymentConfirmed, false, 'Unrelated socket must NOT receive session-payment-confirmed');
    console.log('✅ TEST 1 PASSED: Payment broadcasts are strictly scoped; unrelated socket receives 0 payment events.');

    // -------------------------------------------------------------
    // TEST 2: Paid Swap Price Tampering Protection
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Paid Swap Price Tampering Protection ---');

    // 2a: Client sends price lower than serverComputedPrice -> Rejected 400 PRICE_TAMPERING_DETECTED
    const tamperRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Python ↔ Rust Mentoring Swap',
        teacherId,
        studentId,
        isSwap: true,
        durationMin: 60,
        pricePerStudent: 100 // Tampered! Server calculated is 600
      })
    });
    assert.strictEqual(tamperRes.status, 400, 'Tampered swap price must return HTTP 400');
    const tamperBody = await tamperRes.json();
    assert.strictEqual(tamperBody.code, 'PRICE_TAMPERING_DETECTED');
    console.log('  Subtest 2a: Client-tampered lower swap price correctly rejected with PRICE_TAMPERING_DETECTED');

    // 2b: Explicitly free swap (isFree: true or pricePerStudent: 0) -> Allowed
    const freeTime = new Date(timestamp + 3600000 * 2).toISOString();
    const freeSwapRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Free Skill Swap ↔ Peer Discussion',
        teacherId,
        studentId,
        isSwap: true,
        scheduledAt: freeTime,
        durationMin: 60,
        isFree: true,
        pricePerStudent: 0
      })
    });
    assert.strictEqual(freeSwapRes.status, 201, 'Free swap should be accepted with status 201');
    const freeSwapBody = await freeSwapRes.json();
    assert.strictEqual(freeSwapBody.amount, 0, 'Free swap amount must be 0');
    console.log('  Subtest 2b: Explicitly free swap successfully booked at price ₹0');

    // 2c: Paid swap with server session price -> Allowed
    const paidTime = new Date(timestamp + 3600000 * 4).toISOString();
    const paidSwapRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Full Rate Swap ↔ Advanced Rust',
        teacherId,
        studentId,
        isSwap: true,
        scheduledAt: paidTime,
        durationMin: 60,
        pricePerStudent: 600
      })
    });
    assert.strictEqual(paidSwapRes.status, 201, 'Valid paid swap should be accepted with status 201');
    const paidSwapBody = await paidSwapRes.json();
    assert.strictEqual(paidSwapBody.amount, 600, 'Session price must match server computed price ₹600');
    console.log('  Subtest 2c: Legitimate paid swap accepted with authoritative server price ₹600');

    // 2d: Zero price sent on paid swap without isFree flag -> Rejected with 400
    const zeroPriceRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Paid Swap With Sneaky Zero Price ↔ Compilers',
        teacherId,
        studentId,
        isSwap: true,
        scheduledAt: new Date(timestamp + 3600000 * 6).toISOString(),
        durationMin: 60,
        pricePerStudent: 0 // Client attempts zero price without isFree
      })
    });
    assert.strictEqual(zeroPriceRes.status, 400, 'Zero price on non-free swap must return HTTP 400');
    const zeroPriceBody = await zeroPriceRes.json();
    assert.strictEqual(zeroPriceBody.code, 'PRICE_TAMPERING_DETECTED');
    console.log('  Subtest 2d: Zero price on paid swap correctly rejected with PRICE_TAMPERING_DETECTED');

    // 2e: Mentor has NO hourly rate configured and NO original session exists -> Rejected with 400 SWAP_PRICE_UNAVAILABLE
    const noRateMentorId = `mentor-norate-${timestamp}`;
    inMemoryUsers.push({
      id: noRateMentorId,
      name: 'No Rate Mentor',
      email: `${noRateMentorId}@test.com`,
      role: 'teacher',
      upiId: 'norate@okaxis'
    } as any);

    const noRateSwapRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Swap With No-Rate Mentor ↔ Data Structures',
        teacherId: noRateMentorId,
        studentId,
        isSwap: true,
        scheduledAt: new Date(timestamp + 3600000 * 8).toISOString(),
        durationMin: 60,
        pricePerStudent: 300 // Untrusted client price
      })
    });
    assert.strictEqual(noRateSwapRes.status, 400, 'Swap with no mentor rate and no original session must return 400');
    const noRateBody = await noRateSwapRes.json();
    assert.strictEqual(noRateBody.code, 'SWAP_PRICE_UNAVAILABLE');
    console.log('  Subtest 2e: Paid swap without mentor rate or original session correctly rejected with SWAP_PRICE_UNAVAILABLE');

    // 2f: Mentor has NO hourly rate, but original session exists with server price ₹450
    const origSessId = `orig-sess-${timestamp}`;
    inMemorySessions.push({
      id: origSessId,
      title: 'Original Mentoring Session',
      teacherId: noRateMentorId,
      studentId,
      amount: 450,
      pricePerStudent: 450,
      status: 'confirmed'
    } as any);

    // 2f-i: Client attempts to send low price (₹50) or zero (₹0) -> Rejected with 400 PRICE_TAMPERING_DETECTED
    const origLowPriceRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Swap Referring Original Session ↔ Operating Systems',
        teacherId: noRateMentorId,
        studentId,
        isSwap: true,
        originalSessionId: origSessId,
        scheduledAt: new Date(timestamp + 3600000 * 10).toISOString(),
        durationMin: 60,
        pricePerStudent: 50 // Lower than original server price ₹450
      })
    });
    assert.strictEqual(origLowPriceRes.status, 400, 'Low price on swap with original session must return HTTP 400');
    const origLowBody = await origLowPriceRes.json();
    assert.strictEqual(origLowBody.code, 'PRICE_TAMPERING_DETECTED');
    console.log('  Subtest 2f-i: Low client price against original session rate correctly rejected with PRICE_TAMPERING_DETECTED');

    // 2f-ii: Client sends matching price or omits price -> Uses original session server price ₹450
    const origValidSwapRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Swap Referring Original Session ↔ Operating Systems',
        teacherId: noRateMentorId,
        studentId,
        isSwap: true,
        originalSessionId: origSessId,
        scheduledAt: new Date(timestamp + 3600000 * 12).toISOString(),
        durationMin: 60
      })
    });
    assert.strictEqual(origValidSwapRes.status, 201, 'Valid swap using original session rate should succeed with 201');
    const origValidBody = await origValidSwapRes.json();
    assert.strictEqual(origValidBody.amount, 450, 'Session price must use original session server rate ₹450');
    console.log('  Subtest 2f-ii: Swap successfully adopts original session server price ₹450 without trusting client');

    // 2g: Security regression - Unrelated session ID passed as originalSessionId is rejected with 400 SWAP_PRICE_UNAVAILABLE
    const unrelatedSessId = `unrelated-sess-${timestamp}`;
    inMemorySessions.push({
      id: unrelatedSessId,
      title: 'Unrelated Third-Party Session',
      teacherId: teacherId,
      studentId: bystanderId,
      amount: 999,
      pricePerStudent: 999,
      status: 'confirmed'
    } as any);

    // 2g-i: Attempting to reference unrelated session ID
    const unrelatedSwapRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Tampered Swap Referring Unrelated Session ↔ Security',
        teacherId: noRateMentorId,
        studentId,
        isSwap: true,
        originalSessionId: unrelatedSessId,
        scheduledAt: new Date(timestamp + 3600000 * 14).toISOString(),
        durationMin: 60
      })
    });
    assert.strictEqual(unrelatedSwapRes.status, 400, 'Swap referencing unrelated session must return HTTP 400');
    const unrelatedSwapBody = await unrelatedSwapRes.json();
    assert.strictEqual(unrelatedSwapBody.code, 'SWAP_PRICE_UNAVAILABLE');
    console.log('  Subtest 2g-i: Unrelated session ID rejected with SWAP_PRICE_UNAVAILABLE');

    // 2g-ii: Matching session ID with same teacher and student still works
    const matchingSwapRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: 'Legitimate Swap Referring Matching Session ↔ Algorithms',
        teacherId: noRateMentorId,
        studentId,
        isSwap: true,
        originalSessionId: origSessId,
        scheduledAt: new Date(timestamp + 3600000 * 16).toISOString(),
        durationMin: 60
      })
    });
    assert.strictEqual(matchingSwapRes.status, 201, 'Swap referencing matching paid session must succeed with HTTP 201');
    const matchingSwapBody = await matchingSwapRes.json();
    assert.strictEqual(matchingSwapBody.amount, 450, 'Matching session price ₹450 must be adopted');
    console.log('  Subtest 2g-ii: Matching session ID still works and adopts correct server price');
    console.log('✅ TEST 2 PASSED: Server enforces authoritative session price and blocks client tampering.');

    // -------------------------------------------------------------
    // TEST 3: payment-handshake-submitted Rules Enforcement
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: payment-handshake-submitted Rules Enforcement ---');
    const socketAdmin = ioClient(baseUrl, { auth: { token: adminToken }, transports: ['websocket'] });
    await new Promise<void>((r) => socketAdmin.on('connect', () => r()));

    const testSessHandshakeId = `sess-handshake-${timestamp}`;
    const testHandshakeSess = {
      id: testSessHandshakeId,
      title: 'Handshake Test Session',
      teacherId,
      studentId,
      amount: 600,
      status: 'confirmed',
      paymentStatus: 'pending'
    };
    inMemorySessions.push(testHandshakeSess as any);

    // Helper to capture next socket-error on given socket
    function getNextSocketError(sock: any): Promise<any> {
      return new Promise((resolve) => {
        sock.once('socket-error', (err: any) => resolve(err));
      });
    }

    // 3a: Non-student / bystander cannot submit handshake
    const bystanderErrPromise = getNextSocketError(socketBystander);
    socketBystander.emit('payment-handshake-submitted', {
      sessionId: testSessHandshakeId,
      utrNumber: '112233445566'
    });
    const bystanderErr = await bystanderErrPromise;
    assert.ok(bystanderErr.message.includes('Only the enrolled student can submit payment handshake'));
    console.log('  Subtest 3a: Bystander handshake submission rejected (enrolled student required)');

    // 3b: Admin bypass removed — admin cannot submit handshake on behalf of student
    const adminErrPromise = getNextSocketError(socketAdmin);
    socketAdmin.emit('payment-handshake-submitted', {
      sessionId: testSessHandshakeId,
      utrNumber: '112233445566'
    });
    const adminErr = await adminErrPromise;
    assert.ok(adminErr.message.includes('Only the enrolled student can submit payment handshake'));
    console.log('  Subtest 3b: Admin bypass successfully removed; admin submission rejected');

    // 3c: Invalid UTR format outside demo mode (< 12 digits or non-numeric)
    const utrErrPromise = getNextSocketError(socketStudent);
    socketStudent.emit('payment-handshake-submitted', {
      sessionId: testSessHandshakeId,
      utrNumber: '12345' // Not 12 numeric digits
    });
    const utrErr = await utrErrPromise;
    assert.ok(utrErr.message.includes('Invalid UTR: Must be exactly 12 numeric digits'));
    console.log('  Subtest 3c: Non-12-digit UTR correctly rejected with validation error');

    // 3d: Session in cancelled status
    testHandshakeSess.status = 'cancelled';
    const cancelErrPromise = getNextSocketError(socketStudent);
    socketStudent.emit('payment-handshake-submitted', {
      sessionId: testSessHandshakeId,
      utrNumber: '123456789012'
    });
    const cancelErr = await cancelErrPromise;
    assert.ok(cancelErr.message.includes('rejected: session is cancelled'));
    console.log('  Subtest 3d: Handshake rejected on cancelled session');
    testHandshakeSess.status = 'confirmed'; // Restore status

    // 3e: Session already paid
    testHandshakeSess.paymentStatus = 'paid';
    const paidErrPromise = getNextSocketError(socketStudent);
    socketStudent.emit('payment-handshake-submitted', {
      sessionId: testSessHandshakeId,
      utrNumber: '123456789012'
    });
    const paidErr = await paidErrPromise;
    assert.ok(paidErr.message.includes('rejected: session is already paid'));
    console.log('  Subtest 3e: Handshake rejected on already-paid session');

    // 3f: Valid student submission transitions state and notifies teacher
    testHandshakeSess.paymentStatus = 'pending'; // Reset to pending
    let teacherReceivedAlert: any = null;
    socketTeacher.on('teacher-payment-alert', (alert) => { teacherReceivedAlert = alert; });

    socketStudent.emit('payment-handshake-submitted', {
      sessionId: testSessHandshakeId,
      utrNumber: '123456789012',
      note: 'UPI Payment complete'
    });

    await new Promise((r) => setTimeout(r, 150));

    assert.strictEqual(testHandshakeSess.paymentStatus, 'submitted_provisional');
    assert.strictEqual(testHandshakeSess.utrNumber, '123456789012');
    assert.ok(teacherReceivedAlert, 'Teacher socket should receive teacher-payment-alert');
    assert.strictEqual(teacherReceivedAlert.utrNumber, '123456789012');
    console.log('  Subtest 3f: Valid student handshake transitions state to submitted_provisional and alerts teacher');

    // 3g: Double-submission rejected when already submitted_provisional
    const doubleErrPromise = getNextSocketError(socketStudent);
    socketStudent.emit('payment-handshake-submitted', {
      sessionId: testSessHandshakeId,
      utrNumber: '123456789012'
    });
    const doubleErr = await doubleErrPromise;
    assert.ok(doubleErr.message.includes('Payment handshake already submitted'));
    console.log('  Subtest 3g: Double submission rejected when already submitted_provisional');

    console.log('✅ TEST 3 PASSED: All payment-handshake-submitted security and validation rules verified.');

    // Cleanup sockets
    socketTeacher.close();
    socketStudent.close();
    socketBystander.close();
    socketAdmin.close();

    console.log('\n====================================================');
    console.log('🎉 All Payment Security Verification Tests Passed!');
    console.log('====================================================');
  } finally {
    serverInstance.close();
  }
}

runPaymentSecurityTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
