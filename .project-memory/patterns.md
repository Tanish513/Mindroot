# Patterns & Conventions

- **Auth & JWT**: Client stores JWT token in `localStorage['mindroot_auth_token']`. `getHeaders()` attaches `Authorization: Bearer <token>`.
- **Validation**: Backend uses Zod schemas and explicit guard validation. Numeric DB fields (e.g. `hourlyRate Int`) must be rounded before Prisma writes (`Math.round()`) to prevent runtime schema crashes on decimals.
- **Dual Persistence**: Every mutation updates both Prisma (when active) and `inMemory*` stores, calls `saveDb()`, and broadcasts changes over `io.emit(...)`.
- **Account Deletion**: User account deletion requires cascading removal of child foreign key records (`userSkill`, `message`, `review`, `transaction`, `session`, `tokens`) before deleting the parent `User` record to avoid relational DB foreign key violations (`P2003`).
- **Confirmation Modals**: Destructive operations like account deletion require interactive modal confirmation before triggering API requests.
