-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hourlyRate" INTEGER NOT NULL DEFAULT 499;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "batchPricing" JSONB DEFAULT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT DEFAULT 'Passionate about peer-to-peer knowledge sharing and skill exchanges.';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT DEFAULT '';
