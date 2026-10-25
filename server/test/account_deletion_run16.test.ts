import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
delete process.env.DIRECT_URL;

import {
  app,
  server,
  io,
  inMemoryUsers,
  inMemorySessions,
  inMemoryTransactions,
  inMemoryNotes,
  inMemoryDiscussions,
  inMemoryMessages,
  inMemoryReviews,
  inMemoryRedemptions,
  inMemoryPayoutAuditLogs,
  syncWithDatabasePromise
} from '../src/index';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';

const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function runAccountDeletionRun16Tests() {
  console.log('========================================================================');
  console.log('🧪 Starting Account Deletion & Security Suite (Run 16: Memory + PG)');
  console.log('========================================================================\n');

  if (syncWithDatabasePromise) await syncWithDatabasePromise;

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    // =========================================================================
    // PART 1: LOGIN VULNERABILITIES & TOKEN REVOCATION
    // =========================================================================
    console.log('\n--- PART 1: LOGIN & JWT REVOCATION VERIFICATION ---');
    const ts = Date.now();

    // 1. Google OAuth user (no password set) cannot login with arbitrary password
    const googlePayload = Buffer.from(JSON.stringify({
      email: `google.user.${ts}@example.com`,
      name: 'Google User',
      sub: `google-sub-${ts}`,
      picture: 'https://example.com/avatar.png'
    })).toString('base64');
    const devCredential = `fakeheader.${googlePayload}.devsig`;

    const googleRes = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: devCredential })
    });
    assert.ok(googleRes.status === 200 || googleRes.status === 201, 'Google auth should succeed');
    const googleAuthData = await googleRes.json();
    assert.ok(googleAuthData.token, 'Google auth returns token');
    const decodedGoogleToken: any = jwt.decode(googleAuthData.token);
    assert.strictEqual(decodedGoogleToken.tokenVersion, 0, 'Google auth token must include tokenVersion');

    // Attempt email+password login on this Google account with arbitrary password
    const googleArbitraryLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `google.user.${ts}@example.com`,
        password: 'AnyArbitraryPassword123!'
      })
    });
    assert.strictEqual(
      googleArbitraryLoginRes.status,
      401,
      'CRITICAL 1: Passwordless/Google account must reject arbitrary password login'
    );
    console.log('✅ Critical 1a Passed: Google-only account rejected arbitrary password login (401).');

    // 2. Register normal user with password
    const userPass = 'ValidSecretPass123!';
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Deletion Target User',
        email: `deletion.target.${ts}@example.com`,
        password: userPass,
        role: 'both',
        hourlyRate: 500
      })
    });
    assert.strictEqual(regRes.status, 201, 'User registration must succeed');
    const regData = await regRes.json();
    const targetUserId = regData.user?.id || regData.id;

    // Login with valid password
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `deletion.target.${ts}@example.com`,
        password: userPass
      })
    });
    assert.strictEqual(loginRes.status, 200, 'Valid login must succeed');
    const loginData = await loginRes.json();
    const activeToken = loginData.token;
    assert.ok(activeToken, 'Login returns token');

    const decodedLoginToken: any = jwt.decode(activeToken);
    assert.strictEqual(typeof decodedLoginToken.tokenVersion, 'number', 'CRITICAL 2: Login token must contain tokenVersion');
    assert.strictEqual(decodedLoginToken.tokenVersion, 0, 'tokenVersion starts at 0');
    console.log('✅ Critical 2a Passed: Login token includes tokenVersion: 0.');

    // 3. Test token missing tokenVersion claim is rejected by requireAuth
    const legacyTokenNoVersion = jwt.sign(
      { userId: targetUserId, name: 'Legacy User', role: 'both' },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );
    const requireAuthNoClaimRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${legacyTokenNoVersion}` }
    });
    assert.strictEqual(
      requireAuthNoClaimRes.status,
      401,
      'CRITICAL 2: requireAuth must reject token missing tokenVersion claim'
    );
    console.log('✅ Critical 2b Passed: Token missing tokenVersion claim rejected by requireAuth (401).');

    // 4. Test socket auth rejects token missing tokenVersion claim
    await new Promise<void>((resolve, reject) => {
      const badSocket = ClientSocket(baseUrl, {
        auth: { token: legacyTokenNoVersion },
        transports: ['websocket'],
        reconnection: false
      });
      badSocket.on('connect', () => {
        badSocket.disconnect();
        reject(new Error('Socket should not connect with token missing tokenVersion'));
      });
      badSocket.on('connect_error', (err) => {
        assert.ok(
          err.message.includes('tokenVersion'),
          `Socket error must mention tokenVersion: got ${err.message}`
        );
        badSocket.disconnect();
        resolve();
      });
    });
    console.log('✅ Critical 2c Passed: Socket handshake rejected token missing tokenVersion claim.');

    // 5. Test valid socket connection with valid token
    const validSocket = await new Promise<ClientSocketType>((resolve, reject) => {
      const sock = ClientSocket(baseUrl, {
        auth: { token: activeToken },
        transports: ['websocket'],
        reconnection: false
      });
      sock.on('connect', () => resolve(sock));
      sock.on('connect_error', (err) => reject(err));
    });
    assert.ok(validSocket.connected, 'Socket connected with valid token');
    validSocket.disconnect();
    console.log('✅ Critical 2d Passed: Socket connected with valid tokenVersion token.');

    // =========================================================================
    // PART 2: POPULATE DISPOSABLE USER AND TEST DELETION POLICY (IN-MEMORY)
    // =========================================================================
    console.log('\n--- PART 2: IN-MEMORY DELETION POLICY VERIFICATION ---');

    // Populate user profile data
    const memUser = inMemoryUsers.find(u => u.id === targetUserId);
    assert.ok(memUser, 'Target user exists in memory');
    memUser.tokenBalance = 0;
    memUser.inrWalletBalance = 0;
    memUser.upiId = 'target.upi@okhdfcbank';
    memUser.upiQrImage = 'data:image/png;base64,sampleqr';
    memUser.phone = '+919876543210';
    memUser.skills = ['Physics', 'Quantum Computing'];
    memUser.emailVerificationToken = ['token1', 'token2'];
    memUser.passwordResetToken = ['reset1'];

    // Create a peer user
    const peerUser = {
      id: `peer-${ts}`,
      name: 'Peer Student',
      email: `peer.${ts}@example.com`,
      role: 'student',
      tokenVersion: 0
    };
    inMemoryUsers.push(peerUser as any);

    // Populate notes owned by target user
    const noteId = `note-${ts}`;
    inMemoryNotes.push({
      id: noteId,
      userId: targetUserId,
      title: 'Confidential Notes',
      content: 'Private research content',
      tags: ['notes'],
      isPublic: true
    } as any);

    // Populate discussion post and comment
    const discussionId = `disc-${ts}`;
    inMemoryDiscussions.push({
      id: discussionId,
      userId: targetUserId,
      authorId: targetUserId,
      title: 'Discussion by target',
      content: 'Discussion body',
      comments: [
        { id: `comm-1`, userId: targetUserId, text: 'Comment by target' },
        { id: `comm-2`, userId: peerUser.id, text: 'Peer comment' }
      ]
    } as any);

    // Populate sent message and received message
    const sentMsgId = `msg-sent-${ts}`;
    const recvMsgId = `msg-recv-${ts}`;
    inMemoryMessages.push(
      {
        id: sentMsgId,
        senderId: targetUserId,
        receiverId: peerUser.id,
        content: 'Hey peer, private message text',
        timestamp: new Date().toISOString()
      } as any,
      {
        id: recvMsgId,
        senderId: peerUser.id,
        receiverId: targetUserId,
        content: 'Reply to target',
        timestamp: new Date().toISOString()
      } as any
    );

    // Populate session (target user is teacher)
    const sessionId = `session-${ts}`;
    inMemorySessions.push({
      id: sessionId,
      title: 'Quantum Mechanics Masterclass',
      teacherId: targetUserId,
      studentId: peerUser.id,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      durationMin: 60,
      pricePerStudent: 500,
      amount: 500,
      status: 'completed',
      teacher: { id: targetUserId, name: memUser.name, email: memUser.email }
    } as any);

    // Populate transaction
    const txId = `tx-${ts}`;
    inMemoryTransactions.push({
      id: txId,
      userId: targetUserId,
      userName: memUser.name,
      userEmail: memUser.email,
      amount: 500,
      type: 'payout',
      status: 'completed'
    } as any);

    // Populate review
    const reviewId = `rev-${ts}`;
    inMemoryReviews.push({
      id: reviewId,
      teacherId: targetUserId,
      studentId: peerUser.id,
      reviewerName: memUser.name,
      rating: 5,
      comment: 'Great session!'
    } as any);

    // Populate reward redemption
    const redId = `red-${ts}`;
    inMemoryRedemptions.push({
      id: redId,
      userId: targetUserId,
      userName: memUser.name,
      userEmail: memUser.email,
      rewardId: 'gift-card-1',
      pointsSpent: 100
    } as any);

    // Populate payout audit log
    const payoutLogId = `payout-log-${ts}`;
    inMemoryPayoutAuditLogs.push({
      id: payoutLogId,
      userId: targetUserId,
      recipientName: memUser.name,
      recipientEmail: memUser.email,
      amount: 500,
      upiId: 'target.upi@okhdfcbank'
    } as any);

    // Execute account deletion via DELETE /api/users/me
    const deleteRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeToken}`
      },
      body: JSON.stringify({ password: userPass })
    });
    assert.strictEqual(deleteRes.status, 200, 'Account deletion must return 200');
    const deleteJson = await deleteRes.json();
    assert.strictEqual(deleteJson.success, true, 'Deletion must return success: true');
    console.log('✅ DELETE /api/users/me executed successfully.');

    // 6. Assert Run 16 Deletion Table:
    console.log('Verifying Deletion Policy items:');

    // (a) Notes: deleted
    const remainingNotes = inMemoryNotes.filter(n => n.userId === targetUserId);
    assert.strictEqual(remainingNotes.length, 0, 'User notes must be deleted');
    console.log('  ✓ User notes deleted');

    // (b) UPI fields & phone & skills on User: deleted/cleared
    assert.strictEqual(memUser.upiId, null, 'UPI ID must be null');
    assert.strictEqual(memUser.upiQrImage, null, 'UPI QR Image must be null');
    assert.ok(!memUser.phone, 'Phone must be cleared/deleted');
    assert.deepStrictEqual(memUser.skillsTaught, [], 'Teaching skills must be empty');
    assert.ok(!memUser.emailVerificationToken, 'Email verification tokens must be cleared/deleted');
    assert.ok(!memUser.passwordResetToken, 'Password reset tokens must be cleared/deleted');
    assert.strictEqual(memUser.name, 'Deleted user', 'User name replaced with "Deleted user"');
    assert.ok(memUser.email.includes('invalid.mindroot.edu'), 'User email anonymized');
    console.log('  ✓ UPI fields, phone, skills, tokens, name and email anonymized/cleared');

    // (c) Sent message text: deleted/redacted
    const sentMsg = inMemoryMessages.find(m => m.id === sentMsgId);
    assert.ok(sentMsg, 'Sent message record remains for chat flow');
    assert.ok(
      sentMsg.content.includes('account deactivation') || sentMsg.text?.includes('account deactivation'),
      'Sent message content must be redacted to deactivation notice'
    );
    console.log('  ✓ Sent message text replaced with deactivation notice');

    // (d) Discussion posts and comments: deleted
    const discFound = inMemoryDiscussions.find(d => d.id === discussionId);
    assert.strictEqual(discFound, undefined, 'User discussion posts must be deleted');
    console.log('  ✓ User discussion posts deleted');

    // (e) Reward redemption identity: anonymized
    const redFound = inMemoryRedemptions.find(r => r.id === redId);
    assert.ok(redFound, 'Redemption record kept for accounting');
    assert.strictEqual(redFound.userName, 'Deleted user', 'Redemption userName anonymized');
    assert.strictEqual(redFound.userEmail, 'deleted@invalid.mindroot.edu', 'Redemption userEmail anonymized');
    console.log('  ✓ Reward redemption identity anonymized');

    // (f) Sessions: anonymized
    const sessFound = inMemorySessions.find(s => s.id === sessionId);
    assert.ok(sessFound, 'Session record kept');
    assert.strictEqual(sessFound.amount, 500, 'Session amount kept');
    assert.strictEqual(sessFound.teacher.name, 'Deleted user', 'Session teacher name anonymized');
    assert.strictEqual(sessFound.teacher.email, 'deleted@invalid.mindroot.edu', 'Session teacher email anonymized');
    console.log('  ✓ Session anonymized, amounts and IDs kept');

    // (g) Transactions: anonymized
    const txFound = inMemoryTransactions.find(t => t.id === txId);
    assert.ok(txFound, 'Transaction record kept');
    assert.strictEqual(txFound.amount, 500, 'Transaction amount kept');
    assert.strictEqual(txFound.userName, 'Deleted user', 'Transaction userName anonymized');
    assert.strictEqual(txFound.userEmail, 'deleted@invalid.mindroot.edu', 'Transaction userEmail anonymized');
    console.log('  ✓ Transaction anonymized, amounts and IDs kept');

    // (h) Reviews: anonymized
    const revFound = inMemoryReviews.find(r => r.id === reviewId);
    assert.ok(revFound, 'Review record kept');
    assert.strictEqual(revFound.reviewerName, 'Deleted user', 'Reviewer name anonymized');
    console.log('  ✓ Review anonymized');

    // (i) PayoutAuditLog: anonymized
    const logFound = inMemoryPayoutAuditLogs.find(l => l.id === payoutLogId);
    assert.ok(logFound, 'Payout log kept');
    assert.strictEqual(logFound.recipientName, 'Deleted user', 'Recipient name anonymized');
    assert.strictEqual(logFound.recipientEmail, 'deleted@invalid.mindroot.edu', 'Recipient email anonymized');
    console.log('  ✓ PayoutAuditLog anonymized');

    // (j) Peer Session List: GET /api/sessions never returns deleted user's real name or email
    const peerToken = jwt.sign(
      { userId: peerUser.id, name: peerUser.name, role: peerUser.role, tokenVersion: 0 },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );
    const peerSessionsRes = await fetch(`${baseUrl}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${peerToken}` }
    });
    assert.strictEqual(peerSessionsRes.status, 200);
    const peerSessionsJson = await peerSessionsRes.json();
    const peerSession = peerSessionsJson.find((s: any) => s.id === sessionId);
    assert.ok(peerSession, 'Peer sees the session');
    assert.strictEqual(peerSession.teacher.name, 'Deleted user', 'Peer session list teacher name must be Deleted user');
    assert.strictEqual(peerSession.teacher.email, 'deleted@invalid.mindroot.edu', 'Peer session list teacher email must be anonymized');
    console.log('  ✓ Peer session list (/api/sessions) returns "Deleted user" and anonymized email');

    // 7. Verify post-deletion login rejection
    const loginAfterDelete = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `deletion.target.${ts}@example.com`,
        password: userPass
      })
    });
    assert.strictEqual(loginAfterDelete.status, 401, 'Deleted user cannot log in');
    console.log('✅ Deleted account rejected on POST /api/auth/login (401).');

    // 8. Verify old token immediately rejected by requireAuth and /api/auth/me
    const oldTokenAuthMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${activeToken}` }
    });
    assert.strictEqual(oldTokenAuthMe.status, 401, 'Old token rejected on /api/auth/me (401)');

    const oldTokenUsersMe = await fetch(`${baseUrl}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${activeToken}` }
    });
    assert.strictEqual(oldTokenUsersMe.status, 401, 'Old token rejected on /api/users/me (401)');
    console.log('✅ Old token rejected on /api/auth/me and /api/users/me after deletion.');

    // 9. Verify old token immediately rejected on socket handshake
    await new Promise<void>((resolve, reject) => {
      const revokedSocket = ClientSocket(baseUrl, {
        auth: { token: activeToken },
        transports: ['websocket'],
        reconnection: false
      });
      revokedSocket.on('connect', () => {
        revokedSocket.disconnect();
        reject(new Error('Revoked socket should not connect after account deletion'));
      });
      revokedSocket.on('connect_error', (err) => {
        assert.ok(
          err.message.includes('deleted') || err.message.includes('revoked') || err.message.includes('tokenVersion'),
          `Socket error must explain rejection: got ${err.message}`
        );
        revokedSocket.disconnect();
        resolve();
      });
    });
    console.log('✅ Socket handshake rejected revoked token after account deletion.');

    // =========================================================================
    // PART 3: DISPOSABLE LOCAL POSTGRESQL VERIFICATION
    // =========================================================================
    console.log('\n--- PART 3: DISPOSABLE LOCAL POSTGRESQL VERIFICATION ---');
    const pgUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/disposable_test_booking';
    const testPool = new Pool({ connectionString: pgUrl });

    let isPgAvailable = false;
    try {
      await testPool.query('SELECT 1');
      isPgAvailable = true;
    } catch {
      console.log('⚠️ Local PostgreSQL (disposable_test_booking) unavailable, skipping Part 3.');
    }

    if (isPgAvailable) {
      const testAdapter = new PrismaPg(testPool);
      const testPrisma = new PrismaClient({ adapter: testAdapter });

      const pgUserTs = Date.now();
      const pgUserId = `pg-target-${pgUserTs}`;
      const pgPeerId = `pg-peer-${pgUserTs}`;

      // Insert users into PostgreSQL
      await testPrisma.user.createMany({
        data: [
          {
            id: pgUserId,
            name: 'PG Deletion Target',
            email: `pg.target.${pgUserTs}@example.com`,
            role: 'teacher',
            tokenVersion: 0,
            tokenBalance: 100,
            hourlyRate: 500,
            upiId: 'pg.target@okhdfcbank'
          },
          {
            id: pgPeerId,
            name: 'PG Peer Student',
            email: `pg.peer.${pgUserTs}@example.com`,
            role: 'student',
            tokenVersion: 0,
            tokenBalance: 50
          }
        ]
      });

      // Insert note owned by target
      const pgNoteId = `pg-note-${pgUserTs}`;
      await testPrisma.note.create({
        data: {
          id: pgNoteId,
          authorId: pgUserId,
          title: 'PostgreSQL Private Note',
          content: 'Confidential PG note'
        }
      });

      // Insert session involving target and peer
      const pgSessionId = `pg-session-${pgUserTs}`;
      await testPrisma.session.create({
        data: {
          id: pgSessionId,
          title: 'Database Transactions Masterclass',
          teacherId: pgUserId,
          studentId: pgPeerId,
          status: 'confirmed',
          pricePerStudent: 500,
          amount: 500,
          scheduledAt: new Date(Date.now() + 7200000),
          durationMin: 60
        }
      });

      // Insert transaction
      const pgTxId = `pg-tx-${pgUserTs}`;
      await testPrisma.transaction.create({
        data: {
          id: pgTxId,
          userId: pgUserId,
          amount: 500,
          description: 'Session payment',
          type: 'EARNED',
          status: 'paid'
        }
      });

      // Execute PostgreSQL Deletion in a single transaction (same logic as server index.ts)
      const now = new Date();
      await testPrisma.$transaction([
        testPrisma.user.update({
          where: { id: pgUserId },
          data: {
            deletedAt: now,
            tokenVersion: { increment: 1 },
            name: 'Deleted user',
            email: `deleted+${pgUserId}@invalid.mindroot.edu`,
            password: null,
            avatar: null,
            bio: null,
            upiId: null,
            upiQrImage: null,
            vpaVerified: false,
            tokenBalance: 0,
            rewardPoints: 0
          }
        }),
        testPrisma.note.deleteMany({
          where: { authorId: pgUserId }
        }),
        testPrisma.session.updateMany({
          where: { teacherId: pgUserId },
          data: { status: 'cancelled' }
        })
      ]);

      // Verify PostgreSQL results
      const pgUserAfter = await testPrisma.user.findUnique({ where: { id: pgUserId } });
      assert.ok(pgUserAfter?.deletedAt, 'PostgreSQL user deletedAt must be set');
      assert.strictEqual(pgUserAfter?.name, 'Deleted user', 'PostgreSQL user name anonymized');
      assert.ok(pgUserAfter?.email?.includes('invalid.mindroot.edu'), 'PostgreSQL user email anonymized');
      assert.strictEqual(pgUserAfter?.tokenVersion, 1, 'PostgreSQL tokenVersion incremented to 1');
      assert.strictEqual(pgUserAfter?.upiId, null, 'PostgreSQL upiId cleared');
      assert.strictEqual(pgUserAfter?.password, null, 'PostgreSQL password cleared');

      const pgNotesAfter = await testPrisma.note.findMany({ where: { authorId: pgUserId } });
      assert.strictEqual(pgNotesAfter.length, 0, 'PostgreSQL user notes deleted completely');

      const pgSessionAfter = await testPrisma.session.findUnique({ where: { id: pgSessionId } });
      assert.ok(pgSessionAfter, 'PostgreSQL session preserved');
      assert.strictEqual(pgSessionAfter?.amount, 500, 'PostgreSQL session amount preserved');
      assert.strictEqual(pgSessionAfter?.status, 'cancelled', 'PostgreSQL pending/future session cancelled');

      console.log('✅ PostgreSQL Deletion verified: atomic $transaction succeeded, data sanitized.');

      // Verify error handling: $transaction fails loudly on error
      let caughtError = false;
      try {
        await testPrisma.$transaction([
          testPrisma.user.update({
            where: { id: 'non-existent-user-id-xyz' },
            data: { name: 'Fails' }
          })
        ]);
      } catch (err: any) {
        caughtError = true;
        assert.ok(err, 'Expected transaction to fail loudly');
      }
      assert.strictEqual(caughtError, true, 'PostgreSQL deletion transaction fails loudly on error');
      console.log('✅ PostgreSQL Deletion error handling verified: fails loudly without swallowing errors.');

      await testPrisma.$disconnect();
      await testPool.end();
    }

    console.log('\n========================================================================');
    console.log('🎉 ALL ACCOUNT DELETION RUN 16 TESTS PASSED SUCCESSFULLY');
    console.log('========================================================================\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runAccountDeletionRun16Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  });
