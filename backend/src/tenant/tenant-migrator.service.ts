import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Synchronizes all tenant schemas with the public schema on application startup.
 *
 * When Prisma migrations run, they only alter tables in the `public` schema.
 * Existing tenant schemas (e.g. tenant_sls, tenant_acme) don't get the new columns.
 * This service automatically detects missing columns and adds them to every tenant.
 *
 * It runs once on app startup (OnApplicationBootstrap).
 */
@Injectable()
export class TenantMigratorService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TenantMigratorService.name);
  private rawPrisma: PrismaClient;

  // Tables that exist ONLY in public schema — never copied to tenants
  private readonly PUBLIC_ONLY_TABLES = [
    '_prisma_migrations',
    'Tenant',
    'Plan',
    'Subscription',
    'Promotion',
    'SignupAttempt',
    'SaasEvent',
    'SaasInvoice',
    'SaasInvoiceConfig',
    'AddOn',
    'AddOnPurchase',
    'VerificationSession',
  ];

  constructor() {
    // Use raw PrismaClient (no Proxy) to avoid tenant context routing
    this.rawPrisma = new PrismaClient({ log: ['error'] });
  }

  async onApplicationBootstrap() {
    try {
      await this.syncAllTenantSchemas();
    } catch (err) {
      this.logger.error(`Tenant schema sync failed: ${(err as Error).message}`);
    }

    // Sync tenant limits (maxOsPerMonth, maxUsers) to Company table in each schema
    try {
      await this.syncTenantLimits();
    } catch (err) {
      this.logger.error(`Tenant limits sync failed: ${(err as Error).message}`);
    }

    // Cleanup expired/inactive sessions across all schemas
    try {
      await this.cleanupExpiredSessions();
    } catch (err) {
      this.logger.error(`Session cleanup failed: ${(err as Error).message}`);
    }
  }

  /**
   * Main sync: iterate all active tenants and sync each schema.
   */
  async syncAllTenantSchemas() {
    // Get all tenant schemas (including BLOCKED/SUSPENDED — they still need valid schema)
    const tenants = await this.rawPrisma.$queryRawUnsafe<{ schemaName: string; slug: string }[]>(`
      SELECT "schemaName", slug FROM public."Tenant"
      WHERE "deletedAt" IS NULL
        AND status NOT IN ('CANCELLED')
        AND "schemaName" IS NOT NULL
    `);

    if (tenants.length === 0) {
      this.logger.log('No tenant schemas to sync');
      return;
    }

    this.logger.log(`Syncing ${tenants.length} tenant schema(s)...`);

    // Get public schema column definitions (our reference)
    const publicColumns = await this.getSchemaColumns('public');

    // Get public schema enum types (reference for sync)
    const publicEnums = await this.getSchemaEnums('public');

    let totalAdded = 0;
    let totalEnums = 0;
    let totalFks = 0;

    for (const tenant of tenants) {
      try {
        // 1. Sync enum types FIRST (tables/columns depend on them)
        const enumsAdded = await this.syncEnums(tenant.schemaName, publicEnums);
        if (enumsAdded > 0) {
          this.logger.log(`Schema "${tenant.schemaName}" (${tenant.slug}): added ${enumsAdded} missing enum(s)`);
          totalEnums += enumsAdded;
        }

        // 2. Then sync tables and columns
        const added = await this.syncSchema(tenant.schemaName, publicColumns);
        if (added > 0) {
          this.logger.log(`Schema "${tenant.schemaName}" (${tenant.slug}): added ${added} missing column(s)/table(s)`);
          totalAdded += added;
        }

        // 3. Fix any foreign keys still pointing to public schema
        const fksRemapped = await this.remapForeignKeys(tenant.schemaName);
        if (fksRemapped > 0) {
          this.logger.log(`Schema "${tenant.schemaName}" (${tenant.slug}): remapped ${fksRemapped} cross-schema FK(s)`);
          totalFks += fksRemapped;
        }
      } catch (err) {
        this.logger.error(`Failed to sync schema "${tenant.schemaName}": ${(err as Error).message}`);
      }
    }

    const parts: string[] = [];
    if (totalEnums > 0) parts.push(`${totalEnums} enum(s)`);
    if (totalAdded > 0) parts.push(`${totalAdded} column(s)/table(s)`);
    if (totalFks > 0) parts.push(`${totalFks} FK(s) remapped`);

    if (parts.length > 0) {
      this.logger.log(`Tenant sync complete: added ${parts.join(' + ')} across ${tenants.length} schema(s)`);
    } else {
      this.logger.log(`Tenant sync complete: all ${tenants.length} schema(s) are up-to-date`);
    }
  }

  /**
   * Get all columns for all tables in a given schema.
   */
  private async getSchemaColumns(schemaName: string): Promise<ColumnInfo[]> {
    return this.rawPrisma.$queryRawUnsafe<ColumnInfo[]>(`
      SELECT
        c.table_name AS "tableName",
        c.column_name AS "columnName",
        c.data_type AS "dataType",
        c.udt_name AS "udtName",
        c.udt_schema AS "udtSchema",
        c.is_nullable AS "isNullable",
        c.column_default AS "columnDefault",
        c.character_maximum_length AS "charMaxLen"
      FROM information_schema.columns c
      JOIN pg_tables pt ON pt.tablename = c.table_name AND pt.schemaname = c.table_schema
      WHERE c.table_schema = '${schemaName}'
      ORDER BY c.table_name, c.ordinal_position
    `);
  }

  /**
   * Sync a single tenant schema against the public reference.
   * Returns count of columns added.
   */
  private async syncSchema(schemaName: string, publicColumns: ColumnInfo[]): Promise<number> {
    // Validate schema name (prevent SQL injection)
    if (!/^[a-z0-9_]+$/.test(schemaName)) {
      this.logger.warn(`Invalid schema name: "${schemaName}", skipping`);
      return 0;
    }

    // Get current columns in tenant schema
    const tenantColumns = await this.getSchemaColumns(schemaName);

    // Build set of existing columns: "TableName.columnName"
    const tenantColumnSet = new Set(
      tenantColumns.map(c => `${c.tableName}.${c.columnName}`),
    );

    // Build set of existing tables in tenant
    const tenantTables = new Set(tenantColumns.map(c => c.tableName));

    let added = 0;

    // Group public columns by table
    const publicByTable = new Map<string, ColumnInfo[]>();
    for (const col of publicColumns) {
      // Skip public-only tables
      if (this.PUBLIC_ONLY_TABLES.includes(col.tableName)) continue;
      // Skip internal prisma tables
      if (col.tableName.startsWith('_')) continue;

      if (!publicByTable.has(col.tableName)) {
        publicByTable.set(col.tableName, []);
      }
      publicByTable.get(col.tableName)!.push(col);
    }

    for (const [tableName, columns] of publicByTable) {
      // Create missing tables in tenant schema (new tables added via migration after tenant was created)
      if (!tenantTables.has(tableName)) {
        try {
          await this.rawPrisma.$executeRawUnsafe(
            `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}" (LIKE public."${tableName}" INCLUDING ALL)`,
          );
          // Remap enum column types from public to tenant schema
          const publicCols = await this.rawPrisma.$queryRawUnsafe<{ column_name: string; data_type: string; udt_name: string; column_default: string | null }[]>(`
            SELECT column_name, data_type, udt_name, column_default
            FROM information_schema.columns
            WHERE table_schema = '${schemaName}' AND table_name = '${tableName}'
              AND udt_schema = 'public' AND (data_type = 'USER-DEFINED' OR data_type = 'ARRAY')
          `);
          for (const { column_name, data_type, udt_name, column_default } of publicCols) {
            try {
              const isArr = data_type === 'ARRAY';
              const enumName = isArr ? udt_name.substring(1) : udt_name;
              const targetType = isArr ? `"${schemaName}"."${enumName}"[]` : `"${schemaName}"."${enumName}"`;
              if (column_default) await this.rawPrisma.$executeRawUnsafe(`ALTER TABLE "${schemaName}"."${tableName}" ALTER COLUMN "${column_name}" DROP DEFAULT`);
              await this.rawPrisma.$executeRawUnsafe(`ALTER TABLE "${schemaName}"."${tableName}" ALTER COLUMN "${column_name}" TYPE ${targetType} USING "${column_name}"::text${isArr ? '[]' : ''}::"${schemaName}"."${enumName}"${isArr ? '[]' : ''}`);
              if (column_default) {
                const newDefault = column_default.replace(/::"([A-Za-z]+)"(\[\])?/g, `::"${schemaName}"."$1"$2`);
                await this.rawPrisma.$executeRawUnsafe(`ALTER TABLE "${schemaName}"."${tableName}" ALTER COLUMN "${column_name}" SET DEFAULT ${newDefault}`);
              }
            } catch (colErr) { /* enum remap failed, non-fatal */ }
          }
          // Remap foreign keys from public to tenant schema
          await this.remapForeignKeys(schemaName, tableName);
          this.logger.log(`Created missing table "${tableName}" in "${schemaName}"`);
          added++;
        } catch (err) {
          this.logger.warn(`Failed to create table "${tableName}" in "${schemaName}": ${(err as Error).message}`);
        }
        continue;
      }

      for (const col of columns) {
        const key = `${col.tableName}.${col.columnName}`;
        if (!tenantColumnSet.has(key)) {
          // Column is missing in tenant — add it
          try {
            await this.addColumn(schemaName, col);
            added++;
          } catch (err) {
            this.logger.warn(
              `Failed to add column "${col.tableName}"."${col.columnName}" to "${schemaName}": ${(err as Error).message}`,
            );
          }
        }
      }
    }

    return added;
  }

  /**
   * Add a missing column to a tenant schema table.
   */
  private async addColumn(schemaName: string, col: ColumnInfo) {
    const isArray = col.dataType === 'ARRAY';
    const isEnum = col.dataType === 'USER-DEFINED' || isArray;

    let sqlType: string;

    if (isEnum) {
      // Enum types need to reference the tenant schema
      const enumName = isArray ? col.udtName.substring(1) : col.udtName;
      sqlType = isArray
        ? `"${schemaName}"."${enumName}"[]`
        : `"${schemaName}"."${enumName}"`;
    } else {
      // Standard SQL types
      sqlType = this.mapDataType(col);
    }

    const nullable = col.isNullable === 'YES' ? '' : ' NOT NULL';

    // Build default clause
    let defaultClause = '';
    if (col.columnDefault !== null && col.columnDefault !== undefined) {
      let defaultVal = col.columnDefault;

      // Replace public enum references with tenant schema references
      if (isEnum) {
        defaultVal = defaultVal.replace(
          /::"([A-Za-z]+)"(\[\])?/g,
          `::"${schemaName}"."$1"$2`,
        );
      }

      defaultClause = ` DEFAULT ${defaultVal}`;
    }

    const sql = `ALTER TABLE "${schemaName}"."${col.tableName}" ADD COLUMN IF NOT EXISTS "${col.columnName}" ${sqlType}${nullable}${defaultClause}`;

    this.logger.debug(`Running: ${sql}`);
    await this.rawPrisma.$executeRawUnsafe(sql);
  }

  /**
   * Map information_schema data_type to PostgreSQL DDL type.
   */
  private mapDataType(col: ColumnInfo): string {
    switch (col.dataType) {
      case 'character varying':
        return col.charMaxLen ? `VARCHAR(${col.charMaxLen})` : 'TEXT';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'smallint':
        return 'SMALLINT';
      case 'boolean':
        return 'BOOLEAN';
      case 'text':
        return 'TEXT';
      case 'double precision':
        return 'DOUBLE PRECISION';
      case 'real':
        return 'REAL';
      case 'numeric':
        return 'NUMERIC';
      case 'timestamp with time zone':
        return 'TIMESTAMPTZ';
      case 'timestamp without time zone':
        return 'TIMESTAMP';
      case 'date':
        return 'DATE';
      case 'uuid':
        return 'UUID';
      case 'jsonb':
        return 'JSONB';
      case 'json':
        return 'JSON';
      case 'bytea':
        return 'BYTEA';
      default:
        // Fallback: use the udt_name (works for most types)
        return col.udtName.toUpperCase();
    }
  }

  /**
   * Get all enum types and their labels for a given schema.
   */
  private async getSchemaEnums(schemaName: string): Promise<EnumInfo[]> {
    return this.rawPrisma.$queryRawUnsafe<EnumInfo[]>(`
      SELECT t.typname AS "typeName",
             array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = '${schemaName}'
      GROUP BY t.typname
      ORDER BY t.typname
    `);
  }

  /**
   * Sync enum types from public schema to a tenant schema.
   * Creates missing enums and adds missing labels to existing enums.
   * Returns count of enums added/updated.
   */
  private async syncEnums(schemaName: string, publicEnums: EnumInfo[]): Promise<number> {
    if (!/^[a-z0-9_]+$/.test(schemaName)) return 0;

    const tenantEnums = await this.getSchemaEnums(schemaName);
    const tenantEnumMap = new Map(tenantEnums.map(e => [e.typeName, new Set(e.labels)]));

    let changes = 0;

    for (const pubEnum of publicEnums) {
      const existing = tenantEnumMap.get(pubEnum.typeName);

      if (!existing) {
        // Enum doesn't exist in tenant — create it
        try {
          const labelsSql = pubEnum.labels.map(l => `'${l}'`).join(', ');
          await this.rawPrisma.$executeRawUnsafe(
            `CREATE TYPE "${schemaName}"."${pubEnum.typeName}" AS ENUM (${labelsSql})`,
          );
          this.logger.log(`Created enum "${pubEnum.typeName}" in "${schemaName}" with ${pubEnum.labels.length} labels`);
          changes++;
        } catch (err) {
          this.logger.warn(`Failed to create enum "${pubEnum.typeName}" in "${schemaName}": ${(err as Error).message}`);
        }
      } else {
        // Enum exists — check for missing labels (new values added to enum)
        for (const label of pubEnum.labels) {
          if (!existing.has(label)) {
            try {
              await this.rawPrisma.$executeRawUnsafe(
                `ALTER TYPE "${schemaName}"."${pubEnum.typeName}" ADD VALUE IF NOT EXISTS '${label}'`,
              );
              this.logger.log(`Added label "${label}" to enum "${pubEnum.typeName}" in "${schemaName}"`);
              changes++;
            } catch (err) {
              this.logger.warn(`Failed to add label "${label}" to "${pubEnum.typeName}" in "${schemaName}": ${(err as Error).message}`);
            }
          }
        }
      }
    }

    // Also fix columns that reference public enums instead of tenant enums
    if (changes > 0) {
      await this.remapOrphanedEnumColumns(schemaName);
    }

    return changes;
  }

  /**
   * Fix foreign key constraints in a tenant schema that still reference public schema tables.
   * This happens when CREATE TABLE ... (LIKE public."X" INCLUDING ALL) copies FKs
   * that point to public."ReferencedTable" instead of "tenant_xxx"."ReferencedTable".
   *
   * @param schemaName - The tenant schema name
   * @param tableName - If provided, only fix FKs on this specific table
   * @returns count of FKs remapped
   */
  private async remapForeignKeys(schemaName: string, tableName?: string): Promise<number> {
    const tableFilter = tableName ? `AND cl.relname = '${tableName}'` : '';

    const crossSchemaFks = await this.rawPrisma.$queryRawUnsafe<{
      constraint_name: string;
      table_name: string;
      ref_table: string;
      constraint_def: string;
    }[]>(`
      SELECT
        con.conname AS "constraint_name",
        cl.relname AS "table_name",
        ref_cl.relname AS "ref_table",
        pg_get_constraintdef(con.oid) AS "constraint_def"
      FROM pg_constraint con
      JOIN pg_namespace ns ON con.connamespace = ns.oid
      JOIN pg_class cl ON con.conrelid = cl.oid
      JOIN pg_class ref_cl ON con.confrelid = ref_cl.oid
      JOIN pg_namespace ref_ns ON ref_cl.relnamespace = ref_ns.oid
      WHERE con.contype = 'f'
        AND ns.nspname = '${schemaName}'
        AND ref_ns.nspname = 'public'
        ${tableFilter}
    `);

    if (crossSchemaFks.length === 0) return 0;

    // Get set of tables that exist in this tenant schema
    const tenantTables = await this.rawPrisma.$queryRawUnsafe<{ tablename: string }[]>(`
      SELECT tablename FROM pg_tables WHERE schemaname = '${schemaName}'
    `);
    const tenantTableSet = new Set(tenantTables.map(t => t.tablename));

    let remapped = 0;

    for (const fk of crossSchemaFks) {
      try {
        // Drop the old FK that references public schema
        await this.rawPrisma.$executeRawUnsafe(
          `ALTER TABLE "${schemaName}"."${fk.table_name}" DROP CONSTRAINT "${fk.constraint_name}"`,
        );

        // Only recreate if the referenced table exists in tenant schema (not public-only)
        if (tenantTableSet.has(fk.ref_table) && !this.PUBLIC_ONLY_TABLES.includes(fk.ref_table)) {
          // Replace public."TableName" with "tenant_schema"."TableName" in constraint def
          const newDef = fk.constraint_def.replace(/public\./g, `"${schemaName}".`);

          await this.rawPrisma.$executeRawUnsafe(
            `ALTER TABLE "${schemaName}"."${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" ${newDef}`,
          );
          this.logger.log(`Remapped FK "${fk.constraint_name}" on "${fk.table_name}" from public to "${schemaName}"`);
        } else {
          this.logger.log(`Dropped cross-schema FK "${fk.constraint_name}" on "${fk.table_name}" (ref: public."${fk.ref_table}")`);
        }

        remapped++;
      } catch (err) {
        this.logger.warn(`Failed to remap FK "${fk.constraint_name}": ${(err as Error).message}`);
      }
    }

    return remapped;
  }

  /**
   * Fix columns in tenant schema that still reference public enum types.
   * This happens when TenantMigratorService creates a table before the enum exists.
   */
  private async remapOrphanedEnumColumns(schemaName: string): Promise<void> {
    const orphanedCols = await this.rawPrisma.$queryRawUnsafe<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      column_default: string | null;
    }[]>(`
      SELECT table_name, column_name, data_type, udt_name, column_default
      FROM information_schema.columns
      WHERE table_schema = '${schemaName}'
        AND udt_schema = 'public'
        AND (data_type = 'USER-DEFINED' OR data_type = 'ARRAY')
    `);

    for (const col of orphanedCols) {
      try {
        const isArray = col.data_type === 'ARRAY';
        const enumName = isArray ? col.udt_name.substring(1) : col.udt_name;
        const targetType = isArray
          ? `"${schemaName}"."${enumName}"[]`
          : `"${schemaName}"."${enumName}"`;

        if (col.column_default) {
          await this.rawPrisma.$executeRawUnsafe(
            `ALTER TABLE "${schemaName}"."${col.table_name}" ALTER COLUMN "${col.column_name}" DROP DEFAULT`,
          );
        }

        await this.rawPrisma.$executeRawUnsafe(
          `ALTER TABLE "${schemaName}"."${col.table_name}"
           ALTER COLUMN "${col.column_name}"
           TYPE ${targetType}
           USING "${col.column_name}"::text${isArray ? '[]' : ''}::"${schemaName}"."${enumName}"${isArray ? '[]' : ''}`,
        );

        if (col.column_default) {
          const newDefault = col.column_default.replace(
            /::"([A-Za-z]+)"(\[\])?/g,
            `::"${schemaName}"."$1"$2`,
          );
          await this.rawPrisma.$executeRawUnsafe(
            `ALTER TABLE "${schemaName}"."${col.table_name}" ALTER COLUMN "${col.column_name}" SET DEFAULT ${newDefault}`,
          );
        }

        this.logger.log(`Remapped "${col.table_name}"."${col.column_name}" from public to "${schemaName}" enum`);
      } catch (err) {
        this.logger.warn(`Failed to remap "${col.table_name}"."${col.column_name}": ${(err as Error).message}`);
      }
    }
  }

  /**
   * Sync Tenant limits (maxOsPerMonth, maxUsers) to Company table in each tenant schema.
   * This ensures the Company table always reflects the current plan limits.
   */
  private async syncTenantLimits(): Promise<void> {
    const tenants = await this.rawPrisma.$queryRawUnsafe<
      { schemaName: string; slug: string; maxOsPerMonth: number; maxUsers: number; maxTechnicians: number; maxAiMessages: number; maxNfseImports: number }[]
    >(`
      SELECT "schemaName", slug, "maxOsPerMonth", "maxUsers", "maxTechnicians", "maxAiMessages", "maxNfseImports"
      FROM public."Tenant"
      WHERE "deletedAt" IS NULL AND status NOT IN ('CANCELLED') AND "schemaName" IS NOT NULL
    `);

    let updated = 0;
    for (const t of tenants) {
      if (!/^[a-z0-9_]+$/.test(t.schemaName)) continue;
      try {
        // Use GREATEST to never DECREASE Company limits below Tenant baseline
        // (Company may have higher limits due to purchased add-ons)
        const result = await this.rawPrisma.$executeRawUnsafe(`
          UPDATE "${t.schemaName}"."Company"
          SET "maxOsPerMonth" = GREATEST("maxOsPerMonth", ${t.maxOsPerMonth}),
              "maxUsers" = GREATEST("maxUsers", ${t.maxUsers}),
              "maxTechnicians" = GREATEST("maxTechnicians", ${t.maxTechnicians}),
              "maxAiMessages" = GREATEST("maxAiMessages", ${t.maxAiMessages}),
              "maxNfseImports" = GREATEST("maxNfseImports", ${t.maxNfseImports})
          WHERE "maxOsPerMonth" < ${t.maxOsPerMonth} OR "maxUsers" < ${t.maxUsers}
             OR "maxTechnicians" < ${t.maxTechnicians} OR "maxAiMessages" < ${t.maxAiMessages}
             OR "maxNfseImports" < ${t.maxNfseImports}
        `);
        if (result > 0) {
          updated++;
          this.logger.log(`Synced limits for tenant "${t.slug}": maxOS=${t.maxOsPerMonth}, maxUsers=${t.maxUsers}, maxTech=${t.maxTechnicians}, maxAI=${t.maxAiMessages}`);
        }
      } catch (err) {
        this.logger.warn(`Failed to sync limits for "${t.slug}": ${(err as Error).message}`);
      }
    }

    if (updated > 0) {
      this.logger.log(`Tenant limits synced: ${updated} company(ies) updated`);
    }
  }

  /**
   * Delete sessions that are expired or inactive for more than 3 days.
   * Runs on boot across public + all tenant schemas.
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Get all schemas that have a Session table (public + tenants)
    const schemas = await this.rawPrisma.$queryRawUnsafe<{ schemaname: string }[]>(`
      SELECT DISTINCT schemaname FROM pg_tables WHERE tablename = 'Session'
    `);

    let totalDeleted = 0;

    for (const { schemaname } of schemas) {
      if (!/^[a-z0-9_]+$/.test(schemaname)) continue;

      try {
        // Delete sessions that are:
        // 1. Revoked (already logged out)
        // 2. Expired (expiresAt in the past)
        // 3. Inactive for > 3 days (no activity and old)
        const result = await this.rawPrisma.$executeRawUnsafe(`
          DELETE FROM "${schemaname}"."Session"
          WHERE "revokedAt" IS NOT NULL
             OR "expiresAt" < NOW()
             OR (
               "lastActivityAt" IS NOT NULL AND "lastActivityAt" < '${threeDaysAgo}'::timestamptz
             )
             OR (
               "lastActivityAt" IS NULL AND "createdAt" < '${threeDaysAgo}'::timestamptz
             )
        `);

        if (result > 0) {
          totalDeleted += result;
          this.logger.log(`Cleaned ${result} expired session(s) from "${schemaname}"`);
        }
      } catch (err) {
        this.logger.warn(`Session cleanup failed for "${schemaname}": ${(err as Error).message}`);
      }
    }

    if (totalDeleted > 0) {
      this.logger.log(`Session cleanup complete: deleted ${totalDeleted} session(s) across ${schemas.length} schema(s)`);
    } else {
      this.logger.log(`Session cleanup: no expired sessions found`);
    }
  }

  async onModuleDestroy() {
    await this.rawPrisma.$disconnect();
  }
}

interface EnumInfo {
  typeName: string;
  labels: string[];
}

interface ColumnInfo {
  tableName: string;
  columnName: string;
  dataType: string;
  udtName: string;
  udtSchema: string;
  isNullable: string;
  columnDefault: string | null;
  charMaxLen: number | null;
}
