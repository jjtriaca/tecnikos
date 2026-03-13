-- ============================================================================
-- DATA MIGRATION v2: Move SLS operational data from public → tenant_sls
-- ============================================================================
-- Fixed for PostgreSQL enum type casting between schemas
-- ============================================================================

BEGIN;

-- ── Safety: Disable FK triggers temporarily ──────────────────────────
SET session_replication_role = replica;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 0: Create cross-schema enum casts (needed for INSERT...SELECT)
-- ══════════════════════════════════════════════════════════════════════
-- PostgreSQL enum types are schema-qualified, so we need explicit casts.
-- We'll use a function-based approach for the enum columns.

-- ══════════════════════════════════════════════════════════════════════
-- STEP 1: Delete placeholder data in tenant_sls
-- ══════════════════════════════════════════════════════════════════════
DELETE FROM tenant_sls."CodeCounter";
DELETE FROM tenant_sls."User";
DELETE FROM tenant_sls."Company";

-- ══════════════════════════════════════════════════════════════════════
-- STEP 2: Copy ALL operational data from public → tenant_sls
-- Tables WITHOUT enum columns use simple INSERT...SELECT
-- Tables WITH enum columns use explicit casting via text
-- ══════════════════════════════════════════════════════════════════════

-- ── Core entities ────────────────────────────────────────────────────
INSERT INTO tenant_sls."Company" SELECT * FROM public."Company";

-- User: has roles UserRole[] enum array — needs casting
INSERT INTO tenant_sls."User"
SELECT id, "companyId", name, email, "passwordHash", "mfaEnabled",
       "createdAt", "updatedAt", "deletedAt",
       (SELECT array_agg(r::text::tenant_sls."UserRole") FROM unnest(roles) r)::tenant_sls."UserRole"[],
       code, "passwordResetToken", "passwordResetExpiresAt",
       "invitedAt", "passwordSetAt"
FROM public."User";

INSERT INTO tenant_sls."Specialization" SELECT * FROM public."Specialization";
INSERT INTO tenant_sls."Partner" SELECT * FROM public."Partner";
INSERT INTO tenant_sls."PartnerSpecialization" SELECT * FROM public."PartnerSpecialization";
INSERT INTO tenant_sls."Product" SELECT * FROM public."Product";
INSERT INTO tenant_sls."ProductEquivalent" SELECT * FROM public."ProductEquivalent";

-- ── Workflow ─────────────────────────────────────────────────────────
INSERT INTO tenant_sls."WorkflowTemplate" SELECT * FROM public."WorkflowTemplate";
INSERT INTO tenant_sls."WorkflowStepLog" SELECT * FROM public."WorkflowStepLog";

-- ── Automation ───────────────────────────────────────────────────────
INSERT INTO tenant_sls."AutomationTemplate" SELECT * FROM public."AutomationTemplate";
INSERT INTO tenant_sls."AutomationRule" SELECT * FROM public."AutomationRule";
INSERT INTO tenant_sls."AutomationExecution" SELECT * FROM public."AutomationExecution";

-- ── Service Orders: has status enum ──────────────────────────────────
INSERT INTO tenant_sls."ServiceAddress" SELECT * FROM public."ServiceAddress";

-- ServiceOrder: status is ServiceOrderStatus enum
INSERT INTO tenant_sls."ServiceOrder"
SELECT id, "companyId", "partnerId", "assignedPartnerId", "customerId",
       description, "scheduledDate", "scheduledTime", "scheduledEndTime",
       status::text::tenant_sls."ServiceOrderStatus",
       priority, "workflowTemplateId", "currentStepName", "currentStepOrder",
       "completedAt", "cancelledAt", "cancelReason",
       "commissionBps", "commissionOverrideEnabled",
       "createdAt", "updatedAt", "deletedAt",
       code, "totalValueCents", notes,
       "requiredSpecializationIds", "directedTechnicianIds",
       "customerName", "customerPhone", "customerDoc",
       "addressStreet", "addressNumber", "addressComp", "addressNeighborhood",
       "addressCity", "addressState", "addressCep",
       "latitude", "longitude", "createdById"
FROM public."ServiceOrder";

