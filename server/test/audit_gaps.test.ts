import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';

process.env.NODE_ENV = 'test';
process.env.DEMO_SEED_KEY = 'super-secret-demo-key-for-test-suite';

import {
  app,
  server,
  io,
  prisma,
  inMemoryUsers,
  inMemorySessions,
  inMemoryTransactions,
  inMemoryMessages,
  inMemoryDiscussions,
  inMemoryReviews,
  inMemoryPayoutAccounts,
  inMemoryRedemptions,
  inMemoryUsedUtrs,
  syncWithDatabasePromise
} from '../src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

function createToken(userId: string, role = 'student', tokenVersion = 0) {
  return jwt.sign(
    { userId, id: userId, email: `${userId}@test.com`, role, tokenVersion },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function seedTestUser(user: any) {
  inMemoryUsers.push(user);
  if (prisma && process.env.DATABASE_URL) {
    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          tokenBalance: user.tokenBalance || 0,
          rewardPoints: user.rewardPoints || 0,
          role: user.role || 'student',
          name: user.name,
          version: 0
        },
        create: {
          id: user.id,
          name: user.name,
          email: user.email || `${user.id}@test.com`,
          role: user.role || 'student',
          tokenBalance: user.tokenBalance || 0,
          rewardPoints: user.rewardPoints || 0,
          version: 0
        }
      });
    } catch (e: any) {
      console.warn('seedTestUser notice:', e.message);
    }
  }
}

