-- ============================================================================
-- DATA MIGRATION: Move SLS operational data from public → tenant_sls
-- ============================================================================
-- This script:
-- 1. Deletes placeholder data in tenant_sls (from onboarding)
-- 2. Copies ALL operational data from public to tenant_sls (preserving IDs)
-- 3. Creates an "Admin" Company in public for the platform admin
-- 4. Updates admin users' companyId to the new admin Company
-- 5. Sets Tenant.companyId for webhook resolution
-- 6. Cleans operational data from public schema
-- 7. Invalidates sessions (users re-login)
--
-- IMPORTANT: Run AFTER the Prisma migration (20260313200000_tenant_company_id)
-- ============================================================================

BEGIN;

-- ── Safety: Disable FK triggers temporarily ──────────────────────────
SET session_replication_role = replica;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 1: Delete placeholder data in tenant_sls
-- ══════════════════════════════════════════════════════════════════════
DELETE FROM tenant_sls."CodeCounter";
DELETE FROM tenant_sls."User";
DELETE FROM tenant_sls."Company";

-- ══════════════════════════════════════════════════════════════════════
-- STEP 2: Copy ALL operational data from public → tenant_sls
-- Order: parent tables first, then child tables (FK dependencies)
-- ══════════════════════════════════════════════════════════════════════

-- Core entities
INSERT INTO tenant_sls."Company" SELECT * FROM public."Company";
INSERT INTO tenant_sls."User" SELECT * FROM public."User";
INSERT INTO tenant_sls."Specialization" SELECT * FROM public."Specialization";
INSERT INTO tenant_sls."Partner" SELECT * FROM public."Partner";
INSERT INTO tenant_sls."PartnerSpecialization" SELECT * FROM public."PartnerSpecialization";
INSERT INTO tenant_sls."Product" SELECT * FROM public."Product";
INSERT INTO tenant_sls."ProductEquivalent" SELECT * FROM public."ProductEquivalent";

-- Workflow
INSERT INTO tenant_sls."WorkflowTemplate" SELECT * FROM public."WorkflowTemplate";
INSERT INTO tenant_sls."WorkflowStepLog" SELECT * FROM public."WorkflowStepLog";

-- Automation
INSERT INTO tenant_sls."AutomationTemplate" SELECT * FROM public."AutomationTemplate";
INSERT INTO tenant_sls."AutomationRule" SELECT * FROM public."AutomationRule";
INSERT INTO tenant_sls."AutomationExecution" SELECT * FROM public."AutomationExecution";

-- Service Orders
INSERT INTO tenant_sls."ServiceAddress" SELECT * FROM public."ServiceAddress";
INSERT INTO tenant_sls."ServiceOrder" SELECT * FROM public."ServiceOrder";
INSERT INTO tenant_sls."ServiceOrderEvent" SELECT * FROM public."ServiceOrderEvent";
INSERT INTO tenant_sls."ServiceOrderOffer" SELECT * FROM public."ServiceOrderOffer";
INSERT INTO tenant_sls."ServiceOrderLedger" SELECT * FROM public."ServiceOrderLedger";
INSERT INTO tenant_sls."PendingWorkflowWait" SELECT * FROM public."PendingWorkflowWait";
INSERT INTO tenant_sls."ExecutionPause" SELECT * FROM public."ExecutionPause";

-- Financial
INSERT INTO tenant_sls."FinancialAccount" SELECT * FROM public."FinancialAccount";
INSERT INTO tenant_sls."PaymentMethod" SELECT * FROM public."PaymentMethod";
INSERT INTO tenant_sls."PaymentInstrument" SELECT * FROM public."PaymentInstrument";
INSERT INTO tenant_sls."CashAccount" SELECT * FROM public."CashAccount";
INSERT INTO tenant_sls."FinancialEntry" SELECT * FROM public."FinancialEntry";
INSERT INTO tenant_sls."FinancialInstallment" SELECT * FROM public."FinancialInstallment";
INSERT INTO tenant_sls."CardFeeRate" SELECT * FROM public."CardFeeRate";
INSERT INTO tenant_sls."CardSettlement" SELECT * FROM public."CardSettlement";
INSERT INTO tenant_sls."CollectionRule" SELECT * FROM public."CollectionRule";
INSERT INTO tenant_sls."CollectionExecution" SELECT * FROM public."CollectionExecution";
INSERT INTO tenant_sls."BankStatementImport" SELECT * FROM public."BankStatementImport";
INSERT INTO tenant_sls."BankStatementLine" SELECT * FROM public."BankStatementLine";
INSERT INTO tenant_sls."AccountTransfer" SELECT * FROM public."AccountTransfer";

