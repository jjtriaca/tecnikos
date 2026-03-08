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
    filters?: { category?: string; status?: string; brand?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };

    if (filters?.category) where.category = filters.category;
    if (filters?.status) where.status = filters.status;
    if (filters?.brand) where.brand = { contains: filters.brand, mode: 'insensitive' };

    if (pagination?.search) {
      where.OR = [
        { description: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
        { barcode: { contains: pagination.search, mode: 'insensitive' } },
      ];
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
    await this.findOne(id, companyId);

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
