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
  inMemoryNotes,
  inMemorySessions,
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

async function runNotesApiTests() {
  console.log('====================================================');
  console.log('📝 Starting Notes API & Model Verification Test Suite');
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
    const userA = {
      id: `user-author-${timestamp}`,
      name: 'Author User',
      email: `author.${timestamp}@gmail.com`,
      role: 'student'
    };
    const userB = {
      id: `user-reader-${timestamp}`,
      name: 'Reader User',
      email: `reader.${timestamp}@gmail.com`,
      role: 'student'
    };

    inMemoryUsers.push(userA as any, userB as any);

    // TEST 1: Create a regular note
    console.log('--- TEST 1: Create Regular Note ---');
    const createRes = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${userA.id}`
      },
      body: JSON.stringify({
        title: 'Algorithms Revision',
        content: '<p>Graph algorithms notes: BFS, DFS, Dijkstra</p>',
        tags: ['Computer Science', 'Algorithms'],
        type: 'regular',
        visibility: 'private'
      })
    });
    assert.strictEqual(createRes.status, 201, 'Note creation should return 201');
    const createdNote = await createRes.json();
    assert.strictEqual(createdNote.authorId, userA.id, 'Author must match logged-in user');
    assert.strictEqual(createdNote.title, 'Algorithms Revision');
    assert.deepStrictEqual(createdNote.tags, ['Computer Science', 'Algorithms']);
    console.log('✅ Test 1 Passed: Regular note created successfully.');

    // TEST 2: Fetch notes for userA
    console.log('\n--- TEST 2: Fetch Author Notes ---');
    const getRes = await fetch(`${baseUrl}/api/notes`, {
      headers: {
        'Authorization': `Bearer dev-token-${userA.id}`
      }
    });
    assert.strictEqual(getRes.status, 200);
    const notesList = await getRes.json();
    assert.ok(notesList.some((n: any) => n.id === createdNote.id), 'Notes list must include created note');
    console.log('✅ Test 2 Passed: User notes fetched successfully.');

    // TEST 3: Fetch single note by ID
    console.log('\n--- TEST 3: Fetch Single Note ---');
    const getOneRes = await fetch(`${baseUrl}/api/notes/${createdNote.id}`, {
      headers: {
        'Authorization': `Bearer dev-token-${userA.id}`
      }
    });
    assert.strictEqual(getOneRes.status, 200);
    const fetchedNote = await getOneRes.json();
    assert.strictEqual(fetchedNote.id, createdNote.id);
    console.log('✅ Test 3 Passed: Single note retrieved.');

    // TEST 4: Privacy enforcement: userB cannot read private note of userA
    console.log('\n--- TEST 4: Privacy & Isolation Enforcement ---');
    const unauthGet = await fetch(`${baseUrl}/api/notes/${createdNote.id}`, {
      headers: {
        'Authorization': `Bearer dev-token-${userB.id}`
      }
    });
    assert.strictEqual(unauthGet.status, 403, 'Access to private note of another user must return 403');
    console.log('✅ Test 4 Passed: Private note protected against cross-user access.');

    // TEST 5: Update note
    console.log('\n--- TEST 5: Update Note ---');
    const updateRes = await fetch(`${baseUrl}/api/notes/${createdNote.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${userA.id}`
      },
      body: JSON.stringify({
        title: 'Algorithms Revision - Updated',
        content: '<p>Updated content with Bellman-Ford</p>',
        tags: ['Computer Science', 'Algorithms', 'Graphs'],
        visibility: 'private'
      })
    });
    assert.strictEqual(updateRes.status, 200, 'Note update should return 200');
    const updatedNote = await updateRes.json();
    assert.strictEqual(updatedNote.title, 'Algorithms Revision - Updated');
    assert.ok(updatedNote.tags.includes('Graphs'));
    console.log('✅ Test 5 Passed: Note updated successfully.');

    // TEST 6: Delete note
    console.log('\n--- TEST 6: Delete Note ---');
    const deleteRes = await fetch(`${baseUrl}/api/notes/${createdNote.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer dev-token-${userA.id}`
      }
    });
    assert.strictEqual(deleteRes.status, 200, 'Note deletion should return 200');
    console.log('✅ Test 6 Passed: Note deleted successfully.');

    // TEST 7: WebSocket Privacy & Isolation Enforcement
    console.log('\n--- TEST 7: WebSocket Privacy & Isolation Enforcement ---');
    const tokenA = createToken(userA.id);
    const tokenB = createToken(userB.id);

    const socketA = ioClient(baseUrl, { auth: { token: tokenA }, transports: ['websocket'] });
    const socketB = ioClient(baseUrl, { auth: { token: tokenB }, transports: ['websocket'] });

    await Promise.all([
      new Promise<void>((resolve) => socketA.on('connect', () => resolve())),
      new Promise<void>((resolve) => socketB.on('connect', () => resolve()))
    ]);

    let userBReceivedNoteCreated = false;
    let userBReceivedNoteUpdated = false;
    let userBReceivedNoteDeleted = false;
    let userAReceivedNoteCreated = false;

    socketB.on('note-created', () => { userBReceivedNoteCreated = true; });
    socketB.on('note-updated', () => { userBReceivedNoteUpdated = true; });
    socketB.on('note-deleted', () => { userBReceivedNoteDeleted = true; });
    socketA.on('note-created', () => { userAReceivedNoteCreated = true; });

    // User A creates private note
    const privNoteRes = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        title: 'Secret Personal Note',
        content: '<p>Super secret private content</p>',
        tags: ['Private'],
        type: 'regular',
        visibility: 'private'
      })
    });
    assert.strictEqual(privNoteRes.status, 201);
    const privNote = await privNoteRes.json();

    // Wait 150ms for events to propagate
    await new Promise((r) => setTimeout(r, 150));

    assert.strictEqual(userAReceivedNoteCreated, true, 'Author socket MUST receive note-created event');
    assert.strictEqual(userBReceivedNoteCreated, false, 'Unrelated socket MUST NOT receive private note-created event');

    // User A updates private note
    await fetch(`${baseUrl}/api/notes/${privNote.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        title: 'Secret Personal Note - Edited',
        content: '<p>Still private</p>'
      })
    });

    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(userBReceivedNoteUpdated, false, 'Unrelated socket MUST NOT receive private note-updated event');

    // User A deletes private note
    await fetch(`${baseUrl}/api/notes/${privNote.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenA}`
      }
    });

    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(userBReceivedNoteDeleted, false, 'Unrelated socket MUST NOT receive private note-deleted event');

    socketA.close();
    socketB.close();
    console.log('✅ Test 7 Passed: Private note websocket events are strictly scoped; unrelated socket never receives private note events.');

    // TEST 8: 2-Seat Cohort Session Shared Note Save, Update & Access
    console.log('\n--- TEST 8: 2-Seat Cohort Session Shared Note Save & Access ---');
    const cohortSession = {
      id: `session-cohort-2seat-${timestamp}`,
      title: '2-Seat Advanced System Design',
      teacherId: userA.id,
      maxCapacity: 2,
      status: 'confirmed',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      students: [
        { id: userB.id, name: userB.name }
      ]
    };
    inMemorySessions.push(cohortSession as any);

    // Mentor creates note on 2-seat cohort session with visibility: shared
    const sharedNoteRes = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${userA.id}`
      },
      body: JSON.stringify({
        title: 'System Design Lecture Takeaways',
        content: '<p>Distributed consensus, Raft, Paxos</p>',
        tags: ['Architecture', 'Distributed'],
        type: 'regular',
        sessionId: cohortSession.id,
        visibility: 'shared'
      })
    });
    assert.strictEqual(sharedNoteRes.status, 201, 'Mentor must be able to create shared note for 2-seat session');
    const sharedNote = await sharedNoteRes.json();
    assert.strictEqual(sharedNote.visibility, 'shared');
    assert.strictEqual(sharedNote.sharedWithUserId, userB.id);

    // Mentor saves / updates the note again (simulating subsequent Save)
    const updateSharedRes = await fetch(`${baseUrl}/api/notes/${sharedNote.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer dev-token-${userA.id}`
      },
      body: JSON.stringify({
        title: 'System Design Lecture Takeaways - Saved',
        content: '<p>Distributed consensus, Raft, Paxos, and 2PC</p>',
        tags: ['Architecture', 'Distributed'],
        sessionId: cohortSession.id,
        visibility: 'shared'
      })
    });
    assert.strictEqual(updateSharedRes.status, 200, 'Mentor update of shared note must return 200');
    const updatedSharedNote = await updateSharedRes.json();
    assert.strictEqual(updatedSharedNote.visibility, 'shared');
    assert.strictEqual(updatedSharedNote.sharedWithUserId, userB.id);

    // Student userB fetches shared notes
    const studentSharedListRes = await fetch(`${baseUrl}/api/notes?filter=shared`, {
      headers: { 'Authorization': `Bearer dev-token-${userB.id}` }
    });
    assert.strictEqual(studentSharedListRes.status, 200);
    const studentSharedList = await studentSharedListRes.json();
    assert.ok(studentSharedList.some((n: any) => n.id === sharedNote.id), 'Student of 2-seat session must see the shared note');

    // Student userB can save a copy of the shared note
    const copyRes = await fetch(`${baseUrl}/api/notes/${sharedNote.id}/save-copy`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer dev-token-${userB.id}` }
    });
    assert.strictEqual(copyRes.status, 201);
    const copyNote = await copyRes.json();
    assert.strictEqual(copyNote.authorId, userB.id);
    assert.ok(copyNote.title.includes('Copy'));
    console.log('✅ Test 8 Passed: 2-seat cohort session shared note saved, preserved shared status, and accessible to cohort student.');

    console.log('\n====================================================');
    console.log('🎉 All Notes API & Model Verification Tests Passed!');
    console.log('====================================================');
  } finally {
    serverInstance.close();
  }
}

runNotesApiTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
