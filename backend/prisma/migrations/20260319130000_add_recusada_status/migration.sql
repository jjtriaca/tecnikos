-- Add RECUSADA to ServiceOrderStatus enum
ALTER TYPE "ServiceOrderStatus" ADD VALUE IF NOT EXISTS 'RECUSADA';
