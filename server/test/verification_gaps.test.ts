import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';

process.env.NODE_ENV = 'test';

import {
  app,
  io,
  inMemoryUsers,
  inMemorySessions,
  inMemoryPayoutAccounts,
  syncWithDatabasePromise,
  prisma
} from '../src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

function createToken(payload: { id: string; email: string; role: string; tokenVersion?: number }) {
  return jwt.sign(
    { userId: payload.id, id: payload.id, email: payload.email, role: payload.role, tokenVersion: payload.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function seedTestUser(user: any) {
  const existingIdx = inMemoryUsers.findIndex(u => u.id === user.id);
  if (existingIdx >= 0) {
    inMemoryUsers[existingIdx] = { ...inMemoryUsers[existingIdx], ...user };
  } else {
    inMemoryUsers.push(user);
  }

  if (prisma && process.env.DATABASE_URL) {
    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          name: user.name,
          email: user.email || `${user.id}@test.com`,
          role: user.role || 'student',
          tokenBalance: user.tokenBalance || 0,
          rewardPoints: user.rewardPoints || 0,
          upiId: user.upiId || null,
          vpaVerified: user.vpaVerified || false
        },
        create: {
          id: user.id,
          name: user.name,
          email: user.email || `${user.id}@test.com`,
          role: user.role || 'student',
          tokenBalance: user.tokenBalance || 0,
          rewardPoints: user.rewardPoints || 0,
          upiId: user.upiId || null,
          vpaVerified: user.vpaVerified || false
        }
      });
    } catch {}
  }
}

function waitForEvent(socket: ClientSocketType, event: string, timeoutMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    function handler(data: any) {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    }

    socket.on(event, handler);
  });
}

function assertNoEvent(socket: ClientSocketType, event: string, timeoutMs = 800): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, timeoutMs);

    function handler(data: any) {
      clearTimeout(timer);
      socket.off(event, handler);
      reject(new Error(`Unexpected event "${event}" received with payload: ${JSON.stringify(data)}`));
    }

    socket.on(event, handler);
  });
}

