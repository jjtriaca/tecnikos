import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialAccountDto, UpdateFinancialAccountDto } from './dto/financial-account.dto';

const DEFAULT_ACCOUNTS = [
  // REVENUE
  { code: '1000', name: 'Receitas Operacionais', type: 'REVENUE', level: 1, allowPosting: false, isSystem: true, sortOrder: 100 },
  { code: '1100', name: 'Receita de Serviços', type: 'REVENUE', level: 2, allowPosting: true, isSystem: true, sortOrder: 110, parentCode: '1000' },
  { code: '1200', name: 'Receita de Produtos', type: 'REVENUE', level: 2, allowPosting: true, isSystem: false, sortOrder: 120, parentCode: '1000' },
  { code: '1300', name: 'Descontos Concedidos', type: 'REVENUE', level: 2, allowPosting: true, isSystem: false, sortOrder: 130, parentCode: '1000' },

  // COST
  { code: '2000', name: 'Custos de Serviços Prestados', type: 'COST', level: 1, allowPosting: false, isSystem: true, sortOrder: 200 },
  { code: '2100', name: 'Mão de Obra Técnica', type: 'COST', level: 2, allowPosting: true, isSystem: true, sortOrder: 210, parentCode: '2000' },
  { code: '2200', name: 'Materiais e Peças', type: 'COST', level: 2, allowPosting: true, isSystem: false, sortOrder: 220, parentCode: '2000' },
  { code: '2300', name: 'Combustível e Deslocamento', type: 'COST', level: 2, allowPosting: true, isSystem: false, sortOrder: 230, parentCode: '2000' },

  // EXPENSE - Administrative
  { code: '3000', name: 'Despesas Administrativas', type: 'EXPENSE', level: 1, allowPosting: false, isSystem: true, sortOrder: 300 },
  { code: '3100', name: 'Salários e Encargos', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 310, parentCode: '3000' },
  { code: '3200', name: 'Aluguel', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 320, parentCode: '3000' },
  { code: '3300', name: 'Água', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 330, parentCode: '3000' },
  { code: '3400', name: 'Energia Elétrica', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 340, parentCode: '3000' },
  { code: '3500', name: 'Internet e Telefone', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 350, parentCode: '3000' },
  { code: '3600', name: 'Despesas Gerais', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 360, parentCode: '3000' },

  // EXPENSE - Commercial
  { code: '4000', name: 'Despesas Comerciais', type: 'EXPENSE', level: 1, allowPosting: false, isSystem: false, sortOrder: 400 },
  { code: '4100', name: 'Marketing e Publicidade', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 410, parentCode: '4000' },
  { code: '4200', name: 'Comissões', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 420, parentCode: '4000' },

  // EXPENSE - Financial
  { code: '5000', name: 'Despesas Financeiras', type: 'EXPENSE', level: 1, allowPosting: false, isSystem: true, sortOrder: 500 },
  { code: '5100', name: 'Juros e Multas', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 510, parentCode: '5000' },
  { code: '5200', name: 'Taxas de Cartão', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: true, sortOrder: 520, parentCode: '5000' },
  { code: '5300', name: 'Taxas Bancárias', type: 'EXPENSE', level: 2, allowPosting: true, isSystem: false, sortOrder: 530, parentCode: '5000' },
];

@Injectable()
export class FinancialAccountService {
  private readonly logger = new Logger(FinancialAccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedDefaults(companyId: string): Promise<void> {
    const existing = await this.prisma.financialAccount.count({ where: { companyId } });
    if (existing > 0) return; // Already seeded

    this.logger.log(`Seeding default financial accounts for company ${companyId}`);

    // Create parent accounts first
    const parents = DEFAULT_ACCOUNTS.filter(a => a.level === 1);
    const parentMap = new Map<string, string>(); // code -> id

    for (const p of parents) {
      const created = await this.prisma.financialAccount.create({
        data: {
          companyId,
          code: p.code,
          name: p.name,
          type: p.type,
          level: p.level,
          allowPosting: p.allowPosting,
          isSystem: p.isSystem,
          sortOrder: p.sortOrder,
        },
      });
      parentMap.set(p.code, created.id);
    }

    // Create child accounts
    const children = DEFAULT_ACCOUNTS.filter(a => a.level === 2) as (typeof DEFAULT_ACCOUNTS[0] & { parentCode: string })[];
    for (const c of children) {
      const parentId = parentMap.get(c.parentCode);
      await this.prisma.financialAccount.create({
        data: {
          companyId,
          code: c.code,
          name: c.name,
          type: c.type,
          parentId,
          level: c.level,
          allowPosting: c.allowPosting,
          isSystem: c.isSystem,
          sortOrder: c.sortOrder,
        },
      });
    }

    this.logger.log(`Seeded ${DEFAULT_ACCOUNTS.length} financial accounts for company ${companyId}`);
  }

  async findAll(companyId: string, type?: string) {
    // Fetch ALL accounts (groups + subgroups) in a single query to avoid
    // issues with Prisma relation include on self-referential models in
    // tenant schemas. Build the tree manually.
    const where: any = { companyId, deletedAt: null };
    if (type) where.type = type;

    const allAccounts = await this.prisma.financialAccount.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    // Separate groups (level 1) and subgroups (level 2)
    const groups = allAccounts.filter(a => a.level === 1);
    const subgroups = allAccounts.filter(a => a.level === 2);

    // Build a parentId -> children map
    const childrenMap = new Map<string, typeof subgroups>();
    for (const sub of subgroups) {
      if (!sub.parentId) continue;
      const list = childrenMap.get(sub.parentId) || [];
      list.push(sub);
      childrenMap.set(sub.parentId, list);
    }

    // Attach children to each group
    return groups.map(g => ({
      ...g,
      children: childrenMap.get(g.id) || [],
    }));
  }

  async findPostable(companyId: string, type?: string) {
    const where: any = { companyId, deletedAt: null, allowPosting: true, isActive: true };
    if (type) where.type = type;

    return this.prisma.financialAccount.findMany({
      where,
      include: { parent: { select: { id: true, code: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findByCode(companyId: string, code: string) {
    return this.prisma.financialAccount.findUnique({
      where: { companyId_code: { companyId, code } },
    });
  }

  async create(companyId: string, dto: CreateFinancialAccountDto) {
    // Check unique code
    const existing = await this.prisma.financialAccount.findUnique({
      where: { companyId_code: { companyId, code: dto.code } },
    });
    if (existing) throw new BadRequestException(`Código ${dto.code} já existe`);

    let parentId = dto.parentId;
    let level = 1;

    if (parentId) {
      const parent = await this.prisma.financialAccount.findFirst({
        where: { id: parentId, companyId, deletedAt: null },
      });
      if (!parent) throw new NotFoundException('Grupo pai não encontrado');
      if (parent.level !== 1) throw new BadRequestException('Subgrupos não podem ter filhos');
      level = 2;
    }

    return this.prisma.financialAccount.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId,
        level,
        allowPosting: level === 2, // Only subgroups allow posting
        sortOrder: dto.sortOrder || 0,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateFinancialAccountDto) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.financialAccount.update({ where: { id }, data });
  }

  async delete(id: string, companyId: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { _count: { select: { entries: true, children: true } } },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');
    if (account.isSystem) throw new BadRequestException('Contas do sistema não podem ser excluídas');
    if (account._count.entries > 0) throw new BadRequestException('Conta possui lançamentos vinculados');
    if (account._count.children > 0) throw new BadRequestException('Grupo possui subgrupos — exclua-os primeiro');

    return this.prisma.financialAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
