import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getTenantSchema } from '../tenant/tenant-context';

/**
 * Models that live ONLY in the public schema (SaaS infrastructure).
 * These are NEVER redirected to tenant schemas.
 */
const PUBLIC_ONLY_MODELS = new Set([
  'tenant',
  'verificationSession',
  'plan',
  'subscription',
  'promotion',
  'addOn',
  'addOnPurchase',
  'saasInvoice',
  'saasInvoiceConfig',
  'signupAttempt',
  'saasEvent',
]);

/**
 * All Prisma model delegate names that should be redirected to the tenant
 * schema when a tenant context is active. Any model NOT in PUBLIC_ONLY_MODELS.
 */
const TENANT_MODEL_DELEGATES = new Set([
  'company', 'user', 'session', 'partner', 'serviceOrder',
  'serviceOrderOffer', 'serviceOrderEvent', 'otpCode',
  'workflowTemplate', 'workflowStepLog', 'serviceOrderLedger',
  'attachment', 'notification', 'specialization', 'partnerSpecialization',
  'evaluation', 'automationRule', 'automationExecution', 'automationTemplate',
  'financialEntry', 'financialInstallment', 'collectionRule', 'collectionExecution',
  'product', 'productEquivalent', 'nfeImport', 'nfeImportItem',
  'sefazConfig', 'sefazDocument', 'pendingWorkflowWait', 'auditLog',
  'executionPause', 'technicianLocationLog', 'whatsAppConfig', 'whatsAppMessage',
  'paymentMethod', 'paymentInstrument', 'cashAccount', 'accountTransfer',
  'bankStatementImport', 'bankStatementLine', 'nfseConfig', 'nfseEmission',
  'obra', 'serviceAddress', 'cardSettlement', 'cardFeeRate', 'financialAccount',
  'nfseEntrada', 'service', 'fiscalPeriod', 'emailConfig', 'technicianContract',
  'codeCounter', 'chatIAConversation', 'chatIAMessage', 'quote', 'quoteItem',
  'quoteAttachment', 'checklistResponse',
]);

/**
 * PrismaClient methods that should be redirected to the tenant client
 * when in tenant context (raw queries and transactions operate on tenant data).
 */