async function runVerificationGapsTests() {
  console.log('====================================================');
  console.log('🧪 Starting Verification Gaps Test Suite (Plan 3)');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  io.attach(serverInstance);
  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  const activeSockets: ClientSocketType[] = [];

  try {
    // -------------------------------------------------------------
    // F10.6: Non-admin cannot self-verify VPA via PATCH or payout-account
    // -------------------------------------------------------------
    console.log('\n--- TEST F10.6: Non-Admin Cannot Self-Verify VPA ---');
    const teacherId = `teacher-f10-6-${Date.now()}`;
    const teacherToken = createToken({ id: teacherId, email: `${teacherId}@test.com`, role: 'teacher' });
    await seedTestUser({
      id: teacherId,
      name: 'Mentor F10-6',
      email: `${teacherId}@test.com`,
      role: 'teacher',
      upiId: 'mentor.f10@okhdfcbank',
      vpaVerified: false,
      version: 0
    });

    // 1. PATCH /api/users/:id with vpaVerified: true as mentor
    const patchRes = await fetch(`${baseUrl}/api/users/${teacherId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
      body: JSON.stringify({ vpaVerified: true })
    });
    // Should be rejected with 403 or field ignored, leaving vpaVerified = false
    const teacherObj = inMemoryUsers.find(u => u.id === teacherId);
    assert.strictEqual(teacherObj?.vpaVerified, false, 'Mentor must not be able to set vpaVerified via PATCH');

    // 2. POST /api/wallet/payout-account with vpaVerified: true as mentor
    const payoutRes = await fetch(`${baseUrl}/api/wallet/payout-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
      body: JSON.stringify({
        accountHolderName: 'Mentor F10-6',
        payoutMethod: 'upi',
        upiId: 'new.f10@okhdfcbank',
        vpaVerified: true
      })
    });
    assert.strictEqual(payoutRes.status, 200);
    const teacherAfterPayout = inMemoryUsers.find(u => u.id === teacherId);
    assert.strictEqual(teacherAfterPayout?.vpaVerified, false, 'Mentor must not be able to set vpaVerified via payout-account');
    const payoutAcc = inMemoryPayoutAccounts[teacherId];
    assert.strictEqual(payoutAcc?.vpaVerified, false, 'PayoutAccount vpaVerified must remain false');

    // 3. Admin can verify VPA
    const adminId = `admin-f10-6-${Date.now()}`;
    const adminToken = createToken({ id: adminId, email: `${adminId}@test.com`, role: 'admin' });
    await seedTestUser({ id: adminId, name: 'Admin', email: `${adminId}@test.com`, role: 'admin', version: 0 });
    const adminVerifyRes = await fetch(`${baseUrl}/api/users/${teacherId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ vpaVerified: true })
    });
    assert.strictEqual(adminVerifyRes.status, 200, 'Admin can verify VPA');
    assert.strictEqual(inMemoryUsers.find(u => u.id === teacherId)?.vpaVerified, true, 'Admin successfully set vpaVerified');
    console.log('✅ TEST F10.6 PASSED: Non-admin cannot self-verify VPA; admin can verify.');

    // -------------------------------------------------------------
    // F10.7: Demo bypass rejected when DEMO_MODE is not true
    // -------------------------------------------------------------
    console.log('\n--- TEST F10.7: Demo Bypass Rejected When DEMO_MODE Disabled ---');
    const demoStudentId = `demo-student-${Date.now()}`;
    const demoMentorId = `demo-mentor-${Date.now()}`;
    const demoStudentToken = createToken({ id: demoStudentId, email: `${demoStudentId}@test.com`, role: 'student' });
    await seedTestUser({ id: demoStudentId, name: 'Demo Student', email: `${demoStudentId}@test.com`, role: 'student', tokenBalance: 0, version: 0 });
    await seedTestUser({ id: demoMentorId, name: 'Demo Mentor', email: `${demoMentorId}@test.com`, role: 'teacher', upiId: null, version: 0 });

    const demoSessId = `demo-sess-${Date.now()}`;
    inMemorySessions.push({
      id: demoSessId,
      title: 'Demo Guard Test Session',
      teacherId: demoMentorId,
      studentId: demoStudentId,
      amount: 499,
      status: 'confirmed',
      paymentStatus: 'pending'
    });

    // Attempt confirm-upi with isDemo: true while mentor has no VPA
    // Because DEMO_MODE !== 'true' in test environment, demo bypass must NOT activate
    const demoPayRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${demoStudentToken}` },
      body: JSON.stringify({
        sessionId: demoSessId,
        teacherId: demoMentorId,
        amount: 499,
        isDemo: true
      })
    });
    assert.strictEqual(demoPayRes.status, 400, 'Demo bypass must be rejected when DEMO_MODE is disabled');
    console.log('✅ TEST F10.7 PASSED: Demo bypass rejected when DEMO_MODE is disabled.');

    // -------------------------------------------------------------
    // F10.8 / P3.3: Paid booking without mentor VPA rejected even when paymentMethod omitted
    // -------------------------------------------------------------
    console.log('\n--- TEST F10.8 (P3.3): VPA Guard Independent of paymentMethod ---');
    const noVpaMentorId = `no-vpa-mentor-${Date.now()}`;
    await seedTestUser({
      id: noVpaMentorId,
      name: 'No VPA Mentor',
      email: `${noVpaMentorId}@test.com`,
      role: 'teacher',
      hourlyRate: 500,
      upiId: null,
      version: 0
    });
    const bookingStudentId = `book-student-${Date.now()}`;
    const bookingStudentToken = createToken({ id: bookingStudentId, email: `${bookingStudentId}@test.com`, role: 'student' });
    await seedTestUser({
      id: bookingStudentId,
      name: 'Booking Student',
      email: `${bookingStudentId}@test.com`,
      role: 'student',
      tokenBalance: 20,
      version: 0
    });

    // 1. Booking with price > 0 and paymentMethod omitted
    const omittedMethodRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bookingStudentToken}` },
      body: JSON.stringify({
        teacherId: noVpaMentorId,
        title: 'Paid Session Without PaymentMethod',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        pricePerStudent: 500
      })
    });
    assert.strictEqual(omittedMethodRes.status, 400, 'Must reject paid session without mentor VPA when paymentMethod omitted');
    const omittedData: any = await omittedMethodRes.json();
    assert.strictEqual(omittedData.code, 'MENTOR_PAYOUT_NOT_CONFIGURED');

    // 2. Booking with paymentMethod: 'tokens' succeeds even without mentor VPA
    const tokenBookingRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bookingStudentToken}` },
      body: JSON.stringify({
        teacherId: noVpaMentorId,
        title: 'Token Session With No-VPA Mentor',
        scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
        paymentMethod: 'tokens',
        tokenCost: 5
      })
    });
    assert.strictEqual(tokenBookingRes.status, 201, 'Token booking should succeed without mentor VPA');

    // 3. Mentor with valid VPA books normally when paymentMethod omitted
    const withVpaMentorId = `vpa-mentor-${Date.now()}`;
    await seedTestUser({
      id: withVpaMentorId,
      name: 'Valid VPA Mentor',
      email: `${withVpaMentorId}@test.com`,
      role: 'teacher',
      hourlyRate: 500,
      upiId: 'valid.mentor@okhdfcbank',
      vpaVerified: true,
      version: 0
    });
    const normalBookingRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bookingStudentToken}` },
      body: JSON.stringify({
        teacherId: withVpaMentorId,
        title: 'Paid Session With VPA Mentor',
        scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        pricePerStudent: 500
      })
    });
    assert.strictEqual(normalBookingRes.status, 201, 'Paid session should succeed when mentor has valid VPA');
    console.log('✅ TEST F10.8 (P3.3) PASSED: Missing paymentMethod treated as direct UPI and requires mentor VPA.');

    // -------------------------------------------------------------
    // P2.5 / P3.4: session-request-created delivered only to approver
    // -------------------------------------------------------------
    console.log('\n--- TEST P2.5 (P3.4): Event Scoping for session-request-created ---');
    const p34TeacherId = `p34-teacher-${Date.now()}`;
    const p34StudentId = `p34-student-${Date.now()}`;
    const p34TeacherToken = createToken({ id: p34TeacherId, email: `${p34TeacherId}@test.com`, role: 'teacher' });
    const p34StudentToken = createToken({ id: p34StudentId, email: `${p34StudentId}@test.com`, role: 'student' });

    await seedTestUser({ id: p34TeacherId, name: 'P34 Mentor', email: `${p34TeacherId}@test.com`, role: 'teacher', upiId: 'p34.mentor@okaxis', vpaVerified: true, version: 0 });
    await seedTestUser({ id: p34StudentId, name: 'P34 Student', email: `${p34StudentId}@test.com`, role: 'student', tokenBalance: 10, version: 0 });

    const clientMentorSocket = ClientSocket(baseUrl, {
      auth: { token: p34TeacherToken },
      transports: ['websocket'],
      forceNew: true
    });
    const clientStudentSocket = ClientSocket(baseUrl, {
      auth: { token: p34StudentToken },
      transports: ['websocket'],
      forceNew: true
    });
    activeSockets.push(clientMentorSocket, clientStudentSocket);

    await Promise.all([
      new Promise<void>((res) => clientMentorSocket.on('connect', () => res())),
      new Promise<void>((res) => clientStudentSocket.on('connect', () => res()))
    ]);

    // Student books a session
    const approverEventPromise = waitForEvent(clientMentorSocket, 'session-request-created', 3000);
    const studentNoEventPromise = assertNoEvent(clientStudentSocket, 'session-request-created', 800);

    const p34BookRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p34StudentToken}` },
      body: JSON.stringify({
        teacherId: p34TeacherId,
        title: 'Scoped Notification Session',
        scheduledAt: new Date(Date.now() + 86400000 * 4).toISOString(),
        pricePerStudent: 300
      })
    });
    assert.strictEqual(p34BookRes.status, 201);

    const approverPayload = await approverEventPromise;
    assert.strictEqual(approverPayload.teacherId, p34TeacherId, 'Approver should receive session-request-created');
    await studentNoEventPromise; // Asserts student did not receive session-request-created

    clientMentorSocket.disconnect();
    clientStudentSocket.disconnect();
    console.log('✅ TEST P2.5 (P3.4) PASSED: session-request-created received only by approver.');

    // -------------------------------------------------------------
    // P2.11 / P3.2: Host-only room-event types authorized
    // -------------------------------------------------------------
    console.log('\n--- TEST P2.11 (P3.2): Host-Only Room-Event Authorization ---');
    const p32TeacherId = `p32-teacher-${Date.now()}`;
    const p32StudentId = `p32-student-${Date.now()}`;
    const p32TeacherToken = createToken({ id: p32TeacherId, email: `${p32TeacherId}@test.com`, role: 'teacher' });
    const p32StudentToken = createToken({ id: p32StudentId, email: `${p32StudentId}@test.com`, role: 'student' });

    await seedTestUser({ id: p32TeacherId, name: 'P32 Mentor', email: `${p32TeacherId}@test.com`, role: 'teacher', version: 0 });
    await seedTestUser({ id: p32StudentId, name: 'P32 Student', email: `${p32StudentId}@test.com`, role: 'student', version: 0 });

    const liveSessId = `live-room-${Date.now()}`;
    inMemorySessions.push({
      id: liveSessId,
      title: 'Host Control Session',
      teacherId: p32TeacherId,
      studentId: p32StudentId,
      status: 'confirmed',
      paymentStatus: 'paid'
    });

    const hostSocket = ClientSocket(baseUrl, {
      auth: { token: p32TeacherToken },
      transports: ['websocket'],
      forceNew: true
    });
    const attendeeSocket = ClientSocket(baseUrl, {
      auth: { token: p32StudentToken },
      transports: ['websocket'],
      forceNew: true
    });
    activeSockets.push(hostSocket, attendeeSocket);

    await Promise.all([
      new Promise<void>((res) => hostSocket.on('connect', () => res())),
      new Promise<void>((res) => attendeeSocket.on('connect', () => res()))
    ]);

    // Both join live room
    hostSocket.emit('join-room', { roomId: liveSessId, userName: 'P32 Mentor' });
    attendeeSocket.emit('join-room', { roomId: liveSessId, userName: 'P32 Student' });
    await new Promise((r) => setTimeout(r, 200));

    // 1. Attendee attempts to send host-only event ('fullscreen')
    const attendeeErrorPromise = waitForEvent(attendeeSocket, 'room-error', 2000);
    const hostNoEventPromise = assertNoEvent(hostSocket, 'room-event', 800);

    attendeeSocket.emit('room-event', {
      roomId: liveSessId,
      event: { type: 'fullscreen', isFullscreen: true }
    });

    const roomError = await attendeeErrorPromise;
    assert.ok(roomError.error, 'Attendee should receive room-error for host-only event');
    await hostNoEventPromise;

    // 2. Host sends host-only event ('fullscreen') -> successfully relayed to attendee
    const attendeeReceivePromise = waitForEvent(attendeeSocket, 'room-event', 2000);
    hostSocket.emit('room-event', {
      roomId: liveSessId,
      event: { type: 'fullscreen', isFullscreen: true }
    });
    const relayedEvent = await attendeeReceivePromise;
    assert.strictEqual(relayedEvent.event?.type, 'fullscreen', 'Host fullscreen event should be relayed');

    // 3. Non-host event ('chat') sent by student -> allowed and relayed
    const chatReceivePromise = waitForEvent(hostSocket, 'room-event', 2000);
    attendeeSocket.emit('room-event', {
      roomId: liveSessId,
      event: { type: 'chat', sender: 'P32 Student', text: 'Hello Mentor!' }
    });
    const relayedChat = await chatReceivePromise;
    assert.strictEqual(relayedChat.event?.type, 'chat', 'Student chat event should be relayed');

    hostSocket.disconnect();
    attendeeSocket.disconnect();
    console.log('✅ TEST P2.11 (P3.2) PASSED: Host-only events rejected for non-host and relayed for host.');

    // -------------------------------------------------------------
    // P2.12 / P3.5: Paid swaps per D2 = A
    // -------------------------------------------------------------
    console.log('\n--- TEST P2.12 (P3.5): Paid Swap Amount & VPA Guard ---');
    const swapMentorNoVpa = `swap-mentor-novpa-${Date.now()}`;
    const swapMentorWithVpa = `swap-mentor-vpa-${Date.now()}`;
    const swapStudent = `swap-student-${Date.now()}`;
    const swapStudentToken = createToken({ id: swapStudent, email: `${swapStudent}@test.com`, role: 'student' });

    await seedTestUser({ id: swapMentorNoVpa, name: 'Swap Mentor No VPA', email: `${swapMentorNoVpa}@test.com`, role: 'teacher', upiId: null, version: 0 });
    await seedTestUser({ id: swapMentorWithVpa, name: 'Swap Mentor With VPA', email: `${swapMentorWithVpa}@test.com`, role: 'teacher', upiId: 'swap.mentor@okaxis', vpaVerified: true, version: 0 });
    await seedTestUser({ id: swapStudent, name: 'Swap Student', email: `${swapStudent}@test.com`, role: 'student', version: 0 });

    // 1. Paid swap with mentor lacking VPA -> rejected with 400 MENTOR_PAYOUT_NOT_CONFIGURED
    const paidSwapNoVpaRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${swapStudentToken}` },
      body: JSON.stringify({
        teacherId: swapMentorNoVpa,
        title: 'Python ↔ Rust Skill Swap',
        isSwap: true,
        pricePerStudent: 300,
        scheduledAt: new Date(Date.now() + 86400000 * 5).toISOString()
      })
    });
    assert.strictEqual(paidSwapNoVpaRes.status, 400, 'Paid swap without mentor VPA must be rejected');
    const paidSwapNoVpaData: any = await paidSwapNoVpaRes.json();
    assert.strictEqual(paidSwapNoVpaData.code, 'MENTOR_PAYOUT_NOT_CONFIGURED');

    // 2. Paid swap with mentor having VPA -> created with server price 300
    const paidSwapValidRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${swapStudentToken}` },
      body: JSON.stringify({
        teacherId: swapMentorWithVpa,
        title: 'Python ↔ Rust Skill Swap',
        isSwap: true,
        pricePerStudent: 300,
        scheduledAt: new Date(Date.now() + 86400000 * 6).toISOString()
      })
    });
    assert.strictEqual(paidSwapValidRes.status, 201, 'Paid swap with mentor VPA should succeed');
    const paidSwapSession: any = await paidSwapValidRes.json();
    assert.strictEqual(paidSwapSession.amount, 300, 'Paid swap must maintain server price (not forced to 0)');

    // 3. Free swap (price 0) -> succeeds even without mentor VPA
    const freeSwapRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${swapStudentToken}` },
      body: JSON.stringify({
        teacherId: swapMentorNoVpa,
        title: 'Free Skill Swap ↔',
        isSwap: true,
        scheduledAt: new Date(Date.now() + 86400000 * 7).toISOString()
      })
    });
    assert.strictEqual(freeSwapRes.status, 201, 'Free swap should succeed without mentor VPA');
    const freeSwapSession: any = await freeSwapRes.json();
    assert.strictEqual(freeSwapSession.amount, 0, 'Free swap has amount 0');
    console.log('✅ TEST P2.12 (P3.5) PASSED: Paid swaps enforce VPA guard and server price; free swaps stay 0.');

    // -------------------------------------------------------------
    // P2.13 / P3.1: Server-owned amount/payee; no confirm while pending
    // -------------------------------------------------------------
    console.log('\n--- TEST P2.13 (P3.1): Server-Owned Amount/Payee & Pending Payment Guards ---');
    const p31TeacherId = `p31-teacher-${Date.now()}`;
    const p31StudentId = `p31-student-${Date.now()}`;
    const p31BystanderId = `p31-bystander-${Date.now()}`;
    const p31TeacherToken = createToken({ id: p31TeacherId, email: `${p31TeacherId}@test.com`, role: 'teacher' });
    const p31StudentToken = createToken({ id: p31StudentId, email: `${p31StudentId}@test.com`, role: 'student' });
    const p31BystanderToken = createToken({ id: p31BystanderId, email: `${p31BystanderId}@test.com`, role: 'student' });

    await seedTestUser({ id: p31TeacherId, name: 'P31 Mentor', email: `${p31TeacherId}@test.com`, role: 'teacher', upiId: 'p31.mentor@okhdfcbank', vpaVerified: true, inrWalletBalance: 0, totalEarned: 0, version: 0 });
    await seedTestUser({ id: p31StudentId, name: 'P31 Student', email: `${p31StudentId}@test.com`, role: 'student', tokenBalance: 20, version: 0 });
    await seedTestUser({ id: p31BystanderId, name: 'P31 Bystander', email: `${p31BystanderId}@test.com`, role: 'student', tokenBalance: 20, version: 0 });

    const p31SessId = `p31-sess-${Date.now()}`;
    inMemorySessions.push({
      id: p31SessId,
      title: 'P31 Session Security',
      teacherId: p31TeacherId,
      studentId: p31StudentId,
      amount: 499,
      pricePerStudent: 499,
      tokenCost: 5,
      status: 'pending',
      paymentStatus: 'pending'
    });

    // 1. confirm-payment on pending session must return 400 SESSION_NOT_CONFIRMED
    const pendingConfirmPayRes = await fetch(`${baseUrl}/api/sessions/${p31SessId}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p31TeacherToken}` }
    });
    assert.strictEqual(pendingConfirmPayRes.status, 400, 'confirm-payment on pending session must return 400');
    const pendingConfirmData: any = await pendingConfirmPayRes.json();
    assert.strictEqual(pendingConfirmData.code, 'SESSION_NOT_CONFIRMED');

    // 2. Non-teacher / bystander calling confirm-payment returns 403
    const bystanderConfirmRes = await fetch(`${baseUrl}/api/sessions/${p31SessId}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p31BystanderToken}` }
    });
    assert.strictEqual(bystanderConfirmRes.status, 403, 'Bystander calling confirm-payment must return 403');

    // 3. Confirm the session
    const sessToApprove = inMemorySessions.find(s => s.id === p31SessId);
    if (sessToApprove) sessToApprove.status = 'confirmed';

    // 4. confirm-upi: client tampering with amount or teacherId is rejected with 400
    const valid12Utr1 = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const tamperAmountRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p31StudentToken}` },
      body: JSON.stringify({
        sessionId: p31SessId,
        teacherId: p31TeacherId,
        amount: 100, // Tampered: session price is 499
        utr: valid12Utr1
      })
    });
    assert.strictEqual(tamperAmountRes.status, 400, 'Tampered amount in confirm-upi must return 400');

    const valid12Utr2 = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const tamperTeacherRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p31StudentToken}` },
      body: JSON.stringify({
        sessionId: p31SessId,
        teacherId: p31BystanderId, // Tampered: actual teacher is p31TeacherId
        amount: 499,
        utr: valid12Utr2
      })
    });
    assert.strictEqual(tamperTeacherRes.status, 400, 'Tampered teacherId in confirm-upi must return 400');

    // 5. pay-tokens: client tampering with tokenCost is rejected with 400
    const tamperTokenCostRes = await fetch(`${baseUrl}/api/sessions/${p31SessId}/pay-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p31StudentToken}` },
      body: JSON.stringify({ tokenCost: 1 }) // Tampered: session tokenCost is 5
    });
    assert.strictEqual(tamperTokenCostRes.status, 400, 'Tampered tokenCost in pay-tokens must return 400');

    // 6. Valid confirm-upi with correct session price succeeds
    const valid12Utr3 = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const validUpiRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p31StudentToken}` },
      body: JSON.stringify({
        sessionId: p31SessId,
        teacherId: p31TeacherId,
        amount: 499,
        utr: valid12Utr3
      })
    });
    assert.strictEqual(validUpiRes.status, 200, 'Valid confirm-upi with correct price must succeed');

    // 7. Teacher confirms payment on confirmed session -> totalEarned increments by 499
    const teacherConfirmRes = await fetch(`${baseUrl}/api/sessions/${p31SessId}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p31TeacherToken}` }
    });
    assert.strictEqual(teacherConfirmRes.status, 200, 'Teacher confirming payment on confirmed session succeeds');
    const teacherUserAfter = inMemoryUsers.find(u => u.id === p31TeacherId);
    assert.strictEqual(teacherUserAfter?.totalEarned, 499, 'Teacher totalEarned must be credited server-owned amount (₹499)');
    console.log('✅ TEST P2.13 (P3.1) PASSED: Amount and payee server-owned; pending session payment confirmed rejected.');

    // =========================================================================
    // TEST F10.9 (Phase 4): Dedicated POST /api/admin/users/:id/verify-vpa & PayoutAuditLog
    // =========================================================================
    console.log('\n--- Running TEST F10.9: Admin VPA Verification & PayoutAuditLog ---');

    const p4AdminId = `admin-p4-${Date.now()}`;
    const p4AdminToken = createToken({ id: p4AdminId, email: `${p4AdminId}@mindroot.edu`, role: 'admin' });
    await seedTestUser({ id: p4AdminId, name: 'Audit Admin', email: `${p4AdminId}@mindroot.edu`, role: 'admin' });

    const p4MentorId = `mentor-p4-${Date.now()}`;
    const p4MentorToken = createToken({ id: p4MentorId, email: `${p4MentorId}@mindroot.edu`, role: 'teacher' });
    await seedTestUser({ id: p4MentorId, name: 'Tanishk Mentor', email: `${p4MentorId}@mindroot.edu`, role: 'teacher', upiId: null, vpaVerified: false });

    // 1. Non-admin calls verify-vpa -> 403 Forbidden
    const nonAdminVerifyRes = await fetch(`${baseUrl}/api/admin/users/${p4MentorId}/verify-vpa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p4MentorToken}` },
      body: JSON.stringify({ verified: true })
    });
    assert.strictEqual(nonAdminVerifyRes.status, 403, 'Non-admin calling verify-vpa must return 403');

    // 2. Admin calls verify-vpa on user with NO VPA -> 400 MENTOR_PAYOUT_NOT_CONFIGURED
    const adminVerifyNoVpaRes = await fetch(`${baseUrl}/api/admin/users/${p4MentorId}/verify-vpa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p4AdminToken}` },
      body: JSON.stringify({ verified: true })
    });
    assert.strictEqual(adminVerifyNoVpaRes.status, 400, 'Admin verifying user without VPA must return 400');
    const noVpaJson = await adminVerifyNoVpaRes.json();
    assert.strictEqual(noVpaJson.code, 'MENTOR_PAYOUT_NOT_CONFIGURED', 'Code must be MENTOR_PAYOUT_NOT_CONFIGURED');

    // 3. Mentor configures valid VPA -> audit log recorded for upiId change
    const setVpaRes = await fetch(`${baseUrl}/api/wallet/payout-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p4MentorToken}` },
      body: JSON.stringify({ upiId: 'tanishk@okhdfcbank' })
    });
    assert.strictEqual(setVpaRes.status, 200, 'Setting valid VPA must succeed');

    // 4. Admin verifies VPA -> 200 OK, vpaVerified = true, audit entry created
    const p4AdminVerifyRes = await fetch(`${baseUrl}/api/admin/users/${p4MentorId}/verify-vpa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p4AdminToken}` },
      body: JSON.stringify({ verified: true })
    });
    assert.strictEqual(p4AdminVerifyRes.status, 200, 'Admin verifying configured VPA must return 200');
    const verifyJson = await p4AdminVerifyRes.json();
    assert.strictEqual(verifyJson.user.vpaVerified, true, 'User vpaVerified must be true');
    assert.ok(verifyJson.user.vpaVerifiedAt, 'User vpaVerifiedAt must be set');

    // 5. Query audit logs -> returns recorded audit trail
    const auditRes = await fetch(`${baseUrl}/api/admin/users/${p4MentorId}/payout-audit-logs`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${p4AdminToken}` }
    });
    assert.strictEqual(auditRes.status, 200, 'Querying audit logs must return 200');
    const auditJson = await auditRes.json();
    assert.ok(Array.isArray(auditJson.logs) && auditJson.logs.length >= 2, 'Audit logs must contain upiId and vpaVerified entries');
    const upiAudit = auditJson.logs.find((l: any) => l.field === 'upiId');
    assert.ok(upiAudit, 'Must have upiId audit entry');
    assert.strictEqual(upiAudit.newMasked, 'ta***@okhdfcbank', 'New VPA must be masked as ta***@okhdfcbank');

    // 6. Admin revokes verification -> 200 OK, vpaVerified = false
    const adminRevokeRes = await fetch(`${baseUrl}/api/admin/users/${p4MentorId}/verify-vpa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p4AdminToken}` },
      body: JSON.stringify({ verified: false })
    });
    assert.strictEqual(adminRevokeRes.status, 200, 'Admin revoking VPA verification must return 200');
    const revokeJson = await adminRevokeRes.json();
    assert.strictEqual(revokeJson.user.vpaVerified, false, 'User vpaVerified must now be false');

    console.log('✅ TEST F10.9 (Phase 4) PASSED: Dedicated verify-vpa (403 non-admin, 400 unconfigured), PayoutAuditLog masking & audit trail verified.');

    console.log('\n====================================================');
    console.log('🎉 ALL VERIFICATION GAPS TESTS PASSED!');
    console.log('====================================================\n');
  } finally {
    activeSockets.forEach(s => {
      try { s.disconnect(); } catch {}
    });
    if ((serverInstance as any).closeAllConnections) {
      (serverInstance as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
    if (prisma && process.env.DATABASE_URL) {
      try {
        await prisma.$disconnect();
      } catch {}
    }
  }
}

runVerificationGapsTests().catch((err) => {
  console.error('\n❌ VERIFICATION GAPS TEST FAILED:', err);
  process.exitCode = 1;
});
