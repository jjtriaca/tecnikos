import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Manages cached PrismaClient instances per tenant schema.
 * Each tenant gets its own PrismaClient connected to its PostgreSQL schema.
 * Max ~20 tenants = ~20 PrismaClients with connection_limit=3 each = ~60 connections.
 */
@Injectable()
export class TenantConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly clients = new Map<string, PrismaClient>();

  /**
   * Get a PrismaClient for a specific tenant schema.
   * Creates and caches one if it doesn't exist yet.
   */
  getClient(schemaName: string): PrismaClient {
    if (!schemaName) {
      throw new Error('schemaName is required');
    }

    let client = this.clients.get(schemaName);
    if (client) return client;

    const baseUrl = process.env.DATABASE_URL || '';
    // Replace ?schema=public with ?schema=tenant_xxx,public
    // Including public ensures PostgreSQL enum types (UserRole, etc.) are found
    const tenantUrl = baseUrl.includes('?schema=')
      ? baseUrl.replace(/\?schema=[^&]+/, `?schema=${schemaName},public`)
      : `${baseUrl}?schema=${schemaName},public`;

    client = new PrismaClient({
      datasources: { db: { url: tenantUrl } },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    client.$connect().catch((err) => {
      this.logger.error(`Failed to connect tenant "${schemaName}": ${err.message}`);
    });

    this.clients.set(schemaName, client);
    this.logger.log(`Created PrismaClient for schema "${schemaName}" (total: ${this.clients.size})`);
    return client;
  }

  /**
   * Remove and disconnect a specific tenant client (e.g., after cancellation).
   */
  async removeClient(schemaName: string): Promise<void> {
    const client = this.clients.get(schemaName);
    if (client) {
      await client.$disconnect();
      this.clients.delete(schemaName);
      this.logger.log(`Disconnected tenant "${schemaName}" (total: ${this.clients.size})`);
    }
  }

  /**
   * Disconnect all tenant clients on module destroy.
   */
  async onModuleDestroy(): Promise<void> {
    const disconnects = Array.from(this.clients.entries()).map(async ([name, client]) => {
      try {
        await client.$disconnect();
      } catch (err) {
        this.logger.warn(`Error disconnecting "${name}": ${(err as Error).message}`);
      }
    });
    await Promise.all(disconnects);
    this.clients.clear();
    this.logger.log('All tenant connections closed');
  }

  /** Get number of active tenant connections */
  get size(): number {
    return this.clients.size;
  }

  /** Get all schema names with active connections */
  get schemas(): string[] {
    return Array.from(this.clients.keys());
  }
}
