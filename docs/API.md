# Mindroot API Reference

This document provides a comprehensive reference of the HTTP REST API in `server/src/index.ts` and `server/src/routes/notes.ts`.

All authenticated routes require a JWT bearer token passed in the `Authorization` header:
`Authorization: Bearer <jwt-token>`

---

## 1. Authentication Routes

| Method | Path | Auth Required | Request Body / Params | Response Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | No | `{ email: string, password: string }` | Returns `{ success: true, token: string, user: User }`. Rate-limited (max 20 attempts/15 min). |
| `POST` | `/api/auth/register` | No | `{ name: string, email: string, password: string, role?: string, teaches?: string[], learns?: string[] }` | Registers a new user with hashed password. Returns `{ success: true, token: string, user: User }` (Status 201). |
| `POST` | `/api/auth/google` | No | `{ credential: string }` | Verifies Google ID token and returns authenticated session `{ success: true, token: string, user: User }`. |
| `GET` | `/api/auth/verify-email` | No | Query: `token` | Validates email verification token and marks user verified. |
| `POST` | `/api/auth/resend-verification` | No | `{ email: string }` | Resends email verification link (rate-limited). |
| `POST` | `/api/auth/forgot-password` | No | `{ email: string }` | Initiates password reset flow and emails token. |
| `POST` | `/api/auth/reset-password` | No | `{ token: string, newPassword: string }` | Validates reset token and updates password. |

---

## 2. User & Profile Routes

| Method | Path | Auth Required | Request Body / Params | Response Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/users/me` | **Yes** | None | Returns profile of authenticated user. |
| `PUT` | `/api/users/profile` | **Yes** | `{ name?: string, headline?: string, bio?: string, hourlyRate?: number, teaches?: string[], learns?: string[], avatar?: string }` | Updates profile of authenticated user. |
| `GET` | `/api/peers` | **Yes** | Query: `role?`, `search?` | Returns list of other registered users (excluding caller). |
| `GET` | `/api/users/:id` | **Yes** | Path: `id` | Returns public profile of specified user. |

---

## 3. Session & Booking Routes

| Method | Path | Auth Required | Request Body / Params | Response Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/sessions` | **Yes** | Query: `teacherId?`, `studentId?`, `status?` | Returns session records visible to caller (scoped to sessions where caller is student, teacher, or enrolled participant; admin views all). |
| `POST` | `/api/sessions` | **Yes** | `{ teacherId: string, skillId?: string, title?: string, scheduledAt: string, durationMin?: number, maxCapacity?: number, isSwap?: boolean, payWithTokens?: boolean, paymentMethod?: string, isFree?: boolean, originalSessionId?: string }` | Books a session. Caller is strictly assigned as the student/proposer. Server calculates authoritative price from mentor hourly rate and duration; client-supplied prices are never trusted and lower/zero prices are rejected (HTTP 400 `PRICE_TAMPERING_DETECTED`). For paid swaps (`isSwap: true`), if the mentor has no hourly rate configured, the server uses the referenced or existing session's server-side price (the referenced session must belong to the same teacher and student and be a real paid session); if no valid server price exists, it rejects with HTTP 400 `SWAP_PRICE_UNAVAILABLE`. Explicitly free swaps (`isFree: true`) stay ₹0. Requires mentor VPA for paid sessions. |
| `PATCH` | `/api/sessions/:id` | **Yes** | Path: `id`<br>Body: `{ status: "confirmed" \| "declined" \| "cancelled" \| "completed" }` | Updates session status following strict state-transition guards. Only teacher can confirm/decline; student or teacher can cancel. Cancelling token sessions triggers automatic refund. |
| `DELETE` | `/api/sessions/:id` | **Yes** | Path: `id` | Cancels session and removes from active records. |
| `GET` | `/api/sessions/:id/calendar.ics` | No | Path: `id` | Generates standard `.ics` VCALENDAR/VEVENT file (`Content-Type: text/calendar`). |

---

## 4. Direct UPI Payment Routes

