CREATE TABLE "WorkDay" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "totalWorkedMs" BIGINT NOT NULL DEFAULT 0,
    "totalPausedMs" BIGINT NOT NULL DEFAULT 0,
    "overtimeMs" BIGINT NOT NULL DEFAULT 0,
    "mealBreakTaken" BOOLEAN NOT NULL DEFAULT false,
    "osCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "WorkDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkDay_companyId_partnerId_date_key" ON "WorkDay"("companyId", "partnerId", "date");
CREATE INDEX "WorkDay_companyId_partnerId_idx" ON "WorkDay"("companyId", "partnerId");
CREATE INDEX "WorkDay_partnerId_date_idx" ON "WorkDay"("partnerId", "date");
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
