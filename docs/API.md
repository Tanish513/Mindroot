# Mindroot API Reference

This document provides a comprehensive reference table of every HTTP endpoint in `server/src/index.ts`, grouped by category.

---

## 1. Authentication Routes

| Method | Path | Required Params / Body | Response Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | **Body**: `{ email: string, password: string, isAdmin?: boolean }` | Returns `{ success: true, user: User }` on valid credentials. Returns HTTP 401/403 on error. |
| `POST` | `/api/auth/register` | **Body**: `{ name: string, email: string, password: string, role: string, teaches: string[], learns: string[] }` | Registers a new user account, syncs to memory/DB, and returns the created `User` object (Status 201). |

---

## 2. User & Wallet Routes

| Method | Path | Required Params / Body | Response Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/me` | **Headers**: `x-user-id` (optional user ID) | Returns the profile object of the currently logged-in user. |
| `GET` | `/api/peers` | **Headers**: `x-user-id` (optional user ID) | Returns an array of all peer `User` objects, excluding the requesting user. |
| `POST` | `/api/users` | **Body**: `{ name: string, teaches: string[], learns: string[] }` | Fallback user registration endpoint. Returns created `User` object (Status 201). |
| `GET` | `/api/transactions` | **Headers**: `x-user-id` or **Query**: `userId` | Returns an array of `Transaction` ledger records for the requested user. |

---

## 3. Session & Calendar Routes

| Method | Path | Required Params / Body | Response Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sessions` | None | Returns an array of all scheduled, pending, confirmed, and completed `Session` records. |
| `POST` | `/api/sessions` | **Body**: `{ title: string, teacherId: string, studentId: string, scheduledAt: string, skillId?: string, durationMin?: number }` | Books a new peer session and returns the created `Session` object (Status 201). |
| `PATCH` | `/api/sessions/:id` | **Path**: `id`<br>**Body**: `{ status: "pending" \| "confirmed" \| "completed" \| "live" }` | Updates session status. When status is `"completed"`, credits teacher tokens and debits student tokens. |
| `DELETE` | `/api/sessions/:id` | **Path**: `id` | Cancels/deletes the session and returns `{ success: true }`. |
| `GET` | `/api/sessions/:id/calendar.ics` | **Path**: `id` | Generates and returns a standard `.ics` VCALENDAR/VEVENT file (`Content-Type: text/calendar`). |

---

## 4. Message Routes

| Method | Path | Required Params / Body | Response Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/messages` | **Query**: `userId` (required user ID) | Returns an array of `Message` chat objects sent or received by the specified user. |
| `POST` | `/api/messages` | **Body**: `{ senderId: string, receiverId: string, text: string }` | Sends and persists a 1-on-1 chat message, returning the created `Message` object (Status 201). |

---

## 5. Review Routes

| Method | Path | Required Params / Body | Response Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reviews` | **Query**: `targetId` (required target user ID) | Returns an array of `Review` feedback objects submitted for the specified user. |
| `POST` | `/api/reviews` | **Body**: `{ authorId: string, targetId: string, topic: string, rating: number, quote: string, chips: string[] }` | Saves a peer review, recalculates the target user's dynamic `trustScore`, and returns created `Review` (Status 201). |

---

## 6. System & Stats Routes

| Method | Path | Required Params / Body | Response Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/stats` | None | Returns aggregated platform metrics `{ totalUsers: number, totalSessions: number, tokensCirculating: number }`. |
| `POST` | `/api/ai/chat` | **Body**: `{ message: string, history?: Array, context: string, userName: string, tokenBalance: number }` | Contextual AI assistant endpoint providing platform navigation guidance. |
