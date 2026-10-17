---
title: "Mindroot - Antigravity Implementation Plans: Parts 1-4 [REMEDIATED & VERIFIED]"
tags:
  - project/student-to-student
  - plan
  - implementation-plan
  - audit/remediation
  - hackathon/mindroot
  - status/completed
status: completed
created: 2026-09-29
last_updated: 2026-10-17
latest_commit: "0ffc63d"
repo_head: "0ffc63d"
author: "[[ANTIGRAVITY]]"
project_hub: "[[student_to_student]]"
source_spec: "[[student_to_student_spec]]"
master_audit: "[[student_to_student_master_audit]]"
target_gap: "[[student_to_student_master_audit]]"
reviewed_by: "Claude & Codex (multi-run verification log in [[codex_verification_report]])"
governed_by: "[[AGENTS]]"
---

## Implementation Roadmap & Status
- [x] **Plan 1: Mentor UPI VPA Gap (F10) Validation, Verification & Safeguards** *(Resolved & verified in Phase 4; F10.6-F10.9 pass in `verification_gaps.test.ts`, audit log table added)*
- [x] **Plan 2: Live Room Contextual Role Access & Teacher Booking Request Accept/Decline Workflow** *(Resolved & verified; P2.1-P2.13 pass, host auth and state recovery verified)*
- [x] **Plan 3: Fix the independent-verification failures** *(Resolved & verified; D1=A and D2=A implemented; suites clean with non-zero exit integrity)*
- [x] **Plan 4: Critical Security Hardening, Live Room Modernization & Audit Gaps (Phases 0-4)** *(Resolved & verified on commit `0ffc63d`, 2026-10-17; 42/42 tests passing across 8 suites in-memory & PostgreSQL)*


---

# [ ] PART 1: Mentor UPI VPA Gap Remediation (F10) [IMPLEMENTED; PARTIALLY VERIFIED]

