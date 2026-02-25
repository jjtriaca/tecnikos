import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.ensureCompanyColumns();
    await this.ensurePartnerColumns();
    await this.ensureServiceOrderColumns();
    await this.ensureLocationLogTable();
    await this.ensureExecutionPauseTable();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
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
}
