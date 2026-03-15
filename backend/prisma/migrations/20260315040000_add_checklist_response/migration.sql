-- CreateEnum ChecklistClass
CREATE TYPE "ChecklistClass" AS ENUM ('TOOLS_PPE', 'MATERIALS', 'INITIAL_CHECK', 'FINAL_CHECK', 'CUSTOM');

-- CreateEnum ChecklistMode
CREATE TYPE "ChecklistMode" AS ENUM ('ITEM_BY_ITEM', 'FULL');

-- CreateTable ChecklistResponse
CREATE TABLE "ChecklistResponse" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "companyId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "checklistClass" "ChecklistClass" NOT NULL,
    "stage" TEXT NOT NULL,
    "mode" "ChecklistMode" NOT NULL DEFAULT 'ITEM_BY_ITEM',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "items" JSONB NOT NULL,
    "observation" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "technicianName" TEXT,
    "geolocation" JSONB,
    "deviceInfo" JSONB,
    "timeInStage" INTEGER,
    "skippedItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistResponse_serviceOrderId_idx" ON "ChecklistResponse"("serviceOrderId");
CREATE INDEX "ChecklistResponse_companyId_serviceOrderId_idx" ON "ChecklistResponse"("companyId", "serviceOrderId");
CREATE INDEX "ChecklistResponse_serviceOrderId_checklistClass_idx" ON "ChecklistResponse"("serviceOrderId", "checklistClass");

-- AddForeignKey
ALTER TABLE "ChecklistResponse" ADD CONSTRAINT "ChecklistResponse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistResponse" ADD CONSTRAINT "ChecklistResponse_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MigrateData: Service.checklists from [{name, items}] to {toolsPpe, materials, initialCheck, finalCheck}
UPDATE "Service"
SET "checklists" = jsonb_build_object(
    'toolsPpe', COALESCE("checklists"->0->'items', '[]'::jsonb),
    'materials', COALESCE("checklists"->1->'items', '[]'::jsonb),
    'initialCheck', COALESCE("checklists"->2->'items', '[]'::jsonb),
    'finalCheck', COALESCE("checklists"->3->'items', '[]'::jsonb)
)
WHERE "checklists" IS NOT NULL AND jsonb_typeof("checklists") = 'array';
