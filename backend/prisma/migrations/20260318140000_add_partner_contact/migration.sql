-- CreateTable
CREATE TABLE "PartnerContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerContact_companyId_partnerId_type_idx" ON "PartnerContact"("companyId", "partnerId", "type");

-- Seed: migrate existing email and phone from Partner to PartnerContact
INSERT INTO "PartnerContact" ("id", "companyId", "partnerId", "type", "value", "label", "active", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "companyId",
    "id",
    'EMAIL',
    "email",
    'Principal',
    true,
    NOW(),
    NOW()
FROM "Partner"
WHERE "email" IS NOT NULL AND "email" != '' AND "deletedAt" IS NULL;

INSERT INTO "PartnerContact" ("id", "companyId", "partnerId", "type", "value", "label", "active", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "companyId",
    "id",
    'WHATSAPP',
    "phone",
    'Principal',
    true,
    NOW(),
    NOW()
FROM "Partner"
WHERE "phone" IS NOT NULL AND "phone" != '' AND "deletedAt" IS NULL;