| Method | Path | Auth Required | Request Body / Params | Response Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/payment/mentor-upi/:teacherId` | **Yes** | Path: `teacherId` | Returns mentor's configured UPI VPA, account name, and verification status. Rate-limited to 60 req/min. |
| `POST` | `/api/sessions/:id/pay-direct-upi` | **Yes** | Path: `id`<br>Body: `{ utr: string, isDemo?: boolean }` | Submits 12-digit UTR payment for verification. Enforces UTR uniqueness across transactions. Transitions session to `pending_mentor_confirmation`. |
| `POST` | `/api/sessions/:id/confirm-payment` | **Yes** | Path: `id` | **Teacher only**: Confirms receipt of student's direct UPI payment. Transitions session to `confirmed` and `paid`. Non-teachers receive HTTP 403. |
| `GET` | `/api/payment/simulate-webhook` | No | Query: `sessionId`, `key` | Demo/testing webhook simulating bank credit notification. |

---

## 5. Wallet, Transactions & Payouts

| Method | Path | Auth Required | Request Body / Params | Response Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/transactions` | **Yes** | None | Returns caller-scoped transaction history (authenticated user's transactions only; users cannot view other users' ledgers). |
| `GET` | `/api/wallet/payout-account` | **Yes** | None | Returns payout account details (VPA, bank account) for authenticated user. |
| `POST` | `/api/wallet/payout-account` | **Yes** | `{ upiId?: string, accountHolderName?: string, accountNumber?: string, ifscCode?: string, bankName?: string, payoutMethod?: string }` | Sets or updates user's payout VPA or bank details. Validates VPA format (`user@bank`). |
| `POST` | `/api/wallet/withdraw` | **Yes** | `{ amount: number, payoutNote?: string }` | Initiates earnings withdrawal from token/INR balance to verified payout destination via direct settlement. |

---

## 6. Notes Routes (`/api/notes`)

All notes endpoints require authentication. Webhooks/socket events (`note-created`, `note-updated`, `note-deleted`) are strictly scoped to `user:${authorId}` and `user:${sharedWithUserId}` rooms.

| Method | Path | Auth Required | Request Body / Params | Response Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/notes` | **Yes** | Query: `type?`, `tag?`, `search?` | Returns notes authored by or shared with authenticated user. |
| `GET` | `/api/notes/:id` | **Yes** | Path: `id` | Returns single note if caller is author or shared recipient; returns HTTP 403 otherwise. |
| `POST` | `/api/notes` | **Yes** | `{ title: string, content: string, tags?: string[], type?: "regular" \| "session_summary", sessionId?: string, visibility?: "private" \| "shared", sharedWithUserId?: string }` | Creates a new note. Author is strictly authenticated caller. (Status 201). |
| `PUT` | `/api/notes/:id` | **Yes** | Path: `id`<br>Body: `{ title?: string, content?: string, tags?: string[], visibility?: string, sharedWithUserId?: string }` | Updates note. Author only. Returns HTTP 403 for non-authors. |
| `DELETE` | `/api/notes/:id` | **Yes** | Path: `id` | Deletes note. Author only. Returns HTTP 403 for non-authors. |

---

## 7. Community Discussions & Bounties

| Method | Path | Auth Required | Request Body / Params | Response Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/discussions` | **Yes** | Query: `tag?`, `search?` | Lists peer discussion questions and bounties. |
| `POST` | `/api/discussions` | **Yes** | `{ title: string, content: string, tags?: string[], tokenBounty?: number }` | Posts a new discussion question. If `tokenBounty > 0`, tokens are placed in escrow. |
| `GET` | `/api/discussions/:id` | **Yes** | Path: `id` | Fetches discussion thread with comments. |
| `POST` | `/api/discussions/:id/comments` | **Yes** | Path: `id`<br>Body: `{ content: string }` | Adds an answer/comment to discussion. |
| `POST` | `/api/discussions/:id/accept` | **Yes** | Path: `id`<br>Body: `{ commentId: string }` | Question author accepts answer, releasing escrowed bounty tokens to answer author. Double-claims rejected. |

---

## 8. Reviews Routes

| Method | Path | Auth Required | Request Body / Params | Response Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/reviews` | **Yes** | Query: `targetId` | Returns reviews for specified user. |
| `POST` | `/api/reviews` | **Yes** | `{ sessionId: string, rating: number, quote: string, chips?: string[] }` | Submits verified review. **Strictly requires completed session** and that caller was an enrolled participant. Outsiders and uncompleted sessions receive HTTP 400/403. |

---

## 9. Real-Time Signaling & WebRTC

| Event / Endpoint | Transport | Description |
| :--- | :--- | :--- |
| `GET /api/config` | HTTP | Public system configuration (demo mode status). |
| `GET /api/webrtc/ice-servers` | HTTP | Returns STUN/TURN server ICE configuration. Fails closed (HTTP 503) in non-demo mode if TURN is unconfigured. |
| `join-room` | WebSocket | Joins WebRTC room. Validates participant authorization against session records. |
| `whiteboard-update`, `chat-message` | WebSocket | Relayed only to verified members inside the active room. |
| `payment-handshake-submitted` | WebSocket | Enrolled student submits payment handshake (UTR). Non-students, invalid state, or malformed UTR outside demo mode rejected. |
| `user:<userId>` rooms | WebSocket | Personal private channel for user-specific scoped notifications (payments, requests, notes). |
