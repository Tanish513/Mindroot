# Repeatable Lessons & Mistakes Avoided

- **MISTAKE-001: Treating 0 as falsy (`val || 499`) for prices**:
  - Problem: Setting price to 0 was overwritten by fallback 499 because `0` evaluates to `false` in JS logical OR.
  - Fix: Check `typeof val === 'number' ? val : 499` or `val !== undefined && !isNaN(Number(val))`.
- **MISTAKE-002: Math.max clamping price to minimum 50**:
  - Problem: Inputs clamped with `Math.max(50, ...)` and HTML `min={50}` prevented users from setting prices below 50 or 0.
  - Fix: Use `Math.max(0, ...)` and `min={0}`.
- **MISTAKE-003: Onboarding modal omitting API update**:
  - Problem: Google OAuth onboarding modal updated local Zustand store and socket sync, but never awaited `api.updateUser(...)`, causing backend DB to lose role and price on refresh.
  - Fix: Explicitly call and await `api.updateUser(pendingUser.id, ...)` in `handleOnboardingSubmit`.
- **MISTAKE-004: Direct `prisma.user.delete` failing foreign key constraints**:
  - Problem: Deleting user directly caused Postgres to throw `P2003` foreign key constraint failures due to related sessions, messages, reviews, transactions, userSkills.
  - Fix: Clean up child records inside `prisma.$transaction` before deleting the user.