const REDIRECTED_METHODS = new Set([
  '$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe', '$transaction',
]);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly _tenantClients = new Map<string, PrismaClient>();

  constructor() {
    super();

    // Return a Proxy that transparently routes model delegate access
    // and raw queries to the correct tenant PrismaClient based on
    // the AsyncLocalStorage tenant context set by TenantMiddleware.
    //
    // During module init (no tenant context), all queries go to public schema.
    // During HTTP requests with a tenant subdomain, queries are routed
    // to the tenant-specific PrismaClient (e.g., ?schema=tenant_sls).
    //
    // Public-only models (Tenant, Plan, Subscription, etc.) are NEVER redirected.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return new Proxy(this, {
      get(target: PrismaService, prop: string | symbol, receiver: any): any {
        if (typeof prop === 'string') {
          const schema = getTenantSchema();
          if (schema) {
            // Redirect tenant model delegates to tenant client
            if (TENANT_MODEL_DELEGATES.has(prop)) {
              const client = self._getTenantClient(schema);
              return (client as any)[prop];
            }
            // Redirect raw query / transaction methods to tenant client
            if (REDIRECTED_METHODS.has(prop)) {
              const client = self._getTenantClient(schema);
              const method = (client as any)[prop];
              return typeof method === 'function' ? method.bind(client) : method;
            }
          }
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  /**
   * Get or create a PrismaClient for a tenant schema.
   * Cached for the lifetime of the application.
   */
  _getTenantClient(schemaName: string): PrismaClient {
    let client = this._tenantClients.get(schemaName);
    if (client) return client;

    const baseUrl = process.env.DATABASE_URL || '';
    const tenantUrl = baseUrl.includes('?schema=')
      ? baseUrl.replace(/\?schema=[^&]+/, `?schema=${schemaName}`)
      : `${baseUrl}?schema=${schemaName}`;

    client = new PrismaClient({
      datasources: { db: { url: tenantUrl } },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    client.$connect().catch((err) => {
      this.logger.error(`Failed to connect tenant "${schemaName}": ${err.message}`);
    });

    this._tenantClients.set(schemaName, client);
    this.logger.log(`Created tenant PrismaClient for "${schemaName}" (total: ${this._tenantClients.size})`);
    return client;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.ensureCompanyColumns();
    await this.ensurePartnerColumns();
    await this.ensureServiceOrderColumns();
    await this.ensureLocationLogTable();
    await this.ensureExecutionPauseTable();
    await this.ensureNfseEmissionTables();
    await this.ensureCardSettlementTable();
    await this.ensureFinancialAccountTable();
    await this.ensureServiceTable();
    await this.ensureCardFeeRateTable();
    await this.ensureSefazManifestColumns();
    await this.ensureProductFinalidadeColumn();
    await this.ensureNfeImportItemSnapshots();
    await this.ensureCodeColumns();
    await this.fixOrphanImportedStatus();
    await this.ensureMultiTenantTables();
    await this.ensureChecklistResponseTable();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    // Disconnect all cached tenant PrismaClients
    for (const [name, client] of this._tenantClients) {
      try {
        await client.$disconnect();
      } catch (err) {
        this.logger.warn(`Error disconnecting tenant "${name}": ${(err as Error).message}`);
      }
    }
    this._tenantClients.clear();
    this.logger.log('All tenant connections closed');
  }

  /** Ensure Brazilian company columns exist (self-healing migration) */
  private async ensureCompanyColumns(): Promise<void> {
    const columns = [
      { name: 'tradeName', type: 'TEXT' },
      { name: 'cnpj', type: 'TEXT' },
      { name: 'ie', type: 'TEXT' },
      { name: 'im', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'cep', type: 'TEXT' },
      { name: 'addressStreet', type: 'TEXT' },
      { name: 'addressNumber', type: 'TEXT' },
      { name: 'addressComp', type: 'TEXT' },
      { name: 'neighborhood', type: 'TEXT' },
      { name: 'city', type: 'TEXT' },
      { name: 'state', type: 'TEXT' },
      { name: 'ownerName', type: 'TEXT' },
      { name: 'ownerCpf', type: 'TEXT' },
      { name: 'ownerPhone', type: 'TEXT' },
      { name: 'ownerEmail', type: 'TEXT' },
      // v2.00.00 — Configurações de Avaliação
      { name: 'evalGestorWeight', type: 'INTEGER', defaultVal: '40' },
      { name: 'evalClientWeight', type: 'INTEGER', defaultVal: '60' },
      { name: 'evalMinRating', type: 'DOUBLE PRECISION', defaultVal: '3.0' },
    ];

    try {
      const existing: { column_name: string }[] = await this.$queryRaw`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'Company'
      `;
      const existingNames = new Set(existing.map((c) => c.column_name));

      for (const col of columns) {
        if (!existingNames.has(col.name)) {
          const defaultClause = (col as any).defaultVal
            ? ` DEFAULT ${(col as any).defaultVal}`
            : '';
          await this.$executeRawUnsafe(
            `ALTER TABLE "Company" ADD COLUMN "${col.name}" ${col.type}${defaultClause}`,
          );
          this.logger.log(`Added column Company.${col.name}`);
        }
      }

      // Ensure CNPJ unique index
      if (!existingNames.has('cnpj')) {
        try {
          await this.$executeRawUnsafe(
            `CREATE UNIQUE INDEX IF NOT EXISTS "Company_cnpj_key" ON "Company"("cnpj")`,
          );
        } catch { /* index may already exist */ }
      }
    } catch (err) {
      this.logger.warn('Auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure Partner table has passwordHash and rating columns (self-healing migration) */
  private async ensurePartnerColumns(): Promise<void> {
    const columns = [
      { name: 'passwordHash', type: 'TEXT' },
      { name: 'rating', type: 'DOUBLE PRECISION', defaultVal: '5.0' },
    ];

    try {
      const existing: { column_name: string }[] = await this.$queryRaw`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'Partner'
      `;
      const existingNames = new Set(existing.map((c) => c.column_name));

      for (const col of columns) {
        if (!existingNames.has(col.name)) {
          const defaultClause = (col as any).defaultVal
            ? ` DEFAULT ${(col as any).defaultVal}`
            : '';
          await this.$executeRawUnsafe(
            `ALTER TABLE "Partner" ADD COLUMN "${col.name}" ${col.type}${defaultClause}`,
          );
          this.logger.log(`Added column Partner.${col.name}`);
        }
      }
    } catch (err) {
      this.logger.warn('Partner auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure ServiceOrder table has new columns (self-healing migration) */
  private async ensureServiceOrderColumns(): Promise<void> {
    const columns = [
      { name: 'estimatedArrivalMinutes', type: 'INTEGER' },
      { name: 'trackingStartedAt', type: 'TIMESTAMP' },
      { name: 'proximityEnteredAt', type: 'TIMESTAMP' },
      { name: 'proximityRadiusMeters', type: 'INTEGER' },
      // v1.00.42 — Sistema de Pausas
      { name: 'isPaused', type: 'BOOLEAN', defaultVal: 'false' },
      { name: 'pausedAt', type: 'TIMESTAMP' },
      { name: 'pauseCount', type: 'INTEGER', defaultVal: '0' },
      { name: 'totalPausedMs', type: 'BIGINT', defaultVal: '0' },
    ];

    try {
      const existing: { column_name: string }[] = await this.$queryRaw`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'ServiceOrder'
      `;
      const existingNames = new Set(existing.map((c) => c.column_name));

      for (const col of columns) {
        if (!existingNames.has(col.name)) {
          await this.$executeRawUnsafe(
            `ALTER TABLE "ServiceOrder" ADD COLUMN "${col.name}" ${col.type}`,
          );
          this.logger.log(`Added column ServiceOrder.${col.name}`);
        }
      }
    } catch (err) {
      this.logger.warn('ServiceOrder auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure ExecutionPause table exists (self-healing migration v1.00.42) */
  private async ensureExecutionPauseTable(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ExecutionPause" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "serviceOrderId" TEXT NOT NULL,
          "partnerId" TEXT NOT NULL,
          "reasonCategory" TEXT NOT NULL,
          "reason" TEXT,
          "pausedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "resumedAt" TIMESTAMP(3),
          "durationMs" BIGINT,
          "pausePhotos" JSONB,
          "resumePhotos" JSONB,
          CONSTRAINT "ExecutionPause_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExecutionPause_serviceOrderId_idx" ON "ExecutionPause"("serviceOrderId")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExecutionPause_companyId_serviceOrderId_idx" ON "ExecutionPause"("companyId", "serviceOrderId")`);
    } catch (err) {
      this.logger.warn('ExecutionPause auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure TechnicianLocationLog table exists (self-healing migration v1.00.40) */
  private async ensureLocationLogTable(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TechnicianLocationLog" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "serviceOrderId" TEXT NOT NULL,
          "partnerId" TEXT NOT NULL,
          "lat" DOUBLE PRECISION NOT NULL,
          "lng" DOUBLE PRECISION NOT NULL,
          "accuracy" DOUBLE PRECISION,
          "speed" DOUBLE PRECISION,
          "heading" DOUBLE PRECISION,
          "distanceToTarget" DOUBLE PRECISION,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TechnicianLocationLog_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TechnicianLocationLog_serviceOrderId_createdAt_idx" ON "TechnicianLocationLog"("serviceOrderId", "createdAt")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TechnicianLocationLog_partnerId_createdAt_idx" ON "TechnicianLocationLog"("partnerId", "createdAt")`);
    } catch (err) {
      this.logger.warn('TechnicianLocationLog auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure NFS-e Emission tables and columns exist (self-healing migration v3.0) */
  private async ensureNfseEmissionTables(): Promise<void> {
    try {
      // NfseConfig table
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "NfseConfig" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "focusNfeToken" TEXT,
          "focusNfeEnvironment" TEXT NOT NULL DEFAULT 'HOMOLOGATION',
          "focusNfeCompanyId" TEXT,
          "inscricaoMunicipal" TEXT,
          "codigoMunicipio" TEXT,
          "naturezaOperacao" TEXT NOT NULL DEFAULT '1',
          "regimeEspecialTributacao" TEXT,
          "optanteSimplesNacional" BOOLEAN NOT NULL DEFAULT false,
          "itemListaServico" TEXT,
          "codigoCnae" TEXT,
          "codigoTributarioMunicipio" TEXT,
          "aliquotaIss" DOUBLE PRECISION,
          "askOnFinishOS" BOOLEAN NOT NULL DEFAULT true,
          "receiveWithoutNfse" TEXT NOT NULL DEFAULT 'WARN',
          "sendEmailToTomador" BOOLEAN NOT NULL DEFAULT true,
          "rpsSeries" TEXT NOT NULL DEFAULT 'A',
          "rpsNextNumber" INTEGER NOT NULL DEFAULT 1,
          "defaultDiscriminacao" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "NfseConfig_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "NfseConfig_companyId_key" ON "NfseConfig"("companyId")`);

      // NfseEmission table
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "NfseEmission" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "serviceOrderId" TEXT,
          "rpsNumber" INTEGER NOT NULL,
          "rpsSeries" TEXT NOT NULL,
          "nfseNumber" TEXT,
          "codigoVerificacao" TEXT,
          "focusNfeRef" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PROCESSING',
          "errorMessage" TEXT,
          "prestadorCnpj" TEXT NOT NULL,
          "prestadorIm" TEXT,
          "prestadorCodigoMunicipio" TEXT,
          "tomadorCnpjCpf" TEXT,
          "tomadorRazaoSocial" TEXT,
          "tomadorEmail" TEXT,
          "valorServicos" INTEGER NOT NULL,
          "aliquotaIss" DOUBLE PRECISION,
          "issRetido" BOOLEAN NOT NULL DEFAULT false,
          "valorIss" INTEGER,
          "itemListaServico" TEXT,
          "codigoCnae" TEXT,
          "discriminacao" TEXT,
          "codigoMunicipioServico" TEXT,
          "naturezaOperacao" TEXT,
          "xmlUrl" TEXT,
          "pdfUrl" TEXT,
          "cancelledAt" TIMESTAMP(3),
          "cancelReason" TEXT,
          "issuedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "NfseEmission_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "NfseEmission_focusNfeRef_key" ON "NfseEmission"("focusNfeRef")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NfseEmission_companyId_status_idx" ON "NfseEmission"("companyId", "status")`);

      // Self-heal NfseConfig new columns
      const nfseConfigCols: { column_name: string }[] = await this.$queryRaw`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'NfseConfig'
      `;
      const nfseConfigColNames = new Set(nfseConfigCols.map((c) => c.column_name));
      if (!nfseConfigColNames.has('codigoTributarioNacional')) {
        await this.$executeRawUnsafe(`ALTER TABLE "NfseConfig" ADD COLUMN "codigoTributarioNacional" TEXT`);
        this.logger.log('Added column NfseConfig.codigoTributarioNacional');
      }
      if (!nfseConfigColNames.has('autoEmitOnEntry')) {
        await this.$executeRawUnsafe(`ALTER TABLE "NfseConfig" ADD COLUMN "autoEmitOnEntry" BOOLEAN NOT NULL DEFAULT false`);
        this.logger.log('Added column NfseConfig.autoEmitOnEntry');
      }
      if (!nfseConfigColNames.has('nfseLayout')) {
        await this.$executeRawUnsafe(`ALTER TABLE "NfseConfig" ADD COLUMN "nfseLayout" TEXT NOT NULL DEFAULT 'MUNICIPAL'`);
        this.logger.log('Added column NfseConfig.nfseLayout');
      }
      if (!nfseConfigColNames.has('afterEmissionSendWhatsApp')) {
        await this.$executeRawUnsafe(`ALTER TABLE "NfseConfig" ADD COLUMN "afterEmissionSendWhatsApp" BOOLEAN NOT NULL DEFAULT false`);
        this.logger.log('Added column NfseConfig.afterEmissionSendWhatsApp');
      }
      if (!nfseConfigColNames.has('codigoTributarioNacionalServico')) {
        await this.$executeRawUnsafe(`ALTER TABLE "NfseConfig" ADD COLUMN "codigoTributarioNacionalServico" TEXT`);
        this.logger.log('Added column NfseConfig.codigoTributarioNacionalServico');
      }

      // FinancialEntry NFS-e columns
      const existing: { column_name: string }[] = await this.$queryRaw`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'FinancialEntry'
      `;
      const existingNames = new Set(existing.map((c) => c.column_name));

      if (!existingNames.has('nfseStatus')) {
        await this.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN "nfseStatus" TEXT`);
        this.logger.log('Added column FinancialEntry.nfseStatus');
      }
      if (!existingNames.has('nfseEmissionId')) {
        await this.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN "nfseEmissionId" TEXT`);
        this.logger.log('Added column FinancialEntry.nfseEmissionId');
      }
      if (!existingNames.has('obraId')) {
        await this.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN "obraId" TEXT`);
        this.logger.log('Added column FinancialEntry.obraId');
      }

      // ServiceOrder obra column
      const soCols: { column_name: string }[] = await this.$queryRaw`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'ServiceOrder'
      `;
      const soColNames = new Set(soCols.map((c) => c.column_name));
      if (!soColNames.has('obraId')) {
        await this.$executeRawUnsafe(`ALTER TABLE "ServiceOrder" ADD COLUMN "obraId" TEXT`);
        this.logger.log('Added column ServiceOrder.obraId');
      }

      // NfseEmission obra column
      const emCols: { column_name: string }[] = await this.$queryRaw`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'NfseEmission'
      `;
      const emColNames = new Set(emCols.map((c) => c.column_name));
      if (!emColNames.has('obraId')) {
        await this.$executeRawUnsafe(`ALTER TABLE "NfseEmission" ADD COLUMN "obraId" TEXT`);
        this.logger.log('Added column NfseEmission.obraId');
      }

      // Obra table
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Obra" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "partnerId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "cno" TEXT NOT NULL,
          "addressStreet" TEXT NOT NULL,
          "addressNumber" TEXT NOT NULL,
          "addressComp" TEXT,
          "neighborhood" TEXT NOT NULL,
          "city" TEXT NOT NULL,
          "state" TEXT NOT NULL,
          "cep" TEXT NOT NULL,
          "ibgeCode" TEXT,
          "active" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Obra_companyId_partnerId_idx" ON "Obra"("companyId", "partnerId")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Obra_companyId_active_idx" ON "Obra"("companyId", "active")`);
    } catch (err) {
      this.logger.warn('NFS-e Emission auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure CardSettlement table exists (self-healing migration) */
  private async ensureCardSettlementTable(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CardSettlement" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "financialEntryId" TEXT NOT NULL,
          "paymentMethodCode" TEXT,
          "cardBrand" TEXT,
          "grossCents" INTEGER NOT NULL,
          "feePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "feeCents" INTEGER NOT NULL DEFAULT 0,
          "expectedNetCents" INTEGER NOT NULL,
          "expectedDate" TIMESTAMP(3) NOT NULL,
          "receivingDays" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "settledAt" TIMESTAMP(3),
          "actualAmountCents" INTEGER,
          "differenceCents" INTEGER,
          "cashAccountId" TEXT,
          "settledByName" TEXT,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CardSettlement_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CardSettlement_companyId_status_idx" ON "CardSettlement"("companyId", "status")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CardSettlement_companyId_expectedDate_idx" ON "CardSettlement"("companyId", "expectedDate")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CardSettlement_financialEntryId_idx" ON "CardSettlement"("financialEntryId")`);
    } catch (err) {
      this.logger.warn('CardSettlement auto-migration check failed (non-fatal):', err);
    }
  }

  private async ensureFinancialAccountTable(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "FinancialAccount" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "parentId" TEXT,
          "level" INTEGER NOT NULL DEFAULT 1,
          "allowPosting" BOOLEAN NOT NULL DEFAULT false,
          "isSystem" BOOLEAN NOT NULL DEFAULT false,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP(3),
          CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "FinancialAccount_companyId_code_key" ON "FinancialAccount"("companyId", "code")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FinancialAccount_companyId_parentId_idx" ON "FinancialAccount"("companyId", "parentId")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FinancialAccount_companyId_type_idx" ON "FinancialAccount"("companyId", "type")`);
      // Add financialAccountId column to FinancialEntry if missing
      await this.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "financialAccountId" TEXT`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FinancialEntry_financialAccountId_idx" ON "FinancialEntry"("financialAccountId")`);
    } catch (err) {
      this.logger.warn('FinancialAccount auto-migration check failed (non-fatal):', err);
    }
  }

  private async ensureServiceTable(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Service" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "code" TEXT,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "unit" TEXT NOT NULL DEFAULT 'SV',
          "priceCents" INTEGER,
          "category" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP(3),
          CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Service_companyId_idx" ON "Service"("companyId")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Service_companyId_code_idx" ON "Service"("companyId", "code")`);
    } catch (err) {
      this.logger.warn('Service auto-migration check failed (non-fatal):', err);
    }
  }

  private async ensureCardFeeRateTable(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CardFeeRate" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "brand" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "installmentFrom" INTEGER NOT NULL DEFAULT 1,
          "installmentTo" INTEGER NOT NULL DEFAULT 1,
          "feePercent" DOUBLE PRECISION NOT NULL,
          "receivingDays" INTEGER NOT NULL DEFAULT 30,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CardFeeRate_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CardFeeRate_companyId_brand_type_installmentFrom_installmentTo_key" ON "CardFeeRate"("companyId", "brand", "type", "installmentFrom", "installmentTo")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CardFeeRate_companyId_brand_type_idx" ON "CardFeeRate"("companyId", "brand", "type")`);
      // v1.01.08: Add description column
      await this.$executeRawUnsafe(`ALTER TABLE "CardFeeRate" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT ''`);
    } catch (err) {
      this.logger.warn('CardFeeRate auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure SEFAZ manifestation columns exist (self-healing migration) */
  private async ensureSefazManifestColumns(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`ALTER TABLE "SefazDocument" ADD COLUMN IF NOT EXISTS "manifestType" TEXT`);
      await this.$executeRawUnsafe(`ALTER TABLE "SefazDocument" ADD COLUMN IF NOT EXISTS "manifestedAt" TIMESTAMP(3)`);
      await this.$executeRawUnsafe(`ALTER TABLE "SefazConfig" ADD COLUMN IF NOT EXISTS "autoManifestCiencia" BOOLEAN NOT NULL DEFAULT false`);
    } catch (err) {
      this.logger.warn('SefazManifest auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure NfeImportItem snapshot columns exist for revert (self-healing migration) */
  private async ensureNfeImportItemSnapshots(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`ALTER TABLE "NfeImportItem" ADD COLUMN IF NOT EXISTS "prevStockQty" DOUBLE PRECISION`);
      await this.$executeRawUnsafe(`ALTER TABLE "NfeImportItem" ADD COLUMN IF NOT EXISTS "prevAvgCostCents" INTEGER`);
      await this.$executeRawUnsafe(`ALTER TABLE "NfeImportItem" ADD COLUMN IF NOT EXISTS "prevLastPurchasePriceCents" INTEGER`);
    } catch (err) {
      this.logger.warn('NfeImportItem snapshot auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure Product.finalidade column exists (self-healing migration) */
  private async ensureProductFinalidadeColumn(): Promise<void> {
    try {
      await this.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "finalidade" TEXT`);
    } catch (err) {
      this.logger.warn('Product finalidade auto-migration check failed (non-fatal):', err);
    }
  }

  /** Ensure code columns + CodeCounter table exist, backfill existing records */
  private async ensureCodeColumns(): Promise<void> {
    const tables = ['Partner', 'ServiceOrder', 'FinancialEntry', 'Evaluation', 'User', 'Product', 'Service'];
    try {
      // Add code column to each table if missing
      for (const table of tables) {
        await this.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "code" TEXT`);
        await this.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_companyId_code_key" ON "${table}"("companyId", "code") WHERE "code" IS NOT NULL`,
        );
      }

      // Ensure CodeCounter table exists
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CodeCounter" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "entity" TEXT NOT NULL,
          "prefix" TEXT NOT NULL,
          "nextNumber" INTEGER NOT NULL DEFAULT 1,
          CONSTRAINT "CodeCounter_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "CodeCounter_companyId_entity_key" ON "CodeCounter"("companyId", "entity")`,
      );

      // Backfill codes for all companies
      const companies: { id: string }[] = await this.$queryRawUnsafe(`SELECT id FROM "Company" WHERE "deletedAt" IS NULL`);

      const entityConfig: { entity: string; table: string; prefix: string }[] = [
        { entity: 'PARTNER', table: 'Partner', prefix: 'PAR' },
        { entity: 'SERVICE_ORDER', table: 'ServiceOrder', prefix: 'OS' },
        { entity: 'FINANCIAL_ENTRY', table: 'FinancialEntry', prefix: 'FIN' },
        { entity: 'EVALUATION', table: 'Evaluation', prefix: 'AVA' },
        { entity: 'USER', table: 'User', prefix: 'USR' },
        { entity: 'PRODUCT', table: 'Product', prefix: 'PRD' },
        { entity: 'SERVICE', table: 'Service', prefix: 'SRV' },
      ];

      for (const company of companies) {
        for (const cfg of entityConfig) {
          // Count records without code
          const countResult: { count: bigint }[] = await this.$queryRawUnsafe(
            `SELECT COUNT(*) as count FROM "${cfg.table}" WHERE "companyId" = $1 AND code IS NULL`,
            company.id,
          );
          const count = Number(countResult[0]?.count ?? 0);
          if (count === 0) continue;

          // Get current counter
          const counterResult: { nextNumber: number }[] = await this.$queryRawUnsafe(
            `SELECT "nextNumber" FROM "CodeCounter" WHERE "companyId" = $1 AND "entity" = $2`,
            company.id, cfg.entity,
          );
          let nextNum = counterResult[0]?.nextNumber ?? 1;

          // Backfill records ordered by createdAt
          const records: { id: string }[] = await this.$queryRawUnsafe(
            `SELECT id FROM "${cfg.table}" WHERE "companyId" = $1 AND code IS NULL ORDER BY "createdAt" ASC`,
            company.id,
          );

          for (const record of records) {
            const code = `${cfg.prefix}-${String(nextNum).padStart(5, '0')}`;
            await this.$executeRawUnsafe(
              `UPDATE "${cfg.table}" SET code = $1 WHERE id = $2`,
              code, record.id,
            );
            nextNum++;
          }

          // Upsert counter
          await this.$executeRawUnsafe(
            `INSERT INTO "CodeCounter" ("id", "companyId", "entity", "prefix", "nextNumber")
             VALUES (gen_random_uuid(), $1, $2, $3, $4)
             ON CONFLICT ("companyId", "entity") DO UPDATE SET "nextNumber" = GREATEST("CodeCounter"."nextNumber", $4)`,
            company.id, cfg.entity, cfg.prefix, nextNum,
          );

          this.logger.log(`Backfilled ${records.length} ${cfg.entity} codes for company ${company.id}`);
        }
      }
    } catch (err) {
      this.logger.warn('Code columns auto-migration failed (non-fatal):', err);
    }
  }

  /** Ensure multi-tenant SaaS tables exist (Tenant, Plan, Subscription, Promotion) */
  private async ensureMultiTenantTables(): Promise<void> {
    try {
      // Enum types
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "TenantStatus" AS ENUM ('PENDING_VERIFICATION', 'PENDING_PAYMENT', 'ACTIVE', 'BLOCKED', 'CANCELLED', 'SUSPENDED');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
      `);
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
      `);

      // Plan table
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Plan" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "name" TEXT NOT NULL,
          "maxUsers" INTEGER NOT NULL,
          "maxOsPerMonth" INTEGER NOT NULL,
          "priceCents" INTEGER NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "description" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Plan_name_key" ON "Plan"("name")`);

      // Tenant table
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Tenant" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "slug" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "schemaName" TEXT NOT NULL,
          "cnpj" TEXT,
          "status" "TenantStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
          "planId" TEXT,
          "responsibleName" TEXT,
          "responsibleEmail" TEXT,
          "responsiblePhone" TEXT,
          "responsibleCpf" TEXT,
          "responsibleDocUrl" TEXT,
          "verificationId" TEXT,
          "asaasCustomerId" TEXT,
          "isMaster" BOOLEAN NOT NULL DEFAULT false,
          "maxUsers" INTEGER NOT NULL DEFAULT 5,
          "maxOsPerMonth" INTEGER NOT NULL DEFAULT 100,
          "blockedAt" TIMESTAMP(3),
          "blockReason" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP(3),
          CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug")`);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_schemaName_key" ON "Tenant"("schemaName")`);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_cnpj_key" ON "Tenant"("cnpj") WHERE "cnpj" IS NOT NULL`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant"("status")`);

      // Subscription table
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Subscription" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "tenantId" TEXT NOT NULL,
          "planId" TEXT NOT NULL,
          "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
          "currentPeriodStart" TIMESTAMP(3) NOT NULL,
          "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
          "nextBillingDate" TIMESTAMP(3) NOT NULL,
          "asaasSubscriptionId" TEXT,
          "osUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
          "osResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "extraOsPurchased" INTEGER NOT NULL DEFAULT 0,
          "promotionId" TEXT,
          "promotionMonthsLeft" INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "cancelledAt" TIMESTAMP(3),
          CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Subscription_tenantId_idx" ON "Subscription"("tenantId")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status")`);

      // Promotion table
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Promotion" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "name" TEXT NOT NULL,
          "code" TEXT,
          "discountPercent" DOUBLE PRECISION,
          "discountCents" INTEGER,
          "durationMonths" INTEGER NOT NULL DEFAULT 1,
          "applicablePlans" TEXT[] DEFAULT '{}',
          "maxUses" INTEGER,
          "currentUses" INTEGER NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Promotion_code_key" ON "Promotion"("code") WHERE "code" IS NOT NULL`);

      // v1.01.97: Add new columns to existing tables
      await this.$executeRawUnsafe(`ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "priceYearlyCents" INTEGER`);
      await this.$executeRawUnsafe(`ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "features" TEXT[] DEFAULT '{}'`);
      await this.$executeRawUnsafe(`ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "skipPayment" BOOLEAN NOT NULL DEFAULT false`);

      this.logger.log('Multi-tenant tables verified');
    } catch (err) {
      this.logger.warn('Multi-tenant tables auto-migration failed (non-fatal):', err);
    }
  }

  private async ensureChecklistResponseTable(): Promise<void> {
    try {
      // Enum types
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "ChecklistClass" AS ENUM ('TOOLS_PPE', 'MATERIALS', 'INITIAL_CHECK', 'FINAL_CHECK', 'CUSTOM');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
      `);
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "ChecklistMode" AS ENUM ('ITEM_BY_ITEM', 'FULL');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
      `);

      // ChecklistResponse table
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ChecklistResponse" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "companyId" TEXT NOT NULL,
          "serviceOrderId" TEXT NOT NULL,
          "checklistClass" "ChecklistClass" NOT NULL,
          "stage" TEXT NOT NULL,
          "mode" "ChecklistMode" NOT NULL DEFAULT 'ITEM_BY_ITEM',
          "required" BOOLEAN NOT NULL DEFAULT true,
          "items" JSONB NOT NULL,
          "observation" TEXT,
          "confirmed" BOOLEAN NOT NULL DEFAULT false,
          "confirmedAt" TIMESTAMP(3),
          "confirmedBy" TEXT,
          "technicianName" TEXT,
          "geolocation" JSONB,
          "deviceInfo" JSONB,
          "timeInStage" INTEGER,
          "skippedItems" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ChecklistResponse_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChecklistResponse_serviceOrderId_idx" ON "ChecklistResponse"("serviceOrderId")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChecklistResponse_companyId_serviceOrderId_idx" ON "ChecklistResponse"("companyId", "serviceOrderId")`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChecklistResponse_serviceOrderId_checklistClass_idx" ON "ChecklistResponse"("serviceOrderId", "checklistClass")`);
    } catch (err) {
      this.logger.warn('ChecklistResponse auto-migration check failed (non-fatal):', err);
    }
  }

  /** Fix orphan IMPORTED status - only docs processed through wizard should be IMPORTED */
  private async fixOrphanImportedStatus(): Promise<void> {
    try {
      // Case 1: IMPORTED without any NfeImport link
      const r1 = await this.$executeRawUnsafe(`
        UPDATE "SefazDocument"
        SET status = 'FETCHED'
        WHERE status = 'IMPORTED' AND "nfeImportId" IS NULL
      `);
      if (typeof r1 === 'number' && r1 > 0) {
        this.logger.log(`Fixed ${r1} SefazDocument(s) without nfeImportId → FETCHED`);
      }

      // Case 2: IMPORTED linked to PENDING NfeImport (auto-imported, never processed)
      const r2 = await this.$executeRawUnsafe(`
        UPDATE "SefazDocument"
        SET status = 'FETCHED', "nfeImportId" = NULL
        WHERE status = 'IMPORTED'
          AND "nfeImportId" IS NOT NULL
          AND "nfeImportId" IN (SELECT id FROM "NfeImport" WHERE status = 'PENDING')
      `);
      if (typeof r2 === 'number' && r2 > 0) {
        this.logger.log(`Fixed ${r2} SefazDocument(s) linked to PENDING NfeImport → FETCHED`);
        // Clean up orphan NfeImportItems and NfeImports
        await this.$executeRawUnsafe(`
          DELETE FROM "NfeImportItem"
          WHERE "nfeImportId" IN (
            SELECT id FROM "NfeImport" WHERE status = 'PENDING'
              AND id NOT IN (SELECT "nfeImportId" FROM "SefazDocument" WHERE "nfeImportId" IS NOT NULL)
          )
        `);
        await this.$executeRawUnsafe(`
          DELETE FROM "NfeImport"
          WHERE status = 'PENDING'
            AND id NOT IN (SELECT "nfeImportId" FROM "SefazDocument" WHERE "nfeImportId" IS NOT NULL)
        `);
      }
    } catch (err) {
      this.logger.warn('fixOrphanImportedStatus failed (non-fatal):', err);
    }
  }
}
