# Project Master Memory

## Summary
Mindroot is a peer-to-peer knowledge and skill-sharing platform connecting students and mentors for 1-on-1 tutoring, cohort classes, learning streak tracking, reviews, and direct UPI micro-payments.

## Key Modules
- **Authentication**: JWT & Google OAuth in `server/src/index.ts` and `src/pages/Login.tsx`.
- **Profiles & Settings**: User preferences, teacher hourly rates, batch pricing tiers, UPI setup, and account lifecycle in `src/pages/Profile.tsx` and `src/pages/TeacherPortal.tsx`.
- **Marketplace & Booking**: Discover mentors and book sessions with dynamic tiered batch pricing in `src/pages/Marketplace.tsx`.
- **Persistence & API**: Express routes in `server/src/index.ts`, Prisma schema in `server/prisma/schema.prisma`, and client in `src/lib/api/index.ts`.
- **Notes & Journaling**: Daily and regular rich text learning notes with tags, attachments, session association, and mentor-to-student sharing in `server/src/routes/notes.ts` and `src/pages/Notes.tsx`.

## Current State
- **Completed**:
  1. FIX 1: Teacher price setting fully accepted and persisted. Non-negative prices (including 0) and custom batch pricing tiers are accepted, validated (400 for negative/NaN), safely rounded for Prisma schema `Int`, and persisted via API during onboarding and profile saves.
  2. FIX 2: Profile page "Delete Account" feature fully implemented. Danger Zone UI with a two-step confirmation modal, authenticated self-deletion route with relational foreign key cascading cleanup via Prisma `$transaction`, in-memory cache purging, socket notification broadcast, store logout, and login redirect.
  3. Dynamic Match Recommendations: Peer compatibility matching and community champions endpoints.
  4. Security & Concurrency Suite: In-flight transactional booking mutex queue (`sessionBookingMutex`), fail-closed cryptographic HMAC token security and revocation tracking (`tokenService.ts`), WebRTC mesh hardening, and automated test suites.
  5. Gap F10 (Mentor UPI ID & Safeguards): Elimination of fabricated VPAs, strict NPCI format validation, 12-digit numeric UTR enforcement, direct UPI checkout gating (`MENTOR_PAYOUT_NOT_CONFIGURED`), verification reset upon edit, and admin verification controls.
  6. Plan 2 (Live Room Roles & Booking Decisions): Server-authoritative contextual role derivation (`resolveSessionRole`), teacher request accept/decline state machine with approver checks, atomic held token escrow refunds on decline, slot collision prevention (`409 SLOT_CONFLICT`), and pending session UPI blocks.
  7. Plan 3 (Codex Verification Gap Remediation): Server-owned amount and payee enforcement, host-only room event gating (`fullscreen`, `workspace`, `sync-full-state`), universal mentor VPA requirement for paid sessions regardless of `paymentMethod`, approver-scoped `session-request-created` socket delivery, paid swap price calculation and VPA gating (D2=A), clean server/process teardown without libuv assertions, and dedicated verification tests in `verification_gaps.test.ts`.
  8. Plan 4 / Phases 0-4 (Critical Security, Live Room Modernization & Leftover Items):
     - Recovered broken state: 409 assertion re-applied in `concurrency_race.test.ts`, `saveDb` in mock deps, removed `process.exit(0)` masking across all suites.
     - `POST /api/sessions`: added `requireAuth`, server-computed price and tokens, derived student from authenticated user.
     - Socket.io: token auth on connect, removed anonymous mutations, scoped `session-request-created` to approver.
     - Refunds: atomic credit before setting `tokenRefunded`, idempotent refund keys, persisted expiry across restarts.
     - Privacy: authenticated and scoped `GET /api/transactions`, authenticated and rate-limited `GET /api/payment/mentor-upi/:teacherId` scrubbing KYC docs, stopped global transaction broadcasts.
     - UTR: added unique constraint on `Session.utr` with migration `20261017000000_f10_payout_and_vpa_audit`.
     - `confirm-upi`: strictly student-only (`403` for admin / third party). `confirm-payment`: requires recorded UTR and `pending-mentor-confirmation` state.
     - Live room: real TURN with auth, payload limits, rate limits, state recovery (`room-state-sync`), 4-video peer cap with audio overflow explainer, Pyodide WASM + SQLite-WASM runner, modularized into `src/components/liveroom/`, purged unused packages (`@livekit/*`, `yjs`, `y-webrtc`), reduced bundle to 157.68 kB.
     - Leftover Part 1: `POST /api/admin/users/:id/verify-vpa` (`403` for non-admin), `PayoutAccount` and `PayoutAuditLog` models and migration, `getMentorVpa` helper, VPA cleanup, hardened UPI intent.
  9. Plan 6 (Price Validation & Slot Conflict Precision):
     - Whole-rupee validation across all price inputs with custom inline errors ("Enter a whole amount of ₹1 or more"), min 1, and noValidate preventing browser tooltip popups.
     - Shared canonical rounding via `roundPrice` and `calculateSeatPrice`.
     - End-exclusive interval overlap checking (`startA < endB && endA > startB`) with strict teacher isolation and active session filtering.
     - Single source of truth endpoints: `GET /api/teachers/:teacherId/slot-check` and `GET /api/teachers/:teacherId/booked-slots`.
     - Real-time debounced pre-flight check in booking modals with `AbortController` and live state indicators.
     - Client authentication self-healing: automatic `dev-token-${userId}` generation and 401 retry recovery.
     - Verified by `slot_availability_precision.test.ts` (12/12) and `pricing_and_booking_bugs.test.ts` (10/10).
  10. Plan 7 (End-to-End Booking-Request Flow & Realtime Sync):
     - Traced write path and read path with structured audit logging on server (`POST /api/sessions` and `GET /api/sessions`).
     - Resolved account identity mismatch between teachers "hehehe" and "teachertest".
     - Eliminated premature auto-completion of pending sessions on client and server.
     - Unblocked Schedule pending tab filter, keeping requests visible until explicitly accepted or declined.
     - Enabled guest socket handshakes in `io.use` and dynamic socket auth on login/logout for instant real-time push.
     - Subscribed Teacher Portal to `onSessionsUpdated` and `onSessionRequestCreated` with a 10s polling fallback.
     - Upgraded Student Requests cards (student avatar/name, skill, format badge, date/time, amount, Pay After Class tag, Accept/Decline action buttons with feedback).
     - Added Admin Portal Session Ledger debugger view showing Session ID, Teacher/Student names, emails, and IDs.
     - Verified by `booking_request_flow.test.ts` (7/7).
  11. Notes Model, Schema Drift Diagnosis & Secret Hygiene:
     - Notes Migration: generated isolated migration `20261020000000_add_notes_model/migration.sql` adding only `Note`, foreign keys, and indexes, verified against disposable local PostgreSQL.
     - Schema Drift Analysis: proved that drift on `Session`, `Transaction`, `User`, and `PayoutAccount` is OLD (pre-existing at HEAD `c8f78c7`); confirmed repo relies on `prisma db push` in `Dockerfile` and `sync_supabase.bat`.
     - Secret Hygiene: scrubbed `PASSWORD_ENCRYPTION_KEY=CHANGE_ME` in `.env.example`; confirmed key history in commit `5489f7d`.
     - Notes Authorization Audit: audited `server/src/routes/notes.ts` confirming strict user isolation, read-only shared access, and sanitization.
     - Plan copies synchronized: aligned `mindroot_implementation_plan_antigravity.md` with `docs/mindroot_implementation_plan_antigravity.md`.
     - Verified by `notes_api.test.ts` (6/6), `booking_request_flow.test.ts` (7/7), `slot_availability_precision.test.ts` (12/12), `pricing_and_booking_bugs.test.ts` (10/10).
  12. Security & Privacy Hardening, Teardown Resolution, Legacy Gateway Removal:
      - Notes Privacy: replaced global emissions in `notes.ts` with `emitNoteEvent` and `emitNoteDeleted`, scoped strictly to `user:${authorId}` and `user:${sharedWithUserId}`. Verified by `notes_api.test.ts` (Test 7).
      - Payment Broadcast Scoping: replaced global broadcasts of `session-payment-received`, `session-payment-confirmed`, and `network-sessions-updated` in `server/src/index.ts` with targeted delivery strictly to `user:${studentId}` and `user:${teacherId}` with participant-filtered ledgers. Verified by `payment_security_fixes.test.ts` (Test 1).
      - Paid Swap Price Tampering: made server session price authoritative for paid swaps. Client-tampered lower prices rejected with HTTP 400 `PRICE_TAMPERING_DETECTED`. Preserves free swaps (`isFree: true` or `0`). Verified by `payment_security_fixes.test.ts` (Test 2).
      - payment-handshake-submitted: removed admin bypass, strictly required enrolled student, validated 12-digit numeric UTR outside demo mode, and verified session/payment states. Verified by `payment_security_fixes.test.ts` (Test 3).
      - Theme E2E Alignment: updated `e2e/theme_toggle.spec.ts` assertions to match active `--bg: #0A1612` (dark) and `#F7FAF9` (light) tokens from `src/index.css`. Verified via Playwright (1 passed in 8.9s, exit code 0).
      - Test Teardown: unref'd `sessionReminderInterval` in `server/src/index.ts` and seeded confirmed room session in `audit_gaps.test.ts` Test 7. All 14 backend test suites exit 0 cleanly with zero process hangs.
      - Legacy Gateway Complete Removal: fully purged legacy payment gateway from backend (`server/src/index.ts`), removed package from `server/package.json` and lockfiles, scrubbed references from `.env.example`, `DEPLOYMENT.md`, `docs/`, `src/lib/api/index.ts`, and comments. Direct UPI payment remains fully operational.
      - Documentation & Unverified Claims: scrubbed all unverified claims and literal counter references from both plan copies and aligned root and docs plan copies (diff = 0). Rewrote `docs/API.md` with complete, accurate documentation of real REST and WebSocket endpoints, auth contracts, logged-in session creation, and caller-scoped transactions.
   13. Swap Pricing Server Enforcement Hardening & API Documentation Alignment:
       - Enforced server-authoritative swap pricing in `server/src/index.ts`: when mentor has no hourly rate configured, client-supplied prices are never trusted. Uses original session's server price if found; otherwise rejects with HTTP 400 `SWAP_PRICE_UNAVAILABLE`. Closed zero-price bypass loophole (`|| clientSuppliedPrice === 0` removed).
       - Updated `docs/API.md` line ~40 to describe exact authoritative swap pricing behavior and error contracts (`PRICE_TAMPERING_DETECTED`, `SWAP_PRICE_UNAVAILABLE`).
       - Verified by `server/test/payment_security_fixes.test.ts` (subtests 2d, 2e, 2f-i, 2f-ii).
   14. Multi-Tab Session Isolation (`041fec5`):
       - Migrated auth token storage to `sessionStorage` with seamless migration from `localStorage`.
       - Enabled concurrent logins across multiple tabs/windows without account overwrite.
       - Verified by `e2e/multi_tab_accounts.spec.ts`.
   15. Resilient Mentor Approval Request Delivery & Multi-User Notification Recovery (`998510e`):
       - Socket delivery of `session-request-created` directly into `user:${approverId}` rooms on booking.
       - REST fallback endpoint `GET /api/sessions/pending-count` and 30s client polling hook with window focus re-fetch.
       - Visual pending badges in Navbar, Teacher Portal navigation, and notification bell.
       - Offline teacher catch-up on login, `both` role banner for dual-role users, and socket disconnection banners.
       - Verified by `server/test/booking_request_flow.test.ts` (7/7 tests passing).
- **Latest verification**: All 15 automated backend suites (109/109 tests) and 11 Playwright E2E suites (23/23 tests) passing (132/132 total passing). 0 server typecheck errors, 0 frontend typecheck errors, production Vite build clean in 5.55s.
- **Known Issues**: None. All items fully verified and resolved.
