-- AlterTable: Add workflowTemplateId to ServiceOrder
ALTER TABLE "ServiceOrder" ADD COLUMN "workflowTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: WorkflowStepLog
CREATE TABLE "WorkflowStepLog" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowStepLog_serviceOrderId_idx" ON "WorkflowStepLog"("serviceOrderId");

-- CreateIndex (unique per OS+step)
CREATE UNIQUE INDEX "WorkflowStepLog_serviceOrderId_stepOrder_key" ON "WorkflowStepLog"("serviceOrderId", "stepOrder");

-- AddForeignKey
ALTER TABLE "WorkflowStepLog" ADD CONSTRAINT "WorkflowStepLog_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
