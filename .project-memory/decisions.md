# Architectural Decisions

- **DEC-001: Support Non-Negative (>= 0) Hourly Rates**:
  - Decision: Teachers can set rate to 0 (free sessions / volunteering / skill swaps) or positive integer values.
  - Reason: Mentors and students exchanging skills may offer free sessions; rejecting 0 or clamping at 50 blocked legitimate use cases.
- **DEC-002: Prisma Cascading Transaction for Account Deletion**:
  - Decision: Execute cascading child deletion in `prisma.$transaction` across `userSkill`, `message`, `review`, `transaction`, `session`, `emailVerificationToken`, `passwordResetToken` before `prisma.user.delete`.
  - Reason: `schema.prisma` does not have `onDelete: Cascade` on most user relations; deleting user without cleaning child rows throws `P2003` foreign key errors.
- **DEC-003: Self-Service Account Deletion with Admin Exemption**:
  - Decision: Both `/api/users/me` and `/api/users/:id` allowed with `requireAuth` as long as `req.userId === id || req.userRole === 'admin'`. Master `user-admin` account is protected from deletion.
