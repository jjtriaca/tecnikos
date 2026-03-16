-- Add PENDING to SubscriptionStatus enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'ACTIVE';
