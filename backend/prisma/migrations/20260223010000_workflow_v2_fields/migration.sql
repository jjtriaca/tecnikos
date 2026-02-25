-- AlterTable: Add V2 fields to WorkflowStepLog
ALTER TABLE "WorkflowStepLog" ADD COLUMN "blockId" TEXT;
ALTER TABLE "WorkflowStepLog" ADD COLUMN "responseData" JSONB;

-- CreateIndex
CREATE INDEX "WorkflowStepLog_serviceOrderId_blockId_idx" ON "WorkflowStepLog"("serviceOrderId", "blockId");