async function runAuditGapsTests() {
  console.log('====================================================');
  console.log('🧪 Starting Audit Gaps Automated Verification Suite');
  console.log('====================================================\n');

  await syncWithDatabasePromise;

  const serverInstance = http.createServer(app);
  // Attach Socket.io to this test server instance
  io.attach(serverInstance);

  await new Promise<void>((resolve) => serverInstance.listen(0, '127.0.0.1', () => resolve()));
  const port = (serverInstance.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    // -------------------------------------------------------------
    // TEST 1: Non-Teacher Confirm-Payment Rejection (HTTP 403)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Non-Teacher Confirm-Payment Rejection ---');
    const teacher1Id = `teacher-gap-${Date.now()}`;
    const student1Id = `student-gap-${Date.now()}`;
    const imposterId = `imposter-gap-${Date.now()}`;
    const session1Id = `sess-gap-${Date.now()}`;

    await seedTestUser({ id: teacher1Id, name: 'Real Teacher', email: `${teacher1Id}@test.com`, role: 'teacher', totalEarned: 0, inrWalletBalance: 0 });
    await seedTestUser({ id: student1Id, name: 'Real Student', email: `${student1Id}@test.com`, role: 'student', tokenBalance: 10 });
    await seedTestUser({ id: imposterId, name: 'Imposter Peer', email: `${imposterId}@test.com`, role: 'student', tokenBalance: 0 });

    inMemorySessions.push({
      id: session1Id,
      title: 'Advanced Operating Systems',
      teacherId: teacher1Id,
      studentId: student1Id,
      amount: 499,
      paymentStatus: 'pending_mentor_confirmation',
      status: 'pending'
    });

    const imposterToken = createToken(imposterId, 'student');
    const studentToken = createToken(student1Id, 'student');
    const teacherToken = createToken(teacher1Id, 'teacher');

    // 1. Imposter attempts to confirm
    const imposterRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${imposterToken}` }
    });
    assert.strictEqual(imposterRes.status, 403, 'Unrelated peer must receive HTTP 403 on confirm-payment');

    // 2. Student attempts to confirm
    const studentRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
    });
    assert.strictEqual(studentRes.status, 403, 'Enrolled student must receive HTTP 403 on confirm-payment');

    // 3. Teacher confirms
    const teacherRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` }
    });
    assert.strictEqual(teacherRes.status, 200, 'Teacher must successfully confirm payment');
    const teacherData = await teacherRes.json();
    assert.strictEqual(teacherData.success, true);
    console.log('✅ TEST 1 PASSED: Only assigned teacher or admin can confirm payment (HTTP 403 for others)!');

    // -------------------------------------------------------------
    // TEST 2: Reward Redemption Mutex Concurrency
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Reward Redemption Mutex Concurrency ---');
    const rewardUserId = `reward-user-${Date.now()}`;
    const rewardUser = {
      id: rewardUserId,
      name: 'Reward Tester',
      email: `${rewardUserId}@test.com`,
      role: 'student',
      rewardPoints: 50
    };
    await seedTestUser(rewardUser);
    const rewardToken = createToken(rewardUserId, 'student');

    console.log('Firing 10 concurrent requests to redeem 50-point voucher with 50 points balance...');
    const redeemResponses = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const res = await fetch(`${baseUrl}/api/rewards/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rewardToken}` },
          body: JSON.stringify({ rewardId: 'reward-voucher-100' }) // costs 50
        });
        return res.status;
      })
    );

    const successfulRedeems = redeemResponses.filter(s => s === 200);
    const rejectedRedeems = redeemResponses.filter(s => s === 400);

    console.log(`Redemptions: ${successfulRedeems.length} OK, ${rejectedRedeems.length} Rejected (Insufficient Points)`);
    assert.strictEqual(successfulRedeems.length, 1, 'Exactly 1 redemption must succeed');
    assert.strictEqual(rejectedRedeems.length, 9, 'Exactly 9 redemptions must be rejected');
    assert.strictEqual(rewardUser.rewardPoints, 0, 'User reward points must be exactly 0 after 1 redemption');
    console.log('✅ TEST 2 PASSED: Reward redemption mutex serialized requests; 1 OK, 9 rejected!');

    // -------------------------------------------------------------
    // TEST 3: Discussion Bounty Escrow & Double-Claim Prevention
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Discussion Bounty Escrow & Double-Claim Prevention ---');
    const authorId = `bounty-author-${Date.now()}`;
    const solverId = `bounty-solver-${Date.now()}`;

    const authorUser = {
      id: authorId,
      name: 'Question Author',
      email: `${authorId}@test.com`,
      role: 'student',
      tokenBalance: 50,
      rewardPoints: 100
    };
    const solverUser = {
      id: solverId,
      name: 'Genius Solver',
      email: `${solverId}@test.com`,
      role: 'student',
      tokenBalance: 0,
      rewardPoints: 0
    };
    await seedTestUser(authorUser);
    await seedTestUser(solverUser);

    const authorAuthToken = createToken(authorId, 'student');

    // 1. Post discussion with 5 token bounty
    const discRes = await fetch(`${baseUrl}/api/discussions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authorAuthToken}` },
      body: JSON.stringify({
        title: 'How to solve LeetCode Hard #42 Trapping Rain Water in O(1) space?',
        content: 'I need an intuitive two-pointer breakdown.',
        bounty: { type: 'tokens', amount: 5 }
      })
    });
    assert.strictEqual(discRes.status, 201, 'Discussion creation should return HTTP 201');
    const createdDisc = await discRes.json();
    assert.strictEqual(authorUser.tokenBalance, 45, 'Author balance must be deducted by 5 immediately into escrow');

    // 2. Post answer from solver
    const commRes = await fetch(`${baseUrl}/api/discussions/${createdDisc.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Use two pointers left and right, tracking maxLeft and maxRight...',
        authorId: solverId,
        authorName: solverUser.name
      })
    });
    assert.strictEqual(commRes.status, 201);
    const commentData = await commRes.json();
    const commentId = commentData.comment.id;

    // 3. Accept answer and release escrowed bounty
    const acceptRes = await fetch(`${baseUrl}/api/discussions/${createdDisc.id}/accept-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authorAuthToken}` },
      body: JSON.stringify({ commentId })
    });
    assert.strictEqual(acceptRes.status, 200, 'Accepting answer should succeed');
    assert.strictEqual(solverUser.tokenBalance, 5, 'Solver should receive the 5 escrowed tokens');

    // 4. Double accept attempt should fail
    const doubleAcceptRes = await fetch(`${baseUrl}/api/discussions/${createdDisc.id}/accept-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authorAuthToken}` },
      body: JSON.stringify({ commentId })
    });
    assert.strictEqual(doubleAcceptRes.status, 400, 'Double claim of bounty must be rejected with HTTP 400');
    assert.strictEqual(solverUser.tokenBalance, 5, 'Solver balance must remain 5, no duplicate bounty award');
    console.log('✅ TEST 3 PASSED: Discussion bounty held in escrow and transferred on accept; double-claim rejected!');

    // -------------------------------------------------------------
    // TEST 4: Verified Review Restrictions
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Verified Review Restrictions ---');
    const revTeacherId = `rev-teacher-${Date.now()}`;
    const revStudentId = `rev-student-${Date.now()}`;
    const outsiderId = `rev-outsider-${Date.now()}`;
    const uncompletedSessId = `sess-uncompleted-${Date.now()}`;

    await seedTestUser({ id: revTeacherId, name: 'Review Mentor', email: `${revTeacherId}@test.com`, role: 'teacher', trustScore: 5.0 });
    await seedTestUser({ id: revStudentId, name: 'Review Student', email: `${revStudentId}@test.com`, role: 'student', trustScore: 5.0 });
    await seedTestUser({ id: outsiderId, name: 'Random Bystander', email: `${outsiderId}@test.com`, role: 'student', trustScore: 5.0 });

    const uncompletedSess = {
      id: uncompletedSessId,
      title: 'Uncompleted Physics Lab',
      teacherId: revTeacherId,
      studentId: revStudentId,
      status: 'pending' // Not completed!
    };
    inMemorySessions.push(uncompletedSess);

    const revStudentToken = createToken(revStudentId, 'student');
    const outsiderToken = createToken(outsiderId, 'student');

    // 1. Reviewing uncompleted session fails
    const uncompletedRevRes = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${revStudentToken}` },
      body: JSON.stringify({
        sessionId: uncompletedSessId,
        rating: 5,
        quote: 'Session was great!'
      })
    });
    assert.strictEqual(uncompletedRevRes.status, 400, 'Review for uncompleted session must fail with HTTP 400');

    // 2. Mark session completed, but non-participant reviews
    uncompletedSess.status = 'completed';
    const nonPartRevRes = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outsiderToken}` },
      body: JSON.stringify({
        sessionId: uncompletedSessId,
        rating: 5,
        quote: 'Fake review from outsider'
      })
    });
    assert.strictEqual(nonPartRevRes.status, 403, 'Non-participant review must fail with HTTP 403');

    // 3. Participant reviews completed session -> succeeds
    const validRevRes = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${revStudentToken}` },
      body: JSON.stringify({
        sessionId: uncompletedSessId,
        rating: 5,
        quote: 'Outstanding mentorship on thermodynamics!'
      })
    });
    assert.strictEqual(validRevRes.status, 201, 'Valid participant review must succeed with HTTP 201');

    // 4. Duplicate review attempt fails
    const duplicateRevRes = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${revStudentToken}` },
      body: JSON.stringify({
        sessionId: uncompletedSessId,
        rating: 5,
        quote: 'Trying to submit a second review'
      })
    });
    assert.strictEqual(duplicateRevRes.status, 400, 'Duplicate review for same session must fail with HTTP 400');
    console.log('✅ TEST 4 PASSED: Uncompleted sessions, non-participants, and duplicate reviews strictly blocked!');

    // -------------------------------------------------------------
    // TEST 5: Soft-Delete Balance Protection & PII Scrubbing
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Soft-Delete Balance Protection & PII Scrubbing ---');
    const deleteUserId = `del-user-${Date.now()}`;
    const peerUserId = `peer-user-${Date.now()}`;

    const userToDelete = {
      id: deleteUserId,
      name: 'Aiden Pearce',
      email: `${deleteUserId}@test.com`,
      role: 'student',
      tokenBalance: 25,
      inrWalletBalance: 0,
      bio: 'Cybersecurity researcher',
      avatar: 'https://avatar.test/aiden.png'
    };
    await seedTestUser(userToDelete);

    // Associated payout account
    inMemoryPayoutAccounts[deleteUserId] = {
      accountHolderName: 'Aiden Pearce',
      upiId: 'aiden@okhdfcbank',
      payoutMethod: 'upi'
    };

    // Messages and transactions
    inMemoryMessages.push({
      id: `msg-${Date.now()}`,
      senderId: deleteUserId,
      receiverId: peerUserId,
      text: 'Secret project notes from Aiden'
    });

    inMemoryTransactions.push({
      id: `tx-peer-${Date.now()}`,
      userId: peerUserId,
      peerId: deleteUserId,
      peerName: 'Aiden Pearce',
      amount: 10,
      title: 'Peer tutoring with Aiden Pearce',
      currency: 'TOKENS'
    });

    const deleteUserToken = createToken(deleteUserId, 'student');

    // 1. Cannot delete account with active balance (25 tokens)
    console.log(`Test 5.1: Trying delete with balance ${userToDelete.tokenBalance}`);
    const blockedDeleteRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${deleteUserToken}` }
    });
    console.log(`Test 5.1 status: ${blockedDeleteRes.status}`);
    const blockedData = await blockedDeleteRes.json();
    console.log(`Test 5.1 error message: ${blockedData.error}`);
    assert.strictEqual(blockedDeleteRes.status, 400, 'Account deletion must be blocked while balance > 0');
    assert.ok(blockedData.error.includes('active balance'), 'Error must mention active balance');

    // 2. Spend balance down to 0, then delete
    console.log('Test 5.2: Setting balance to 0 and re-attempting deletion');
    userToDelete.tokenBalance = 0;
    if (prisma && process.env.DATABASE_URL) {
      await prisma.user.update({ where: { id: deleteUserId }, data: { tokenBalance: 0 } }).catch(() => {});
    }
    const okDeleteRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${deleteUserToken}` }
    });
    console.log(`Test 5.2 status: ${okDeleteRes.status}`);
    const okData = await okDeleteRes.json();
    console.log(`Test 5.2 message: ${okData.message || okData.error}`);
    assert.strictEqual(okDeleteRes.status, 200, 'Account deletion with zero balance should succeed');

    // 3. Verify PII scrubbing
    assert.strictEqual(userToDelete.name, 'Deleted Student', 'Name should be anonymized to Deleted Student');
    assert.strictEqual(userToDelete.bio, '', 'Bio should be wiped');
    assert.strictEqual(userToDelete.avatar, null, 'Avatar should be null');
    assert.strictEqual(inMemoryPayoutAccounts[deleteUserId], undefined, 'PayoutAccount should be deleted');

    // 4. Verify message content blanked
    const deletedUserMsg = inMemoryMessages.find(m => m.senderId === deleteUserId);
    assert.strictEqual(deletedUserMsg?.text, '[Message removed due to account deactivation]');

    // 5. Verify peer transaction denormalized peerName scrubbed
    const peerTx = inMemoryTransactions.find(t => t.userId === peerUserId);
    assert.strictEqual(peerTx?.peerName, 'Deactivated User', 'Peer transaction peerName must be scrubbed to Deactivated User');
    console.log('✅ TEST 5 PASSED: Balance protected; PII, messages, payout details, and peer ledger records scrubbed!');

    // -------------------------------------------------------------
    // TEST 6: Seed-Demo Endpoint Gating (HTTP 403)
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Seed-Demo Endpoint Gating ---');
    // 1. Unauthenticated call without key
    const unauthSeedRes = await fetch(`${baseUrl}/api/admin/seed-demo`, { method: 'POST' });
    assert.strictEqual(unauthSeedRes.status, 403, 'Unauthenticated seed-demo without key must return HTTP 403');

    // 2. Student call without key
    const studentSeedRes = await fetch(`${baseUrl}/api/admin/seed-demo`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.strictEqual(studentSeedRes.status, 403, 'Student calling seed-demo without key must return HTTP 403');

    // 3. Call with invalid header key
    const invalidKeySeedRes = await fetch(`${baseUrl}/api/admin/seed-demo`, {
      method: 'POST',
      headers: { 'x-demo-seed-key': 'wrong-key-12345' }
    });
    assert.strictEqual(invalidKeySeedRes.status, 403, 'Invalid seed key must return HTTP 403');

    // 4. Call with valid secret key
    const validKeySeedRes = await fetch(`${baseUrl}/api/admin/seed-demo`, {
      method: 'POST',
      headers: { 'x-demo-seed-key': process.env.DEMO_SEED_KEY! }
    });
    assert.strictEqual(validKeySeedRes.status, 200, 'Valid DEMO_SEED_KEY must successfully seed demo');
    const seedData = await validKeySeedRes.json();
    assert.strictEqual(seedData.success, true);
    assert.strictEqual(seedData.student.email, 'student.demo@mindroot.edu');
    assert.strictEqual(seedData.teacher.email, 'mentor.demo@mindroot.edu');
    console.log('✅ TEST 6 PASSED: seed-demo strictly protected by DEMO_SEED_KEY and Admin role!');

    // -------------------------------------------------------------
    // TEST 7: Socket Event Authorization & tokenVersion Handshake Check
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Socket Event Authorization & tokenVersion Handshake ---');
    const socketUserId = `socket-user-${Date.now()}`;
    const socketUser = {
      id: socketUserId,
      name: 'Socket Pilot',
      email: `${socketUserId}@test.com`,
      role: 'student',
      tokenVersion: 2
    };
    await seedTestUser(socketUser);

    // 1. Stale tokenVersion: client has tokenVersion 1, server user has tokenVersion 2
    const staleToken = createToken(socketUserId, 'student', 1);
    const staleSocket = ioClient(baseUrl, {
      auth: { token: staleToken },
      transports: ['websocket'],
      reconnection: false
    });

    const connectErrorPromise = new Promise<string>((resolve) => {
      staleSocket.on('connect_error', (err) => resolve(err.message));
      staleSocket.on('connect', () => resolve('CONNECTED_UNEXPECTEDLY'));
    });
    const errorMsg = await connectErrorPromise;
    staleSocket.close();
    assert.ok(errorMsg.includes('Stale tokenVersion'), `Expected stale tokenVersion error, got: ${errorMsg}`);
    console.log(`Stale token handshake rejected as expected: "${errorMsg}"`);

    // 2. Valid token connects, joins room, emits whiteboard-update, peer receives it
    const validSocketToken = createToken(socketUserId, 'student', 2);
    const clientA = ioClient(baseUrl, { auth: { token: validSocketToken }, transports: ['websocket'] });
    const clientB = ioClient(baseUrl, { auth: { token: validSocketToken }, transports: ['websocket'] });

    await Promise.all([
      new Promise<void>((r) => clientA.on('connect', () => r())),
      new Promise<void>((r) => clientB.on('connect', () => r()))
    ]);

    const testRoom = `room-sync-${Date.now()}`;
    clientA.emit('join-room', { roomId: testRoom, userId: socketUserId });
    clientB.emit('join-room', { roomId: testRoom, userId: socketUserId });

    // Wait for room join to complete
    await new Promise((r) => setTimeout(r, 100));

    const receivedWhiteboardPromise = new Promise<any>((resolve) => {
      clientB.on('whiteboard-update', (data) => resolve(data));
    });

    clientA.emit('whiteboard-update', { roomId: testRoom, stroke: 'x:10,y:20' });
    const strokeData = await receivedWhiteboardPromise;
    assert.strictEqual(strokeData.stroke, 'x:10,y:20', 'Peer in room should receive whiteboard-update');

    // 3. Unauthenticated / non-room member emission is dropped
    const unjoinedSocket = ioClient(baseUrl, { transports: ['websocket'] });
    await new Promise<void>((r) => unjoinedSocket.on('connect', () => r()));

    let leaked = false;
    clientB.on('chat-message', () => { leaked = true; });
    unjoinedSocket.emit('chat-message', { roomId: testRoom, text: 'unauthorized spam' });

    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(leaked, false, 'Unjoined socket chat-message must NOT be relayed to room!');

    clientA.close();
    clientB.close();
    unjoinedSocket.close();
    console.log('✅ TEST 7 PASSED: Stale token handshake rejected; room membership required to relay strokes/chat!');

    // -------------------------------------------------------------
    // TEST 8: Cancellation Refund & Direct-UPI Handling
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Cancellation Refund & Direct-UPI Handling ---');
    // Scenario A: Token-paid session auto-refunds student once
    const tokenSessStudentId = `token-student-${Date.now()}`;
    const tokenSessTeacherId = `token-teacher-${Date.now()}`;
    const tokenSessionId = `token-sess-${Date.now()}`;

    const tokenStudent = {
      id: tokenSessStudentId,
      name: 'Token Learner',
      email: `${tokenSessStudentId}@test.com`,
      role: 'student',
      tokenBalance: 0
    };
    await seedTestUser(tokenStudent);
    await seedTestUser({
      id: tokenSessTeacherId,
      name: 'Compiler Mentor',
      email: `${tokenSessTeacherId}@test.com`,
      role: 'teacher',
      tokenBalance: 0
    });

    const tokenSession = {
      id: tokenSessionId,
      title: 'Compiler Optimization Techniques',
      studentId: tokenSessStudentId,
      teacherId: tokenSessTeacherId,
      amount: 5,
      currency: 'TOKENS',
      paymentId: `tx-token-${Date.now()}`,
      paymentStatus: 'paid',
      status: 'confirmed'
    };
    inMemorySessions.push(tokenSession);

    const tokenStudentToken = createToken(tokenSessStudentId, 'student');

    // First cancel -> refunds 5 tokens
    const cancel1Res = await fetch(`${baseUrl}/api/sessions/${tokenSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenStudentToken}` },
      body: JSON.stringify({ status: 'cancelled' })
    });
    assert.strictEqual(cancel1Res.status, 200);
    assert.strictEqual(tokenStudent.tokenBalance, 5, 'Student must receive 5 token refund on cancellation');

    // Second cancel attempt -> does not double-refund
    const cancel2Res = await fetch(`${baseUrl}/api/sessions/${tokenSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenStudentToken}` },
      body: JSON.stringify({ status: 'cancelled' })
    });
    assert.strictEqual(cancel2Res.status, 200);
    assert.strictEqual(tokenStudent.tokenBalance, 5, 'Double cancel must NOT refund tokens twice');

    // Scenario B: Direct UPI session moves to cancellation_direct_refund_pending
    const upiSessId = `upi-sess-${Date.now()}`;
    const upiSession = {
      id: upiSessId,
      title: 'Full Stack Mentorship',
      studentId: tokenSessStudentId,
      teacherId: tokenSessTeacherId,
      amount: 499,
      utrNumber: `UPI-TEST-${Date.now()}`,
      paymentStatus: 'paid',
      status: 'confirmed'
    };
    inMemorySessions.push(upiSession);

    const upiCancelRes = await fetch(`${baseUrl}/api/sessions/${upiSessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenStudentToken}` },
      body: JSON.stringify({ status: 'cancelled' })
    });
    assert.strictEqual(upiCancelRes.status, 200);
    assert.strictEqual(
      upiSession.paymentStatus,
      'cancellation_direct_refund_pending',
      'Direct UPI cancelled session must move to cancellation_direct_refund_pending'
    );
    console.log('✅ TEST 8 PASSED: Token cancellation refunded student exactly once; Direct-UPI moved to pending direct refund!');

    // -------------------------------------------------------------
    // TEST 9: Gap F10 UPI VPA Capture, Validation, Verification, and Safeguards
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Gap F10 Mentor UPI ID / VPA Safeguards ---');

    // 9.1: confirm-upi returns 400 MENTOR_PAYOUT_NOT_CONFIGURED when mentor has no VPA
    const unconfTeacherId = `unconf-teacher-${Date.now()}`;
    const unconfStudentId = `unconf-student-${Date.now()}`;
    const unconfSessId = `unconf-sess-${Date.now()}`;

    await seedTestUser({
      id: unconfTeacherId,
      name: 'Unconfigured Mentor',
      email: `${unconfTeacherId}@test.com`,
      role: 'teacher',
      upiId: null,
      vpaVerified: false
    });
    await seedTestUser({
      id: unconfStudentId,
      name: 'Eager Student',
      email: `${unconfStudentId}@test.com`,
      role: 'student'
    });

    inMemorySessions.push({
      id: unconfSessId,
      title: 'Machine Learning Deep Dive',
      teacherId: unconfTeacherId,
      studentId: unconfStudentId,
      amount: 499,
      status: 'pending',
      paymentStatus: 'unpaid'
    });

    const unconfStudentToken = createToken(unconfStudentId, 'student');
    const noVpaPayRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${unconfStudentToken}` },
      body: JSON.stringify({
        sessionId: unconfSessId,
        teacherId: unconfTeacherId,
        amount: 499,
        utr: '123456789012'
      })
    });
    const noVpaPayData: any = await noVpaPayRes.json();
    assert.strictEqual(noVpaPayRes.status, 400, 'Must return 400 when mentor has no VPA');
    assert.strictEqual(noVpaPayData.code, 'MENTOR_PAYOUT_NOT_CONFIGURED', 'Code must be MENTOR_PAYOUT_NOT_CONFIGURED');
    console.log('✅ TEST 9.1 PASSED: Direct UPI payment blocked when mentor lacks configured VPA!');

    // 9.2: payout-account returns 400 for invalid VPA formats
    const confTeacherId = `conf-teacher-${Date.now()}`;
    await seedTestUser({
      id: confTeacherId,
      name: 'Configurable Mentor',
      email: `${confTeacherId}@test.com`,
      role: 'teacher',
      vpaVerified: false
    });
    const confTeacherToken = createToken(confTeacherId, 'teacher');

    const invalidVpaRes = await fetch(`${baseUrl}/api/wallet/payout-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${confTeacherToken}` },
      body: JSON.stringify({
        accountHolderName: 'Configurable Mentor',
        payoutMethod: 'upi',
        upiId: 'bad_vpa_without_handle'
      })
    });
    assert.strictEqual(invalidVpaRes.status, 400, 'Must reject malformed VPA format');
    console.log('✅ TEST 9.2 PASSED: payout-account rejects malformed VPA format!');

    // 9.3: confirm-upi strictly validates 12-digit numeric UTR
    // First, configure a valid VPA for confTeacherId
    const setVpaRes = await fetch(`${baseUrl}/api/wallet/payout-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${confTeacherToken}` },
      body: JSON.stringify({
        accountHolderName: 'Configurable Mentor',
        payoutMethod: 'upi',
        upiId: 'mentor.valid@okhdfcbank'
      })
    });
    assert.strictEqual(setVpaRes.status, 200, 'Setting valid VPA must succeed');

    const validSessId = `valid-sess-${Date.now()}`;
    inMemorySessions.push({
      id: validSessId,
      title: 'Valid Mentorship Session',
      teacherId: confTeacherId,
      studentId: unconfStudentId,
      amount: 499,
      status: 'pending',
      paymentStatus: 'unpaid'
    });

    // Short UTR rejected
    const shortUtrRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${unconfStudentToken}` },
      body: JSON.stringify({
        sessionId: validSessId,
        teacherId: confTeacherId,
        amount: 499,
        utr: '12345'
      })
    });
    assert.strictEqual(shortUtrRes.status, 400, 'Must reject non-12-digit UTR');

    // Alphanumeric UTR rejected
    const alphaUtrRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${unconfStudentToken}` },
      body: JSON.stringify({
        sessionId: validSessId,
        teacherId: confTeacherId,
        amount: 499,
        utr: 'abc123456789'
      })
    });
    assert.strictEqual(alphaUtrRes.status, 400, 'Must reject non-numeric UTR');

    // Valid 12-digit numeric UTR accepted
    const valid12Utr = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const validUtrRes = await fetch(`${baseUrl}/api/payment/confirm-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${unconfStudentToken}` },
      body: JSON.stringify({
        sessionId: validSessId,
        teacherId: confTeacherId,
        amount: 499,
        utr: valid12Utr
      })
    });
    assert.strictEqual(validUtrRes.status, 200, 'Valid 12-digit UTR must be accepted');
    console.log('✅ TEST 9.3 PASSED: confirm-upi strictly validates 12-digit numeric UTRs!');

    // 9.4: VPA change resets vpaVerified = false, Admin can verify VPA
    const adminUserId = `admin-audit-${Date.now()}`;
    await seedTestUser({
      id: adminUserId,
      name: 'System Admin',
      email: `${adminUserId}@test.com`,
      role: 'admin'
    });
    const adminToken = createToken(adminUserId, 'admin');

    // Admin verifies VPA
    const adminVerifyRes = await fetch(`${baseUrl}/api/users/${confTeacherId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ vpaVerified: true })
    });
    assert.strictEqual(adminVerifyRes.status, 200);
    const teacherAfterAdminVerify = inMemoryUsers.find(u => u.id === confTeacherId);
    assert.strictEqual(teacherAfterAdminVerify.vpaVerified, true, 'Admin should be able to verify mentor VPA');

    // Teacher edits VPA -> vpaVerified automatically resets to false
    const teacherEditVpaRes = await fetch(`${baseUrl}/api/wallet/payout-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${confTeacherToken}` },
      body: JSON.stringify({
        accountHolderName: 'Configurable Mentor',
        payoutMethod: 'upi',
        upiId: 'new.mentor@okaxis'
      })
    });
    assert.strictEqual(teacherEditVpaRes.status, 200);
    const teacherAfterEdit = inMemoryUsers.find(u => u.id === confTeacherId);
    assert.strictEqual(teacherAfterEdit.vpaVerified, false, 'Editing VPA must reset vpaVerified to false');
    console.log('✅ TEST 9.4 PASSED: VPA editing resets verification status; Admin can verify VPA!');

    // 9.5: GET /api/payment/mentor-upi/:teacherId returns truthful null upiId without placeholder
    const mentorUpiRes = await fetch(`${baseUrl}/api/payment/mentor-upi/${unconfTeacherId}`, {
      headers: { 'Authorization': `Bearer ${unconfStudentToken}` }
    });
    assert.strictEqual(mentorUpiRes.status, 200);
    const mentorUpiData: any = await mentorUpiRes.json();
    assert.strictEqual(mentorUpiData.upiId, null, 'Unconfigured mentor must return upiId: null');
    assert.strictEqual(mentorUpiData.isConfigured, false, 'isConfigured must be false');
    const rawResText = JSON.stringify(mentorUpiData);
    assert.strictEqual(rawResText.includes('@okhdfcbank'), false, 'Response must never contain fabricated @okhdfcbank');
    console.log('✅ TEST 9.5 PASSED: mentor-upi returns null for unconfigured mentors with zero fabricated VPAs!');

    console.log('\n====================================================');
    console.log('🎉 ALL AUDIT GAP VERIFICATION TESTS PASSED (9/9)');
    console.log('====================================================\n');
    serverInstance.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ AUDIT GAPS TEST FAILED:', err);
    serverInstance.close();
    process.exit(1);
  }
}

runAuditGapsTests().catch((err) => {
  console.error('\n❌ AUDIT GAPS TEST FAILED:', err);
  process.exit(1);
});
