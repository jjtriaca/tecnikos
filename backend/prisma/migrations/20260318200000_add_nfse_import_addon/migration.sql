-- AddOn: nfseImportQuantity
ALTER TABLE "AddOn" ADD COLUMN IF NOT EXISTS "nfseImportQuantity" INTEGER NOT NULL DEFAULT 0;

-- AddOnPurchase: nfseImportQuantity
ALTER TABLE "AddOnPurchase" ADD COLUMN IF NOT EXISTS "nfseImportQuantity" INTEGER NOT NULL DEFAULT 0;
