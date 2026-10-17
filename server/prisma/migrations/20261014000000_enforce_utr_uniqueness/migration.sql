-- AlterTable Session: add utrNumber, utr, tokenRefunded, refundKey columns if not exists
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "utrNumber" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "utr" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "tokenRefunded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "refundKey" TEXT;

-- AlterTable Transaction: add utr column if not exists
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "utr" TEXT;

-- Pre-migration duplicate check: Ensure no duplicate non-null UTRs exist before creating unique constraints
DO $$
BEGIN
    -- Check duplicates on Transaction.utr
    IF EXISTS (
        SELECT "utr", COUNT(*)
        FROM "Transaction"
        WHERE "utr" IS NOT NULL
        GROUP BY "utr"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot create unique index: duplicate non-null UTR found in Transaction';
    END IF;

    -- Check duplicates on Session.utrNumber
    IF EXISTS (
        SELECT "utrNumber", COUNT(*)
        FROM "Session"
        WHERE "utrNumber" IS NOT NULL
        GROUP BY "utrNumber"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot create unique index: duplicate non-null utrNumber found in Session';
    END IF;

    -- Check duplicates on Session.utr
    IF EXISTS (
        SELECT "utr", COUNT(*)
        FROM "Session"
        WHERE "utr" IS NOT NULL
        GROUP BY "utr"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot create unique index: duplicate non-null utr found in Session';
    END IF;
END $$;

-- Create unique index on Transaction(utr) if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_utr_key" ON "Transaction"("utr");

-- Create unique index on Session(utrNumber) if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "Session_utrNumber_key" ON "Session"("utrNumber");

-- Create unique index on Session(utr) if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "Session_utr_key" ON "Session"("utr");
