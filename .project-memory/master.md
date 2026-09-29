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
  4. Security & Concurrency Suite: In-flight transactional booking mutex queue (`sessionBookingMutex`), fail-closed cryptographic HMAC token security and revocation tracking (`tokenService.ts`), WebRTC mesh hardening, and 5 automated test suites in `server/test/` verifying concurrency races, cross-tenant authorization, and accounting/audit gaps.
- **Known Issues**: None. All builds, typechecks, and automated backend test suites pass cleanly.
