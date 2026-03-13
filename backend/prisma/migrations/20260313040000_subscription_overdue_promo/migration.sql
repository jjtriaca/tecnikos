-- AlterTable: Add overdue tracking and promo value fields to Subscription
ALTER TABLE "Subscription" ADD COLUMN "overdueAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "originalValueCents" INTEGER;

-- CreateIndex
CREATE INDEX "Subscription_overdueAt_idx" ON "Subscription"("overdueAt");
