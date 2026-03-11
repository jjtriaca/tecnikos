-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "chatIAMonthlyMsgs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "chatIAMonthReset" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "onboardingDismissed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatIAConversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "isOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatIAConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatIAMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "actionButtons" JSONB,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatIAMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatIAConversation_companyId_idx" ON "ChatIAConversation"("companyId");
CREATE INDEX IF NOT EXISTS "ChatIAConversation_userId_idx" ON "ChatIAConversation"("userId");
CREATE INDEX IF NOT EXISTS "ChatIAConversation_createdAt_idx" ON "ChatIAConversation"("createdAt");

CREATE INDEX IF NOT EXISTS "ChatIAMessage_conversationId_idx" ON "ChatIAMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "ChatIAMessage_createdAt_idx" ON "ChatIAMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "ChatIAConversation" ADD CONSTRAINT "ChatIAConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatIAConversation" ADD CONSTRAINT "ChatIAConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatIAMessage" ADD CONSTRAINT "ChatIAMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatIAConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
