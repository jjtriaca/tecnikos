-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "commissionBps" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "ServiceOrderLedger" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderLedger_serviceOrderId_key" ON "ServiceOrderLedger"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "ServiceOrderLedger" ADD CONSTRAINT "ServiceOrderLedger_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
