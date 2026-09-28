# File Index

| File | Purpose | Key Symbols / Endpoints | Fingerprint | Status | Notes |
|---|---|---|---|---|---|
| `server/src/index.ts` | Backend server, auth routes, users API, websocket sync | `POST /api/auth/register`, `PATCH /api/users/:id`, `DELETE /api/users/:id`, `DELETE /api/users/me` | 206963B 2026-09-24 16:30:53 | verified | Validates non-negative hourlyRate (including 0), rounds decimals for Prisma Int, self & admin DELETE with cascading Prisma $transaction |
| `server/prisma/schema.prisma` | Relational database schema | `User`, `Session`, `Message`, `Review`, `Transaction`, `UserSkill` | 4698B 2026-09-24 16:16:36 | verified | Schema models and foreign keys documented |
| `src/pages/Login.tsx` | Sign-in, sign-up, Google OAuth onboarding modal | `handleBaseRateChange`, `handleSignUpSubmit`, `handleOnboardingSubmit` | 48247B 2026-09-24 16:33:11 | verified | Fixed base rate clamping (min 0), awaits api.updateUser on onboarding submit |
| `src/pages/Profile.tsx` | User profile, rates, skills, danger zone delete | `handleHourlyRateChange`, `handleSaveProfile`, `handleDeleteAccount` | 73825B 2026-09-24 16:38:34 | verified | Fixed falsy hourlyRate fallback (0 preserved), added Danger Zone with Delete Account confirmation modal |
| `src/pages/TeacherPortal.tsx` | Teacher portal, schedule, batch rates | `handleSaveRates`, `portalRates` | 28213B 2026-09-24 16:33:42 | verified | Fixed portalRates falsy fallback for rate 0, min=0 on rate inputs |
| `src/lib/api/index.ts` | Frontend API client | `updateUser`, `deleteUser`, `calculateSeatPrice`, `sanitizePeer` | 65178B 2026-09-24 16:31:30 | verified | Fixed price > 0 check to >= 0 in calculateSeatPrice and sanitizePeer |
| `src/store/useAppStore.ts` | Zustand global store | `login`, `logout`, `currentUser` | 8729B 2026-09-24 16:20:16 | verified | State management and logout clear |
