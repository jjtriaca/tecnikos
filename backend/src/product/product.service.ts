import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/util/build-order-by';
import { buildSearchWhere } from '../common/util/build-search-where';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_SORTABLE = [
  'description',
  'code',
  'currentStock',
  'salePriceCents',
  'costCents',
  'createdAt',
];

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  /* ═══════════════════════════════════════════════════════════════
     findAll — Paginated list with filters
     ═══════════════════════════════════════════════════════════════ */

  async findAll(
    companyId: string,
    pagination?: PaginationDto,
    filters?: { category?: string; status?: string; brand?: string; usage?: 'sale' | 'work' | 'both'; poolType?: string; finalidade?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };

    if (filters?.category) where.category = filters.category;
    if (filters?.status) where.status = filters.status;
    if (filters?.brand) where.brand = { contains: filters.brand, mode: 'insensitive' };
    if (filters?.poolType) where.poolType = filters.poolType;
    if (filters?.finalidade) where.finalidade = filters.finalidade;
    if (filters?.usage === 'sale') where.useInSale = true;
    else if (filters?.usage === 'work') where.useInWork = true;
    else if (filters?.usage === 'both') {
      where.useInSale = true;
      where.useInWork = true;
    }

    if (pagination?.search) {
      const searchClause = buildSearchWhere(pagination.search, [
        { field: 'description', mode: 'insensitive' },
        { field: 'code', mode: 'insensitive' },
        { field: 'barcode', mode: 'insensitive' },
      ]);
      if (searchClause) Object.assign(where, searchClause);
    }

    const orderBy = buildOrderBy(
      pagination?.sortBy,
      pagination?.sortOrder,
      PRODUCT_SORTABLE,
      { createdAt: 'desc' },
    );

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { equivalents: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     listPoolTypes — DISTINCT poolType (alimenta dropdown da regra)
     ═══════════════════════════════════════════════════════════════ */

  async listPoolTypes(companyId: string): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { companyId, deletedAt: null, poolType: { not: null } },
      select: { poolType: true },
      distinct: ['poolType'],
      orderBy: { poolType: 'asc' },
    });
    return rows.map((r) => r.poolType!).filter((t) => t && t.trim().length > 0);
  }

  /* ═══════════════════════════════════════════════════════════════
     ensureSemProduto — garante que existe um Product "Sem Produto"
     universal no tenant. Idempotente: busca por description (case-insensitive),
     cria se nao existe. Usado como placeholder universal no catalog picker
     (botao virtual "Sem produto / servico"). Tudo com valor 0.
     ═══════════════════════════════════════════════════════════════ */

  async ensureSemProduto(companyId: string): Promise<{ id: string; description: string; unit: string; salePriceCents: number }> {
    // Busca case-insensitive. Se existe mas nao esta marcado como system, marca.
    const existing = await this.prisma.product.findFirst({
      where: {
        companyId,
        deletedAt: null,
        description: { equals: 'Sem Produto', mode: 'insensitive' },
      },
      select: { id: true, description: true, unit: true, salePriceCents: true, isSystemProduct: true },
    });
    if (existing) {
      if (!existing.isSystemProduct) {
        await this.prisma.product.update({
          where: { id: existing.id },
          data: { isSystemProduct: true },
        });
      }
      return {
        id: existing.id,
        description: existing.description,
        unit: existing.unit,
        salePriceCents: existing.salePriceCents ?? 0,
      };
    }

    const code = await this.codeGenerator.generateCode(companyId, 'PRODUCT');
    const created = await this.prisma.product.create({
      data: {
        companyId,
        code,
        description: 'Sem Produto',
        unit: 'UN',
        salePriceCents: 0,
        costCents: 0,
        useInSale: false,
        useInWork: true,
        status: 'ATIVO',
        isSystemProduct: true,
      },
      select: { id: true, description: true, unit: true, salePriceCents: true },
    });
    return { ...created, salePriceCents: created.salePriceCents ?? 0 };
  }

  /* ═══════════════════════════════════════════════════════════════
     listFilterOptions — DISTINCT categories + brands + poolTypes
     pra alimentar os dropdowns de filtro da lista de produtos.
     ═══════════════════════════════════════════════════════════════ */

  async listFilterOptions(companyId: string): Promise<{
    categories: string[];
    brands: string[];
    poolTypes: string[];
  }> {
    const [cats, brands, types] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId, deletedAt: null, category: { not: null } },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { companyId, deletedAt: null, brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { companyId, deletedAt: null, poolType: { not: null } },
        select: { poolType: true },
        distinct: ['poolType'],
        orderBy: { poolType: 'asc' },
      }),
    ]);
    return {
      categories: cats.map((c) => c.category!).filter((s) => s && s.trim().length > 0),
      brands: brands.map((b) => b.brand!).filter((s) => s && s.trim().length > 0),
      poolTypes: types.map((t) => t.poolType!).filter((s) => s && s.trim().length > 0),
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     findOne — Detail with equivalents + supplier info
     ═══════════════════════════════════════════════════════════════ */

  async findOne(id: string, companyId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        equivalents: {
          include: {
            supplier: { select: { id: true, name: true, document: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  /* ═══════════════════════════════════════════════════════════════
     create — Create product, validate unique code per company
     ═══════════════════════════════════════════════════════════════ */

  async create(data: CreateProductDto, companyId: string) {
    const code = await this.codeGenerator.generateCode(companyId, 'PRODUCT');

    return this.prisma.product.create({
      data: {
        companyId,
        code,
        barcode: data.barcode,
        description: data.description,
        brand: data.brand,
        model: data.model,
        unit: data.unit ?? 'UN',
        ncm: data.ncm,
        cest: data.cest,
        origin: data.origin,
        category: data.category,
        icmsRate: data.icmsRate,
        ipiRate: data.ipiRate,
        pisRate: data.pisRate,
        cofinsRate: data.cofinsRate,
        csosn: data.csosn,
        cfop: data.cfop,
        cst: data.cst,
        cstPis: data.cstPis,
        cstCofins: data.cstCofins,
        costCents: data.costCents,
        salePriceCents: data.salePriceCents,
        profitMarginPercent: data.profitMarginPercent,
        currentStock: data.currentStock ?? 0,
        minStock: data.minStock,
        maxStock: data.maxStock,
        location: data.location,
        useInSale: data.useInSale,
        useInWork: data.useInWork,
        technicalSpecs: data.technicalSpecs as any,
        imageUrl: data.imageUrl,
        poolType: data.poolType,
      },
      include: {
        _count: { select: { equivalents: true } },
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     update — Update product
     ═══════════════════════════════════════════════════════════════ */

  async update(id: string, companyId: string, data: UpdateProductDto) {
    const product = await this.findOne(id, companyId);

    // Produtos padrao do sistema (ex: "Sem Produto"): bloqueia alterar campos
    // que quebrariam a identificacao do registro. Permite editar campos secundarios
    // (estoque, NCM, fiscal) caso necessario, mas description/code sao imutaveis.
    if ((product as any).isSystemProduct) {
      if (data.description !== undefined && data.description !== product.description) {
        throw new BadRequestException(
          'Este produto e padrao do sistema — a descricao nao pode ser alterada.',
        );
      }
      if (data.code !== undefined && data.code !== product.code) {
        throw new BadRequestException(
          'Este produto e padrao do sistema — o codigo nao pode ser alterado.',
        );
      }
      if (data.status !== undefined && data.status !== 'ATIVO') {
        throw new BadRequestException(
          'Este produto e padrao do sistema — deve permanecer ATIVO.',
        );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        barcode: data.barcode,
        description: data.description,
        brand: data.brand,
        model: data.model,
        unit: data.unit,
        ncm: data.ncm,
        cest: data.cest,
        origin: data.origin,
        category: data.category,
        icmsRate: data.icmsRate,
        ipiRate: data.ipiRate,
        pisRate: data.pisRate,
        cofinsRate: data.cofinsRate,
        csosn: data.csosn,
        cfop: data.cfop,
        cst: data.cst,
        cstPis: data.cstPis,
        cstCofins: data.cstCofins,
        costCents: data.costCents,
        salePriceCents: data.salePriceCents,
        profitMarginPercent: data.profitMarginPercent,
        currentStock: data.currentStock,
        minStock: data.minStock,
        maxStock: data.maxStock,
        location: data.location,
        status: data.status,
        useInSale: data.useInSale,
        useInWork: data.useInWork,
        technicalSpecs: data.technicalSpecs as any,
        imageUrl: data.imageUrl,
        poolType: data.poolType,
      },
      include: {
        _count: { select: { equivalents: true } },
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     delete — Soft delete
     ═══════════════════════════════════════════════════════════════ */

  async delete(id: string, companyId: string) {
    const product = await this.findOne(id, companyId);

    // Bloqueia delete de produtos padrao do sistema (ex: "Sem Produto" universal)
    if ((product as any).isSystemProduct) {
      throw new BadRequestException(
        'Este produto e padrao do sistema e nao pode ser deletado. E necessario pra funcionamento da opcao "Sem Produto" no catalogo.',
      );
    }

    // Clean up NfeImportItems on PENDING imports that reference this product
    await this.prisma.$executeRaw`
      UPDATE "NfeImportItem" SET "productId" = NULL, "action" = 'PENDING'
      WHERE "productId" = ${id}
        AND "nfeImportId" IN (
          SELECT i.id FROM "NfeImport" i WHERE i.status = 'PENDING'
        )
    `;

    // Delete ProductEquivalents
    await this.prisma.productEquivalent.deleteMany({
      where: { productId: id },
    });

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     adjustStock — Adjust stock by delta, recalculate average cost
     ═══════════════════════════════════════════════════════════════ */

  async adjustStock(
    id: string,
    companyId: string,
    delta: number,
    reason?: string,
  ) {
    const product = await this.findOne(id, companyId);

    const newStock = product.currentStock + delta;
    if (newStock < 0) {
      throw new BadRequestException(
        `Estoque resultante (${newStock}) não pode ser negativo`,
      );
    }

    const updateData: any = { currentStock: newStock };

    // Recalculate averageCostCents when adding stock (delta > 0) and lastPurchasePriceCents exists
    if (delta > 0 && product.lastPurchasePriceCents != null) {
      const oldTotal = (product.averageCostCents ?? 0) * product.currentStock;
      const newTotal = oldTotal + product.lastPurchasePriceCents * delta;
      updateData.averageCostCents = newStock > 0
        ? Math.round(newTotal / newStock)
        : 0;
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    return {
      ...updated,
      stockDelta: delta,
      reason: reason || null,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     Equivalents — List / Add / Remove
     ═══════════════════════════════════════════════════════════════ */

  async findEquivalents(productId: string, companyId: string) {
    // Ensure product belongs to company
    await this.findOne(productId, companyId);

    return this.prisma.productEquivalent.findMany({
      where: { productId },
      include: {
        supplier: { select: { id: true, name: true, document: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addEquivalent(
    productId: string,
    companyId: string,
    data: {
      supplierId: string;
      supplierCode: string;
      supplierDescription?: string;
      lastPriceCents?: number;
    },
  ) {
    // Ensure product belongs to company
    await this.findOne(productId, companyId);

    // Validate supplier belongs to company
    const supplier = await this.prisma.partner.findFirst({
      where: { id: data.supplierId, companyId, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado nesta empresa');
    }

    // Check for duplicate (productId + supplierId + supplierCode)
    const existing = await this.prisma.productEquivalent.findFirst({
      where: {
        productId,
        supplierId: data.supplierId,
        supplierCode: data.supplierCode,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Este equivalente já está cadastrado para este produto',
      );
    }

    return this.prisma.productEquivalent.create({
      data: {
        productId,
        supplierId: data.supplierId,
        supplierCode: data.supplierCode,
        supplierDescription: data.supplierDescription,
        lastPriceCents: data.lastPriceCents,
      },
      include: {
        supplier: { select: { id: true, name: true, document: true } },
      },
    });
  }

  async removeEquivalent(
    productId: string,
    equivalentId: string,
    companyId: string,
  ) {
    // Ensure product belongs to company
    await this.findOne(productId, companyId);

    const equivalent = await this.prisma.productEquivalent.findFirst({
      where: { id: equivalentId, productId },
    });
    if (!equivalent) {
      throw new NotFoundException('Equivalente não encontrado');
    }

    return this.prisma.productEquivalent.delete({
      where: { id: equivalentId },
    });
  }
}
