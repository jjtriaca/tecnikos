-- AddOnPurchase: index on expiresAt for efficient cron lookups
CREATE INDEX IF NOT EXISTS "AddOnPurchase_expiresAt_idx" ON "AddOnPurchase"("expiresAt");