-- Integrations / Config
INSERT INTO tenant_sls."WhatsAppConfig" SELECT * FROM public."WhatsAppConfig";
INSERT INTO tenant_sls."WhatsAppMessage" SELECT * FROM public."WhatsAppMessage";
INSERT INTO tenant_sls."EmailConfig" SELECT * FROM public."EmailConfig";
INSERT INTO tenant_sls."SefazConfig" SELECT * FROM public."SefazConfig";
INSERT INTO tenant_sls."SefazDocument" SELECT * FROM public."SefazDocument";
INSERT INTO tenant_sls."NfseConfig" SELECT * FROM public."NfseConfig";
INSERT INTO tenant_sls."NfseEmission" SELECT * FROM public."NfseEmission";

-- NFe
INSERT INTO tenant_sls."NfeImport" SELECT * FROM public."NfeImport";
INSERT INTO tenant_sls."NfeImportItem" SELECT * FROM public."NfeImportItem";

-- Communication
INSERT INTO tenant_sls."Notification" SELECT * FROM public."Notification";
INSERT INTO tenant_sls."ChatIAConversation" SELECT * FROM public."ChatIAConversation";
INSERT INTO tenant_sls."ChatIAMessage" SELECT * FROM public."ChatIAMessage";

-- Audit
INSERT INTO tenant_sls."AuditLog" SELECT * FROM public."AuditLog";
INSERT INTO tenant_sls."Attachment" SELECT * FROM public."Attachment";

-- Technicians
INSERT INTO tenant_sls."TechnicianContract" SELECT * FROM public."TechnicianContract";
INSERT INTO tenant_sls."TechnicianLocationLog" SELECT * FROM public."TechnicianLocationLog";
INSERT INTO tenant_sls."Evaluation" SELECT * FROM public."Evaluation";

-- Quotes
INSERT INTO tenant_sls."Quote" SELECT * FROM public."Quote";
INSERT INTO tenant_sls."QuoteItem" SELECT * FROM public."QuoteItem";
INSERT INTO tenant_sls."QuoteAttachment" SELECT * FROM public."QuoteAttachment";

-- Fiscal
INSERT INTO tenant_sls."FiscalPeriod" SELECT * FROM public."FiscalPeriod";
INSERT INTO tenant_sls."NfseEntrada" SELECT * FROM public."NfseEntrada";
INSERT INTO tenant_sls."Service" SELECT * FROM public."Service";
INSERT INTO tenant_sls."Obra" SELECT * FROM public."Obra";

-- Code counters (critical: preserve sequence numbers)
INSERT INTO tenant_sls."CodeCounter" SELECT * FROM public."CodeCounter";

-- OTP codes
INSERT INTO tenant_sls."OtpCode" SELECT * FROM public."OtpCode";

-- ══════════════════════════════════════════════════════════════════════
-- STEP 3: Create Admin Company for platform admin
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO public."Company" (
  id, name, "tradeName", cnpj, phone, email, status,
  "evalGestorWeight", "evalClientWeight", "evalMinRating",
  "taxRegime", crt, "fiscalProfile", "commissionBps",
  "commissionOverrideEnabled", "fiscalEnabled",
  "maxOsPerMonth", "maxUsers",
  "chatIAMonthlyMsgs", "onboardingDismissed",
  "createdAt", "updatedAt"
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tecnikos Admin',
  'Tecnikos',
  NULL, -- Admin has no CNPJ
  NULL,
  'admin@tecnikos.com.br',
  'ATIVA',
  40, 60, 3.0,
  'SN', 1, 'A', 1000,
  false, false,
  0, 0,
  0, true,
  NOW(), NOW()
);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 4: Update admin users to point to new Admin Company
-- ══════════════════════════════════════════════════════════════════════
UPDATE public."User"
SET "companyId" = '00000000-0000-0000-0000-000000000001'
WHERE email IN ('jjtriaca@gmail.com', 'maritriaca@hotmail.com');

-- ══════════════════════════════════════════════════════════════════════
-- STEP 5: Set Tenant.companyId for webhook resolution
-- ══════════════════════════════════════════════════════════════════════
UPDATE public."Tenant"
SET "companyId" = '00000000-0000-0000-0000-000000000002'
WHERE slug = 'sls';