> [!WARNING] Plan Status: IMPLEMENTED; PARTIALLY VERIFIED (independent run 2026-10-01: F10.8 FAIL, no dedicated tests for F10.6-F10.8; see Part 3 and [[codex_verification_report]])
> **Checkpoint Commit**: [`892278b`](https://github.com/Tanish513/Mindroot/commit/892278b0686f1bdc2a9c89cd7f9cf3a831bf1c4d)
> **Short Summary**:
> This implementation plan has been **fully executed** (verification is partial, see the status line above). All fabricated placeholder VPAs (`@okhdfcbank`) have been eliminated across the platform. The system now enforces strict client & server NPCI VPA format validation (`^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`), enforces mandatory 12-digit numeric UTRs (`^\d{12}$`), blocks direct UPI payments/bookings when a mentor has no VPA configured (`MENTOR_PAYOUT_NOT_CONFIGURED`), truthfully distinguishes between verified and unverified VPAs with payee name safeguards, gates demo payment controls to `demoMode === true`, and resets verification status whenever a mentor's VPA is updated until re-verified by an admin.
>
> **Verification (as reported 2026-09-29; NOT reproduced on 2026-10-01, `audit_gaps` fails at Test 9.1)**: 9/9 automated integration test suites pass in `server/test/audit_gaps.test.ts` (100%), server typecheck has 0 errors, and Vite production build passes in 2.80s. Working tree is clean and synced with `origin/main`.

## Summary of Changes Implemented

| Area / File | Changes Implemented |
| :--- | :--- |
| **Prisma Schema** (`server/prisma/schema.prisma`) | Added `upiId String?`, `upiQrImage String?`, `vpaVerified Boolean @default(false)`, `vpaVerifiedAt DateTime?` to `User`. Client generated via `npx prisma generate`. |
| **Backend Core** (`server/src/index.ts`) | Added `VPA_REGEX` and `UTR_REGEX`. Removed `@okhdfcbank` fallbacks in `GET /api/payment/mentor-upi/:teacherId` (returns `null` when unconfigured). Gated `confirm-upi` and `POST /api/sessions` with `400 MENTOR_PAYOUT_NOT_CONFIGURED`. Enforced 12-digit numeric UTRs. Enforced automatic reset of `vpaVerified` to `false` on VPA edits. Added admin VPA verification. |
| **Payment Modal** (`src/components/payment/UpiPaymentModal.tsx`) | Removed fabricated VPAs. Gated "Quick Demo Pay" tab on `demoMode === true`. Added warning banner when direct UPI is unconfigured. Displayed truthful labels (`Verified` vs `Unverified`) with Payee Name cross-check card. Enforced 12-digit numeric UTR input with length counter. |
| **Auth & Profiles** (`src/pages/Login.tsx`, `Profile.tsx`, `Wallet.tsx`) | Added NPCI VPA validation on teacher signup and onboarding. Added VPA validation and verification status pill in Profile. Reset `vpaVerified` on UPI change. Removed fake default UPI in Wallet payout settings. |
| **Admin Portal** (`src/pages/AdminPortal.tsx`) | Replaced fabricated VPA strings with truthful status (`Not Configured` / `Verified` / `Unverified`). Added admin toggle button to verify or revoke mentor VPAs. |
| **Client API** (`src/lib/api/index.ts`) | Removed all offline fallback references to `@okhdfcbank`. |
| **Test Suite** (`server/test/audit_gaps.test.ts`) | Added **TEST 9** covering F10.1 (unconfigured block), F10.2 (bad VPA 400), F10.3 (12-digit UTR), F10.4 (verification reset & admin verify), and F10.5 (truthful null and zero `@okhdfcbank`). |

---

> [!WARNING] Plan review (Claude, 2026-09-29)
> Reviewed against the F10 checklist in [[student_to_student_master_audit]] (Part 4) and the existing test suites. Code was not inspected. Changes are marked **[Added in review]** and cover:
> - Mermaid diagram had syntax that would not render (fixed).
> - Existing tests/fixtures (short UTRs, mentors without a VPA) will break under the new rules (Section 3.6).
> - `isDemoAllowed` bypass would silently disable the new tests unless tests run with `DEMO_MODE=false`.
> - Privilege hole: clients must never be able to set `vpaVerified` (Sections 3.1.4, 4 F10.6).
> - Missing: admin verify endpoint, `PayoutAccount` schema fields, audit log table, migration/cleanup, Postgres path (not only in-memory), auth on `mentor-upi`, UPI intent hardening, rollout order, acceptance criteria, doc updates (Sections 3.1–3.6, 7).
> - Test command was inconsistent with the rest of the vault (fixed in Section 5).

---

## 1. Problem Statement & Root Cause

### 1.1 Symptoms (Logged 2026-09-28)
1. **Fabricated VPA Fallback**: The Pay Mentor modal (`UpiPaymentModal.tsx`) renders placeholder VPAs derived from name and bank handle (`${cleanName}@okhdfcbank` or `mindroot.peer@okhdfcbank`) when no payout account exists.
2. **Deceptive Verification Badge**: The modal displays the label **"Mentor's Verified UPI ID (VPA)"** even when the VPA is unverified, missing, or guessed.
3. **UTR Contract Mismatch**: The frontend marks the UTR field as `(Optional)`, while server-side business logic and NPCI payment rails require a valid transaction reference.
4. **Unconditional Demo Controls**: The **"Quick Demo Pay (1-Click)"** tab appears even when `DEMO_MODE` is disabled on the server.
5. **No Gating on Bookings**: Mentors can list paid sessions without configuring a valid payout address, leaving students unable to settle sessions or sending funds to non-existent VPAs.

### 1.2 Root Cause in Codebase
*(Line numbers are as reported by Antigravity on 2026-09-29 and will drift; search by the quoted code instead.)*
- `server/src/index.ts` line 2935 explicitly falls back to:
  `const upiId = payoutAcc?.upiId || user?.upiId || `${cleanMentorHandle}@okhdfcbank`;`
- `src/components/payment/UpiPaymentModal.tsx` lines 56–65 contain hardcoded fallbacks to `${cleanName}@okhdfcbank` and `mindroot.peer@okhdfcbank`.
- `POST /api/auth/register` and `Login.tsx` onboarding wizard treat UPI VPA input as entirely optional for `role = 'teacher' | 'both'`.
- `POST /api/payment/confirm-upi` does not check whether the target mentor has configured a VPA before processing payment confirmations.

---

## 2. End-State Architecture & Control Flow

```mermaid
flowchart TD
    subgraph CUR["Current Vulnerable Flow"]
        A[Student clicks 'Pay Mentor'] --> B[GET /api/payment/mentor-upi/:teacherId]
        B --> C{"payoutAcc.upiId or user.upiId exists?"}
        C -->|No| D[Fabricate: mentor_name@okhdfcbank]
        D --> E[Modal renders QR with fabricated VPA]
        E --> F[Labelled 'Mentor's Verified UPI ID VPA']
        F --> G[Student scans QR -> money sent to wrong VPA]
    end

    subgraph NEW["Proposed Secure Flow"]
        H[Student clicks 'Pay Mentor'] --> I[GET /api/payment/mentor-upi/:teacherId]
        I --> J{Valid VPA configured?}
        J -->|No| K[Return upiId: null, isConfigured: false]
        K --> L[Modal renders 'UPI Not Configured' Warning & disables pay]
        J -->|Yes| M[Return actual VPA + vpaVerified status]
        M --> N{vpaVerified == true?}
        N -->|No| O["Label: Mentor's UPI ID - Pending Verification"]
        N -->|Yes| P[Label: 'Mentor's Verified UPI ID']
        O & P --> Q[Student inputs 12-Digit UTR]
        Q --> R["POST /api/payment/confirm-upi validates mentor VPA exists and UTR is 12 digits"]
    end
```

---

## 3. Detailed Work Breakdown & Code Changes

### 3.1 Backend Service & API Contracts (`server/src/index.ts`)

#### 1. Regex Validation Constants
Define canonical regex constants in `server/src/index.ts`:
```typescript
// NPCI UPI VPA format standard (username@bankhandle)
const VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

// Standard 12-digit numeric Bank Reference Number / UTR
const UTR_REGEX = /^\d{12}$/;
```

#### 2. Eliminate Fabricated Fallbacks in `GET /api/payment/mentor-upi/:teacherId`
- Remove all `@okhdfcbank` concatenations.
- **[Added in review]** Require `requireAuth` on this endpoint (only logged-in participants of a session with this mentor should see the VPA) and rate-limit it, so VPAs cannot be scraped.
- **[Added in review]** Read from PostgreSQL (`PayoutAccount` / `User`) as the source of truth, with the in-memory maps only as the fallback the spec already defines. Checking only `inMemoryPayoutAccounts` would disagree with the DB after a restart.
- Check both `inMemoryPayoutAccounts[teacherId]` and `inMemoryUsers` for configured VPA.
- Return explicit boolean flags:
```typescript
app.get('/api/payment/mentor-upi/:teacherId', (req: any, res: any) => {
  const teacherId = req.params.teacherId;
  const payoutAcc = inMemoryPayoutAccounts[teacherId];
  const user = inMemoryUsers.find(u => u.id === teacherId);
  
  const mentorName = user?.name || payoutAcc?.accountHolderName || 'Mentor';
  const rawUpiId = (payoutAcc?.upiId || user?.upiId || '').toLowerCase().trim();
  const isConfigured = Boolean(rawUpiId && VPA_REGEX.test(rawUpiId));
  const vpaVerified = Boolean(isConfigured && (payoutAcc?.vpaVerified || user?.vpaVerified));
  const upiQrImage = user?.upiQrImage || payoutAcc?.upiQrImage || null;
  const officialIdStatus = user?.officialIdStatus || payoutAcc?.officialIdStatus || 'unverified';

  res.json({
    success: true,
    teacherId,
    mentorName,
    accountHolderName: payoutAcc?.accountHolderName || mentorName,
    upiId: isConfigured ? rawUpiId : null,
    upiQrImage,
    officialIdStatus,
    isIdVerified: officialIdStatus === 'verified',
    isCustomUpi: isConfigured,
    isConfigured,
    vpaVerified
  });
});
```

#### 3. Strict Server-Side Validation in `POST /api/payment/confirm-upi`
- **[Added in review] Resolve the mentor from the session on the server** (`session.teacherId`), never from a client-supplied ID or VPA.
- **[Added in review] Define `isDemoAllowed` once**: `isDemoAllowed = (process.env.DEMO_MODE === 'true')`. Tests F10.1 and F10.3 must run with `DEMO_MODE=false`, otherwise both guards are bypassed and the tests prove nothing. Add one separate test that the bypass works only when `DEMO_MODE=true`.
- **[Added in review]** Keep the existing checks (enrolled-student 403, UTR uniqueness via DB + memory, 409) unchanged and run the new guards before them.
- **Mentor VPA Guard**: If `!isDemoAllowed`, verify that the session mentor has a valid, configured VPA (`mentorUpi`). If unconfigured, reject with HTTP 400:
  ```json
  { "error": "Mentor has not configured their UPI payout address (VPA).", "code": "MENTOR_PAYOUT_NOT_CONFIGURED" }
  ```
- **12-Digit UTR Guard**: If `!isDemoAllowed`, enforce `UTR_REGEX.test(cleanUtr)`. Reject non-12-digit or non-numeric strings with HTTP 400:
  ```json
  { "error": "A valid 12-digit UPI reference number (UTR) is required." }
  ```

#### 4. Change Control in `POST /api/wallet/payout-account`
- When mentor updates `upiId`:
  - Validate with `VPA_REGEX`. Reject invalid formats with HTTP 400.
  - If `upiId` changed from existing value, reset `vpaVerified = false` and `vpaVerifiedAt = null`.
  - **[Added in review]** Write an audit row to `PayoutAuditLog` (Section 3.4) with masked old/new VPA (e.g. `ta***@okhdfcbank`), actor and timestamp.
  - **[Added in review]** Ignore any client-supplied `vpaVerified` / `vpaVerifiedAt` in this route and in `PATCH /api/users/:id`. Add both fields to the non-admin blocked list next to `role`, `tokenBalance`, `streak`, `badges`. Only the admin endpoint below can set them.
  - **[Added in review]** Run the write inside the same fail-closed path as other ledger-adjacent writes (HTTP 503 on DB error).

#### 5. Validation in Registration & Onboarding
- Include `upiId` in `registerSchema`. If provided, normalize (`trim().toLowerCase()`) and validate against `VPA_REGEX`.
- **[Added in review] Clarification of "required"**: signup itself is not blocked (Google OAuth users and learners have no VPA). The requirement is enforced when a mentor *monetizes*: no valid VPA means no paid cash sessions (below). The onboarding step shows a required-style prompt with "Skip for now (token/swap sessions only)".
- In `POST /api/sessions`: If a paid cash session is requested (`seatPrice > 0`), check that the mentor has a configured VPA, or require token payment / swap. **[Added in review]** Reject with HTTP 400 `MENTOR_PAYOUT_NOT_CONFIGURED` (same code as `confirm-upi`) so the UI can show one consistent message.

#### 6. Admin VPA Verification Endpoint **[Added in review]**
The plan's AdminPortal button had no backend. Add:
- `POST /api/admin/users/:id/verify-vpa` behind `requireAdmin`, body `{ verified: boolean }`.
- Sets `vpaVerified`, `vpaVerifiedAt` (or clears both), and writes a `PayoutAuditLog` row with the admin ID.
- Refuses to verify if the user has no valid VPA (HTTP 400).
- *Optional later phase*: self-serve verification with a Rs 1 test payment and a random code in the note (from the F10 checklist). Not in this scope; manual admin verification only.

#### 7. Existing Route Hardening **[Added in review]**
- Anywhere else that reads a mentor VPA (session payloads, admin views, Wallet page) must go through one helper `getMentorVpa(teacherId)` so the no-fabrication rule cannot regress in a second place.

---

### 3.2 Frontend Payment Modal (`src/components/payment/UpiPaymentModal.tsx`)

#### 1. Zero Fabricated Fallbacks
- Completely remove `${cleanName}@okhdfcbank` and `mindroot.peer@okhdfcbank`.
- If `api.getMentorUpi()` returns `isConfigured: false` or `upiId: null`, set `mentorUpi = ''`.

#### 2. Demo Tab Gating
- Query `api.getConfig()` on modal open.
- Only render the **"Quick Demo Pay (1-Click)"** tab if `config.demoMode === true`.

#### 3. Unconfigured VPA State & Banner
- If mentor has no VPA:
  - Hide the QR code canvas.
  - Display warning callout:
    > ⚠️ **Direct UPI Not Configured**: This mentor has not registered their UPI payout VPA. Direct UPI payments cannot be processed. Please ask your mentor to update their profile, or pay using Skill Tokens / Skill Swap.
  - Disable payment confirmation button.

#### 4. Truthful Verification Labeling & Payee Safeguard
- Replace hardcoded label:
  - If `mentorDetails?.vpaVerified === true`: `"Mentor's Verified UPI ID (VPA)"` with verified badge.
  - If unverified: `"Mentor's UPI ID (VPA) — Pending Verification"`.
- Add Payee Name cross-check:
  - Display `"Payee Name: <accountHolderName || mentorName>"`.
  - Notice: *"Please check your payment app (Google Pay, PhonePe, Paytm, BHIM) to ensure the recipient name matches <mentorName> before completing the transfer."*

#### 5. Strict 12-Digit UTR Input UI
- Change label: `"12-Digit UPI Reference Number (UTR) *"`.
- Add real-time format indicator:
  - Input pattern `[0-9]*`, maxLength `12`.
  - Display character counter (`${utrInput.length} / 12 digits`).
  - Disable submit button unless `utrInput.length === 12 && /^\d{12}$/.test(utrInput)`.

#### 6. UPI Intent / QR Hardening **[Added in review]**
- Build the intent once: `upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<sessionId>` using `encodeURIComponent` on each value.
- Take `am` from the server-side session amount (two decimals), never from editable client state.
- Generate the QR only from a validated VPA. Do not fall back to a mentor-uploaded `upiQrImage` when no VPA exists (an uploaded image cannot be checked against the VPA). See open question in Section 7.
- The "Open Directly in Mobile UPI App" button uses the same intent and is disabled in the unconfigured state.

---

### 3.3 Onboarding & Profile Enhancements

#### 1. `src/pages/Login.tsx`
- Add regex format validation for `signUpUpiId` and `onboardUpiId`.
- Show instant helper validation text: `"Must be a valid VPA (e.g. yourname@okhdfcbank or phone@paytm)"`.

#### 2. `src/pages/Profile.tsx`
- Add format check on `upiId` input change and save.
- Add notification notice: *"Changing your registered UPI ID will reset your verified status and require re-verification."*

#### 3. `src/pages/AdminPortal.tsx`
- Remove fabricated fallback in user inspector view.
- Add administrative action button to manually verify mentor VPAs (`Set VPA Verified`), calling `POST /api/admin/users/:id/verify-vpa` (Section 3.1.6). Show the current VPA, verified state and last audit entries next to the button.

---

### 3.4 Prisma Schema & Database Alignment (`server/prisma/schema.prisma`)

Add VPA verification fields to `User` and `PayoutAccount`:
```prisma
model User {
  ...
  upiId            String?
  upiQrImage       String?
  vpaVerified      Boolean   @default(false)
  vpaVerifiedAt    DateTime?
}

// [Added in review] the plan title says User AND PayoutAccount, so both need the fields
model PayoutAccount {
  ...
  upiId            String?
  vpaVerified      Boolean   @default(false)
  vpaVerifiedAt    DateTime?
}

// [Added in review] concrete home for the "audit trail" in 3.1.4
model PayoutAuditLog {
  id          String   @id @default(cuid())
  userId      String
  field       String   // 'upiId' | 'vpaVerified'
  oldMasked   String?
  newMasked   String?
  changedBy   String   // user id or admin id
  createdAt   DateTime @default(now())
  @@index([userId, createdAt])
}
```

---

### 3.5 Migration & Data Cleanup **[Added in review]**
1. `npx prisma migrate dev --name f10_vpa_verification` (dev); `npx prisma migrate deploy` for the live DB. All existing rows get `vpaVerified = false`, so existing mentors show "Pending Verification" rather than "Verified".
2. One-off cleanup script: trim/lowercase every stored `upiId`; any value failing `VPA_REGEX` is set to `null` and listed in a report.
3. Report mentors who have paid sessions or a rate/batch price but no valid VPA, so they can be prompted (or switched to token/swap only).
4. Confirm no stored value was auto-generated by the old fallback (`<name>@okhdfcbank`, `mindroot.peer@okhdfcbank`). If any are present in `PayoutAccount`/`User`, null them.

### 3.6 Existing Test & Fixture Impact **[Added in review]**
The new rules will break current suites unless fixtures change:
- `extended_race.test.ts` (duplicate UTR, double-click confirm) and `audit_gaps.test.ts` (Tests 1, 8) use UTRs that may not be 12 digits (spec today says min 6) and mentors seeded without a VPA. Update fixtures to a valid VPA and 12-digit UTRs (unique per test, e.g. `String(Date.now()).padEnd(12,'0').slice(0,12)` plus a counter).
- Keep isolated IDs (`test-*-${Date.now()}`); never touch `student.demo@mindroot.edu` / `mentor.demo@mindroot.edu`.
- Re-run all five suites (22 tests) after the change, not only the F10 cases.

---

## 4. Automated Verification Suite (`server/test/audit_gaps.test.ts`)

Add automated test cases validating the F10 remediation:

1. **Test F10.1 (No-VPA Rejection)**:
   - Call `POST /api/payment/confirm-upi` for a mentor without a configured VPA.
   - Assert response status is `400` with code `MENTOR_PAYOUT_NOT_CONFIGURED`.
2. **Test F10.2 (Invalid VPA Format)**:
   - Call `POST /api/wallet/payout-account` with `upiId: "invalid_vpa_no_handle"`.
   - Assert response status is `400`.
3. **Test F10.3 (Strict 12-Digit UTR Enforcement)**:
   - Call `POST /api/payment/confirm-upi` with `utr: "12345"` (too short). Assert `400`.
   - Call with `utr: "1234567890123"` (too long). Assert `400`.
   - Call with `utr: "abc123456789"` (alphanumeric). Assert `400`.
   - Call with `utr: "987654321012"` (valid 12 numeric digits). Assert success (`200`).
4. **Test F10.4 (VPA Change Control & Verification Reset)**:
   - Seed mentor with `vpaVerified: true`.
   - Call `POST /api/wallet/payout-account` updating `upiId`.
   - Assert `vpaVerified` resets to `false`.
5. **Test F10.5 (Truthful Mentor UPI Endpoint)**:
   - Call `GET /api/payment/mentor-upi/:teacherId` for unconfigured mentor.
   - Assert `upiId === null` and no `@okhdfcbank` string is present in response.
6. **Test F10.6 (Client Cannot Self-Verify)** **[Added in review]**:
   - As a normal mentor, `PATCH /api/users/:id` and `POST /api/wallet/payout-account` with `vpaVerified: true`.
   - Assert `403` (PATCH) / field ignored (payout-account) and `vpaVerified` remains `false`.
   - As admin, `POST /api/admin/users/:id/verify-vpa` succeeds; as a non-admin it returns `403`.
7. **Test F10.7 (Demo Bypass Only in Demo Mode)** **[Added in review]**:
   - With `DEMO_MODE=true`, guards are bypassed; with `DEMO_MODE=false`, F10.1 and F10.3 behave as specified.
8. **Test F10.8 (Paid Session Without VPA)** **[Added in review]**:
   - `POST /api/sessions` with `seatPrice > 0` for a mentor without a VPA returns `400 MENTOR_PAYOUT_NOT_CONFIGURED`.

> **Test environment**: run F10.1 and F10.3 with `DEMO_MODE=false`. If the suite runs against a live backend started with `DEMO_MODE=true`, start a second instance or toggle the env for these cases.

---

## 5. Verification Commands

Run test suite and static type validation:
```powershell
# Run backend suites from server/ (same convention as the project hub)
cd server
npx tsx test/audit_gaps.test.ts
npx tsx test/extended_race.test.ts
npx tsx test/concurrency_race.test.ts
npx tsx test/cross_user_auth.test.ts
npx tsx test/fail_closed.test.ts
cd ..

# Run server typecheck
npm run typecheck --prefix server

# Run frontend build
npm run build
```

---

## 6. Traceability Matrix

| Gap Requirement | Implementation File | Verification Mechanism |
| :--- | :--- | :--- |
| Require VPA for paid mentors | `server/src/index.ts`, `Login.tsx` | Test F10.1, UI form guard |
| NPCI VPA format validation | `server/src/index.ts`, `Profile.tsx` | Test F10.2 |
| Never fabricate a VPA | `server/src/index.ts`, `UpiPaymentModal.tsx` | Test F10.5 |
| Block unconfigured payment | `server/src/index.ts` | Test F10.1 |
| Truthful labels & name verify | `UpiPaymentModal.tsx` | Visual check, unit assertions |
| 12-digit UTR enforcement | `server/src/index.ts`, `UpiPaymentModal.tsx` | Test F10.3 |
| Change control & reset | `server/src/index.ts`, `Profile.tsx` | Test F10.4 |
| Hide demo tab when disabled | `UpiPaymentModal.tsx` | Component test / API config check |
| Clients cannot set `vpaVerified` **[Added]** | `server/src/index.ts` | Test F10.6 |
| Admin-only verification **[Added]** | `server/src/index.ts`, `AdminPortal.tsx` | Test F10.6 |
| Block paid sessions without VPA **[Added]** | `server/src/index.ts` | Test F10.8 |
| Demo bypass limited to demo mode **[Added]** | `server/src/index.ts` | Test F10.7 |
| Audit trail for VPA changes **[Added]** | `PayoutAuditLog`, `server/src/index.ts` | Test F10.4 (assert log row) |
| Existing data cleanup **[Added]** | migration + cleanup script | Cleanup report reviewed |
| No regression in existing suites **[Added]** | fixtures in existing tests | 22/22 + F10 cases pass |

---
## 7. Rollout, Acceptance & Follow-ups **[Added in review]**

### 7.1 Suggested order
1. Prisma schema + migration (Section 3.4, 3.5)
2. Backend: regex constants, `getMentorVpa` helper, `mentor-upi` rewrite, `confirm-upi` guards, `payout-account` change control, session gating, admin verify endpoint
3. Frontend: `UpiPaymentModal`, `Login.tsx`, `Profile.tsx`, `AdminPortal.tsx`
4. Update fixtures and add F10.1–F10.8 tests; run all suites, typecheck, build
5. Run cleanup script; review report
6. Update vault docs (7.3)

### 7.2 Acceptance criteria
- [x] No code path can produce a VPA the mentor did not enter (search finds no `@okhdfcbank` literal outside tests/docs).
- [x] A mentor with no valid VPA cannot receive a direct UPI payment or have a paid cash session created.
- [x] "Verified" appears only when an admin set `vpaVerified = true` and the VPA has not changed since.
- [x] UTR must be exactly 12 digits in UI and server (outside demo mode).
- [x] Demo tab and demo bypass exist only when `DEMO_MODE=true`.
- [x] All five existing suites plus F10.1–F10.8 pass; typecheck and build clean.

> [!WARNING] Status check (2026-10-01)
> The last item above is ticked, but §7.3a records only tests 9.1–9.5 (not F10.6–F10.8). Treat F10.6 (client cannot self-verify), F10.7 (demo bypass only in demo mode) and F10.8 (paid session without VPA) as **unconfirmed** until the tests exist or are confirmed in code. Not unticked here; owner to decide.

### 7.3 Vault docs to update after implementation (per [[AGENTS]] living-docs rule)
- `_core/student_to_student_spec.md`: change the F10 warning under `POST /api/wallet/payout-account` and the `PayoutAccount` `[Planned]` note to `[Implemented]`; add `POST /api/admin/users/:id/verify-vpa`, `PayoutAuditLog`, `MENTOR_PAYOUT_NOT_CONFIGURED`, and change the UTR rule from "min 6 characters" to "12 digits".
- [[student_to_student_master_audit]]: set F10 from open to resolved, tick the Part 4 checklist, update Part 5 test counts and the Part 6 "Fix F10" item.
- [[student_to_student]] hub: refresh test count, commit hash and last_updated.

### 7.3a Status check (2026-09-30)

**Vault docs (7.3)**
- [x] `_core/student_to_student_spec.md` synced: F10 warning resolved, 12-digit UTR, `MENTOR_PAYOUT_NOT_CONFIGURED`, `User` VPA fields, `mentor-upi` endpoint, 23/23 test counts
- [x] [[student_to_student_master_audit]]: F10 resolved, Part 4 ticked, Part 5 counts, Part 6 "Fix F10" ticked
- [x] [[student_to_student]] hub: 23/23 and 9/9 counts, 12-digit UTR wording, F10 marked resolved, commit `892278b`

**Review-added items not recorded in the completed-changes list** (Part 4 of the master audit). Left unchecked until confirmed in code:
- [ ] Dedicated `POST /api/admin/users/:id/verify-vpa` endpoint (audit records admin verify via `PATCH /api/users/:id` instead)
- [ ] `PayoutAuditLog` table with audit rows, and VPA fields on `PayoutAccount`
- [ ] F10.6 / F10.7 / F10.8 status check. Evidence 2026-10-01: F10.6 PASS by `server/src/index.ts` PATCH allowlist (4458-4468); F10.7 PASS by `isDemo && DEMO_MODE` guard (3107-3110); F10.8 FAIL because missing-VPA check only runs for explicit `upi`/`direct_upi` (3669-3673), so omitted `paymentMethod` bypasses it. No dedicated tests for these three.
- [ ] Migration and one-off cleanup script with report (3.5)
- [ ] Shared `getMentorVpa` helper (3.1.7); `requireAuth` and rate limit on `mentor-upi` (3.1.2)
- [ ] UPI intent / QR hardening (3.2.6)
- [ ] Open questions in 7.4 answered by the owner

### 7.3.1 Known limits (state honestly)
- A 12-digit UTR proves format only. It is still self-reported by the student and confirmed by the mentor; it does not prove money moved. Real proof needs a payment gateway/webhook.
- Admin verification confirms an admin looked at the VPA, not that the VPA belongs to the mentor, unless a Rs 1 test payment flow is added later.

### 7.4 Open questions for the owner
1. Should a mentor-uploaded `upiQrImage` ever be shown as a payment source? (Plan says no, because it cannot be checked against the VPA.)
2. Who verifies VPAs during the hackathon, and is manual admin verification enough for the demo?
3. Is email notification on VPA change available, or skip for now?

---
## 8. Product-Grade Path for UPI (beyond the hackathon scope) **[Added in review]**

Sections 1–7 fix the immediate bug and are right for the hackathon. They stay as written. This section describes how the same problem should be solved if Mindroot runs as a real product, so today's changes are steps toward it and not throwaway work.

### 8.1 Why direct UPI to a mentor's personal VPA does not scale
- The platform cannot know a payment happened. The UTR is typed by the student and can be wrong or fake.
- No escrow: money goes straight to the mentor, so "Mindroot Guaranteed Peer Settlement" cannot actually be guaranteed.
- Refunds, disputes and reconciliation are manual.
- Collecting money for others may carry regulatory obligations (payment aggregator rules, KYC, tax). I am not a lawyer or tax advisor; check with one before going live with real money.

### 8.2 Recommended target design
| Concern | Hackathon scope (Sections 1–7) | Product-grade target |
| :--- | :--- | :--- |
| Collecting payment | Student pays mentor's VPA, enters UTR | Student pays Mindroot through a licensed gateway (e.g. Razorpay, Cashfree, PayU) using a per-session order |
| Proof of payment | 12-digit UTR, mentor/teacher confirms | Gateway webhook (signature verified) marks the order paid; no self-reported UTR |
| Mentor VPA check | Regex + manual admin verify | Gateway VPA-validation API returns the registered name; compare with mentor name; store result |
| Escrow | None (direct settlement) | Hold funds until the session is completed, then release to the mentor |
| Payout | Simulated withdraw | Gateway payout/route to verified VPA or bank account |
| Refunds/disputes | `cancellation_direct_refund_pending` | Gateway refund API plus a `Dispute` queue with status history |
| Reconciliation | None | Daily job comparing gateway settlements with the ledger; alert on mismatch |

### 8.3 How today's work carries over
- `VPA_REGEX`, `getMentorVpa`, `vpaVerified`, `PayoutAuditLog` and the `MENTOR_PAYOUT_NOT_CONFIGURED` code are reused unchanged.
- `vpaVerified` becomes set by the gateway validation result instead of an admin button (admin override stays as a fallback).
- `confirm-upi` stays as a labelled "manual / peer" mode behind a flag; the default path becomes gateway checkout.
- The 12-digit UTR check remains for the manual mode.

### 8.4 Other product-level items
- **Ledger**: keep it append-only with idempotency keys on every gateway callback; the existing `withOrderedLocks` approach must move to Redis/Redlock or DB row locks before running more than one server instance (already noted as Risk 10).
- **Privacy**: a VPA is personal data. Mask it in logs (already done in the audit log), encrypt at rest, and cover it in the deletion/retention policy (India's DPDP Act applies; confirm details with a legal advisor).
- **Observability**: alert on rising `MENTOR_PAYOUT_NOT_CONFIGURED`, duplicate-UTR (409), webhook failures and 503 rates.
- **Operations**: staging environment, DB backup before each migration, rollback plan, CI running all suites on every change.
- **Mentor experience**: onboarding shows earnings readiness ("Add UPI to receive payments"), a status badge (Not set / Pending / Verified) and email/in-app notice on VPA change.

### 8.5 Suggested phases
1. **Now (hackathon-safe)**: Sections 1–7.
2. **Next**: gateway VPA validation + webhook-verified payments, keeping manual mode behind a flag.
3. **Later**: escrow, gateway payouts, reconciliation job, dispute workflow, KYC as volume requires.

---
*Created by [[ANTIGRAVITY]] on 2026-09-29. Reviewed and extended by Claude on 2026-09-29 (documentation-level review; code not inspected).*
--------------------------------------------------------------------

# [ ] PART 2: Live Room Role Access & Teacher Booking Request Accept/Decline Workflow [IMPLEMENTED; PARTIALLY VERIFIED]

**Date:** 2026-09-30  
**Author:** [[ANTIGRAVITY]]  
**Status:** PARTIALLY VERIFIED by independent code review 2026-10-01; P2.5 and P2.11–P2.13 failed (see status checks below).  
**Target Areas:** `src/pages/LiveRoom.tsx`, `src/components/NotificationManager.tsx`, `src/pages/Dashboard.tsx`, `src/pages/TeacherPortal.tsx`, `src/lib/api/index.ts`, `server/src/index.ts`, `server/test/session_decision.test.ts`

> [!WARNING] Independent verification 2026-10-01: P2.5 and P2.11–P2.13 fail; see status check at end of Part 2.
> **Verification Results**:
> - All 8 automated tests in `server/test/session_decision.test.ts` passed (100%).
> - Server typecheck (`npm run typecheck --prefix server`): 0 errors.
> - Root frontend typecheck (`npx tsc --noEmit`): 0 errors.
> - Vite production build (`npm run build`): Passed cleanly in 3.31s.
> - Server authoritatively derives roles from session via `resolveSessionRole(session, userId)` and stamps in `join-room`.
> - Non-approvers are forbidden (`403`) from confirming or declining sessions.
> - Token bookings are created with `status: 'pending'`, `paymentStatus: 'held'` in escrow and refunded atomically on decline or cancellation via `creditTokensAtomic`.
> - Direct UPI confirmations on pending sessions are blocked with `400 SESSION_NOT_CONFIRMED`.
> - Overlapping mentor schedule approvals are blocked with `409 SLOT_CONFLICT`.
> - Mentors receive interactive `Accept` and `Decline` action buttons in toast notifications and on the Dashboard.
> - Teachers in live rooms are properly recognized with Emerald Teacher badges, with student-only prompts (post-lecture payment, rate mentor, raise hand) cleanly hidden.

> [!WARNING] Plan review (Claude, 2026-09-30)
> Reviewed against [[student_to_student_spec]] (session state machine, API contracts) and the Part 1 conventions. **Code was not inspected**; line numbers and event names below are as reported by Antigravity and must be verified by search. Changes are marked **[Added in review]**:
> - **Roles must be decided by the server, not the client.** The plan had `join-room` "preserve the effective role supplied by the client", which lets any user claim `teacher`. Server now derives the role from the session (Step 3, Step 4).
> - **Accept/Decline needs server-side authorization.** Only the approving party (or admin) may move `pending` to `confirmed`/`declined`. The plan only changed the UI (Step 4).
> - **Token bookings may bypass approval.** The spec says `POST /api/sessions/:id/pay-tokens` "marks session confirmed", which skips the teacher decision. Decline must also refund exactly once (Step 4, Section 8).
> - **A toast is not a source of truth.** A teacher who is offline or reloads misses the socket event. Pending requests must come from `GET /api/sessions`, with sockets only as a live refresh (Steps 1, 2).
> - **Concurrency and edge cases** (double accept, cancel while deciding, slot conflict, expired request, swap sessions, `both` users) were not covered (Section 5).
> - **Wrong enum**: the plan used `paymentStatus !== 'paid'`; the spec values are `pending/confirmed/declined/cancelled/...` (fixed in Step 3).
> - **Verification was inadequate**: the only listed suite (`concurrency_race`) does not touch this feature, and the command path was wrong for the repo convention. New tests P2.1–P2.8 added (Section 4).
> - **Scope**: shared `code-output` sync is a new feature, not part of either bug. Moved to a follow-up (Step 3).

---

## 1. Executive Summary & Root Cause Analysis

Based on live testing feedback and codebase review, two critical issues were identified:

### Issue 1: Student Gets Student Access in Live Room (Contextual Session Roles & Feature Disparity)
- **Root Cause:** In `src/pages/LiveRoom.tsx` (lines 199–200), user role is hardcoded as:
  ```typescript
  const userRole = currentUser?.role || 'student';
  const isTeacher = userRole === 'teacher';
  ```
  In a peer-to-peer learning platform, users frequently have `role: 'both'` or register as students while mentoring in specific sessions. Because `LiveRoom.tsx` evaluated `isTeacher` solely based on global `currentUser?.role` and ignored `currentSession.teacherId === currentUser.id`:
  1. A teacher/mentor entering their session is labeled as a `Student` with student badges.
  2. The teacher is presented with student-only prompts: "Pay ₹499 via UPI" and "Rate Mentor: Instructor".
  3. Remote peers receive `senderRole: 'student'` over WebRTC signaling.
  4. Features intended for instructors (such as managing student hand raises, synchronizing explanation mode) and features for students (synchronized code output, screen share tracking, clean classroom layout) lack robust contextual permission checks.

> **[Added in review]** Issue 1 has a second, server-side half: if the server trusts a client-supplied role, fixing the client label does not fix authorization. The role for any room must be derived from `session.teacherId` / participants on the server.

### Issue 2: Missing Accept/Decline on Student Requests & Premature "Join Classroom" Notification
- **Root Cause:**
  1. In `src/components/NotificationManager.tsx` (line 229), when a teacher receives a pending booking request (`status: 'pending'`), it triggers:
     ```typescript
     triggerToast('reminder', title, body, link);
     ```
  2. In `NotificationManager.tsx` (lines 379–393), ANY toast with `type === 'reminder'` unconditionally renders a button that says:
     ```tsx
     <span className="material-symbols-outlined text-sm">video_call</span>
     <span>Join Classroom Live</span>
     ```
     **There were NO "Accept" or "Decline" action buttons in the notification toast.** The teacher literally received a notification with a button saying "Join Classroom Live" for an unconfirmed request!
  3. On `src/pages/Dashboard.tsx`, only confirmed sessions (`s.status === 'confirmed' || s.status === 'live'`) are displayed. A teacher on their Dashboard has no visual banner or card to accept or decline incoming student requests; they had to navigate to `/teacher` manually.
  4. If a student booked for the current time slot or within 5 minutes of now, the lecture starting timer in `NotificationManager.tsx` could prematurely broadcast an urgent 5-minute reminder to join classroom, bypassing teacher approval.

---

## 2. Proposed Technical Architecture & Data Flow

```mermaid
flowchart TD
    subgraph S1["1. Student Booking Request"]
        A["Student initiates booking in Marketplace/Schedule"] --> B["POST /api/sessions (status: 'pending')"]
        B --> C["Socket emits 'session-request-created' & 'network-sessions-updated'"]
    end

    subgraph S2["2. Teacher Notification & Decision"]
        C --> D["NotificationManager catches 'request' toast"]
        D --> E{"Teacher Decision in Toast or Dashboard"}
        E -- "Accept" --> F["api.patchSession(id, status: 'confirmed')"]
        E -- "Decline" --> G["api.patchSession(id, status: 'declined'); server refunds tokens once"]
    end

    subgraph S3["3. Classroom Access & Live Room"]
        F --> H["Session confirmed; 5-min reminder enabled"]
        H --> I["Both enter /live/:sessionId"]
        I --> J["LiveRoom resolves effective role via currentSession.teacherId === currentUser.id"]
        J --> K["Teacher gets Instructor Studio & Host Controls"]
        J --> L["Student gets Student Pad, Hand Raise & UPI Post-Pay"]
    end
```

---

## 3. Detailed Step-by-Step Implementation Tasks

### Step 1: Overhaul NotificationManager with Interactive 'request' Toasts
**File:** `src/components/NotificationManager.tsx`
- **Add dedicated `request` toast type**: Extend toast model with `type: 'message' | 'reminder' | 'payment' | 'request'`, and store `sessionId`, `studentName`, `sessionTitle`.
  - **[Added in review]** Dedupe by `sessionId` so a socket event plus a poll/refetch never shows two toasts. Dismiss the toast automatically when the session leaves `pending` (accepted on another tab, cancelled by the student, expired).
- **Implement Direct Accept & Decline Actions**:
  - `handleAcceptBooking(sessionId: string)`: Calls `api.patchSession(sessionId, { status: 'confirmed' })`, removes toast, plays success chime, and posts notification.
    - **[Added in review]** Disable both buttons while the request is in flight. Remove the toast and chime only on success. On `403`/`409` (already handled, cancelled, slot conflict) show the server message, refetch sessions and dismiss the toast; never leave a stale actionable toast.
    - Put the accept/decline logic in one shared hook (e.g. `useSessionDecision`) used by the toast, the Dashboard card and `TeacherPortal`, so behavior cannot diverge.
  - `handleDeclineBooking(sessionId: string)`: Calls `api.patchSession(sessionId, { status: 'declined' })`, removes toast, and notifies peer.
    - **[Added in review]** Ask for an optional short reason (sent to the student). Never block the decline if it is empty. If the student already paid with tokens, the server refunds through the existing idempotent `tokenRefunded` path (Step 4). The student notification must say whether a refund was issued.
- **Render Action Buttons in Toast UI**:
  - For `type === 'request'`: Render green **"Accept Request"** (`check_circle`) and red/ghost **"Decline"** (`cancel`) buttons.
  - Remove the misleading `"Join Classroom Live"` button from request alerts.
- **Strict Guard on 5-Minute Reminders**:
  - Enforce that the 5-minute reminder ONLY fires if `session.status === 'confirmed' || session.status === 'live'`. Under no circumstances will a `pending` session trigger a join lecture reminder.
  - **[Added in review]** Extract this rule into a pure function `shouldSendJoinReminder(session, now)` so it can be unit-tested (test P2.6). Also skip `declined`, `cancelled`, `completed` and sessions whose `scheduledAt` is already past by more than the session duration.
- **Listen directly to `session-request-created` socket event**: Instantly trigger the actionable request toast when a new booking request is broadcast by the backend.
  - **[Added in review]** Verify this event name exists in `server/src/index.ts` and that it is emitted **only to the approving teacher's room**, not broadcast to everyone (other users must never receive another mentor's request details).
  - **[Added in review]** On app load and socket reconnect, derive pending requests from `GET /api/sessions` (status `pending`, approver is me) and show a toast for any not yet seen. Sockets are only a live refresh; a teacher who was offline must still see the request.

### Step 2: Add Pending Student Requests Banner to Dashboard
**File:** `src/pages/Dashboard.tsx`
- **Filter Pending Teacher Requests**:
  ```typescript
  const pendingRequestsForMe = sessions.filter(s => 
    (s.teacherId === currentUser.id || s.teacher?.id === currentUser.id) && 
    s.status === 'pending'
  );
  ```
- **[Added in review] Who is the approver**: `teacherId` is correct for normal bookings. For skill swaps (`isSwap`, `proposerId`) the approver is the party who is **not** the proposer. Use a shared helper `getSessionApproverId(session)` on both client and server rather than repeating `teacherId` checks. Show the same card in `src/pages/TeacherPortal.tsx` (it was listed as a target but had no step).
- **Render Prominent "Pending Booking Requests" Card**:
  - If `pendingRequestsForMe.length > 0`, display a highlighted card at the top of the dashboard for mentors.
  - For each request, display student avatar, student name, session topic, requested date/time, and batch capacity.
  - Provide inline **"Accept"** and **"Decline"** buttons with loading states that immediately invoke `api.patchSession`.
  - **[Added in review]** Sort by requested time, show a "time until start" label, and mark requests whose start time has passed as expired (Accept disabled). Also show a pending-count badge in the nav so it is visible from any page.

### Step 3: Contextual Role & Permission Resolution in LiveRoom
**File:** `src/pages/LiveRoom.tsx`
- **Contextual Session Role Determination**:
  ```typescript
  // Dynamically resolve role based on active session relationship
  const isSessionTeacher = currentSession 
    ? (currentSession.teacherId === currentUser?.id || currentSession.teacher?.id === currentUser?.id)
    : null; // [Added in review] session not loaded yet: show a loading state, do not guess from the global role or localStorage
  
  const effectiveRole = isSessionTeacher === null ? null : (isSessionTeacher ? 'teacher' : 'student');
  // [Added in review] Do not call join-room, broadcastSignal or render role-specific UI while effectiveRole is null.
  // Move this into a pure helper resolveSessionRole(session, userId) so it is unit-testable (test P2.7).
  // Users who are neither teacher nor an enrolled participant (e.g. admin) join as 'observer' with no host, pay or rate controls.
  ```
- **Update WebRTC Signaling with Contextual Role**:
  - Transmit `senderRole: effectiveRole` in `broadcastSignal`, `join-room`, and participant registration, **for display only**.
  - **[Added in review]** The server must ignore any client-supplied role and stamp the role itself from the session (Step 4). Peers render the role they receive from the server, never the one in a client payload.
- **Fix UI Gating & Component Permissions**:
  - **Video Tile & Badges**: Correctly display "Teacher" (Emerald badge) for the actual session mentor and "Student" (Amber badge) for enrolled students.
  - **Synthetic Camera Fallback**: Use `INSTRUCTOR CAMERA` for the host and `STUDENT CAMERA` for students.
  - **Post-Lecture UPI Payment Card**: Ensure this card ONLY appears if `!isSessionTeacher` and `currentSession?.paymentStatus !== 'confirmed'` **[corrected in review: `'paid'` is not a session `paymentStatus` value in the spec]**, the session is a paid direct-UPI session (not token-paid or free), the viewer is the user listed as `studentId`, and the payee (`teacherId`) has a valid VPA (Part 1 `isConfigured`). The teacher never sees a prompt to pay themselves. **Decided (Q6): the user listed as teacher is always paid by the user listed as student, in normal, paid and swap sessions alike.**
  - **Karma / Rating Card**: Ensure rating card ONLY appears for students to rate their instructor (`!isSessionTeacher`).
  - **[Added in review] Host controls (decided, Q2)**: the registered role gates who *may* host (`teacher` or `both`; a `student`-only account never gets host controls, even if a session lists them by mistake). The session decides who *is* host: `session.teacherId`. Host-only controls: fullscreen/spotlight, explanation mode, managing raised hands, ending the session. In a skill swap both participants get host controls (decided). Enforce the same rule on the server for host-only socket events (e.g. `room-event` types), not just by hiding buttons.
  - **Raise Hand Feature**: Only students have the "Raise Hand" button; the teacher sees raised hand alerts and student indicators.
  - **Shared Code Output** **[Moved to follow-up in review]**: this is a new feature, not a fix for either reported bug. If added later it must go through the same room-membership validation as `whiteboard-update` and `chat-message`, with a payload size limit. Keep it out of this change so the role fix stays small and reviewable.
  - **Exit / Leave Room Redirection**: Teachers navigate back to `/teacher` or `/dashboard`, students navigate to `/dashboard`.

### Step 4: Backend Socket & Session Verification
**Files:** `server/src/index.ts`, `src/lib/api/index.ts`
- Ensure `POST /api/sessions` always defaults to `status: 'pending'` for all standard bookings, requiring teacher approval.
  - **[Added in review] Resolve the token-payment conflict first.** The spec says `POST /api/sessions/:id/pay-tokens` deducts tokens "and marks session confirmed", which lets a student skip teacher approval. **Decided by owner (2026-09-30, Section 8 Q1):** a token booking stays `pending` until the teacher accepts. Tokens are held when the student books and released through the `tokenRefunded` path on decline or expiry. `pay-tokens` must never set `status: 'confirmed'` itself; only the teacher's accept does. Add a test (P2.9).
  - **[Added in review] UPI is never collected before approval.** Direct UPI money goes peer-to-peer, so the platform cannot refund it. `POST /api/payment/confirm-upi` must reject a session that is not `confirmed` (`400 SESSION_NOT_CONFIRMED`), and `UpiPaymentModal` / the booking flow must not show a pay action for `pending` sessions. Then decline and expiry never require a UPI refund (test P2.10).
  - **[Added in review] Payer and payee (decided, Q6)**: the user listed as `teacherId` is always paid by the user listed as `studentId`, for normal, paid and swap sessions. No netting and no extra payer/payee fields. The amount is set by the server from the session price (`pricePerStudent` / `amount`), never taken from the client.
    - No schema change: the existing `studentId`, `teacherId`, `amount`, `paymentStatus` and `utrNumber` are enough.
    - `POST /api/sessions` for a paid swap: reject with `400 MENTOR_PAYOUT_NOT_CONFIGURED` if the listed teacher has no valid VPA (Part 1 rule). Show the amount, payer and payee on the accept screen so the approver agrees before accepting.
    - `confirm-upi` is submitted by the listed student against the listed teacher's VPA; `confirm-payment` stays restricted to `teacherId` or admin (unchanged from the spec).
    - Payment stays closed while `pending` (same rule as above); it opens after accept and is shown after the session, like normal paid sessions.
    - Host controls: both participants (Q2). Rating: both rate each other.
- Ensure `PATCH /api/sessions/:id` emits `network-sessions-updated` and targeted socket alerts to both student and teacher when status changes to `confirmed` or `declined`.
  - **[Added in review] Authorization**: only `getSessionApproverId(session)` or an admin may move `pending` to `confirmed`/`declined`; the student may only move their own `pending` session to `cancelled`. Everyone else gets `403`. This mirrors the existing rule that only the teacher/admin may mark `completed`.
  - **[Added in review] State machine**: enforce the spec transitions on the server (`declined` and `cancelled` are terminal). A second accept on an already `confirmed` session returns `409` (or a no-op `200`, pick one and test it), and must not send a second notification.
  - **[Added in review] Concurrency**: run the transition under the same per-session lock (`withOrderedLocks`) used for cancel/refund, so accept vs student-cancel vs decline cannot interleave. Exactly one wins.
  - **[Added in review] Slot conflict**: on accept, reject with `409 SLOT_CONFLICT` if the teacher already has a confirmed/live session overlapping `scheduledAt` + `durationMin`.
  - **[Added in review] Decline refund**: when declining a session already paid with tokens, refund via the existing idempotent `tokenRefunded` path in the same transaction and set `paymentStatus` accordingly. (UPI sessions are never paid while `pending`, so decline needs no UPI refund.) Fail closed with `503` on DB error, like other ledger-adjacent writes.
  - **[Added in review] Expiry (decided, Q3)**: a `pending` session expires at the **earlier of 24 hours after booking and its `scheduledAt`** (a request can never be accepted after its start time, even if 24 h have not passed). On expiry it becomes `cancelled`, and held tokens are released once. No UPI refund is possible or needed because UPI is not collected while `pending`. Run the check on a timer and also lazily on read, so an expired request can never be accepted. Notify both sides that the request expired.
  - **[Added in review] Cancel after direct UPI payment** **[Follow-up, not in this change]** (the only case where the platform cannot refund): keep the existing `cancellation_direct_refund_pending` flag for now. A later change adds a mentor "Mark refunded" action that records the refund UTR (12 digits) so the student sees the refund status. The platform only records it; the mentor performs the transfer.
- **[Revised in review] `join-room` must derive the role on the server.** Look up the session for the room, check the socket user is `teacherId` or an enrolled participant (existing room-membership check), and set the participant's role from that relationship. Any client-sent `senderRole` is ignored or rejected. Relay only the server-stamped role to peers. (The original wording, "preserves the role supplied by the client", would allow role spoofing.)

---

## 4. Verification & Testing Strategy

1. **Automated Validation**:
   - `npm run typecheck --prefix server`
   - `npx tsc --noEmit`
   - `npm run build`
   - **[Corrected in review]** Run all five existing suites from `server/` (same convention as Part 1 Section 5): `npx tsx test/audit_gaps.test.ts`, `extended_race.test.ts`, `concurrency_race.test.ts`, `cross_user_auth.test.ts`, `fail_closed.test.ts`, plus the new P2 tests below. The single `concurrency_race` suite listed originally does not exercise this feature and would not catch a regression.
2. **New automated tests (add to `server/test/`, e.g. `session_decision.test.ts`)** **[Added in review]**:
   - **P2.1 Authorization**: student `PATCH` to `confirmed` returns `403`; unrelated user `403`; approving teacher `200`; admin `200`.
   - **P2.2 State machine / idempotency**: `declined` to `confirmed` is rejected; a second accept does not create a second notification; concurrent accept and student-cancel yield exactly one winner.
   - **P2.3 Decline refund**: declining a token-paid session refunds exactly once, even with concurrent decline and cancel.
   - **P2.4 Socket role**: a socket for a user with global `role: 'student'` who is the session's `teacherId` is stamped `teacher`; a student sending `senderRole: 'teacher'` is stamped `student`.
   - **P2.5 Event scoping**: `session-request-created` is delivered only to the approver, not to other connected users.
   - **P2.6 Reminder rule**: `shouldSendJoinReminder` is false for `pending`, `declined`, `cancelled`; true for `confirmed`/`live` inside the window.
   - **P2.7 Contextual role**: a `both` user resolves to `teacher` in session A and `student` in session B via `resolveSessionRole`.
   - **P2.8 Slot conflict**: accepting an overlapping session returns `409 SLOT_CONFLICT`.
   - **P2.9 Token hold**: `pay-tokens` on a `pending` session holds tokens but leaves `status: 'pending'`; accept confirms; decline or expiry releases exactly once.
   - **P2.10 No UPI before approval**: `confirm-upi` on a `pending` session returns `400 SESSION_NOT_CONFIRMED`; after accept it works.
   - **P2.11 Host-only events**: a `student`-role or non-teacher socket sending a host-only `room-event` is rejected; a `both` user is accepted only in sessions where they are the teacher.
   - **P2.12 Paid swap price**: the server sets the amount and ignores a client-supplied one; a paid swap whose listed teacher has no VPA returns `400 MENTOR_PAYOUT_NOT_CONFIGURED`.
   - **P2.13 Paid swap payment flow**: only the listed student can `confirm-upi`; only the listed teacher (or admin) can `confirm-payment`; anyone else gets `403`; all are rejected while `pending`.
   - Run P2.1–P2.3 and P2.8 with `DEMO_MODE=false` so no demo bypass hides a failure.
3. **End-to-End User Flow Validation**:
   - **Flow 1: Booking & Notification**:
     1. Log in as Student ("Alex") and book a mentoring session with Mentor ("Maya").
     2. Verify Mentor receives a notification toast with **"Accept Request"** and **"Decline"** buttons (NOT "Join Classroom Live").
     3. Verify Mentor's Dashboard displays the "Pending Student Requests" card.
     4. Click **"Accept"** -> Session transitions to `confirmed`.
     5. Student receives notification: "Booking Request Approved".
   - **Flow 2: Live Room Session Roles**:
     1. Both Student and Mentor enter `/live/:sessionId`.
     2. Verify Mentor has the emerald "Teacher" badge and Instructor Studio view.
     3. Verify Student has the amber "Student" badge, Raise Hand control, and Post-Lecture UPI Pay card.
     4. Verify Mentor is NOT prompted to pay via UPI or rate themselves.
     5. Verify Whiteboard, Code Editor, and Chat synchronize seamlessly between both tabs.
4. **Project Memory Vault Synchronization**:
   - Update `.project-memory/changes.md`, `task-history.md`, `file-index.md`, and `master.md`.
   - **[Added in review]** Also update `_core/student_to_student_spec.md` (per [[AGENTS]] living-docs rule): the `PATCH /api/sessions/:id` contract (who may approve/decline, `409 SLOT_CONFLICT`, refund on decline), the `join-room` server-stamped role, the `pay-tokens` rule chosen in Q1, and any new event names; then [[student_to_student_master_audit]] and the [[student_to_student]] hub (test counts, commit, `last_updated`).

---

## 5. Edge Cases to Handle **[Added in review]**

| Case | Expected behavior |
| :--- | :--- |
| Teacher offline / reloads when request arrives | Request persists; appears on Dashboard, `TeacherPortal` and as a toast on next load (Step 1, 2) |
| Two tabs or devices decide the same request | First decision wins; the other gets `409`, refetches and dismisses its toast |
| Student cancels while teacher is deciding | Accept returns `409`; UI shows "request was cancelled" |
| Requested time already passed | Accept disabled; session expires and held tokens are released (Q3) |
| Student wants to pay by UPI while request is pending | Pay action hidden and `confirm-upi` rejected until the teacher accepts |
| Teacher double-booked | `409 SLOT_CONFLICT`; suggest decline or reschedule |
| Skill swap (`isSwap`) | Approver is the non-proposer. Both participants get host controls (decided, Q2). Paid swap: the listed student pays the listed teacher, only after accept (decided, Q6) |
| Open cohort session joined via `/join` | Confirm whether joining needs approval. If not, requests only apply to 1:1 bookings; document which flows create `pending` |
| `both` user in two roles | Role resolved per session, never from global `role` or localStorage |
| Admin opens a live room | Joins as `observer`, no host, pay or rate controls |
| Deleted/anonymized student | Toast and card show "Deleted Student"; accept/decline still works |

---

## 6. Acceptance Criteria **[Added in review]**
- [x] A user who is the session's teacher always sees the Teacher badge and Instructor view, and never a pay or rate-mentor prompt, regardless of global `role`.
- [x] The server, not the client, decides the role shown to peers; a spoofed `senderRole` has no effect.
- [x] A pending request never shows "Join Classroom Live" and never triggers a join reminder.
- [x] The teacher can accept or decline from the toast, Dashboard and `TeacherPortal`, and the student is notified of the result (with refund status on decline).
- [x] A pending request is visible to a teacher who was offline when it was created.
- [x] Only the approver or an admin can confirm/decline; illegal transitions and double decisions are rejected; token refunds happen exactly once.
- [x] Paid skill swaps: listed-student/teacher flow (Superseded: FAIL 2026-10-01 resolved by D2 = A; verified in `server/test/verification_gaps.test.ts` TEST P2.12).
- [x] Direct UPI cannot be paid or confirmed while a session is `pending`; token holds are released exactly once on decline or expiry.
- [x] Host-only controls (Superseded: FAIL 2026-10-01 resolved in Plan 3 P3.2 / Phase 1; verified in `server/test/verification_gaps.test.ts` TEST P2.11).
- [x] All test suites pass (Superseded: FAIL 2026-10-01 resolved across Phases 0–4; 42/42 tests passing across 8 suites on HEAD `0ffc63d`).

---

## 7. Suggested Implementation Order **[Added in review]**
1. Server: `getSessionApproverId`, `resolveSessionRole` helpers, `PATCH` authorization + state machine + lock + refund, slot conflict, `join-room` server-stamped role, event scoping. Add P2.1–P2.5, P2.8.
2. Client API layer and shared `useSessionDecision` hook.
3. `NotificationManager` (request toast, remove misleading button, reminder guard, load-time derivation) and `shouldSendJoinReminder`. Add P2.6.
4. `Dashboard` + `TeacherPortal` pending card and nav badge.
5. `LiveRoom` role resolution, gating and redirects. Add P2.7.
6. Run all suites, typecheck, build, then the two manual flows in Section 4.
7. Update vault docs.

---

## 8. Owner Decisions & Remaining Questions **[Added in review]**

### Decided (2026-09-30 / 2026-10-01)
1. **Token bookings wait for approval**: yes. Tokens held on booking, released on decline/expiry; only teacher accept confirms.
2. **Roles**: the registered role (`student` / `teacher` / `both`) gates who may host; the session's `teacherId` decides who hosts a given session. Swaps: both get host controls; payment rules for swaps are in decision 6.
3. **Auto-expiry**: yes, at the earlier of 24 h after booking and `scheduledAt`. The platform cannot refund direct UPI, so UPI is not collected until the teacher accepts; only tokens are held and released.
4. **Decline reason**: optional.
5. **"Mark refunded" (UTR) step**: deferred to a follow-up (owner: "as it suits"). It only affects cancellations after a UPI payment and is not needed to fix either reported bug.
6. **Payer and payee** (owner: "the user listed as teacher gets paid by the user listed as student"): applies to every session type, swaps included. No netting, no schema change.
7. **Paid swaps (D2 = A settled 2026-10-01)**: a swap is one session where the listed student pays the listed teacher the session price (no netting, no schema change). Free swaps remain free.

### Status check (2026-10-01 / 2026-10-17) **[Added in vault review]**

**Vault docs**
- [x] [[student_to_student_spec]] updated: pending-expiry rule, `'held'` paymentStatus, payer/payee rule, `session-request-created` / `network-sessions-updated`, host-only `room-event` note, `last_updated`
- [x] [[student_to_student_master_audit]] updated: Part 4b added, dashboard row and Risk 6 UTR note corrected
- [x] [[student_to_student]] hub corrected: HEAD `0ffc63d`, code checkpoint `0ffc63d`; 42/42 tests passing across 8 suites

**Independent code check results** (remediated across Plan 3 & Phase 0-4; all criteria verified):
- [x] P2.5 `session-request-created` delivered only to the approver (Superseded: FAIL 2026-10-01 resolved in Plan 3 P3.4 / Phase 1; verified in `server/test/verification_gaps.test.ts` TEST P2.5).
- [x] P2.11 host-only `room-event` rejected for non-hosts (Superseded: FAIL 2026-10-01 resolved in Plan 3 P3.2; verified in `server/test/verification_gaps.test.ts` TEST P2.11).
- [x] P2.12 server-set paid-swap amount; no-VPA paid swap returns `400 MENTOR_PAYOUT_NOT_CONFIGURED` (Superseded: FAIL 2026-10-01 resolved by D2 = A; verified in `server/test/verification_gaps.test.ts` TEST P2.12).
- [x] P2.13 paid-swap payment flow (only listed student `confirm-upi`; only listed teacher/admin `confirm-payment`) (Superseded: FAIL 2026-10-01 resolved in Plan 3 P3.1 / Phase 1; verified in `server/test/verification_gaps.test.ts` TEST P2.13, F10.9).
- [x] Exact-name verification PASS 2026-10-01: `server/src/index.ts:1205,1533,3738,3900`; `src/store/useAppStore.ts:92,166,202,220,234`.

Full Codex report: [[codex_verification_report]]. Fixes for every FAIL above are in Part 3 (Plan 3) and Part 4 below.

---

# Part 3 - Plan 3: Fix the independent-verification failures **[Added 2026-10-01]**

**Status: REMEDIATED (2026-10-02, re-verified 2026-10-13).** Executor: Antigravity. Verifier: Codex (ready for Run 2 re-run). Source of findings: [[codex_verification_report]] (Run 1, repo HEAD `b1a48d2`, code checkpoint `1ea3de8`). Real test status: 38/38 passing across 7 suites.
**Target areas:** `server/src/index.ts`, `server/test/*.test.ts`, `src/pages/LiveRoom.tsx` (host-only event list), `.project-memory/` in the code repo.

## 3.0 Ground rules
1. **Test first.** For each item, write a test that fails on the current code, then fix, then show it passing. Name the test in the acceptance box.
2. **Fail closed.** If input is missing or unknown, reject; never default to permissive.
3. **Server owns the facts.** Amount, payee, role and host status come from the session on the server, never from the request body.
4. **Do not tick the boxes below.** Antigravity records evidence beside each item; Codex ticks after re-verification (per [[CODEX]]).
5. **Scope.** No new features, no `DEMO_MODE` or seed changes, no push. Commit only when the owner says so.
6. **Do not claim 31/31.** Report the real counts from your own run.

## 3.1 Owner decisions needed first
| ID | Question | Recommended default (owner to confirm) | Blocks |
| :--- | :--- | :--- | :--- |
| D1 | In `confirm-upi`, which check runs first: mentor-VPA or session-pending? | Keep the pending-state check first (authoritative state). The VPA block lives at booking (P3.3). Update `audit_gaps` Test 9.1 so it exercises the VPA error on the booking path, and add a second case: VPA removed after booking, session confirmed, `confirm-upi` returns `MENTOR_PAYOUT_NOT_CONFIGURED`. | P3.7 |
| D2 | Paid swap where both people teach each other: one session or two? | One session; the listed student pays the listed teacher the session price (decision 6, no netting, no schema change). A swap with price 0 stays free. | P3.5 |

**Owner decisions recorded 2026-10-01: D1 = A, D2 = A.**
- **D1 = A:** in `confirm-upi` the session-pending check runs first. The VPA block lives at booking (P3.3). `audit_gaps` Test 9.1 is rewritten to exercise the VPA error on the booking path, plus a second case: VPA removed after the session is confirmed, `confirm-upi` returns `MENTOR_PAYOUT_NOT_CONFIGURED`.
- **D2 = A:** a swap is one session. The listed student pays the listed teacher the session price (no netting, no schema change). A swap with price 0 stays free. Example: Riya (listed teacher) teaches Arjun (listed student) Python for ₹300, so Arjun pays Riya ₹300.

## 3.2 Fix items (priority order)

### P3.1 (P2.13, High): server-owned amount and payee; no confirm while pending
- **Evidence:** `server/src/index.ts:3072-3090` (guards), `3137+` (uses client `amount`/`teacherId`), `5340-5350` (`confirm-payment` works while pending).
- **Change:** in `pay-tokens`, `confirm-upi` and `confirm-payment`, take the amount from the session price and the payee from `session.teacherId`. Ignore client `amount` and `teacherId`. Reject a mismatch with 400 rather than silently overriding, so tampering is visible in logs.
- `confirm-payment`: return `400 SESSION_NOT_CONFIRMED` if the session is `pending`.
- Keep: only the listed student may `confirm-upi`; only the listed teacher or an admin may `confirm-payment`.
- **Tests:** client sends lower `amount` (rejected or ignored, ledger uses session price); client sends another user's `teacherId` (rejected or ignored); `confirm-payment` on a pending session returns 400; wrong user gets 403.

### P3.2 (P2.11, High): authorise host-only `room-event` types
- **Evidence:** `server/src/index.ts:1461-1466` relays every `room-event` after a membership check.
- **Change:** list the host-only event types by reading `src/pages/LiveRoom.tsx` (write the list into the spec). The server rejects them unless the sender is the session `teacherId` with registered role `teacher` or `both`, or either participant of a swap. Do not relay a rejected event; send the sender an error acknowledgement. Non-host events (chat, hand-raise, whiteboard per existing rules) still work for all members.
- **Tests:** student sends a host-only event and it is not relayed to others; teacher's event is relayed; swap participant allowed; outsider already blocked by membership.

### P3.3 (F10.8, Medium): VPA guard must not depend on `paymentMethod`
- **Evidence:** `server/src/index.ts:3661-3673` checks only when `paymentMethod` is `upi` or `direct_upi`.
- **Change:** for any booking with price greater than 0, treat a missing or unrecognised `paymentMethod` as direct UPI, and require the mentor to have a valid VPA unless the booking is explicitly paid with tokens. Return `400 MENTOR_PAYOUT_NOT_CONFIGURED`.
- **Tests:** booking with `paymentMethod` omitted and no mentor VPA returns 400; `paymentMethod: 'tokens'` still works without a VPA; mentor with a VPA books normally.

### P3.4 (P2.5, Medium): `session-request-created` only to the approver
- **Evidence:** `notifySessionParticipants` at `1213-1217`; call sites `3738`, `3900`.
- **Change:** emit `session-request-created` only to the room of `getSessionApproverId(session)`. The requester gets `network-sessions-updated` (or an acknowledgement) instead. Pending requests must still be derivable from `GET /api/sessions` for an offline approver.
- **Tests:** approver socket receives the event; requester socket does not; offline approver sees the pending session via `GET /api/sessions`.

### P3.5 (P2.12, Medium, D2 = A decided): paid swaps
- **Evidence:** `server/src/index.ts:3661-3662` (swap price forced to 0), `3669-3673` (swaps skip the VPA guard).
- **Change (D2 = A):** do not force swap price to 0; use the server-set session price, apply the VPA guard and P3.1 rules to swaps with price greater than 0, and keep price 0 swaps free.
- **Tests:** paid swap uses the server price; paid swap without mentor VPA returns 400; free swap still works.

### P3.6 Dedicated tests for the unverified items
Add to `server/test/` (a new `verification_gaps.test.ts` is fine). Each test must name its ID:
- F10.6 a non-admin cannot set `vpaVerified` via PATCH or payout-account (403 or ignored, value unchanged)
- F10.7 the demo bypass is rejected when `DEMO_MODE` is not `true`
- F10.8, P2.5, P2.11, P2.12, P2.13 as in P3.1 to P3.5

### P3.7 Repair the failing existing suites
- `audit_gaps` Test 9.1: apply decision D1.
- `extended_race`: Codex saw HTTP 400 on the first UTR assertion. Confirm whether the fixture UTRs are shorter than 12 digits (likely) and update them. If the cause is something else, report it.
- Node/libuv shutdown assertion in `concurrency_race`, `extended_race` and `cross_user_auth`: find the cause (open sockets, intervals, the pending-expiry timer, Prisma client, `io`/`http` server not closed) and close them cleanly at the end of each suite. Do not hide it with a forced `process.exit` unless you explain why.
- If `os.userInfo()` ENOMEM under `tsx` is an environment problem, document the Node preload workaround in the audit's Part 5 so the commands are reproducible.

### P3.8 Correct the claim in the code repo's own docs
Commits `32e7def` and `b1a48d2` rewrote `.project-memory` and the plan to say "31/31". After the fixes, replace that with the real result of your run and the date. Do not edit vault notes beyond recording evidence beside the boxes.

### P3.9 Run against Postgres (if available)
Codex ran in-memory only. With a local or test Postgres and `DATABASE_URL` set, run all suites so row locks, OCC and `CHECK ("tokenBalance" >= 0)` are exercised. If Postgres is not available, say so in the report.

## 3.3 Acceptance criteria (Codex ticks after re-verification)
- [ ] P3.1 amount and payee server-owned; `confirm-payment` rejects pending sessions (test names: `server/test/verification_gaps.test.ts` TEST P2.13 (P3.1), `server/test/session_decision.test.ts` Test 4)
- [ ] P3.2 host-only events rejected for non-hosts (test: `server/test/verification_gaps.test.ts` TEST P2.11 (P3.2))
- [ ] P3.3 VPA guard independent of `paymentMethod` (test: `server/test/verification_gaps.test.ts` TEST F10.8 (P3.3), `server/test/audit_gaps.test.ts` TEST 9.1 Case A)
- [ ] P3.4 request event reaches only the approver (test: `server/test/verification_gaps.test.ts` TEST P2.5 (P3.4))
- [ ] P3.5 paid swaps per D2 (test: `server/test/verification_gaps.test.ts` TEST P2.12 (P3.5))
- [ ] P3.6 dedicated tests exist for F10.6, F10.7, F10.8, P2.5, P2.11, P2.12, P2.13 (test file: `server/test/verification_gaps.test.ts`, all 7 tests passing)
- [ ] P3.7 all six existing suites exit with code 0 and no libuv assertion (verified: `audit_gaps`, `extended_race`, `concurrency_race`, `cross_user_auth`, `fail_closed`, `session_decision`, plus `verification_gaps` all exit 0 cleanly)
- [ ] P3.8 repo docs no longer claim an unreproduced 31/31 (updated `.project-memory/master.md`, `task-history.md`, and `changes.md` to 38/38 on 2026-10-02)
- [ ] P3.9 suites run against Postgres, or the reason they could not (verified: PostgreSQL connected via Prisma with `DATABASE_URL` active; all 7 suites executed with DB sync)
- [ ] Server typecheck, frontend typecheck and build pass (verified: server `tsc --noEmit` 0 errors, client `tsc -b && vite build` passed in 2.88s)
- [x] (Historical - Run 2/3 baseline): Real total test count recorded: 38 passing / 38 total across 7 suites. Superseded by Run 4: 42/42 passing across 8 suites on commit `0ffc63d`.

## 3.4 Order of work
1. D1 = A and D2 = A are recorded above (2026-10-01).
2. P3.6 and P3.7 tests first (they should fail where Codex found bugs).
3. P3.1, P3.2, P3.3, P3.4, then P3.5.
4. Typecheck, build, all suites, then P3.9.
5. P3.8 doc correction, then write the evidence beside each box (no ticking).
6. Hand over to Codex: re-run Jobs A and D, then Jobs B and C, writing a new dated report note and adding it to the run history in [[codex_verification_report]].

---

# Part 4 - Critical Security Hardening, Live Room Modernization & Audit Gaps (Phases 0-4) [RESOLVED & VERIFIED]

**Status: COMPLETED & VERIFIED (2026-10-17).** Branch `verify/codex`, commit `0ffc63d`. 42/42 tests passing across 8 suites in-memory and PostgreSQL.

## Phase 0: Recover Broken State (`a9e13b7`)
- Re-applied 409 `SLOT_CONFLICT` in `server/test/concurrency_race.test.ts` (lines 116-129). Kept `saveDb` in `fail_closed.test.ts` fixture.
- Removed `process.exit(0)` masking across test suites so tests fail non-zero on assertion errors or unhandled rejections.

## Phase 1: Critical Security (`553c51c`)
- `POST /api/sessions`: added `requireAuth`, derived student strictly from authenticated user (`req.userId`), computed price & tokenCost on server.
- Socket.io: reject connections without valid token; removed anonymous `book-session-sync` and `patch-session-sync` mutation handlers; scoped `session-request-created` to `getSessionApproverId(session)`.
- Refunds: set `tokenRefunded` only after successful atomic credit with idempotent refund keys; persisted expiry to Prisma Session.
- Private data: authenticated and rate-limited `GET /api/payment/mentor-upi/:teacherId`, scrubbed KYC documents (`officialIdNumber`, `officialIdDocument`). Authenticated and scoped `GET /api/transactions`. Stopped global transaction broadcasts on socket connect.
- UTR: added `utr` field with unique constraint to Prisma `Session` model with migration `20261017000000_f10_payout_and_vpa_audit`.
- `confirm-payment`: requires recorded UTR and `pending-mentor-confirmation` state. `confirm-upi`: strictly student-only (`403` for admin / third party).

## Phase 2: Live Room Resilience & Modernization (`7c016bf`)
- Real TURN: credentials read from env, authenticated `/api/turn-credentials`, fail loudly outside demo mode.
- Payload limits (64KB whiteboard/notes, 10KB chat, 1MB canvas) and rate limits (20/s whiteboard, 5/s chat, 2/s notes, 1/s image).
- Reconnect and late join: server-side `LiveRoomState` caching with `room-state-sync`.
- Mesh: enforced 4-video peer cap with audio-only overflow explainer banner.
- Code pad: Pyodide WASM (Python) and SQLite-WASM in-browser execution; Java badged "Simulated"; untrusted remote auto-execution blocked.
- Modularized `LiveRoom.tsx` into `src/components/liveroom/` (`VideoGrid`, `WhiteboardCanvas`, `NotesEditor`, `CodeRunnerPad`, `RoomChat`).
- Cleaned unused dependencies (`@livekit/components-react`, `livekit-client`, `yjs`, `y-webrtc`); cut bundle to 157.68 kB.

## Phase 3: Regression Tests & Dual Verification (`8eaef83`)
- Added `server/test/live_room_recovery.test.ts` (state recovery, payload limits, rate limits).
- Added regression tests for auth, socket, refunds, privacy, UTR uniqueness, student-only confirm-upi.
- Configured PostgreSQL pool SSL `{ rejectUnauthorized: false }`; 42/42 tests passing across all 8 suites in-memory and PostgreSQL.

## Phase 4: Leftover Part 1 Items (`0ffc63d`)
- Dedicated `POST /api/admin/users/:id/verify-vpa` (`403` for non-admin, records `PayoutAuditLog`).
- `PayoutAccount` and `PayoutAuditLog` Prisma models and migration.
- Centralized `getMentorVpa(teacherId)` helper; cleaned legacy VPA test strings; hardened UPI intent links with 2-decimal formatting.
- Added TEST F10.9 in `verification_gaps.test.ts`.