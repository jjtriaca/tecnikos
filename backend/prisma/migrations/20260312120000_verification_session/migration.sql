-- CreateTable
CREATE TABLE "VerificationSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "cnpjCardUrl" TEXT,
    "docFrontUrl" TEXT,
    "docBackUrl" TEXT,
    "selfieFarUrl" TEXT,
    "selfieMediumUrl" TEXT,
    "selfieCloseUrl" TEXT,
    "uploadedCount" INTEGER NOT NULL DEFAULT 0,
    "uploadComplete" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationSession_token_key" ON "VerificationSession"("token");

-- CreateIndex
CREATE INDEX "VerificationSession_tenantId_idx" ON "VerificationSession"("tenantId");

-- CreateIndex
CREATE INDEX "VerificationSession_token_idx" ON "VerificationSession"("token");

-- AddForeignKey
ALTER TABLE "VerificationSession" ADD CONSTRAINT "VerificationSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
