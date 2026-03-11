-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "osQuantity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOnPurchase" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "osQuantity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "asaasPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOnPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AddOnPurchase_subscriptionId_idx" ON "AddOnPurchase"("subscriptionId");

-- CreateIndex
CREATE INDEX "AddOnPurchase_status_idx" ON "AddOnPurchase"("status");

-- AddForeignKey
ALTER TABLE "AddOnPurchase" ADD CONSTRAINT "AddOnPurchase_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOnPurchase" ADD CONSTRAINT "AddOnPurchase_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
