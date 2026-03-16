-- Add dispatch tracking fields to Notification
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "whatsappMessageId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "errorDetail" TEXT;
