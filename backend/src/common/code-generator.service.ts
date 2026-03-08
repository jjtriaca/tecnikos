import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CodeEntity =
  | 'PARTNER'
  | 'SERVICE_ORDER'
  | 'FINANCIAL_ENTRY'
  | 'EVALUATION'
  | 'USER';

const ENTITY_PREFIX: Record<CodeEntity, string> = {
  PARTNER: 'PAR',
  SERVICE_ORDER: 'OS',
  FINANCIAL_ENTRY: 'FIN',
  EVALUATION: 'AVA',
  USER: 'USR',
};

@Injectable()
export class CodeGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate the next sequential code for a given entity+company.
   * Uses CodeCounter table with atomic increment to avoid race conditions.
   * Format: PREFIX-00001
   */
  async generateCode(companyId: string, entity: CodeEntity): Promise<string> {
    const prefix = ENTITY_PREFIX[entity];

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
    return `${prefix}-${String(number).padStart(5, '0')}`;
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
