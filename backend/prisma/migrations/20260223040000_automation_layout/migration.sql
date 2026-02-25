-- AlterTable: add layout column to AutomationRule (canvas visual positions)
ALTER TABLE "AutomationRule" ADD COLUMN "layout" JSONB;
