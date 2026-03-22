-- AlterTable: Add blockId to Attachment for associating photos with specific workflow blocks
ALTER TABLE "Attachment" ADD COLUMN "blockId" TEXT;

-- CreateIndex: Composite index for efficient photo counting per block
CREATE INDEX "Attachment_serviceOrderId_blockId_idx" ON "Attachment"("serviceOrderId", "blockId");
