-- AddOn: add multi-type quantity fields
ALTER TABLE "AddOn" ADD COLUMN IF NOT EXISTS "userQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AddOn" ADD COLUMN IF NOT EXISTS "technicianQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AddOn" ADD COLUMN IF NOT EXISTS "aiMessageQuantity" INTEGER NOT NULL DEFAULT 0;

-- AddOnPurchase: add multi-type quantity fields + period tracking
ALTER TABLE "AddOnPurchase" ADD COLUMN IF NOT EXISTS "userQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AddOnPurchase" ADD COLUMN IF NOT EXISTS "technicianQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AddOnPurchase" ADD COLUMN IF NOT EXISTS "aiMessageQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AddOnPurchase" ADD COLUMN IF NOT EXISTS "periodMonth" TEXT;
ALTER TABLE "AddOnPurchase" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- Default osQuantity to 0 for existing records that might have NULL
ALTER TABLE "AddOnPurchase" ALTER COLUMN "osQuantity" SET DEFAULT 0;

-- Index for fast lookup of add-ons by period
CREATE INDEX IF NOT EXISTS "AddOnPurchase_periodMonth_idx" ON "AddOnPurchase"("periodMonth");
