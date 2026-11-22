-- CreateEnum
CREATE TYPE "AiVerification" AS ENUM ('VERIFIED', 'NOT_VERIFIED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "AiFix" (
    "id" UUID NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "fallback" BOOLEAN NOT NULL,
    "result" JSONB NOT NULL,
    "verification" "AiVerification" NOT NULL,
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFixFeedback" (
    "id" UUID NOT NULL,
    "aiFixId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFixFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSummary" (
    "scanId" UUID NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "fallback" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSummary_pkey" PRIMARY KEY ("scanId")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiFix_cacheKey_key" ON "AiFix"("cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiFixFeedback_aiFixId_userId_key" ON "AiFixFeedback"("aiFixId", "userId");

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiFixFeedback" ADD CONSTRAINT "AiFixFeedback_aiFixId_fkey" FOREIGN KEY ("aiFixId") REFERENCES "AiFix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFixFeedback" ADD CONSTRAINT "AiFixFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSummary" ADD CONSTRAINT "AiSummary_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
