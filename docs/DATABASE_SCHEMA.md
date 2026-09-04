# Mindroot Database Schema Documentation

This document describes every data model defined in `server/prisma/schema.prisma` in plain English, explaining what each entity represents and how entities relate to one another within the Mindroot Peer Skill Exchange platform.

---

## Entity Relationship Overview

```
                      +-------------------+
                      |       Skill       |
                      +-------------------+
                                | 1
                                |
                                | *
                      +-------------------+
                      |     UserSkill     |
                      +-------------------+
                                | *
                                |
                                | 1
                      +-------------------+
                      |       User        |
                      +-------------------+
                     /   |    |      |    \
                   * /   |*   |*     |*    \*
   +----------------+ +----+ +-----+ +----+ +----------------+
   |    Session     | |Txn | |Msg  | |Rev | |    Session     |
   | (as Teacher)   | +----+ +-----+ +----+ | (as Student)   |
   +----------------+                       +----------------+
```

---

## Data Models

### 1. `User`
* **What it represents**: A registered account on the Mindroot platform (students, teachers, administrators, or users with dual student/teacher roles).
* **Fields**:
  - `id` (String, UUID, Primary Key): Unique identifier for the user.
  - `name` (String): Display name of the user.
  - `role` (String, default `"student"`): Access perspective (`"student"`, `"teacher"`, `"both"`, or `"admin"`).
  - `tokenBalance` (Int, default `4`): Current balance of Skill Tokens (1 token = 1 hour of learning).
  - `trustScore` (Float, default `5.0`): Dynamic trust and reputation rating calculated from peer reviews (1.0 to 5.0).
* **Relationships**:
  - `taughtSessions` $\rightarrow$ Array of `Session` records where this user acts as the `teacher`.
  - `learnedSessions` $\rightarrow$ Array of `Session` records where this user acts as the `student`.
  - `userSkills` $\rightarrow$ Array of `UserSkill` join records defining what skills this user teaches or wants to learn.
  - `transactions` $\rightarrow$ Array of `Transaction` log records tracking earned and spent skill tokens.
  - `sentMessages` $\rightarrow$ Array of `Message` records sent by this user.
  - `receivedMessages` $\rightarrow$ Array of `Message` records received by this user.
  - `writtenReviews` $\rightarrow$ Array of `Review` feedback records authored by this user.
  - `receivedReviews` $\rightarrow$ Array of `Review` feedback records targetting this user.

---

### 2. `Skill`
* **What it represents**: A subject or topic available for exchange on the platform (e.g., Python, UI Design, React, Java, Figma).
* **Fields**:
  - `id` (String, UUID, Primary Key): Unique identifier for the skill.
  - `name` (String): Human-readable name of the skill.
  - `category` (String): Skill domain or grouping (e.g., `"Software & AI"`, `"Design & 3D"`, `"Languages"`, `"Business"`).
* **Relationships**:
  - `userSkills` $\rightarrow$ Array of `UserSkill` join records connecting this skill to users who teach or want to learn it.

---

### 3. `UserSkill`
* **What it represents**: The join entity connecting a `User` to a `Skill`, indicating whether the user offers to teach it or desires to learn it.
* **Fields**:
  - `id` (String, UUID, Primary Key): Unique identifier for the relationship.
  - `userId` (String, Foreign Key): Identifier of the associated `User`.
  - `skillId` (String, Foreign Key): Identifier of the associated `Skill`.
  - `type` (String): Role of the skill for this user (`"teaches"` or `"wants_to_learn"`).
* **Relationships**:
  - `user` $\rightarrow$ Belongs to one `User`.
  - `skill` $\rightarrow$ Belongs to one `Skill`.

---

### 4. `Session`
* **What it represents**: A scheduled 1-on-1 peer skill exchange session between a teacher and a student.
* **Fields**:
  - `id` (String, UUID, Primary Key): Unique identifier for the session.
  - `title` (String): Descriptive topic or summary (e.g., `"React ↔ Python Skill Swap"`).
  - `teacherId` (String, Foreign Key): ID of the user acting as teacher.
  - `studentId` (String, Foreign Key): ID of the user acting as student.
  - `skillId` (String, Optional Foreign Key): Optional ID of the specific skill being taught.
  - `status` (String, default `"pending"`): Lifecycle state (`"pending"`, `"confirmed"`, `"completed"`, or `"live"`).
  - `scheduledAt` (DateTime): Date and time the session is scheduled to begin.
  - `durationMin` (Int, default `60`): Planned duration of the session in minutes.
* **Relationships**:
  - `teacher` $\rightarrow$ The `User` conducting the teaching.
  - `student` $\rightarrow$ The `User` participating as the learner.

---

### 5. `Transaction`
* **What it represents**: A ledger entry recording the flow of Skill Tokens into or out of a user's account when sessions complete.
* **Fields**:
  - `id` (String, UUID, Primary Key): Unique transaction identifier.
  - `userId` (String, Foreign Key): ID of the user whose balance changed.
  - `amount` (Int): Quantity of tokens credited or debited.
  - `description` (String): Explanation of why tokens were transferred (e.g., `"Taught session: React Basics"`).
  - `type` (String): Transaction nature (`"earned"` or `"spent"`).
  - `createdAt` (DateTime, default `now()`): Timestamp of the transaction.
* **Relationships**:
  - `user` $\rightarrow$ Belongs to the `User` associated with the token movement.

---

### 6. `Message`
* **What it represents**: A direct 1-on-1 chat message exchanged between two users.
* **Fields**:
  - `id` (String, UUID, Primary Key): Unique message ID.
  - `senderId` (String, Foreign Key): ID of the user who sent the message.
  - `receiverId` (String, Foreign Key): ID of the user who receives the message.
  - `text` (String): Body content of the chat message.
  - `createdAt` (DateTime, default `now()`): Timestamp when the message was sent.
* **Relationships**:
  - `sender` $\rightarrow$ The `User` sending the message.
  - `receiver` $\rightarrow$ The `User` receiving the message.

---

### 7. `Review`
* **What it represents**: Ratings, written quotes, and skill endorsement badges left by a peer after a completed session.
* **Fields**:
  - `id` (String, UUID, Primary Key): Unique review ID.
  - `authorId` (String, Foreign Key): ID of the user writing the feedback.
  - `targetId` (String, Foreign Key): ID of the user being reviewed.
  - `topic` (String): Topic or skill subject evaluated.
  - `rating` (Int): Numerical score (1 to 5 stars).
  - `quote` (String): Written feedback or testimonial.
  - `chips` (String[]): Array of endorsement tag strings (e.g., `["Great Communicator", "Patient Teacher"]`).
  - `createdAt` (DateTime, default `now()`): Timestamp of review creation.
* **Relationships**:
  - `author` $\rightarrow$ The `User` submitting the review.
  - `target` $\rightarrow$ The `User` receiving the review rating.
