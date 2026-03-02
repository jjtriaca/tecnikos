-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT,
    "remotePhone" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "caption" TEXT,
    "whatsappMsgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_whatsappMsgId_key" ON "WhatsAppMessage"("whatsappMsgId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_companyId_remotePhone_idx" ON "WhatsAppMessage"("companyId", "remotePhone");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_companyId_createdAt_idx" ON "WhatsAppMessage"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_partnerId_idx" ON "WhatsAppMessage"("partnerId");

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
