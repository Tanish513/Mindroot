# Architecture

## Layers
1. **Frontend UI Components (`src/pages/`, `src/components/`)**:
   - React pages (`Login.tsx`, `Profile.tsx`, `TeacherPortal.tsx`, `Marketplace.tsx`, `Schedule.tsx`, `Wallet.tsx`, `AdminPortal.tsx`, `LiveRoom.tsx`).
   - State managed by Zustand store (`src/store/useAppStore.ts`) and synchronized via local storage and WebSocket events.
   - Real-time notifications and decision prompts handled by `NotificationManager.tsx`.
2. **API Client Layer (`src/lib/api/index.ts`)**:
   - Thin fetch client wrapping HTTP REST endpoints and Socket.IO real-time emitters/listeners.
   - Manages JWT token storage (`mindroot_auth_token`) and fallback caches in `localStorage`.
   - Handles session decision methods (`updateSessionStatus`) and token escrow transfers.
3. **Backend Server (`server/src/index.ts`)**:
   - Express REST API with JWT authentication middlewares (`requireAuth`, `requireAdmin`).
   - Socket.IO server handling live room sessions, peer syncing, signaling permissions, and notifications.
   - Dual persistence: Prisma ORM with PostgreSQL when `DATABASE_URL` is set, coupled with synchronized in-memory stores (`inMemoryUsers`, `inMemorySessions`, etc.) and JSON disk persistence (`saveDb()`).
   - Concurrency & booking serialization via in-memory mutexes (`sessionBookingMutex`).
4. **Data Persistence (`server/prisma/schema.prisma`)**:
   - Prisma schema defining models: `User`, `UserSkill`, `Skill`, `Session`, `Transaction`, `Message`, `Review`, `EmailVerificationToken`, `PasswordResetToken`.

## Core Subsystems
1. **Token Service & Escrow (`server/src/lib/tokenService.ts`)**:
   - Atomic balance debit and credit with `KeyedMutex` locking to eliminate in-flight race conditions.
   - Fail-closed cryptographic HMAC token verification, revocation list, and audit trail.
   - Escrow hold mechanism: Student token balance debited upon booking request; tokens held in escrow until session completion (credit mentor) or session decline/cancellation (refund student).
2. **Booking & Decision State Machine**:
   - Sessions initialize as `pending` upon booking request.
   - Mentor accepts (`confirmed`) or declines (`cancelled` / `declined`).
   - Double-booking / slot collision prevention (`409 SLOT_CONFLICT`) checks both mentor and student schedules.
   - Payments gated until confirmation: Direct UPI confirmations blocked on `pending` sessions (`400 SESSION_NOT_CONFIRMED`).
3. **Mentor Payout & UPI Safeguards (Gap F10)**:
   - NPCI-compliant VPA validation regex (`^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`).
   - 12-digit numeric UPI UTR enforcement with global deduplication (`409 DUPLICATE_UTR`).
   - Payout safety gating: Paid sessions blocked if mentor lacks verified VPA (`400 MENTOR_PAYOUT_NOT_CONFIGURED`).
   - Verification tamper prevention: Modifying UPI ID immediately resets `vpaVerified: false`; verification restricted to admin endpoints.
4. **Live Room Contextual Security & Signaling**:
   - Contextual role resolution (`resolveSessionRole`) derives participant roles based on session host/attendee status rather than client-reported roles.
   - Host-only signaling event authorization: Events such as `fullscreen`, `workspace`, and `sync-full-state` are restricted to room hosts or admins, rejecting unauthorized participants with `room-error`.
5. **Real-time Scoped Event Delivery**:
   - User-targeted socket rooms (`user:<userId>`) ensure sensitive booking requests and notifications are delivered only to intended recipients rather than broadcasted.
