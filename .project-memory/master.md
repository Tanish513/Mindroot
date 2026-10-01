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
- **Verification**: 31/31 automated tests passing across 6 suites (`concurrency_race`, `cross_user_auth`, `fail_closed`, `extended_race`, `audit_gaps`, `session_decision`). Full frontend and server builds passing cleanly.
- **Known Issues**: None. Working tree clean.
