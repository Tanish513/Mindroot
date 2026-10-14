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
- **Latest independent verification**: Codex Run 4 (2026-10-13) passed 35/38 listed in-memory cases; `concurrency_race` Test 1 fails because it expects HTTP 400 while nine requests receive 409; Tests 2-3 unrun. Six other suites pass (35/35). Server/frontend typechecks and build pass; Vite reports a 946.69 kB chunk warning. PostgreSQL not run. See vault `codex_verification_report.md` Run 4.
- **Known Issues**: P2.5 `book-session-sync` still broadcasts `session-request-created` to all participants; P2.13 `confirm-upi` still permits admin bypass. The repository working tree has pre-existing uncommitted changes.
