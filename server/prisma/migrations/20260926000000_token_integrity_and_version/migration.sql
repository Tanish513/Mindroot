-- AlterTable User: add version column for optimistic concurrency control
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Transaction: add balanceBefore and balanceAfter audit trail columns
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "balanceBefore" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "balanceAfter" INTEGER;

-- Add database-level CHECK constraint to enforce non-negative token balances
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_token_balance_non_negative'
    ) THEN
        ALTER TABLE "User" ADD CONSTRAINT "user_token_balance_non_negative" CHECK ("tokenBalance" >= 0);
    END IF;
END $$;
