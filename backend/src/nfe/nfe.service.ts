import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { NfeParserService } from './nfe-parser.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';

/* ══════════════════════════════════════════════════════════════════════
   Types — DTO classes with class-validator decorators
   (whitelist: true strips properties without decorators)
   ══════════════════════════════════════════════════════════════════════ */

export class ProcessItemDecision {
  @IsNumber()
  itemNumber: number;

  @IsString()
  action: 'CREATE' | 'LINK' | 'SKIP';

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  finalidade?: string;
}

export class ProcessSupplierDecision {
  @IsString()
  action: 'CREATE' | 'LINK';

  @IsOptional()
  @IsString()
  partnerId?: string;
}

export class ProcessFinanceDecision {
  @IsBoolean()
  createEntry: boolean;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class ProcessDecisions {
  @ValidateNested()
  @Type(() => ProcessSupplierDecision)
  supplier: ProcessSupplierDecision;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessItemDecision)
  items: ProcessItemDecision[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProcessFinanceDecision)
  finance?: ProcessFinanceDecision;
}

/* ══════════════════════════════════════════════════════════════════════
   Service
   ══════════════════════════════════════════════════════════════════════ */

@Injectable()
export class NfeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
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

    // Try to find existing supplier by CNPJ (normalized — strip non-digits for comparison)
    let supplierId: string | null = null;
    if (parsed.supplier.cnpj) {
      const cnpjDigits = parsed.supplier.cnpj.replace(/\D/g, '');
      const suppliers: { id: string }[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM "Partner" WHERE "companyId" = $1 AND "deletedAt" IS NULL AND regexp_replace(document, '[^0-9]', '', 'g') = $2 LIMIT 1`,
        companyId,
        cnpjDigits,
      );
      if (suppliers.length > 0) {
        supplierId = suppliers[0].id;
      }
    }

    // Try to match items to existing products via ProductEquivalent (supplier code mapping)
    const productMatches = new Map<string, string>(); // supplierProductCode -> productId
    if (supplierId) {
      for (const item of parsed.items) {
        if (item.productCode) {
          const equivalent = await this.prisma.productEquivalent.findFirst({
            where: {
              supplierId,
              supplierCode: item.productCode,
              product: { companyId, deletedAt: null },
            },
            select: { productId: true },
          });
          if (equivalent) {
            productMatches.set(item.productCode, equivalent.productId);
          }
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
        // Fiscal fields (Phase 1)
        indOper: parsed.indOper,
        finNfe: parsed.finNfe,
        baseIcmsCents: parsed.totals.baseIcmsCents,
        icmsCents: parsed.totals.icmsCents,
        baseIcmsStCents: parsed.totals.baseIcmsStCents,
        icmsStCents: parsed.totals.icmsStCents,
        ipiCents: parsed.totals.ipiCents,
        pisCents: parsed.totals.pisCents,
        cofinsCents: parsed.totals.cofinsCents,
        freteCents: parsed.totals.freteCents,
        seguroCents: parsed.totals.seguroCents,
        descontoCents: parsed.totals.descontoCents,
        outrasDespCents: parsed.totals.outrasDespCents,
        infCpl: parsed.infCpl,
        xmlContent: xmlContent, // Store full XML for SPED reference
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
              // Tax fields per item (Phase 1)
              cstIcms: item.cstIcms,
              modBcIcms: item.modBcIcms,
              baseIcmsCents: item.baseIcmsCents,
              aliqIcms: item.aliqIcms,
              icmsCents: item.icmsCents,
              baseIcmsStCents: item.baseIcmsStCents,
              aliqIcmsSt: item.aliqIcmsSt,
              icmsStCents: item.icmsStCents,
              cstIpi: item.cstIpi,
              baseIpiCents: item.baseIpiCents,
              aliqIpi: item.aliqIpi,
              ipiCents: item.ipiCents,
              cstPis: item.cstPis,
              basePisCents: item.basePisCents,
              aliqPis: item.aliqPis,
              pisCents: item.pisCents,
              cstCofins: item.cstCofins,
              baseCofinsCents: item.baseCofinsCents,
              aliqCofins: item.aliqCofins,
              cofinsCents: item.cofinsCents,
              freteCents: item.freteCents,
              seguroCents: item.seguroCents,
              descontoCents: item.descontoCents,
              outrasDespCents: item.outrasDespCents,
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

    // Enrich response with matched supplier name for frontend wizard
    let supplierMatchedName: string | null = null;
    if (nfeImport.supplierId) {
      const supplier = await this.prisma.partner.findUnique({
        where: { id: nfeImport.supplierId },
        select: { name: true },
      });
      supplierMatchedName = supplier?.name ?? null;
    }

    return { ...nfeImport, supplierMatchedName };
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

    // Enrich with supplier name
    let supplierMatchedName: string | null = null;
    if (nfeImport.supplierId) {
      const supplier = await this.prisma.partner.findUnique({
        where: { id: nfeImport.supplierId },
        select: { name: true },
      });
      supplierMatchedName = supplier?.name ?? null;
    }

    return { ...nfeImport, supplierMatchedName };
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
    if (!decisions.supplier) {
      throw new BadRequestException('Decisão do fornecedor é obrigatória');
    }
    if (decisions.supplier.action === 'LINK' && !decisions.supplier.partnerId) {
      throw new BadRequestException(
        'partnerId é obrigatório quando a ação do fornecedor é LINK',
      );
    }

    // Normalize item decisions: filter out nulls, map IGNORE→SKIP for frontend compat
    const itemDecisions = (decisions.items || [])
      .filter((item): item is ProcessItemDecision => item != null)
      .map((item) => ({
        ...item,
        action: (item.action === ('IGNORE' as any) ? 'SKIP' : item.action) as ProcessItemDecision['action'],
      }));

    // Validate item decisions
    for (const itemDecision of itemDecisions) {
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
        const partnerCode = await this.codeGenerator.generateCode(companyId, 'PARTNER');
        const newPartner = await tx.partner.create({
          data: {
            companyId,
            code: partnerCode,
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
      for (const itemDecision of itemDecisions) {
        const nfeItem = nfeImport.items.find(
          (i) => i.itemNumber === itemDecision.itemNumber,
        );
        if (!nfeItem) continue;

        let productId: string | null = null;

        if (itemDecision.action === 'CREATE') {
          // Create new Product from NFe item data
          const productCode = await this.codeGenerator.generateCode(companyId, 'PRODUCT');
          const newProduct = await tx.product.create({
            data: {
              companyId,
              code: productCode,
              description: nfeItem.description || 'Produto NFe',
              unit: nfeItem.unit || 'UN',
              ncm: nfeItem.ncm || undefined,
              cfop: nfeItem.cfop || undefined,
              lastPurchasePriceCents: nfeItem.unitPriceCents,
              costCents: nfeItem.unitPriceCents,
              averageCostCents: nfeItem.unitPriceCents,
              finalidade: itemDecision.finalidade || undefined,
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

          // Update lastPurchasePriceCents and finalidade on existing product
          await tx.product.update({
            where: { id: productId },
            data: {
              lastPurchasePriceCents: nfeItem.unitPriceCents,
              ...(itemDecision.finalidade ? { finalidade: itemDecision.finalidade } : {}),
            },
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

      // ── 3. Create FinancialEntry PAYABLE (optional) ─────────────────
      const shouldCreateEntry = decisions.finance?.createEntry !== false; // default true for backward compat
      let financialEntryId: string | null = null;

      if (shouldCreateEntry) {
        const dueDate = decisions.finance?.dueDate
          ? new Date(decisions.finance.dueDate)
          : (nfeImport.issueDate ?? undefined);

        const finCode = await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY');
        const financialEntry = await tx.financialEntry.create({
          data: {
            companyId,
            code: finCode,
            partnerId: supplierId,
            type: 'PAYABLE',
            status: 'PENDING',
            description: `NFe ${nfeImport.nfeNumber || ''} — ${nfeImport.supplierName || 'Fornecedor'}`,
            grossCents: nfeImport.totalCents ?? 0,
            netCents: nfeImport.totalCents ?? 0,
            dueDate,
            notes: nfeImport.nfeKey ? `Chave NFe: ${nfeImport.nfeKey}` : undefined,
          },
        });
        financialEntryId = financialEntry.id;
      }

      // ── 4. Update NfeImport status ─────────────────────────────────
      await tx.nfeImport.update({
        where: { id },
        data: {
          status: 'PROCESSED',
          supplierId,
          financialEntryId,
        },
      });

      // ── 5. Update linked SefazDocument status to IMPORTED ─────────
      if (nfeImport.sefazDocumentId) {
        await tx.sefazDocument.update({
          where: { id: nfeImport.sefazDocumentId },
          data: { status: 'IMPORTED' },
        });
      }

      return { financialEntryId };
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

  /* ═══════════════════════════════════════════════════════════════════
     revert — Undo a processed import: delete created records, reset status
     ═══════════════════════════════════════════════════════════════════ */

  async revert(id: string, companyId: string) {
    const nfeImport = await this.prisma.nfeImport.findFirst({
      where: { id, companyId },
      include: { items: true },
    });

    if (!nfeImport) {
      throw new NotFoundException('Importação de NFe não encontrada');
    }

    if (nfeImport.status !== 'PROCESSED') {
      throw new BadRequestException(
        'Somente importações com status PROCESSADO podem ser revertidas',
      );
    }

    // Check if financial entry is paid — block revert
    if (nfeImport.financialEntryId) {
      const entry = await this.prisma.financialEntry.findUnique({
        where: { id: nfeImport.financialEntryId },
      });
      if (entry && entry.status === 'PAID') {
        throw new BadRequestException(
          'Lançamento financeiro já está pago. Cancele o pagamento antes de reverter.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // ── 1. Delete FinancialEntry created by this import ──────────
      if (nfeImport.financialEntryId) {
        await tx.financialEntry.delete({
          where: { id: nfeImport.financialEntryId },
        });
      }

      // ── 2. Handle products created by this import ────────────────
      const createdItems = nfeImport.items.filter(
        (i) => i.action === 'CREATED' && i.productId,
      );

      for (const item of createdItems) {
        // Delete ProductEquivalents for this product
        await tx.productEquivalent.deleteMany({
          where: { productId: item.productId! },
        });

        // Check if product is referenced by other imports
        const otherRefs = await tx.nfeImportItem.count({
          where: {
            productId: item.productId!,
            id: { not: item.id },
            action: { not: 'PENDING' },
          },
        });

        if (otherRefs === 0) {
          // Safe to delete — no other references
          await tx.product.delete({ where: { id: item.productId! } });
        } else {
          // Used elsewhere — soft delete
          await tx.product.update({
            where: { id: item.productId! },
            data: { deletedAt: new Date() },
          });
        }
      }

      // ── 3. Reset all NfeImportItems ──────────────────────────────
      await tx.nfeImportItem.updateMany({
        where: { nfeImportId: id },
        data: { action: 'PENDING', productId: null },
      });

      // ── 4. Reset NfeImport status ────────────────────────────────
      await tx.nfeImport.update({
        where: { id },
        data: {
          status: 'PENDING',
          financialEntryId: null,
        },
      });

      // ── 5. Reset SefazDocument status to FETCHED ─────────────────
      if (nfeImport.sefazDocumentId) {
        await tx.sefazDocument.update({
          where: { id: nfeImport.sefazDocumentId },
          data: { status: 'FETCHED' },
        });
      }
    });

    // Return updated import
    return this.findOneImport(id, companyId);
  }
}
