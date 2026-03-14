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

    let totalAdded = 0;

    for (const tenant of tenants) {
      try {
        const added = await this.syncSchema(tenant.schemaName, publicColumns);
        if (added > 0) {
          this.logger.log(`Schema "${tenant.schemaName}" (${tenant.slug}): added ${added} missing column(s)`);
          totalAdded += added;
        }
      } catch (err) {
        this.logger.error(`Failed to sync schema "${tenant.schemaName}": ${(err as Error).message}`);
      }
    }

    if (totalAdded > 0) {
      this.logger.log(`Tenant sync complete: ${totalAdded} column(s) added across ${tenants.length} schema(s)`);
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
      // Skip if table doesn't exist in tenant (it might be a new table — createSchema handles that)
      if (!tenantTables.has(tableName)) {
        this.logger.debug(`Table "${tableName}" doesn't exist in "${schemaName}", skipping column sync`);
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

  async onModuleDestroy() {
    await this.rawPrisma.$disconnect();
  }
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
