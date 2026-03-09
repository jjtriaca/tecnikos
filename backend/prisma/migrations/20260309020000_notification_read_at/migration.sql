-- AlterTable: Add readAt field to Notification
ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_companyId_readAt_idx" ON "Notification"("companyId", "readAt");
