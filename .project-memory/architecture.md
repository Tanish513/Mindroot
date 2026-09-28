# Architecture

## Layers
1. **Frontend UI Components (`src/pages/`, `src/components/`)**:
   - React pages (`Login.tsx`, `Profile.tsx`, `TeacherPortal.tsx`, `Marketplace.tsx`, `Schedule.tsx`, `Wallet.tsx`, `AdminPortal.tsx`).
   - State managed by Zustand store (`src/store/useAppStore.ts`) and synchronized via local storage and WebSocket events.
2. **API Client Layer (`src/lib/api/index.ts`)**:
   - Thin fetch client wrapping HTTP REST endpoints and Socket.IO real-time emitters/listeners.
   - Manages JWT token storage (`mindroot_auth_token`) and fallback caches in `localStorage`.
3. **Backend Server (`server/src/index.ts`)**:
   - Express REST API with JWT authentication middlewares (`requireAuth`, `requireAdmin`).
   - Socket.IO server handling live room sessions, peer syncing, and notifications.
   - Dual persistence: Prisma ORM with PostgreSQL when `DATABASE_URL` is set, coupled with synchronized in-memory stores (`inMemoryUsers`, `inMemorySessions`, etc.) and JSON disk persistence (`saveDb()`).
4. **Data Persistence (`server/prisma/schema.prisma`)**:
   - Prisma schema defining models: `User`, `UserSkill`, `Skill`, `Session`, `Transaction`, `Message`, `Review`, `EmailVerificationToken`, `PasswordResetToken`.
