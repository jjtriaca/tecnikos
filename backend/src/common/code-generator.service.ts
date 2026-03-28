import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CodeEntity =
  | 'PARTNER'
  | 'SERVICE_ORDER'
  | 'FINANCIAL_ENTRY'
  | 'EVALUATION'
  | 'USER'
  | 'PRODUCT'
  | 'SERVICE'
  | 'QUOTE'
  | 'CASH_ACCOUNT';

const ENTITY_PREFIX: Record<CodeEntity, string> = {
  PARTNER: 'PAR',
  SERVICE_ORDER: 'OS',
  FINANCIAL_ENTRY: 'FIN',
  EVALUATION: 'AVA',
  USER: 'USR',
  PRODUCT: 'PRD',
  SERVICE: 'SRV',
  QUOTE: 'ORC',
  CASH_ACCOUNT: 'CX',
};

const ENTITY_TABLE: Record<CodeEntity, string> = {
  PARTNER: 'Partner',
  SERVICE_ORDER: 'ServiceOrder',
  FINANCIAL_ENTRY: 'FinancialEntry',
  EVALUATION: 'Evaluation',
  USER: 'User',
  PRODUCT: 'Product',
  SERVICE: 'Service',
  QUOTE: 'Quote',
  CASH_ACCOUNT: 'CashAccount',
};

@Injectable()
export class CodeGeneratorService {
  private readonly logger = new Logger(CodeGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate the next sequential code for a given entity+company.
   * Uses CodeCounter table with atomic increment.
   * If a collision occurs, auto-corrects the counter based on the highest
   * existing code in the table and retries.
   * Format: PREFIX-00001
   */
  async generateCode(companyId: string, entity: CodeEntity, maxRetries = 3): Promise<string> {
    const prefix = ENTITY_PREFIX[entity];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Upsert + atomic increment in a single query
      const counter = await this.prisma.codeCounter.upsert({
        where: { companyId_entity: { companyId, entity } },
        create: {
          companyId,
          entity,
          prefix,
          nextNumber: 2, // We'll use 1 for this call
        },
        update: {
          nextNumber: { increment: 1 },
        },
      });

      // On create, nextNumber is 2 (we use 1). On update, nextNumber is already incremented.
      const number = counter.nextNumber - 1;
      const code = `${prefix}-${String(number).padStart(5, '0')}`;

      // Check if the code already exists in the table
      const table = ENTITY_TABLE[entity];
      const existing: { id: string }[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM "${table}" WHERE "companyId" = $1 AND code = $2 LIMIT 1`,
        companyId,
        code,
      );

      if (existing.length === 0) {
        return code; // No collision, safe to use
      }

      // Collision detected — auto-correct the counter
      this.logger.warn(
        `⚠️ Code collision: ${code} already exists for ${entity}. Auto-correcting counter (attempt ${attempt + 1}/${maxRetries})...`,
      );

      // Find the highest existing code number for this prefix
      const maxResult: { max_num: number | null }[] = await this.prisma.$queryRawUnsafe(
        `SELECT MAX(CAST(SUBSTRING(code FROM '[0-9]+$') AS INTEGER)) as max_num ` +
        `FROM "${table}" WHERE "companyId" = $1 AND code LIKE $2`,
        companyId,
        `${prefix}-%`,
      );

      const maxExisting = maxResult[0]?.max_num || 0;
      const correctedNext = maxExisting + 2; // +1 for the one we'll use, +1 for nextNumber

      await this.prisma.codeCounter.update({
        where: { companyId_entity: { companyId, entity } },
        data: { nextNumber: correctedNext },
      });

      this.logger.log(
        `✅ Counter corrected: ${entity} nextNumber set to ${correctedNext} (max existing: ${prefix}-${String(maxExisting).padStart(5, '0')})`,
      );

      // Retry with corrected counter (loop continues)
    }

    // Should never reach here, but just in case
    throw new Error(`Failed to generate unique code for ${entity} after ${maxRetries} retries`);
  }

  /**
   * Backfill codes for all existing records of a given entity.
   * Called from PrismaService self-healing on startup.
   */
  async backfillCodes(
    companyId: string,
    entity: CodeEntity,
    tableName: string,
  ): Promise<number> {
    const prefix = ENTITY_PREFIX[entity];

    // Find records without code
    const records: { id: string }[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "${tableName}" WHERE "companyId" = $1 AND code IS NULL ORDER BY "createdAt" ASC`,
      companyId,
    );

    if (records.length === 0) return 0;

    // Get or create counter
    let counter = await this.prisma.codeCounter.findUnique({
      where: { companyId_entity: { companyId, entity } },
    });

    let nextNum = counter?.nextNumber ?? 1;

    // Assign codes in order of creation
    for (const record of records) {
      const code = `${prefix}-${String(nextNum).padStart(5, '0')}`;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${tableName}" SET code = $1 WHERE id = $2`,
        code,
        record.id,
      );
      nextNum++;
    }

    // Update counter
    await this.prisma.codeCounter.upsert({
      where: { companyId_entity: { companyId, entity } },
      create: { companyId, entity, prefix, nextNumber: nextNum },
      update: { nextNumber: nextNum },
    });

    return records.length;
  }
}
