import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NfeParserService } from './nfe-parser.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';

/* ══════════════════════════════════════════════════════════════════════
   Types — classes (not interfaces) for emitDecoratorMetadata compat
   ══════════════════════════════════════════════════════════════════════ */

export class ProcessItemDecision {
  itemNumber: number;
  action: 'CREATE' | 'LINK' | 'SKIP';
  productId?: string; // required for LINK
}

export class ProcessSupplierDecision {
  action: 'CREATE' | 'LINK';
  partnerId?: string;
}

export class ProcessDecisions {
  supplier: ProcessSupplierDecision;
  items: ProcessItemDecision[];
}

/* ══════════════════════════════════════════════════════════════════════
   Service
   ══════════════════════════════════════════════════════════════════════ */

@Injectable()
export class NfeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: NfeParserService,
  ) {}

  /* ═══════════════════════════════════════════════════════════════════
     upload — Parse XML, create NfeImport + NfeImportItems
     ═══════════════════════════════════════════════════════════════════ */

  async upload(xmlContent: string, companyId: string, sefazDocumentId?: string) {
    const parsed = this.parser.parse(xmlContent);

    // Check duplicate by nfeKey
    if (parsed.nfeKey) {
      const existing = await this.prisma.nfeImport.findUnique({
        where: { nfeKey: parsed.nfeKey },
      });
      if (existing) {
        throw new ConflictException(
          `NFe com chave ${parsed.nfeKey} já foi importada`,
        );
      }
    }

    // Try to find existing supplier by CNPJ
    let supplierId: string | null = null;
    if (parsed.supplier.cnpj) {
      const supplier = await this.prisma.partner.findFirst({
        where: {
          companyId,
          document: parsed.supplier.cnpj,
          deletedAt: null,
        },
      });
      if (supplier) {
        supplierId = supplier.id;
      }
    }

    // Try to match items to existing products by code
    const productMatches = new Map<string, string>(); // productCode -> productId
    for (const item of parsed.items) {
      if (item.productCode) {
        const product = await this.prisma.product.findFirst({
          where: {
            companyId,
            code: item.productCode,
            deletedAt: null,
          },
        });
        if (product) {
          productMatches.set(item.productCode, product.id);
        }
      }
    }

    // Create NfeImport with items in a single transaction
    const nfeImport = await this.prisma.nfeImport.create({
      data: {
        companyId,
        nfeNumber: parsed.nfeNumber || null,
        nfeSeries: parsed.nfeSeries || null,
        nfeKey: parsed.nfeKey || null,
        issueDate: parsed.issueDate ? new Date(parsed.issueDate) : null,
        supplierId,
        supplierCnpj: parsed.supplier.cnpj || null,
        supplierName: parsed.supplier.name || null,
        totalCents: parsed.totalCents,
        status: 'PENDING',
        sefazDocumentId: sefazDocumentId ?? null,
        items: {
          create: parsed.items.map((item) => {
            const matchedProductId = productMatches.get(item.productCode) ?? null;
            return {
              itemNumber: item.itemNumber,
              productCode: item.productCode || null,
              description: item.description || null,
              ncm: item.ncm || null,
              cfop: item.cfop || null,
              unit: item.unit || null,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              totalCents: item.totalCents,
              productId: matchedProductId,
              action: matchedProductId ? 'LINKED' : 'PENDING',
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, description: true, code: true } },
          },
          orderBy: { itemNumber: 'asc' },
        },
      },
    });

    return nfeImport;
  }

  /* ═══════════════════════════════════════════════════════════════════
     findImports — Paginated list of imports with item count
     ═══════════════════════════════════════════════════════════════════ */

  async findImports(
    companyId: string,
    pagination?: PaginationDto,
    status?: string,
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (status) {
      where.status = status;
    }

    if (pagination?.search) {
      where.OR = [
        { nfeNumber: { contains: pagination.search, mode: 'insensitive' } },
        { nfeKey: { contains: pagination.search, mode: 'insensitive' } },
        { supplierName: { contains: pagination.search, mode: 'insensitive' } },
        { supplierCnpj: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    // Dynamic sorting
    const validSortFields = ['nfeNumber', 'supplierName', 'totalCents', 'issueDate', 'createdAt'];
    const orderBy: Record<string, string> = {};
    if (pagination?.sortBy && validSortFields.includes(pagination.sortBy)) {
      orderBy[pagination.sortBy] = pagination.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.nfeImport.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { items: true } },
        },
      }),
      this.prisma.nfeImport.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     findOneImport — Import detail with all items
     ═══════════════════════════════════════════════════════════════════ */

  async findOneImport(id: string, companyId: string) {
    const nfeImport = await this.prisma.nfeImport.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            product: { select: { id: true, description: true, code: true } },
          },
          orderBy: { itemNumber: 'asc' },
        },
      },
    });

    if (!nfeImport) {
      throw new NotFoundException('Importação de NFe não encontrada');
    }

    return nfeImport;
  }

  /* ═══════════════════════════════════════════════════════════════════
     process — Process import based on user decisions
     ═══════════════════════════════════════════════════════════════════ */

  async process(id: string, companyId: string, decisions: ProcessDecisions) {
    const nfeImport = await this.prisma.nfeImport.findFirst({
      where: { id, companyId },
      include: { items: { orderBy: { itemNumber: 'asc' } } },
    });

    if (!nfeImport) {
      throw new NotFoundException('Importação de NFe não encontrada');
    }

    if (nfeImport.status !== 'PENDING') {
      throw new BadRequestException(
        `Importação já está com status ${nfeImport.status}`,
      );
    }

    // Validate supplier decision
    if (decisions.supplier.action === 'LINK' && !decisions.supplier.partnerId) {
      throw new BadRequestException(
        'partnerId é obrigatório quando a ação do fornecedor é LINK',
      );
    }

    // Validate item decisions
    for (const itemDecision of decisions.items) {
      if (itemDecision.action === 'LINK' && !itemDecision.productId) {
        throw new BadRequestException(
          `productId é obrigatório quando a ação do item ${itemDecision.itemNumber} é LINK`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // ── 1. Supplier: CREATE or LINK ────────────────────────────────
      let supplierId: string;

      if (decisions.supplier.action === 'CREATE') {
        const newPartner = await tx.partner.create({
          data: {
            companyId,
            partnerTypes: ['FORNECEDOR'],
            personType: 'PJ',
            name: nfeImport.supplierName || 'Fornecedor NFe',
            document: nfeImport.supplierCnpj || undefined,
            documentType: nfeImport.supplierCnpj ? 'CNPJ' : undefined,
            status: 'ATIVO',
          },
        });
        supplierId = newPartner.id;
      } else {
        // LINK — validate partner belongs to company
        const partner = await tx.partner.findFirst({
          where: { id: decisions.supplier.partnerId!, companyId, deletedAt: null },
        });
        if (!partner) {
          throw new NotFoundException('Fornecedor vinculado não encontrado');
        }

        // Ensure partner has FORNECEDOR type
        if (!partner.partnerTypes.includes('FORNECEDOR')) {
          await tx.partner.update({
            where: { id: partner.id },
            data: {
              partnerTypes: [...partner.partnerTypes, 'FORNECEDOR'],
            },
          });
        }

        supplierId = partner.id;
      }

      // ── 2. Process each item ───────────────────────────────────────
      for (const itemDecision of decisions.items) {
        const nfeItem = nfeImport.items.find(
          (i) => i.itemNumber === itemDecision.itemNumber,
        );
        if (!nfeItem) continue;

        let productId: string | null = null;

        if (itemDecision.action === 'CREATE') {
          // Create new Product from NFe item data
          const newProduct = await tx.product.create({
            data: {
              companyId,
              code: nfeItem.productCode || undefined,
              description: nfeItem.description || 'Produto NFe',
              unit: nfeItem.unit || 'UN',
              ncm: nfeItem.ncm || undefined,
              cfop: nfeItem.cfop || undefined,
              lastPurchasePriceCents: nfeItem.unitPriceCents,
              costCents: nfeItem.unitPriceCents,
              averageCostCents: nfeItem.unitPriceCents,
            },
          });
          productId = newProduct.id;
        } else if (itemDecision.action === 'LINK') {
          // Validate product belongs to company
          const product = await tx.product.findFirst({
            where: { id: itemDecision.productId!, companyId, deletedAt: null },
          });
          if (!product) {
            throw new NotFoundException(
              `Produto vinculado não encontrado para item ${itemDecision.itemNumber}`,
            );
          }
          productId = product.id;

          // Update lastPurchasePriceCents on existing product
          await tx.product.update({
            where: { id: productId },
            data: { lastPurchasePriceCents: nfeItem.unitPriceCents },
          });
        }
        // SKIP: productId stays null

        // Create ProductEquivalent for linked/created products
        if (productId && nfeItem.productCode) {
          // Check if equivalent already exists
          const existingEq = await tx.productEquivalent.findFirst({
            where: {
              productId,
              supplierId,
              supplierCode: nfeItem.productCode,
            },
          });

          if (existingEq) {
            // Update existing equivalent with latest price
            await tx.productEquivalent.update({
              where: { id: existingEq.id },
              data: {
                lastPriceCents: nfeItem.unitPriceCents,
                lastPurchaseDate: nfeImport.issueDate ?? new Date(),
                supplierDescription: nfeItem.description || existingEq.supplierDescription,
              },
            });
          } else {
            await tx.productEquivalent.create({
              data: {
                productId,
                supplierId,
                supplierCode: nfeItem.productCode,
                supplierDescription: nfeItem.description || null,
                lastPriceCents: nfeItem.unitPriceCents,
                lastPurchaseDate: nfeImport.issueDate ?? new Date(),
              },
            });
          }
        }

        // Update NfeImportItem
        await tx.nfeImportItem.update({
          where: { id: nfeItem.id },
          data: {
            productId,
            action: itemDecision.action === 'SKIP' ? 'SKIPPED' : itemDecision.action === 'CREATE' ? 'CREATED' : 'LINKED',
          },
        });
      }

      // ── 3. Create FinancialEntry PAYABLE ───────────────────────────
      const financialEntry = await tx.financialEntry.create({
        data: {
          companyId,
          partnerId: supplierId,
          type: 'PAYABLE',
          status: 'PENDING',
          description: `NFe ${nfeImport.nfeNumber || ''} — ${nfeImport.supplierName || 'Fornecedor'}`,
          grossCents: nfeImport.totalCents ?? 0,
          netCents: nfeImport.totalCents ?? 0,
          dueDate: nfeImport.issueDate ?? undefined,
          notes: nfeImport.nfeKey ? `Chave NFe: ${nfeImport.nfeKey}` : undefined,
        },
      });

      // ── 4. Update NfeImport status ─────────────────────────────────
      await tx.nfeImport.update({
        where: { id },
        data: {
          status: 'PROCESSED',
          supplierId,
          financialEntryId: financialEntry.id,
        },
      });

      return { financialEntryId: financialEntry.id };
    });

    // Return updated import with all relations
    return this.prisma.nfeImport.findFirst({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, description: true, code: true } },
          },
          orderBy: { itemNumber: 'asc' },
        },
      },
    });
  }
}