-- ══════════════════════════════════════════════════════════════════════
-- STEP 6: Delete operational data from public schema
-- (reverse FK dependency order)
-- ══════════════════════════════════════════════════════════════════════

-- OTP
DELETE FROM public."OtpCode";

-- Quotes
DELETE FROM public."QuoteAttachment";
DELETE FROM public."QuoteItem";
DELETE FROM public."Quote";

-- Fiscal
DELETE FROM public."NfseEntrada";
DELETE FROM public."Service";
DELETE FROM public."FiscalPeriod";
DELETE FROM public."Obra";

-- Technicians
DELETE FROM public."Evaluation";
DELETE FROM public."TechnicianLocationLog";
DELETE FROM public."TechnicianContract";

-- Audit
DELETE FROM public."Attachment";
DELETE FROM public."AuditLog";

-- Communication
DELETE FROM public."ChatIAMessage";
DELETE FROM public."ChatIAConversation";
DELETE FROM public."Notification";

-- NFe
DELETE FROM public."NfeImportItem";
DELETE FROM public."NfeImport";

-- NFS-e
DELETE FROM public."NfseEmission";
DELETE FROM public."NfseConfig";

-- Sefaz
DELETE FROM public."SefazDocument";
DELETE FROM public."SefazConfig";

-- Email/WhatsApp
DELETE FROM public."EmailConfig";
DELETE FROM public."WhatsAppMessage";
DELETE FROM public."WhatsAppConfig";

-- Financial
DELETE FROM public."AccountTransfer";
DELETE FROM public."BankStatementLine";
DELETE FROM public."BankStatementImport";
DELETE FROM public."CollectionExecution";
DELETE FROM public."CollectionRule";
DELETE FROM public."CardSettlement";
DELETE FROM public."CardFeeRate";
DELETE FROM public."FinancialInstallment";
DELETE FROM public."FinancialEntry";
DELETE FROM public."CashAccount";
DELETE FROM public."PaymentInstrument";
DELETE FROM public."PaymentMethod";
DELETE FROM public."FinancialAccount";

-- Service Orders
DELETE FROM public."ExecutionPause";
DELETE FROM public."PendingWorkflowWait";
DELETE FROM public."ServiceOrderLedger";
DELETE FROM public."ServiceOrderOffer";
DELETE FROM public."ServiceOrderEvent";
DELETE FROM public."ServiceOrder";
DELETE FROM public."ServiceAddress";

-- Automation
DELETE FROM public."AutomationExecution";
DELETE FROM public."AutomationRule";
DELETE FROM public."AutomationTemplate";

-- Workflow
DELETE FROM public."WorkflowStepLog";
DELETE FROM public."WorkflowTemplate";

-- Products
DELETE FROM public."ProductEquivalent";
DELETE FROM public."Product";

-- Partners/Specializations
DELETE FROM public."PartnerSpecialization";
DELETE FROM public."Partner";
DELETE FROM public."Specialization";

-- Code counters (clear operational counters from public)
DELETE FROM public."CodeCounter";

-- Sessions (invalidate all — users re-login)
DELETE FROM public."Session";

-- Delete the OLD SLS Company from public (admin users already point to new admin company)
DELETE FROM public."Company" WHERE id = '00000000-0000-0000-0000-000000000002';

-- ══════════════════════════════════════════════════════════════════════
-- STEP 7: Re-enable FK triggers
-- ══════════════════════════════════════════════════════════════════════
SET session_replication_role = DEFAULT;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after migration)
-- ══════════════════════════════════════════════════════════════════════
-- SELECT count(*) as partners FROM tenant_sls."Partner";          -- should be 2801
-- SELECT count(*) as orders FROM tenant_sls."ServiceOrder";       -- should be 5
-- SELECT count(*) as finance FROM tenant_sls."FinancialEntry";    -- should be 11
-- SELECT count(*) as users_tsl FROM tenant_sls."User";            -- should be 2
-- SELECT count(*) as users_pub FROM public."User";                -- should be 2
-- SELECT id, name FROM public."Company";                          -- should be Tecnikos Admin only
-- SELECT id, name FROM tenant_sls."Company";                      -- should be SLS OBRAS LTDA
-- SELECT slug, "companyId" FROM public."Tenant";                  -- sls → 00000000-...0002
