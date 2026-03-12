-- AlterTable
ALTER TABLE "SignupAttempt" ADD COLUMN "lastStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SignupAttempt" ADD COLUMN "lastError" TEXT;
ALTER TABLE "SignupAttempt" ADD COLUMN "completedAt" TIMESTAMP(3);
