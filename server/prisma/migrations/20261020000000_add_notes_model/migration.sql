-- CreateTable
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'regular',
    "date" TEXT,
    "sessionId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "attachments" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "sharedWithUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_authorId_idx" ON "Note"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_sessionId_idx" ON "Note"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_tags_idx" ON "Note"("tags");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_authorId_date_idx" ON "Note"("authorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Note_authorId_date_key" ON "Note"("authorId", "date");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Note_authorId_fkey'
    ) THEN
        ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Note_sharedWithUserId_fkey'
    ) THEN
        ALTER TABLE "Note" ADD CONSTRAINT "Note_sharedWithUserId_fkey" FOREIGN KEY ("sharedWithUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Note_sessionId_fkey'
    ) THEN
        ALTER TABLE "Note" ADD CONSTRAINT "Note_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
