-- CreateTable
CREATE TABLE "SignupAttempt" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "slug" TEXT,
    "companyName" TEXT,
    "cnpj" TEXT,
    "responsibleName" TEXT,
    "responsibleEmail" TEXT,
    "responsiblePhone" TEXT,
    "planId" TEXT,
    "planName" TEXT,
    "billingCycle" TEXT,
    "cnpjData" JSONB,
    "verificationResult" JSONB,
    "rejectionReasons" TEXT[],
    "criticism" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "readAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignupAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "page" TEXT,
    "metadata" JSONB,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignupAttempt_status_idx" ON "SignupAttempt"("status");
CREATE INDEX "SignupAttempt_readAt_idx" ON "SignupAttempt"("readAt");
CREATE INDEX "SignupAttempt_createdAt_idx" ON "SignupAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "SaasEvent_event_idx" ON "SaasEvent"("event");
CREATE INDEX "SaasEvent_createdAt_idx" ON "SaasEvent"("createdAt");
CREATE INDEX "SaasEvent_sessionId_idx" ON "SaasEvent"("sessionId");
