-- CreateTable PayoutAccount
CREATE TABLE IF NOT EXISTS "PayoutAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountHolderName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "upiId" TEXT,
    "payoutMethod" TEXT NOT NULL DEFAULT 'upi',
    "upiQrImage" TEXT,
    "officialIdType" TEXT,
    "officialIdNumber" TEXT,
    "officialIdDocument" TEXT,
    "officialIdStatus" TEXT NOT NULL DEFAULT 'unverified',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "vpaVerified" BOOLEAN NOT NULL DEFAULT false,
    "vpaVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable PayoutAuditLog
CREATE TABLE IF NOT EXISTS "PayoutAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldMasked" TEXT,
    "newMasked" TEXT,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutAccount_userId_key" ON "PayoutAccount"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayoutAuditLog_userId_createdAt_idx" ON "PayoutAuditLog"("userId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PayoutAccount_userId_fkey'
    ) THEN
        ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PayoutAuditLog_userId_fkey'
    ) THEN
        ALTER TABLE "PayoutAuditLog" ADD CONSTRAINT "PayoutAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
