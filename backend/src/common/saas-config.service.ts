import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EncryptionService } from './encryption.service';

/**
 * SaasConfigService — Global system configuration (key-value, AES-256-GCM).
 *
 * Stores admin-level settings like FOCUS_NFE_RESELLER_TOKEN, VAPID keys, etc.
 * Always reads from public schema (bypasses tenant routing).
 * Falls back to process.env if key not found in DB.
 */
@Injectable()
export class SaasConfigService {
  private readonly logger = new Logger(SaasConfigService.name);
  private readonly publicPrisma: PrismaClient;

  constructor(private readonly encryption: EncryptionService) {
    // Direct PrismaClient to always hit public schema (bypass tenant routing)
    this.publicPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
  }

  /**
   * Get a config value by key. DB first, fallback to process.env.
   */
  async get(key: string): Promise<string | null> {
    try {
      const row = await this.publicPrisma.saasConfig.findUnique({ where: { key } });
      if (row?.value) {
        return row.encrypted ? this.encryption.decrypt(row.value) : row.value;
      }
    } catch (err) {
      this.logger.warn(`Failed to read config "${key}" from DB: ${(err as Error).message}`);
    }
    // Fallback to env var
    return process.env[key] || null;
  }

  /**
   * Set (upsert) a config value. Encrypts by default.
   */
  async set(
    key: string,
    value: string,
    opts: { encrypted?: boolean; label?: string; group?: string } = {},
  ): Promise<void> {
    const encrypted = opts.encrypted !== false;
    const storedValue = encrypted ? this.encryption.encrypt(value) : value;

    await this.publicPrisma.saasConfig.upsert({
      where: { key },
      create: {
        key,
        value: storedValue,
        encrypted,
        label: opts.label,
        group: opts.group || 'GENERAL',
      },
      update: {
        value: storedValue,
        encrypted,
        label: opts.label !== undefined ? opts.label : undefined,
        group: opts.group !== undefined ? opts.group : undefined,
      },
    });

    this.logger.log(`Config "${key}" updated (encrypted: ${encrypted})`);
  }

  /**
   * Get all configs. Masked values for encrypted fields (last 4 chars).
   */
  async getAll(group?: string): Promise<
    Array<{ key: string; maskedValue: string; encrypted: boolean; label: string | null; group: string }>
  > {
    const where = group ? { group } : {};
    const rows = await this.publicPrisma.saasConfig.findMany({
      where,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    return rows.map((row) => {
      let maskedValue = '';
      if (row.encrypted) {
        try {
          const decrypted = this.encryption.decrypt(row.value);
          maskedValue = decrypted.length > 4
            ? '••••' + decrypted.slice(-4)
            : '••••';
        } catch {
          maskedValue = '(erro ao descriptografar)';
        }
      } else {
        maskedValue = row.value;
      }
      return {
        key: row.key,
        maskedValue,
        encrypted: row.encrypted,
        label: row.label,
        group: row.group,
      };
    });
  }

  /**
   * Delete a config key.
   */
  async delete(key: string): Promise<void> {
    await this.publicPrisma.saasConfig.deleteMany({ where: { key } });
    this.logger.log(`Config "${key}" deleted`);
  }
}
