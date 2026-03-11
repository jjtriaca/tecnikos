-- AlterTable
ALTER TABLE "Session" ADD COLUMN "deviceName" TEXT;
ALTER TABLE "Session" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