INSERT INTO tenant_sls."ServiceOrderEvent" SELECT * FROM public."ServiceOrderEvent";
INSERT INTO tenant_sls."ServiceOrderOffer" SELECT * FROM public."ServiceOrderOffer";
INSERT INTO tenant_sls."ServiceOrderLedger" SELECT * FROM public."ServiceOrderLedger";

-- PendingWorkflowWait: status is WaitStatus enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."PendingWorkflowWait" LIMIT 1) THEN
    INSERT INTO tenant_sls."PendingWorkflowWait"
    SELECT id, "serviceOrderId", "stepName", "waitType", "waitDuration",
           status::text::tenant_sls."WaitStatus",
           "scheduledAt", "resolvedAt", "createdAt", "updatedAt"
    FROM public."PendingWorkflowWait";
  END IF;
END $$;

INSERT INTO tenant_sls."ExecutionPause" SELECT * FROM public."ExecutionPause";

-- ── Financial ────────────────────────────────────────────────────────
INSERT INTO tenant_sls."FinancialAccount" SELECT * FROM public."FinancialAccount";
INSERT INTO tenant_sls."PaymentMethod" SELECT * FROM public."PaymentMethod";
INSERT INTO tenant_sls."PaymentInstrument" SELECT * FROM public."PaymentInstrument";

-- CashAccount: has 3 enum columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."CashAccount" LIMIT 1) THEN
    INSERT INTO tenant_sls."CashAccount"
    SELECT id, "companyId", name,
           type::text::tenant_sls."CashAccountType",
           "bankCode", "bankName", "agency", "accountNumber",
           CASE WHEN "accountType" IS NOT NULL THEN "accountType"::text::tenant_sls."BankAccountType" ELSE NULL END,
           CASE WHEN "pixKeyType" IS NOT NULL THEN "pixKeyType"::text::tenant_sls."PixKeyType" ELSE NULL END,
           "pixKey", "isDefault", "initialBalance", "currentBalance",
           "createdAt", "updatedAt"
    FROM public."CashAccount";
  END IF;
END $$;

-- FinancialEntry: type and status are enums
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."FinancialEntry" LIMIT 1) THEN
    INSERT INTO tenant_sls."FinancialEntry"
    SELECT id, "companyId", "serviceOrderId",
           type::text::tenant_sls."FinancialEntryType",
           status::text::tenant_sls."FinancialEntryStatus",
           description, "amountCents", "dueDate", "paidAt",
           "partnerId", "customerId",
           "paymentMethodId", "cashAccountId",
           "createdAt", "updatedAt", "deletedAt",
           code, "nfseEmissionId",
           "nfseStatus", "financialAccountId",
           "cardSettlementId"
    FROM public."FinancialEntry";
  END IF;
END $$;

-- FinancialInstallment: status is enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."FinancialInstallment" LIMIT 1) THEN
    INSERT INTO tenant_sls."FinancialInstallment"
    SELECT id, "financialEntryId", "installmentNumber", "amountCents", "dueDate",
           status::text::tenant_sls."InstallmentStatus",
           "paidAt", "paidAmountCents",
           "paymentMethodId", "cashAccountId",
           "createdAt", "updatedAt"
    FROM public."FinancialInstallment";
  END IF;
END $$;

INSERT INTO tenant_sls."CardFeeRate" SELECT * FROM public."CardFeeRate";
INSERT INTO tenant_sls."CardSettlement" SELECT * FROM public."CardSettlement";
INSERT INTO tenant_sls."CollectionRule" SELECT * FROM public."CollectionRule";
INSERT INTO tenant_sls."CollectionExecution" SELECT * FROM public."CollectionExecution";
INSERT INTO tenant_sls."BankStatementImport" SELECT * FROM public."BankStatementImport";

-- BankStatementLine: status is enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."BankStatementLine" LIMIT 1) THEN
    INSERT INTO tenant_sls."BankStatementLine"
    SELECT id, "importId", "transactionDate", description, "amountCents",
           status::text::tenant_sls."StatementLineStatus",
           "matchedEntryId",
           "createdAt", "updatedAt"
    FROM public."BankStatementLine";
  END IF;
END $$;

INSERT INTO tenant_sls."AccountTransfer" SELECT * FROM public."AccountTransfer";

