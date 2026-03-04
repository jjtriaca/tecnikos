-- Add FISCAL to UserRole enum
ALTER TYPE "UserRole" ADD VALUE 'FISCAL';

-- Add roles array column
ALTER TABLE "User" ADD COLUMN "roles" "UserRole"[] NOT NULL DEFAULT '{}';

-- Populate from existing single role
UPDATE "User" SET "roles" = ARRAY["role"];

-- Drop old single role column
ALTER TABLE "User" DROP COLUMN "role";
