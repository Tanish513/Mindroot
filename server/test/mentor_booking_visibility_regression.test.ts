import http from 'http';
import type { AddressInfo } from 'net';
import assert from 'assert';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';

process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
delete process.env.DIRECT_URL;

import {
  app,
  server,
  io,
  inMemoryUsers,
  inMemorySessions,
  syncWithDatabasePromise,
  getSessionApproverId
} from '../src/index';

const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function runMentorBookingVisibilityRegressionTests() {
  console.log('========================================================================');
  console.log('🧪 Starting Mentor Booking Visibility Regression Suite (Memory + PG)');
  console.log('========================================================================\n');

  if (syncWithDatabasePromise) await syncWithDatabasePromise;

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running at ${baseUrl}`);

  try {
    // =========================================================================
    // PART 1: In-Memory Verification (Steps a, b, c, d)
    // =========================================================================
    console.log('\n--- PART 1: IN-MEMORY MODE VERIFICATION ---');
    const ts = Date.now();

    // 1. Register Student, Teacher, and "Both" User
    const studentRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice InMem Student',
        email: `alice.mem.${ts}@example.com`,
        password: 'Password123!',
        role: 'student'
      })
    });
    assert.strictEqual(studentRes.status, 201, 'Student registration must succeed');
    const studentData = await studentRes.json();

    const teacherRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob InMem Teacher',
        email: `bob.mem.${ts}@example.com`,
        password: 'Password123!',
        role: 'teacher',
        hourlyRate: 500
      })
    });
    assert.strictEqual(teacherRes.status, 201, 'Teacher registration must succeed');
    const teacherData = await teacherRes.json();

    // Teacher configures UPI ID via /api/users/me
    const teacherUpiRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherData.token}`
      },
      body: JSON.stringify({ upiId: 'bob.mentor@okhdfcbank' })
    });
    assert.strictEqual(teacherUpiRes.status, 200, 'Teacher UPI setup via /api/users/me must succeed');

    const bothRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Charlie InMem Both',
        email: `charlie.mem.${ts}@example.com`,
        password: 'Password123!',
        role: 'both',
        hourlyRate: 600
      })
    });
    assert.strictEqual(bothRes.status, 201, 'Both-role user registration must succeed');
    const bothData = await bothRes.json();

    const bothUpiRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bothData.token}`
      },
      body: JSON.stringify({ upiId: 'charlie.both@okhdfcbank' })
    });
    assert.strictEqual(bothUpiRes.status, 200, 'Both-role user UPI setup via /api/users/me must succeed');

    // Connect teacher socket to verify real-time event delivery
    const teacherSocket = ClientSocket(baseUrl, {
      auth: { token: teacherData.token },
      transports: ['websocket'],
      forceNew: true
    });
    await new Promise<void>((resolve) => teacherSocket.on('connect', () => resolve()));

    let teacherReceivedEvent: any = null;
    teacherSocket.on('session-request-created', (ev) => {
      teacherReceivedEvent = ev;
    });

    // Step (a): Booking Response
    console.log('Testing (a): Student books session with teacher...');
    const scheduledTime = new Date(Date.now() + 86400000).toISOString();
    const bookRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentData.token}`
      },
      body: JSON.stringify({
        teacherId: teacherData.id,
        title: 'Full Stack Development',
        scheduledAt: scheduledTime,
        durationMin: 60,
        maxCapacity: 1
      })
    });
    assert.strictEqual(bookRes.status, 201, 'Booking creation should return HTTP 201');
    const bookingJson = await bookRes.json();
    assert.ok(bookingJson.id, 'Created session must have an ID');
    assert.strictEqual(bookingJson.status, 'pending', 'Created session must have pending status');
    assert.strictEqual(bookingJson.teacherId, teacherData.id, 'Session teacherId must match target teacher');
    assert.strictEqual(bookingJson.studentId, studentData.id, 'Session studentId must match student');
    assert.strictEqual(bookingJson.pricePerStudent, 500, 'Session price must match server-computed hourly rate');
    console.log('✅ Step (a) Passed: Booking response returned 201 Created with valid pending session.');

    // Wait for socket propagation
    await new Promise((r) => setTimeout(r, 400));

    // Step (b): Teacher's session list over REST
    console.log('Testing (b): Teacher retrieves sessions over REST...');
    const teacherSessionsRes = await fetch(`${baseUrl}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${teacherData.token}` }
    });
    assert.strictEqual(teacherSessionsRes.status, 200);
    const teacherSessions = await teacherSessionsRes.json();
    const foundPendingSession = teacherSessions.find((s: any) => s.id === bookingJson.id);
    assert.ok(foundPendingSession, 'Target teacher must find the pending session in GET /api/sessions');
    assert.strictEqual(foundPendingSession.status, 'pending');

    const teacherPendingCountRes = await fetch(`${baseUrl}/api/sessions/pending-count`, {
      headers: { 'Authorization': `Bearer ${teacherData.token}` }
    });
    assert.strictEqual(teacherPendingCountRes.status, 200);
    const teacherPendingData = await teacherPendingCountRes.json();
    assert.ok(teacherPendingData.count >= 1, 'Teacher pending-count must be >= 1');
    assert.ok(teacherPendingData.sessions.some((s: any) => s.id === bookingJson.id), 'Pending list must include session');
    console.log('✅ Step (b) Passed: Teacher session list and pending-count endpoints return the pending request.');

    // Step (c): session-request-created socket event
    console.log('Testing (c): Socket event delivery...');
    assert.ok(teacherReceivedEvent, 'Teacher socket must receive session-request-created event');
    assert.strictEqual(teacherReceivedEvent.id, bookingJson.id, 'Received event session ID must match created session');
    console.log('✅ Step (c) Passed: Teacher received live session-request-created WebSocket event.');

    // Step (d): "Both" user in student view
    console.log('Testing (d): User with role "both" receives mentor request in student view...');
    const bookBothRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentData.token}`
      },
      body: JSON.stringify({
        teacherId: bothData.id,
        title: 'Deep Learning with Both User',
        scheduledAt: new Date(Date.now() + 172800000).toISOString(),
        durationMin: 60,
        maxCapacity: 1
      })
    });
    assert.strictEqual(bookBothRes.status, 201, 'Booking with both-role mentor must succeed with 201');
    const bothSessionJson = await bookBothRes.json();

    const bothPendingCountRes = await fetch(`${baseUrl}/api/sessions/pending-count`, {
      headers: { 'Authorization': `Bearer ${bothData.token}` }
    });
    assert.strictEqual(bothPendingCountRes.status, 200);
    const bothPendingData = await bothPendingCountRes.json();
    assert.ok(bothPendingData.count >= 1, '"Both" user pending count must be >= 1');
    const foundBothSession = bothPendingData.sessions.find((s: any) => s.id === bothSessionJson.id);
    assert.ok(foundBothSession, '"Both" user must find the pending request');
    assert.strictEqual(getSessionApproverId(foundBothSession), bothData.id, 'Approver ID must match bothData.id');
    console.log('✅ Step (d) Passed: "Both" role user in student view receives pending mentor approval request.');

    teacherSocket.disconnect();

    // =========================================================================
    // PART 2: PostgreSQL Database Verification against Disposable Test DB
    // =========================================================================
    console.log('\n--- PART 2: POSTGRESQL VERIFICATION ---');
    const pgUrl = process.env.TEST_DATABASE_URL;
    let testPool: Pool | null = null;
    let testPrisma: PrismaClient | null = null;

    if (!pgUrl) {
      console.log('ℹ️ TEST_DATABASE_URL not set; skipping live PostgreSQL checks (refusing default to 127.0.0.1:5432/disposable_test_booking).');
    } else {
      let dbName = '';
      try {
        const parsed = new URL(pgUrl);
        dbName = parsed.pathname.replace(/^\//, '');
      } catch {
        throw new Error(`Invalid TEST_DATABASE_URL: ${pgUrl}`);
      }
      if (!dbName.toLowerCase().includes('test')) {
        throw new Error(`Refusing to run tests against database '${dbName}': TEST_DATABASE_URL must contain 'test' in the database name.`);
      }

      testPool = new Pool({ connectionString: pgUrl });
      try {
        await testPool.query('SELECT 1');
        const testAdapter = new PrismaPg(testPool);
        testPrisma = new PrismaClient({ adapter: testAdapter });
      } catch (err) {
        console.log(`⚠️ PostgreSQL configured at ${pgUrl} unavailable, skipping Part 2:`, err);
        if (testPool) {
          await testPool.end();
          testPool = null;
        }
      }
    }

    if (testPrisma && testPool) {

      // Verify that Session and User queries succeed without column errors
      console.log('Testing User, Session, and Transaction queries on PostgreSQL...');
      const dbUsers = await testPrisma.user.findMany();
      console.log(`Prisma user.findMany() OK (users: ${dbUsers.length})`);

      const dbSessions = await testPrisma.session.findMany();
      console.log(`Prisma session.findMany() OK (sessions: ${dbSessions.length})`);

      const dbTransactions = await testPrisma.transaction.findMany();
      console.log(`Prisma transaction.findMany() OK (transactions: ${dbTransactions.length})`);

      // Verify creating a session in PostgreSQL with all schema fields
      const pgStudentId = `pg-student-${ts}`;
      const pgTeacherId = `pg-teacher-${ts}`;

      await testPrisma.user.createMany({
        data: [
          {
            id: pgStudentId,
            name: 'PG Alice',
            email: `alice.pg.${ts}@test.com`,
            role: 'student',
            tokenBalance: 50
          },
          {
            id: pgTeacherId,
            name: 'PG Bob Mentor',
            email: `bob.pg.${ts}@test.com`,
            role: 'teacher',
            hourlyRate: 750,
            upiId: 'bob.pg@okaxis',
            vpaVerified: true
          }
        ]
      });

      const pgSessionId = `session-pg-${ts}`;
      const createdPgSession = await testPrisma.session.create({
        data: {
          id: pgSessionId,
          title: 'PostgreSQL Database Internals',
          teacherId: pgTeacherId,
          studentId: pgStudentId,
          status: 'pending',
          paymentStatus: 'pending',
          pricePerStudent: 750,
          amount: 750,
          maxCapacity: 1,
          students: [{ id: pgStudentId, name: 'PG Alice', paymentStatus: 'pending', amountDue: 750 }],
          scheduledAt: new Date(Date.now() + 86400000),
          durationMin: 60
        }
      });

      assert.strictEqual(createdPgSession.id, pgSessionId);
      assert.strictEqual(createdPgSession.paymentStatus, 'pending');
      assert.strictEqual(createdPgSession.pricePerStudent, 750);

      // Verify querying pending sessions for this teacher
      const foundPgPending = await testPrisma.session.findMany({
        where: {
          teacherId: pgTeacherId,
          status: 'pending'
        },
        include: { teacher: true, student: true }
      });

      assert.strictEqual(foundPgPending.length, 1);
      assert.strictEqual(foundPgPending[0].id, pgSessionId);
      assert.strictEqual(foundPgPending[0].teacher.upiId, 'bob.pg@okaxis');
      assert.strictEqual(foundPgPending[0].student.id, pgStudentId);
      console.log('✅ PostgreSQL Part 2 Passed: User, Session, and Transaction queries succeed; pending session and teacher UPI correctly persisted and queried.');

      await testPrisma.$disconnect();
      await testPool.end();
    }

    console.log('\n========================================================================');
    console.log('🎉 All Mentor Booking Visibility Regression Tests Passed Successfully!');
    console.log('========================================================================');
  } finally {
    server.close();
  }
}

runMentorBookingVisibilityRegressionTests().catch((err) => {
  console.error('❌ Regression test failed with error:', err);
  process.exit(1);
});