-- ── Integrations / Config ────────────────────────────────────────────
INSERT INTO tenant_sls."WhatsAppConfig" SELECT * FROM public."WhatsAppConfig";
INSERT INTO tenant_sls."WhatsAppMessage" SELECT * FROM public."WhatsAppMessage";
INSERT INTO tenant_sls."EmailConfig" SELECT * FROM public."EmailConfig";
INSERT INTO tenant_sls."SefazConfig" SELECT * FROM public."SefazConfig";
INSERT INTO tenant_sls."SefazDocument" SELECT * FROM public."SefazDocument";
INSERT INTO tenant_sls."NfseConfig" SELECT * FROM public."NfseConfig";
INSERT INTO tenant_sls."NfseEmission" SELECT * FROM public."NfseEmission";

-- ── NFe ──────────────────────────────────────────────────────────────
INSERT INTO tenant_sls."NfeImport" SELECT * FROM public."NfeImport";
INSERT INTO tenant_sls."NfeImportItem" SELECT * FROM public."NfeImportItem";

-- ── Communication ────────────────────────────────────────────────────
INSERT INTO tenant_sls."Notification" SELECT * FROM public."Notification";
INSERT INTO tenant_sls."ChatIAConversation" SELECT * FROM public."ChatIAConversation";
INSERT INTO tenant_sls."ChatIAMessage" SELECT * FROM public."ChatIAMessage";

-- ── Audit ─────────────────────────────────────────────────────────────
INSERT INTO tenant_sls."AuditLog" SELECT * FROM public."AuditLog";
INSERT INTO tenant_sls."Attachment" SELECT * FROM public."Attachment";

-- ── Technicians ──────────────────────────────────────────────────────
INSERT INTO tenant_sls."TechnicianContract" SELECT * FROM public."TechnicianContract";
INSERT INTO tenant_sls."TechnicianLocationLog" SELECT * FROM public."TechnicianLocationLog";
INSERT INTO tenant_sls."Evaluation" SELECT * FROM public."Evaluation";

-- ── Quotes: has enum columns ─────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."Quote" LIMIT 1) THEN
    INSERT INTO tenant_sls."Quote"
    SELECT id, "companyId", "serviceOrderId", "customerId", code,
           status::text::tenant_sls."QuoteStatus",
           "totalCents", "validUntil", notes,
           "sentAt", "approvedAt", "rejectedAt",
           "createdAt", "updatedAt", "deletedAt", "createdById"
    FROM public."Quote";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."QuoteItem" LIMIT 1) THEN
    INSERT INTO tenant_sls."QuoteItem"
    SELECT id, "quoteId",
           type::text::tenant_sls."QuoteItemType",
           description, "unitPrice", quantity, "totalCents",
           "productId",
           "createdAt", "updatedAt"
    FROM public."QuoteItem";
  END IF;
END $$;

INSERT INTO tenant_sls."QuoteAttachment" SELECT * FROM public."QuoteAttachment";

-- ── Fiscal ────────────────────────────────────────────────────────────
INSERT INTO tenant_sls."FiscalPeriod" SELECT * FROM public."FiscalPeriod";
INSERT INTO tenant_sls."NfseEntrada" SELECT * FROM public."NfseEntrada";
INSERT INTO tenant_sls."Service" SELECT * FROM public."Service";
INSERT INTO tenant_sls."Obra" SELECT * FROM public."Obra";

-- ── Code counters ────────────────────────────────────────────────────
INSERT INTO tenant_sls."CodeCounter" SELECT * FROM public."CodeCounter";

-- ── OTP / Session ────────────────────────────────────────────────────
INSERT INTO tenant_sls."OtpCode" SELECT * FROM public."OtpCode";
-- Sessions not migrated — users will re-login

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
  NULL,
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

-- Code counters
DELETE FROM public."CodeCounter";

-- Sessions
DELETE FROM public."Session";

-- Delete the OLD SLS Company from public
DELETE FROM public."Company" WHERE id = '00000000-0000-0000-0000-000000000002';

-- ══════════════════════════════════════════════════════════════════════
-- STEP 7: Re-enable FK triggers
-- ══════════════════════════════════════════════════════════════════════
SET session_replication_role = DEFAULT;

COMMIT;
