-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "favicon" TEXT,
ADD COLUMN     "passedRules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "reviewItems" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "rules" JSONB;

-- CreateIndex
CREATE INDEX "Scan_userId_deletedAt_createdAt_idx" ON "Scan"("userId", "deletedAt", "createdAt");
