-- AlterTable
ALTER TABLE "CardSettlement" ADD COLUMN "cardFeeRateId" TEXT;

-- AddForeignKey
ALTER TABLE "CardSettlement" ADD CONSTRAINT "CardSettlement_cardFeeRateId_fkey" FOREIGN KEY ("cardFeeRateId") REFERENCES "CardFeeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
