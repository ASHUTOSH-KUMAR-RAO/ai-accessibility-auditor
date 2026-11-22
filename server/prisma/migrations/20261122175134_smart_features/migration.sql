-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "host" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tabOrder" JSONB;

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "hideScreenshot" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportPdf" (
    "scanId" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportPdf_pkey" PRIMARY KEY ("scanId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_tokenHash_key" ON "ShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareLink_scanId_idx" ON "ShareLink"("scanId");

-- CreateIndex
CREATE INDEX "Scan_userId_host_createdAt_idx" ON "Scan"("userId", "host", "createdAt");

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPdf" ADD CONSTRAINT "ReportPdf_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: hostname of existing scans (everything between "://" and the next "/")
UPDATE "Scan" SET "host" = split_part(split_part("normalizedUrl", '://', 2), '/', 1) WHERE "host" = '';
