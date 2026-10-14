# Patterns & Conventions

- **Auth & JWT**: Client stores JWT token in `localStorage['mindroot_auth_token']`. `getHeaders()` attaches `Authorization: Bearer <token>`. Fail-closed cryptographic HMAC token verification with revocation tracking is managed in `server/src/lib/tokenService.ts`.
- **Validation**: Backend uses Zod schemas and explicit guard validation. Numeric DB fields (e.g. `hourlyRate Int`) must be rounded before Prisma writes (`Math.round()`) to prevent runtime schema crashes on decimals.
- **Dual Persistence**: Every mutation updates both Prisma (when active) and `inMemory*` stores, calls `saveDb()`, and broadcasts changes over `io.emit(...)`.
- **Account Deletion**: User account deletion requires cascading removal of child foreign key records (`userSkill`, `message`, `review`, `transaction`, `session`, `tokens`) before deleting the parent `User` record to avoid relational DB foreign key violations (`P2003`).
- **Confirmation Modals**: Destructive operations like account deletion require interactive modal confirmation before triggering API requests.
- **Server-Authoritative Pricing & Transactions**: Never accept amounts, balances, or payee identifiers from client payloads. Always resolve monetary values and transaction participants strictly from validated server session records.
- **Escrow Token Lifecycle**: Tokens are debited and placed into escrow immediately upon booking request. They are released to the mentor upon completion, or atomically refunded to the student balance if declined or cancelled.
- **Contextual Session Role Authorization**: Never rely solely on a user's static profile role (`student` / `teacher`). Determine permissions dynamically in room contexts via `resolveSessionRole(session, userId)` to enforce host boundaries.
- **Targeted Socket Scoping**: Direct private and workflow-specific events (e.g., booking requests, status updates) exclusively to the specific user's socket room (`io.to('user:' + userId)`), preventing broadcast leakage.
- **Graceful Process & Test Teardown**: In all integration and concurrency test suites, terminate HTTP servers cleanly using `closeAllConnections()`, await server termination, safely disconnect Prisma (`prisma.$disconnect()`), and configure background interval timers with `.unref()`.
