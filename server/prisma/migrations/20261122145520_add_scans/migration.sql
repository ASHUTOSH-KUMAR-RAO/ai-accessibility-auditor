-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Viewport" AS ENUM ('DESKTOP', 'MOBILE');

-- CreateEnum
CREATE TYPE "Impact" AS ENUM ('CRITICAL', 'SERIOUS', 'MODERATE', 'MINOR');

-- CreateTable
CREATE TABLE "Scan" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT,
    "score" INTEGER,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "seriousCount" INTEGER NOT NULL DEFAULT 0,
    "moderateCount" INTEGER NOT NULL DEFAULT 0,
    "minorCount" INTEGER NOT NULL DEFAULT 0,
    "passesCount" INTEGER NOT NULL DEFAULT 0,
    "incompleteCount" INTEGER NOT NULL DEFAULT 0,
    "pageTitle" TEXT,
    "viewport" "Viewport" NOT NULL DEFAULT 'DESKTOP',
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "ruleId" TEXT NOT NULL,
    "impact" "Impact" NOT NULL,
    "wcagTags" TEXT[],
    "wcagCriteria" TEXT[],
    "help" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "helpUrl" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "failureSummary" TEXT NOT NULL,
    "boundingBox" JSONB,
    "occurrenceIndex" INTEGER NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanScreenshot" (
    "scanId" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,

    CONSTRAINT "ScanScreenshot_pkey" PRIMARY KEY ("scanId")
);

-- CreateIndex
CREATE INDEX "Scan_userId_createdAt_idx" ON "Scan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_status_createdAt_idx" ON "Scan"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Issue_scanId_impact_idx" ON "Issue"("scanId", "impact");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanScreenshot" ADD CONSTRAINT "ScanScreenshot_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
