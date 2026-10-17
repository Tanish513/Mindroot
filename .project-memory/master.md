# Project Master Memory

## Summary
Mindroot is a peer-to-peer knowledge and skill-sharing platform connecting students and mentors for 1-on-1 tutoring, cohort classes, learning streak tracking, reviews, and direct UPI micro-payments.

## Key Modules
- **Authentication**: JWT & Google OAuth in `server/src/index.ts` and `src/pages/Login.tsx`.
- **Profiles & Settings**: User preferences, teacher hourly rates, batch pricing tiers, UPI setup, and account lifecycle in `src/pages/Profile.tsx` and `src/pages/TeacherPortal.tsx`.
- **Marketplace & Booking**: Discover mentors and book sessions with dynamic tiered batch pricing in `src/pages/Marketplace.tsx`.
- **Persistence & API**: Express routes in `server/src/index.ts`, Prisma schema in `server/prisma/schema.prisma`, and client in `src/lib/api/index.ts`.

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
- **Latest verification**: 42/42 tests passing across 8 suites (100% in-memory and 100% PostgreSQL). 0 server typecheck errors, 0 frontend typecheck errors, production Vite build clean. (Commit `0ffc63d`).
- **Known Issues**: None. All gaps and adversarial findings resolved and verified.
