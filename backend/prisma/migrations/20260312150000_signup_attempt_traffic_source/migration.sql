-- AlterTable: add traffic source tracking fields
ALTER TABLE "SignupAttempt" ADD COLUMN "referrer" TEXT;
ALTER TABLE "SignupAttempt" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "SignupAttempt" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "SignupAttempt" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "SignupAttempt" ADD COLUMN "utmTerm" TEXT;
ALTER TABLE "SignupAttempt" ADD COLUMN "utmContent" TEXT;
ALTER TABLE "SignupAttempt" ADD COLUMN "landingPage" TEXT;
