import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PoolBudgetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { CreatePoolBudgetDto } from './dto/create-pool-budget.dto';
import { UpdatePoolBudgetDto } from './dto/update-pool-budget.dto';
import { QueryPoolBudgetDto } from './dto/query-pool-budget.dto';
import { evaluateFormula, extractCellRefs, extractDimensionVars, extractEnvVars, extractProductVars, type CellRefData } from './formula-eval';
import { selectBestCandidate, evaluateIndicator, filterCandidates, filterByWhere, type AutoSelectRule } from './auto-select.helper';
import { CreateBudgetItemDto, UpdateBudgetItemDto } from './dto/budget-item.dto';
import {
  PoolFormulaService,
  PoolFormulaConfig,
  PoolConditionConfig,
} from './pool-formula.service';
import * as fs from 'fs';
import * as path from 'path';

interface TemplateSection {
  section: string;
  sortOrder?: number;
  items: Array<{
    catalogConfigId: string;
    sortOrder?: number;
    required?: boolean;
  }>;
}

@Injectable()
export class PoolBudgetService {
  private readonly logger = new Logger(PoolBudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codeGenerator: CodeGeneratorService,
    private readonly formulaService: PoolFormulaService,
  ) {}

  private async assertModuleActive(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { poolModuleActive: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (!company.poolModuleActive) {
      throw new ForbiddenException(
        'Módulo Piscina não está ativo neste tenant. Ative em Configurações.',
      );
    }
  }

  async create(
    dto: CreatePoolBudgetDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    // Valida cliente
    const client = await this.prisma.partner.findFirst({
      where: { id: dto.clientPartnerId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    // Valida template (se enviado)
    let template: { sections: unknown; itemsSnapshot: unknown; defaults: unknown } | null = null;
    if (dto.templateId) {
      template = await this.prisma.poolBudgetTemplate.findFirst({
        where: { id: dto.templateId, companyId, deletedAt: null, isActive: true },
        select: { sections: true, itemsSnapshot: true, defaults: true },
      });
      if (!template) throw new NotFoundException('Template não encontrado ou inativo');
    }

    // Valida printLayout (se enviado)
    if (dto.printLayoutId) {
      const layout = await this.prisma.poolPrintLayout.findFirst({
        where: { id: dto.printLayoutId, companyId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!layout) throw new NotFoundException('Layout de impressão não encontrado');
    }

    const code = await this.codeGenerator
      .generateCode(companyId, 'POOL_BUDGET')
      .catch(() => null);

    // Se template tem defaults (snapshot v1.10.43+), aplica como base. DTO sobrescreve.
    const tDefaults = (template?.defaults as Record<string, any>) || {};
    const created = await this.prisma.poolBudget.create({
      data: {
        companyId,
        code: code ?? undefined,
        clientPartnerId: dto.clientPartnerId,
        templateId: dto.templateId,
        printLayoutId: dto.printLayoutId,
        createdByUserId: user.id,
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
        termsConditions: dto.termsConditions,
        poolDimensions: dto.poolDimensions as unknown as Prisma.InputJsonValue,
        environmentParams: dto.environmentParams as Prisma.InputJsonValue | undefined,
        validityDays: dto.validityDays ?? tDefaults.validityDays ?? 30,
        discountCents: dto.discountCents,
        discountPercent: dto.discountPercent ?? tDefaults.discountPercent ?? null,
        taxesPercent: dto.taxesPercent ?? tDefaults.taxesPercent ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        equipmentWarranty: dto.equipmentWarranty ?? tDefaults.equipmentWarranty ?? null,
        workWarranty: dto.workWarranty ?? tDefaults.workWarranty ?? null,
        paymentTerms: dto.paymentTerms ?? tDefaults.paymentTerms ?? null,
        earlyPaymentDiscountPct: dto.earlyPaymentDiscountPct ?? tDefaults.earlyPaymentDiscountPct ?? null,
        paymentTermId: dto.paymentTermId ?? tDefaults.paymentTermId ?? null,
        sectionOrder: dto.sectionOrder ?? tDefaults.sectionOrder ?? [],
        status: PoolBudgetStatus.RASCUNHO,
      },
      include: {
        clientPartner: { select: { id: true, name: true, document: true } },
        template: { select: { id: true, name: true } },
      },
    });

    // Aplica items do template:
    // 1) Se tem itemsSnapshot[] (v1.10.43+ Salvar como modelo), usa-o (mais rico)
    // 2) Caso contrario, usa sections (template legado)
    if (template) {
      const snapshot = Array.isArray(template.itemsSnapshot) ? (template.itemsSnapshot as any[]) : [];
      if (snapshot.length > 0) {
        await this.applyItemsSnapshot(created.id, snapshot, dto.poolDimensions);
      } else {
        await this.applyTemplate(created.id, companyId, template.sections, dto.poolDimensions);
      }
      await this.recalculateTotals(created.id);
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: created.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: created as unknown as Record<string, unknown>,
    });

    return this.findOne(created.id, companyId);
  }

  /**
   * Constroi map de cellRef -> {qty, total, unitPrice} dos items do budget,
   * pra usar em formulas que referenciam outras linhas (qty(LX), total(LX), etc).
   */
  private async buildBudgetCellRefMap(budgetId: string): Promise<Map<string, CellRefData>> {
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId, cellRef: { not: null } },
      select: {
        cellRef: true, qty: true, unitPriceCents: true,
        product: { select: { technicalSpecs: true } },
        service: { select: { technicalSpecs: true } },
      },
    });
    const map = new Map<string, CellRefData>();
    for (const it of items) {
      if (!it.cellRef) continue;
      const qty = Number(it.qty) || 0;
      const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      const numericSpecs: Record<string, number> = {};
      if (specs && typeof specs === 'object') {
        for (const [k, v] of Object.entries(specs)) {
          const n = Number(v);
          if (Number.isFinite(n)) numericSpecs[k] = n;
        }
      }
      map.set(it.cellRef, {
        qty,
        total: (qty * it.unitPriceCents) / 100,
        unitPrice: it.unitPriceCents / 100,
        specs: numericSpecs,
      });
    }
    return map;
  }

  /**
   * Calcula sibling vars (technicalSpecs do equipamento principal da mesma poolSection)
   * pra serem usadas em formulas/regras com prefixo 'sibling*'. Primeira ocorrencia
   * de cada chave ganha — equipamentos cadastrados antes dos tubos/servicos.
   *
   * Exemplo: linha de servico de montagem na etapa FILTRO usa 'siblingTempoMontagemH'.
   * Esta funcao le o filtro vinculado na etapa, pega technicalSpecs.tempoMontagemH,
   * retorna { siblingTempoMontagemH: 4, siblingVazaoM3h: 9, siblingTuboEntradaMm: 50, ... }.
   */
  private async buildSiblingVars(
    budgetId: string,
    poolSection: any,
    excludeItemId?: string,
    linkedCellRef?: string | null,
  ): Promise<Record<string, number>> {
    // Se linkedCellRef definido, busca SO o item com aquele cellRef (link explicito).
    // Modo preferido — elimina ambiguidade quando varios items da etapa tem o mesmo
    // technicalSpec (ex: 2 equipamentos com tuboEntradaMm na mesma etapa).
    if (linkedCellRef && linkedCellRef.trim()) {
      const target = await this.prisma.poolBudgetItem.findFirst({
        where: { budgetId, cellRef: linkedCellRef.trim() },
        select: {
          id: true,
          product: { select: { technicalSpecs: true } },
          service: { select: { technicalSpecs: true } },
        },
      });
      const out: Record<string, number> = {};
      const specs = (target?.product?.technicalSpecs ?? target?.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      if (specs) {
        for (const [k, raw] of Object.entries(specs)) {
          const n = Number(raw);
          if (!Number.isFinite(n)) continue;
          const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
          out[siblingKey] = n;
        }
      }
      return out;
    }

    // Fallback: itera itens da etapa (excluindo o proprio) — comportamento legacy.
    const items = await this.prisma.poolBudgetItem.findMany({
      where: {
        budgetId,
        poolSection,
        ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
      },
      select: {
        id: true,
        product: { select: { technicalSpecs: true } },
        service: { select: { technicalSpecs: true } },
      },
    });
    const out: Record<string, number> = {};
    for (const it of items) {
      const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      if (!specs) continue;
      for (const [k, raw] of Object.entries(specs)) {
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
        if (out[siblingKey] === undefined) {
          out[siblingKey] = n;
        }
      }
    }
    return out;
  }

  /**
   * Diagnostica por que uma formula com sibling* falhou — retorna mensagem
   * clara ao operador (qual variavel falta, quais items da etapa nao tem o
   * campo preenchido, ou items sem produto/servico vinculado).
   *
   * Chamada quando evaluateFormula lanca erro e a formula contem sibling*.
   * Retorna null se a formula nao usa siblings (caller fallback pro erro generico).
   */
  private async diagnoseSiblingFailure(
    budgetId: string,
    poolSection: any,
    formula: string,
  ): Promise<string | null> {
    // Extrai todas as siblingXxx referenciadas na formula
    const siblingRefs = Array.from(formula.matchAll(/\bsibling([A-Z][A-Za-z0-9_]*)\b/g))
      .map((m) => ({ siblingKey: `sibling${m[1]}`, specKey: m[1].charAt(0).toLowerCase() + m[1].slice(1) }));
    if (siblingRefs.length === 0) return null;

    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId, poolSection },
      select: {
        description: true,
        product: { select: { description: true, technicalSpecs: true } },
        service: { select: { name: true, technicalSpecs: true } },
        productId: true,
        serviceId: true,
      },
    });

    const sectionLabel = String(poolSection);
    const problems: string[] = [];
    const uniqueRefs = Array.from(new Map(siblingRefs.map((r) => [r.siblingKey, r])).values());

    for (const ref of uniqueRefs) {
      // Procura algum item da etapa que tenha o campo preenchido
      const itemsWithField = items.filter((it) => {
        const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
        if (!specs) return false;
        const v = Number(specs[ref.specKey]);
        return Number.isFinite(v);
      });
      if (itemsWithField.length > 0) continue; // achou — sibling existe

      // Nao achou. Diagnostica:
      const unlinkedItems = items.filter((it) => !it.productId && !it.serviceId);
      const linkedWithoutField = items.filter((it) => {
        if (!it.productId && !it.serviceId) return false;
        const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
        if (!specs) return true; // vinculado mas sem specs nenhum
        return !Number.isFinite(Number(specs[ref.specKey]));
      });

      const detail: string[] = [];
      if (unlinkedItems.length > 0) {
        const names = unlinkedItems.slice(0, 3).map((it) => `"${it.description}"`).join(', ');
        const more = unlinkedItems.length > 3 ? ` e mais ${unlinkedItems.length - 3}` : '';
        detail.push(`Items SEM produto vinculado: ${names}${more} — vincule no catalogo (🔍).`);
      }
      if (linkedWithoutField.length > 0) {
        const names = linkedWithoutField.slice(0, 3).map((it) => {
          const prodName = it.product?.description || it.service?.name || it.description;
          return `"${prodName}"`;
        }).join(', ');
        const more = linkedWithoutField.length > 3 ? ` e mais ${linkedWithoutField.length - 3}` : '';
        detail.push(`Produtos vinculados sem "${ref.specKey}": ${names}${more} — preencha em Cadastros > Produtos > Aba Piscina.`);
      }
      if (detail.length === 0) {
        detail.push(`Nenhum item na etapa ${sectionLabel} tem "${ref.specKey}". Adicione um produto que tenha esse campo.`);
      }
      problems.push(`Variavel "${ref.siblingKey}" indisponivel na etapa ${sectionLabel}. ${detail.join(' ')}`);
    }

    if (problems.length === 0) return null;
    return problems.join('\n\n');
  }

  /**
   * Auto-vincula uma linha do orcamento ao Product ou Service do cadastro quando a
   * descricao da match exato (case-insensitive, trim). So vincula quando o match e
   * unico — ambiguidade (multiplos cadastros com mesmo nome) deixa sem vinculo.
   * Retorna {} se nao achou ou se houver duplicata. Sempre idempotente: caller
   * decide se aplica.
   */
  private async findAutoLinkByDescription(
    description: string,
    companyId: string,
  ): Promise<{ productId?: string; serviceId?: string }> {
    const trimmed = (description || '').trim();
    if (!trimmed) return {};

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        description: { equals: trimmed, mode: 'insensitive' },
      },
      select: { id: true },
      take: 2,
    });
    if (products.length === 1) return { productId: products[0].id };
    if (products.length >= 2) return {}; // ambiguidade

    const services = await this.prisma.service.findMany({
      where: {
        companyId,
        name: { equals: trimmed, mode: 'insensitive' },
      },
      select: { id: true },
      take: 2,
    });
    if (services.length === 1) return { serviceId: services[0].id };
    return {};
  }

  /**
   * Pega o proximo cellRef disponivel para o budget (L1, L2, L3, ...).
   * Nao reusa numeros de items deletados — sempre incrementa o maior existente.
   */
  private async nextCellRef(budgetId: string): Promise<string> {
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId, cellRef: { not: null } },
      select: { cellRef: true },
    });
    let max = 0;
    for (const it of items) {
      const m = it.cellRef?.match(/^L(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `L${max + 1}`;
  }

  /**
   * Aplica items vindos de um snapshot (v1.10.43+ "Salvar como modelo").
   * Cada entry tem todos os campos do PoolBudgetItem preservados.
   * Re-avalia formulaExpr contra dimensions atuais quando presente.
   */
  private async applyItemsSnapshot(
    budgetId: string,
    snapshot: any[],
    poolDimensions: any,
  ) {
    if (!Array.isArray(snapshot) || snapshot.length === 0) return;
    const vars = extractDimensionVars(poolDimensions);
    const itemsToCreate: Prisma.PoolBudgetItemCreateManyInput[] = [];
    let order = 0;
    let cellRefSeq = 0;
    for (const it of snapshot) {
      let qty = Number(it.qty) || 0;
      let qtyCalculated: number | null = null;
      // Items de snapshot que tem formula com cellRef (qty(L7), etc) podem falhar aqui
      // pois nao temos os outros items ainda. Tudo bem — recalculateTotals refaz depois.
      if (it.formulaExpr && String(it.formulaExpr).trim() && extractCellRefs(it.formulaExpr).length === 0) {
        try {
          qty = evaluateFormula(String(it.formulaExpr), vars);
          qtyCalculated = qty;
        } catch {
          // Mantem qty do snapshot se a formula falhar
        }
      }
      const unitPriceCents = Number(it.unitPriceCents) || 0;
      const totalCents = Math.round(qty * unitPriceCents);
      cellRefSeq++;
      itemsToCreate.push({
        budgetId,
        poolSection: it.poolSection,
        sortOrder: typeof it.sortOrder === 'number' ? it.sortOrder : order++,
        slotName: it.slotName ?? null,
        description: it.description || '(sem descricao)',
        unit: it.unit || 'UN',
        cellRef: `L${cellRefSeq}`,
        qty,
        qtyCalculated,
        formulaExpr: it.formulaExpr || null,
        unitPriceCents,
        totalCents,
        isAutoCalculated: !!it.formulaExpr,
        isExtra: false,
        // Snapshot carrega autoSelectRule do template — recalculateTotals
        // depois aplica auto-link (exceto se manualSelection=true).
        autoSelectRule: it.autoSelectRule ?? (Prisma.JsonNull as any),
      });
    }
    if (itemsToCreate.length > 0) {
      await this.prisma.poolBudgetItem.createMany({ data: itemsToCreate });
    }
  }

  /**
   * Aplica template: cria PoolBudgetItem pra cada item do template, calculando
   * qty automaticamente via fórmula do PoolCatalogConfig.
   */
  private async applyTemplate(
    budgetId: string,
    companyId: string,
    sections: unknown,
    poolDimensions: any,
  ) {
    const sectionsArr = sections as TemplateSection[];
    if (!Array.isArray(sectionsArr)) return;

    const metrics = this.formulaService.computeMetrics(poolDimensions);

    // Coleta todos catalogConfigIds
    const allIds = sectionsArr.flatMap((s) => s.items.map((i) => i.catalogConfigId));
    if (allIds.length === 0) return;

    // Busca configs com Product/Service
    const configs = await this.prisma.poolCatalogConfig.findMany({
      where: { id: { in: allIds }, companyId, isActive: true },
      include: {
        product: { select: { id: true, description: true, unit: true, salePriceCents: true } },
        service: { select: { id: true, name: true, unit: true, priceCents: true } },
      },
    });
    const configMap = new Map(configs.map((c) => [c.id, c]));

    const itemsToCreate: Prisma.PoolBudgetItemCreateManyInput[] = [];
    let globalSort = 0;

    for (const section of sectionsArr) {
      for (const item of section.items) {
        const cfg = configMap.get(item.catalogConfigId);
        if (!cfg) continue;

        // Filtro por condição
        if (
          !this.formulaService.matchesCondition(
            cfg.poolCondition as PoolConditionConfig | null,
            poolDimensions,
          )
        ) {
          if (!item.required) continue;
        }

        const qtyCalculated =
          this.formulaService.calculateQty(
            cfg.poolFormula as PoolFormulaConfig | null,
            metrics,
          ) ?? 1;

        const description = cfg.product?.description ?? cfg.service?.name ?? '(sem descrição)';
        const unit = cfg.product?.unit ?? cfg.service?.unit ?? 'UN';
        const unitPriceCents = cfg.product?.salePriceCents ?? cfg.service?.priceCents ?? 0;
        const totalCents = Math.round(qtyCalculated * unitPriceCents);

        itemsToCreate.push({
          budgetId,
          catalogConfigId: cfg.id,
          productId: cfg.productId,
          serviceId: cfg.serviceId,
          poolSection: cfg.poolSection,
          sortOrder: globalSort++,
          cellRef: `L${itemsToCreate.length + 1}`,
          description,
          unit,
          qtyCalculated,
          qty: qtyCalculated,
          unitPriceCents,
          totalCents,
          isAutoCalculated: true,
          isExtra: false,
        });
      }
    }

    if (itemsToCreate.length > 0) {
      await this.prisma.poolBudgetItem.createMany({ data: itemsToCreate });
    }
  }

  /**
   * Recalcula subtotalCents, taxesCents e totalCents do orçamento somando os itens.
   */
  async recalculateTotals(budgetId: string) {
    const HOURS_PER_DAY = 8;

    const budget = await this.prisma.poolBudget.findUnique({
      where: { id: budgetId },
      select: {
        discountCents: true,
        discountPercent: true,
        taxesPercent: true,
        startDate: true,
        poolDimensions: true,
        environmentParams: true,
        companyId: true,
      },
    });
    const dimensionVars = {
      ...extractDimensionVars(budget?.poolDimensions),
      ...extractEnvVars(budget?.environmentParams),
    };

    // PASSO -1: auto-link por descricao em items SEM produto/servico vinculado.
    // Resolve o caso em que o usuario criou linha com descricao identica a um
    // Product/Service cadastrado mas sem passar pelo catalog picker (ex: snapshot
    // de template, edicao manual). Sem isso, sibling vars da etapa ficam vazias
    // e formulas com sibling* falham. Idempotente: nao toca em items ja vinculados.
    // Pula items com manualUnlink=true (operador escolheu "Sem produto" no picker).
    if (budget?.companyId) {
      const unlinkedItems = await this.prisma.poolBudgetItem.findMany({
        where: {
          budgetId,
          productId: null,
          serviceId: null,
          manualUnlink: false,
          description: { not: '' },
        },
        select: { id: true, description: true },
      });
      for (const it of unlinkedItems) {
        if (!it.description || !it.description.trim()) continue;
        const matched = await this.findAutoLinkByDescription(it.description, budget.companyId);
        if (matched.productId || matched.serviceId) {
          await this.prisma.poolBudgetItem.update({
            where: { id: it.id },
            data: {
              productId: matched.productId ?? null,
              serviceId: matched.serviceId ?? null,
            },
          });
        }
      }
    }

    // PASSO 0: auto-selecao do produto/servico em items que tem autoSelectRule.
    // Roda ANTES das formulas porque escolha do produto afeta technicalSpecs disponiveis.
    //
    // EVOLUCAO DO COMPORTAMENTO:
    // - v1.10.96: so disparava em items SEM produto/servico vinculado.
    // - v1.10.98: 2 fases (equipamentos primarios + tubos/dependentes).
    // - v1.11.11: respeita escolha que AINDA PASSA na regra. Se o produto atual
    //   nao passa mais (ex: user trocou filtro, tubo virou incompativel), re-aplica
    //   auto-select pra escolher um valido. Sem isso o tubo ficava 'incompativel'
    //   ate o user limpar e re-aplicar manualmente.
    const itemsForAutoSelect = await this.prisma.poolBudgetItem.findMany({
      where: {
        budgetId,
        autoSelectRule: { not: Prisma.JsonNull as any },
      },
      select: {
        id: true, autoSelectRule: true, productId: true, serviceId: true,
        description: true, unitPriceCents: true, poolSection: true,
        product: { select: { id: true, description: true, salePriceCents: true, unit: true, technicalSpecs: true, poolType: true } },
        service: { select: { id: true, name: true, priceCents: true, unit: true, technicalSpecs: true } },
      },
    });
    if (itemsForAutoSelect.length > 0) {
      const companyId = await this.prisma.poolBudget.findUnique({
        where: { id: budgetId },
        select: { companyId: true },
      }).then((b) => b?.companyId);

      if (companyId) {
        // Carrega catalogo (Products + Services) com technicalSpecs uma vez
        const allProducts = await this.prisma.product.findMany({
          where: { companyId },
          select: { id: true, description: true, salePriceCents: true, unit: true, technicalSpecs: true, poolType: true },
        });
        const allServices = await this.prisma.service.findMany({
          where: { companyId },
          select: { id: true, name: true, priceCents: true, unit: true, technicalSpecs: true },
        });

        // Detecta uso de sibling vars no where da rule — split em 2 fases
        const ruleUsesSiblings = (rule: AutoSelectRule | null): boolean => {
          if (!rule) return false;
          const text = `${rule.where || ''} ${rule.indicator?.expr || ''}`;
          return /\bsibling[A-Z]/.test(text);
        };

        // Avalia se o produto/servico ATUAL do item ainda passa nos 3 filtros da regra
        // (filterCategoria, filterDescription, where). Se passa, item nao precisa
        // reauto-selecao — respeita escolha que continua valida.
        const currentStillPasses = (it: typeof itemsForAutoSelect[number], rule: AutoSelectRule, vars: Record<string, number | undefined>): boolean => {
          const current = it.product || it.service;
          if (!current) return false; // sem produto: precisa escolher
          const candidate = it.product
            ? [{ ...it.product }]
            : [{ ...(it.service as any), description: (it.service as any).name }];
          const filtered1 = filterCandidates(candidate as any, rule);
          if (filtered1.length === 0) return false;
          const filtered2 = filterByWhere(filtered1, rule, vars);
          return filtered2.length > 0;
        };

        const processItem = async (
          it: typeof itemsForAutoSelect[number],
          extraVars: Record<string, number>,
          opts: { forceReapply?: boolean } = {},
        ) => {
          const rule = it.autoSelectRule as AutoSelectRule | null;
          if (!rule || (!rule.where && !rule.filterCategoria && !rule.filterDescription && !rule.filterPoolType)) return;
          // manualSelection: regra so filtra candidatos no catalog picker, engine NAO escolhe automaticamente.
          // Usado quando o item nao tem criterio objetivo (ex: cascata e estetica) e o operador escolhe na mao.
          if (rule.manualSelection) return;
          const vars = { ...dimensionVars, ...extraVars };

          // Comportamento por tipo de item:
          //   - Items PRIMARIOS (filtro/cascata/SPA/aquecedor — Fase A, sem sibling):
          //     respeita produto vinculado se ainda passa na regra. So substitui se
          //     ficou incompativel. Permite operador escolher entre opcoes validas.
          //   - Items DEPENDENTES (tubos — Fase B, com sibling*): com forceReapply=true,
          //     SEMPRE re-aplica a regra todo recalc. Pra que quando o gestor troca
          //     o filtro/cascata/aquecedor manualmente, o tubo se ajuste automaticamente.
          //     A 'escolha manual' do tubo dura ate o proximo recalc do orcamento.
          if (!opts.forceReapply && (it.productId || it.serviceId) && currentStillPasses(it, rule, vars)) {
            return;
          }

          // Tenta primeiro Products, depois Services
          const bestProduct = selectBestCandidate(allProducts as any, rule, vars);
          let target: { id: string; type: 'product' | 'service'; description: string; priceCents: number; unit: string } | null = null;
          if (bestProduct) {
            target = {
              id: bestProduct.id,
              type: 'product',
              description: bestProduct.description ?? '',
              priceCents: bestProduct.salePriceCents ?? 0,
              unit: bestProduct.unit ?? 'UN',
            };
          } else {
            const bestService = selectBestCandidate(
              allServices.map((s) => ({ ...s, description: s.name })) as any,
              rule,
              vars,
            );
            if (bestService) {
              target = {
                id: bestService.id,
                type: 'service',
                description: (bestService as any).name ?? '',
                priceCents: (bestService as any).priceCents ?? 0,
                unit: (bestService as any).unit ?? 'UN',
              };
            }
          }
          if (!target) return;

          await this.prisma.poolBudgetItem.update({
            where: { id: it.id },
            data: {
              productId: target.type === 'product' ? target.id : null,
              serviceId: target.type === 'service' ? target.id : null,
              description: target.description || it.description,
              unitPriceCents: target.priceCents || it.unitPriceCents,
              unit: target.unit,
            },
          });
        };

        // Fase A: equipamentos primarios (sem sibling vars)
        const phaseA = itemsForAutoSelect.filter((it) => !ruleUsesSiblings(it.autoSelectRule as AutoSelectRule | null));
        const phaseB = itemsForAutoSelect.filter((it) => ruleUsesSiblings(it.autoSelectRule as AutoSelectRule | null));

        for (const it of phaseA) {
          await processItem(it, {});
        }

        // Calcula vars 'sibling*' por item da Fase B — usa linkedCellRef quando
        // a regra define vinculo explicito a uma linha (preferido). Senao, fallback
        // generico: itera outros items da mesma etapa, excluindo o proprio.
        if (phaseB.length > 0) {
          const allInBudget = await this.prisma.poolBudgetItem.findMany({
            where: { budgetId },
            select: {
              id: true,
              cellRef: true,
              poolSection: true,
              product: { select: { technicalSpecs: true } },
              service: { select: { technicalSpecs: true } },
            },
          });

          // Fase B (dependentes): forceReapply=true — items como tubos sempre seguem
          // o equipamento principal da etapa. Quando filtro/cascata/SPA/aquecedor muda,
          // o tubo redo automaticamente. Escolha manual em tubo dura ate o proximo recalc.
          for (const it of phaseB) {
            const rule = it.autoSelectRule as AutoSelectRule | null;
            const linkedCellRef = rule?.linkedCellRef || null;
            const sec = String(it.poolSection);
            const sectionVars: Record<string, number> = {};
            if (linkedCellRef) {
              // Modo vinculo explicito: pega APENAS o item com aquele cellRef
              const target = allInBudget.find((o) => o.cellRef === linkedCellRef);
              const specs = (target?.product?.technicalSpecs ?? target?.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
              if (specs) {
                for (const [k, raw] of Object.entries(specs)) {
                  const n = Number(raw);
                  if (!Number.isFinite(n)) continue;
                  sectionVars[`sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`] = n;
                }
              }
            } else {
              // Modo legacy: itera outros items da mesma etapa
              for (const other of allInBudget) {
                if (other.id === it.id) continue;
                if (String(other.poolSection) !== sec) continue;
                const specs = (other.product?.technicalSpecs as Record<string, unknown> | null) || null;
                if (!specs) continue;
                for (const [k, raw] of Object.entries(specs)) {
                  const n = Number(raw);
                  if (!Number.isFinite(n)) continue;
                  const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
                  if (sectionVars[siblingKey] === undefined) {
                    sectionVars[siblingKey] = n;
                  }
                }
              }
            }
            await processItem(it, sectionVars, { forceReapply: true });
          }
        }
      }
    }

    // PASSO 1: re-avalia formulas de items SEM dependencias (sem dias, sem cellRef de outros items)
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId },
      select: {
        id: true, qty: true, unit: true, unitPriceCents: true, formulaExpr: true, cellRef: true,
        poolSection: true, autoSelectRule: true,
        product: { select: { technicalSpecs: true } },
        service: { select: { technicalSpecs: true } },
      },
    });
    // Calcula sibling vars POR ITEM. Modo preferido: linkedCellRef da regra
    // (vinculo explicito a uma linha). Fallback: outros items da mesma etapa
    // excluindo o proprio (evita auto-referencia).
    const computeSiblingsForItem = (it: typeof items[number]): Record<string, number> => {
      const sec = String(it.poolSection);
      const out: Record<string, number> = {};
      const linkedCellRef = (it.autoSelectRule as any)?.linkedCellRef as string | null | undefined;
      if (linkedCellRef && linkedCellRef.trim()) {
        const target = items.find((o) => o.cellRef === linkedCellRef.trim());
        const specs = (target?.product?.technicalSpecs ?? target?.service?.technicalSpecs) as Record<string, unknown> | null;
        if (specs) {
          for (const [k, raw] of Object.entries(specs)) {
            const n = Number(raw);
            if (!Number.isFinite(n)) continue;
            out[`sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`] = n;
          }
        }
        return out;
      }
      for (const other of items) {
        if (other.id === it.id) continue;
        if (String(other.poolSection) !== sec) continue;
        const specs = (other.product?.technicalSpecs ?? other.service?.technicalSpecs) as Record<string, unknown> | null;
        if (!specs) continue;
        for (const [k, raw] of Object.entries(specs)) {
          const n = Number(raw);
          if (!Number.isFinite(n)) continue;
          const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
          if (out[siblingKey] === undefined) {
            out[siblingKey] = n;
          }
        }
      }
      return out;
    };
    // Monta o vars completo pra um item: dimensions + environment + product/service specs + siblings da etapa
    const varsForItem = (it: typeof items[number]) => {
      const productSpecs = it.product?.technicalSpecs ?? it.service?.technicalSpecs ?? null;
      const siblings = computeSiblingsForItem(it);
      return { ...dimensionVars, ...extractProductVars(productSpecs), ...siblings };
    };

    const usesDias = (expr: string | null) => !!expr && /\bdias\b/.test(expr);
    const usesCellRef = (expr: string | null) => extractCellRefs(expr).length > 0;

    // Helpers de mutate state local
    function persistItem(it: typeof items[number], newQty: number) {
      const newTotal = Math.round(newQty * it.unitPriceCents);
      it.qty = newQty;
      return { qty: newQty, qtyCalculated: newQty, totalCents: newTotal };
    }

    // Constroi mapa cellRef -> dados (atualizado conforme items sao re-avaliados)
    function buildCellRefMap(): Map<string, CellRefData> {
      const map = new Map<string, CellRefData>();
      for (const it of items) {
        if (!it.cellRef) continue;
        const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
        const numericSpecs: Record<string, number> = {};
        if (specs && typeof specs === 'object') {
          for (const [k, v] of Object.entries(specs)) {
            const n = Number(v);
            if (Number.isFinite(n)) numericSpecs[k] = n;
          }
        }
        map.set(it.cellRef, {
          qty: Number(it.qty) || 0,
          total: ((Number(it.qty) || 0) * it.unitPriceCents) / 100,
          unitPrice: it.unitPriceCents / 100,
          specs: numericSpecs,
        });
      }
      return map;
    }
    // Lista de items pra agregacoes via sum(): cada item com qty + specs + categoria do produto
    const buildBudgetItemsForFormula = () => items.map((it) => {
      const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      const numericSpecs: Record<string, number> = {};
      let categoria: string | null = null;
      if (specs && typeof specs === 'object') {
        for (const [k, v] of Object.entries(specs)) {
          if (k === 'categoriaPlanilha' && typeof v === 'string') {
            categoria = v;
          } else {
            const n = Number(v);
            if (Number.isFinite(n)) numericSpecs[k] = n;
          }
        }
      }
      return { qty: Number(it.qty) || 0, specs: numericSpecs, categoria };
    });

    // PASSO 1a: items sem nenhuma dependencia (so dimensions)
    for (const it of items) {
      if (!it.formulaExpr) continue;
      if (usesDias(it.formulaExpr) || usesCellRef(it.formulaExpr)) continue;
      try {
        const newQty = evaluateFormula(it.formulaExpr, varsForItem(it), new Map(), buildBudgetItemsForFormula());
        const data = persistItem(it, newQty);
        await this.prisma.poolBudgetItem.update({ where: { id: it.id }, data });
      } catch { /* mantem qty atual */ }
    }

    function computeDias(excludeItemId?: string): number {
      let totalHours = 0;
      for (const it of items) {
        if (excludeItemId && it.id === excludeItemId) continue;
        if (it.formulaExpr && usesDias(it.formulaExpr)) continue; // ignora items que dependem de dias
        const u = (it.unit || '').trim().toLowerCase();
        const qty = Number(it.qty) || 0;
        if (qty <= 0) continue;
        if (u === 'h' || u === 'hora' || u === 'horas') totalHours += qty;
        else if (u === 'd' || u === 'dia' || u === 'dias') totalHours += qty * HOURS_PER_DAY;
      }
      return totalHours > 0 ? Math.ceil(totalHours / HOURS_PER_DAY) : 0;
    }

    // PASSO 1b: items que usam APENAS dias (sem cellRef)
    for (const it of items) {
      if (!it.formulaExpr) continue;
      if (!usesDias(it.formulaExpr) || usesCellRef(it.formulaExpr)) continue;
      const diasForThis = computeDias(it.id);
      try {
        const newQty = evaluateFormula(it.formulaExpr, { ...varsForItem(it), dias: diasForThis }, new Map(), buildBudgetItemsForFormula());
        const data = persistItem(it, newQty);
        await this.prisma.poolBudgetItem.update({ where: { id: it.id }, data });
      } catch { /* mantem qty atual */ }
    }

    // PASSO 2: items que usam cellRef (com ou sem dias). Resolve em ordem topologica
    // (item depende de items ja resolvidos). Em ate N iteracoes (N = items count),
    // re-avalia items cujas dependencias agora estao prontas. Detecta ciclo se nao converge.
    const itemsWithCellRef = items.filter((it) => it.formulaExpr && usesCellRef(it.formulaExpr));
    const resolved = new Set<string>(); // ids ja resolvidos nesta passada
    const maxIter = itemsWithCellRef.length + 1;
    for (let iter = 0; iter < maxIter; iter++) {
      let progressed = false;
      for (const it of itemsWithCellRef) {
        if (resolved.has(it.id)) continue;
        const refs = extractCellRefs(it.formulaExpr!);
        // Verifica auto-referencia
        if (it.cellRef && refs.includes(it.cellRef)) {
          // Item ref a si mesmo - mantem qty atual
          resolved.add(it.id);
          continue;
        }
        // Todos os deps existem e ja foram resolvidos (ou nao precisam ser, se nao tem formula)?
        const cellRefMap = buildCellRefMap();
        const allDepsAvailable = refs.every((ref) => {
          const target = items.find((x) => x.cellRef === ref);
          if (!target) return false; // referencia para linha inexistente
          if (!target.formulaExpr || !usesCellRef(target.formulaExpr)) return true; // nao depende de outros
          return resolved.has(target.id);
        });
        if (!allDepsAvailable) continue;

        // Avalia
        try {
          const diasForThis = usesDias(it.formulaExpr!) ? computeDias(it.id) : 0;
          const newQty = evaluateFormula(
            it.formulaExpr!,
            { ...varsForItem(it), dias: diasForThis },
            cellRefMap,
            buildBudgetItemsForFormula(),
          );
          const data = persistItem(it, newQty);
          await this.prisma.poolBudgetItem.update({ where: { id: it.id }, data });
        } catch { /* mantem qty atual */ }
        resolved.add(it.id);
        progressed = true;
      }
      if (!progressed) break;
    }
    // Items nao resolvidos = ciclo detectado (A -> B -> A). Mantem qty atual deles.

    // PASSO 3: agora soma subtotal final e calcula totais/prazo
    const finalItems = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId },
      select: { totalCents: true, qty: true, unit: true },
    });
    const subtotalCents = finalItems.reduce((sum, i) => sum + (i.totalCents ?? 0), 0);

    // Desconto: %/valor sobre subtotal
    const discountPctCents = budget?.discountPercent && budget.discountPercent > 0
      ? Math.round(subtotalCents * (budget.discountPercent / 100))
      : 0;
    const discountFlatCents = budget?.discountCents && budget.discountCents > 0
      ? budget.discountCents
      : 0;
    const discountCents = discountPctCents + discountFlatCents;

    // Impostos: % sobre subtotal
    const taxesCents = budget?.taxesPercent && budget.taxesPercent > 0
      ? Math.round(subtotalCents * (budget.taxesPercent / 100))
      : 0;

    // Total Geral = subtotal - desconto + impostos
    const totalCents = Math.max(0, subtotalCents - discountCents + taxesCents);

    // Prazo final (ja inclui items com unit DIA/h, exceto os que dependem de dias)
    const estimatedDurationDays = computeDias() || null;

    let endDate: Date | null = null;
    if (budget?.startDate && estimatedDurationDays && estimatedDurationDays > 0) {
      endDate = new Date(budget.startDate);
      endDate.setUTCDate(endDate.getUTCDate() + estimatedDurationDays);
    }

    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: {
        subtotalCents,
        taxesCents,
        totalCents,
        estimatedDurationDays,
        endDate,
      },
    });
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters: QueryPoolBudgetDto,
  ): Promise<PaginatedResult<unknown>> {
    await this.assertModuleActive(companyId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PoolBudgetWhereInput = {
      companyId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.clientPartnerId ? { clientPartnerId: filters.clientPartnerId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { code: { contains: filters.search, mode: 'insensitive' } },
              { title: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.PoolBudgetOrderByWithRelationInput = pagination.sortBy
      ? { [pagination.sortBy]: pagination.sortOrder ?? 'desc' }
      : { createdAt: 'desc' };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.poolBudget.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          clientPartner: { select: { id: true, name: true, document: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.poolBudget.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        clientPartner: true,
        template: { select: { id: true, name: true } },
        printLayout: { select: { id: true, name: true } },
        paymentTerm: true,
        items: {
          orderBy: [{ poolSection: 'asc' }, { sortOrder: 'asc' }],
          include: {
            product: { select: { id: true, code: true, description: true, imageUrl: true, technicalSpecs: true } },
            service: { select: { id: true, code: true, name: true, imageUrl: true, technicalSpecs: true } },
          },
        },
        project: { select: { id: true, code: true, status: true } },
      },
    });

    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    // Calcula indicator (label, color, value) em runtime pra cada item com autoSelectRule.
    // Nao armazena em DB — sempre fresco baseado em dimensoes atuais + technicalSpecs do produto.
    const dimensionVarsForIndicator = {
      ...extractDimensionVars(budget.poolDimensions),
      ...extractEnvVars(budget.environmentParams),
    };
    // Calcula sibling vars POR ITEM, excluindo o proprio (evita auto-referencia).
    // v1.11.05: necessario pra indicators que referenciam o equipamento principal
    // da etapa (ex: tubo usa siblingTuboEntradaMm). Antes calculava por etapa global
    // — bug: tubo lia o proprio tuboEntradaMm em vez do kit/filtro.
    const computeIndicatorSiblings = (currentId: string, sec: string, linkedCellRef?: string | null): Record<string, number> => {
      const out: Record<string, number> = {};
      if (linkedCellRef && linkedCellRef.trim()) {
        const target = budget.items.find((o) => o.cellRef === linkedCellRef.trim());
        const specs = ((target?.product as any)?.technicalSpecs ?? (target?.service as any)?.technicalSpecs) as Record<string, unknown> | null;
        if (specs) {
          for (const [k, raw] of Object.entries(specs)) {
            const n = Number(raw);
            if (!Number.isFinite(n)) continue;
            out[`sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`] = n;
          }
        }
        return out;
      }
      for (const other of budget.items) {
        if (other.id === currentId) continue;
        if (String(other.poolSection) !== sec) continue;
        const specs = ((other.product as any)?.technicalSpecs ?? (other.service as any)?.technicalSpecs) as Record<string, unknown> | null;
        if (!specs) continue;
        for (const [k, raw] of Object.entries(specs)) {
          const n = Number(raw);
          if (!Number.isFinite(n)) continue;
          const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
          if (out[siblingKey] === undefined) {
            out[siblingKey] = n;
          }
        }
      }
      return out;
    };
    for (const item of budget.items) {
      const rule = (item as any).autoSelectRule as AutoSelectRule | null | undefined;
      if (!rule?.indicator) continue;
      const productSpecs = (item.product as any)?.technicalSpecs ?? (item.service as any)?.technicalSpecs ?? null;
      const siblings = computeIndicatorSiblings(item.id, String(item.poolSection), rule.linkedCellRef);
      const vars = { ...dimensionVarsForIndicator, ...extractProductVars(productSpecs), ...siblings };
      const calculated = evaluateIndicator(rule, vars);
      if (calculated) {
        (item as any).indicatorLabel = calculated.label;
        (item as any).indicatorColor = calculated.color;
        (item as any).indicatorValue = calculated.value;
        (item as any).indicatorUnit = calculated.unit;
      }
    }

    // Auto-backfill de cellRef em items legacy (criados antes da feature de cellRef).
    // Sem cellRef, formulas com qty(LX)/total(LX) nao acham nenhuma linha referenciavel.
    const missing = budget.items.filter((it) => !it.cellRef);
    if (missing.length > 0) {
      let nextNum = budget.items.reduce((max, it) => {
        const m = it.cellRef?.match(/^L(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const updates: Promise<any>[] = [];
      for (const it of missing.sort((a, b) => a.sortOrder - b.sortOrder)) {
        nextNum++;
        const newRef = `L${nextNum}`;
        updates.push(
          this.prisma.poolBudgetItem.update({
            where: { id: it.id },
            data: { cellRef: newRef },
          }),
        );
        it.cellRef = newRef;
      }
      await Promise.all(updates);
    }

    return budget;
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePoolBudgetDto,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Orçamento não encontrado');

    if (before.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException(
        'Orçamento aprovado não pode ser editado. Crie uma nova versão.',
      );
    }

    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: {
        clientPartnerId: dto.clientPartnerId,
        templateId: dto.templateId,
        printLayoutId: dto.printLayoutId,
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
        termsConditions: dto.termsConditions,
        poolDimensions: dto.poolDimensions
          ? (dto.poolDimensions as unknown as Prisma.InputJsonValue)
          : undefined,
        environmentParams: dto.environmentParams as Prisma.InputJsonValue | undefined,
        validityDays: dto.validityDays,
        discountCents: dto.discountCents,
        discountPercent: dto.discountPercent,
        taxesPercent: dto.taxesPercent,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        equipmentWarranty: dto.equipmentWarranty,
        workWarranty: dto.workWarranty,
        paymentTerms: dto.paymentTerms,
        earlyPaymentDiscountPct: dto.earlyPaymentDiscountPct,
        sectionOrder: dto.sectionOrder,
        paymentTermId: dto.paymentTermId,
      },
    });

    if (
      dto.discountCents !== undefined ||
      dto.discountPercent !== undefined ||
      dto.taxesPercent !== undefined ||
      dto.startDate !== undefined
    ) {
      await this.recalculateTotals(id);
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'UPDATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Orçamento não encontrado');

    if (before.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException(
        'Orçamento aprovado não pode ser removido. Cancele ao invés.',
      );
    }

    await this.prisma.poolBudget.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  // ============== ITEMS ==============

  async addItem(
    budgetId: string,
    dto: CreateBudgetItemDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode adicionar items');
    }

    // Auto-link: se DTO nao especificou productId/serviceId, busca match exato no cadastro
    // (precisa rodar ANTES de avaliar formula pra que productSpecs estejam disponiveis)
    let resolvedProductId = dto.productId ?? null;
    let resolvedServiceId = dto.serviceId ?? null;
    if (!resolvedProductId && !resolvedServiceId && dto.description) {
      const matched = await this.findAutoLinkByDescription(dto.description, companyId);
      if (matched.productId) resolvedProductId = matched.productId;
      else if (matched.serviceId) resolvedServiceId = matched.serviceId;
    }

    // Se formula foi enviada, avalia e sobrescreve qty + qtyCalculated
    let effectiveQty = dto.qty;
    let qtyCalculated: number | undefined;
    if (dto.formulaExpr && dto.formulaExpr.trim()) {
      const fullBudget = await this.prisma.poolBudget.findUnique({
        where: { id: budgetId },
        select: { poolDimensions: true },
      });
      // Inclui technicalSpecs do produto/servico vinculado pra suportar formulas
      // que usam vars como consumoKgM2, pesoKg, vazaoM3h, etc.
      let productSpecs: unknown = null;
      if (resolvedProductId) {
        const p = await this.prisma.product.findUnique({
          where: { id: resolvedProductId },
          select: { technicalSpecs: true },
        });
        productSpecs = p?.technicalSpecs;
      } else if (resolvedServiceId) {
        const s = await this.prisma.service.findUnique({
          where: { id: resolvedServiceId },
          select: { technicalSpecs: true },
        });
        productSpecs = s?.technicalSpecs;
      }
      // Se a regra tem linkedCellRef, siblings vem so dessa linha (vinculo explicito)
      const ruleLinkedCellRef = (dto.autoSelectRule as any)?.linkedCellRef as string | null | undefined;
      const siblingVars = await this.buildSiblingVars(budgetId, dto.poolSection, undefined, ruleLinkedCellRef);
      const vars = { ...extractDimensionVars(fullBudget?.poolDimensions), ...extractProductVars(productSpecs), ...siblingVars };
      const cellRefMap = await this.buildBudgetCellRefMap(budgetId);
      try {
        effectiveQty = evaluateFormula(dto.formulaExpr, vars, cellRefMap);
        qtyCalculated = effectiveQty;
      } catch (err: any) {
        // Se a formula usa cellRef e nao consegue resolver agora, deixa pro recalculateTotals
        const refs = extractCellRefs(dto.formulaExpr);
        if (refs.length > 0) {
          // mantem qty fornecido no DTO; recalculateTotals depois ajusta
          qtyCalculated = effectiveQty;
        } else {
          // Mensagem rica quando a formula usa sibling* e o erro pode ser por var indisponivel
          const diag = await this.diagnoseSiblingFailure(budgetId, dto.poolSection, dto.formulaExpr);
          throw new BadRequestException(diag || `Formula invalida: ${err.message}`);
        }
      }
    }
    const totalCents = Math.round(effectiveQty * dto.unitPriceCents);
    const cellRef = await this.nextCellRef(budgetId);

    const item = await this.prisma.poolBudgetItem.create({
      data: {
        budgetId,
        catalogConfigId: dto.catalogConfigId,
        productId: resolvedProductId,
        serviceId: resolvedServiceId,
        poolSection: dto.poolSection,
        sortOrder: dto.sortOrder ?? 0,
        slotName: dto.slotName,
        description: dto.description,
        unit: dto.unit ?? 'UN',
        cellRef,
        qty: effectiveQty,
        qtyCalculated: qtyCalculated ?? null,
        formulaExpr: dto.formulaExpr || null,
        ...(dto.autoSelectRule ? { autoSelectRule: dto.autoSelectRule as Prisma.InputJsonValue } : {}),
        unitPriceCents: dto.unitPriceCents,
        totalCents,
        isAutoCalculated: !!dto.formulaExpr,
        isExtra: dto.isExtra ?? true,
        notes: dto.notes,
      },
    });

    await this.recalculateTotals(budgetId);

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_ITEM',
      entityId: item.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: item as unknown as Record<string, unknown>,
    });

    return item;
  }

  async updateItem(
    itemId: string,
    dto: UpdateBudgetItemDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const item = await this.prisma.poolBudgetItem.findFirst({
      where: { id: itemId, budget: { companyId, deletedAt: null } },
      include: { budget: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode editar items');
    }

    // Se formula foi enviada, recalcula qty + qtyCalculated. String vazia = remove formula.
    let effectiveQty = dto.qty ?? item.qty;
    let qtyCalculated: number | null | undefined = undefined;
    let formulaExpr: string | null | undefined = undefined;
    let autoCalculatedOverride: boolean | undefined = undefined;
    if (dto.formulaExpr !== undefined) {
      if (dto.formulaExpr.trim()) {
        const fullBudget = await this.prisma.poolBudget.findUnique({
          where: { id: item.budgetId },
          select: { poolDimensions: true },
        });
        // Inclui technicalSpecs do produto/servico vinculado (formulas com consumoKgM2,
        // pesoKg, vazaoM3h etc dependem disso). Usa o vinculo atual do item, ou novo do DTO se mudou.
        const targetProductId = dto.productId !== undefined ? dto.productId : item.productId;
        const targetServiceId = dto.serviceId !== undefined ? dto.serviceId : item.serviceId;
        let productSpecs: unknown = null;
        if (targetProductId) {
          const p = await this.prisma.product.findUnique({
            where: { id: targetProductId },
            select: { technicalSpecs: true },
          });
          productSpecs = p?.technicalSpecs;
        } else if (targetServiceId) {
          const s = await this.prisma.service.findUnique({
            where: { id: targetServiceId },
            select: { technicalSpecs: true },
          });
          productSpecs = s?.technicalSpecs;
        }
        // Exclui o proprio item — evita auto-referencia em items com technicalSpecs
        // (ex: tubo lendo o proprio tuboEntradaMm via siblingTuboEntradaMm).
        // Se a regra tem linkedCellRef, usa SO a linha vinculada (vinculo explicito).
        const ruleLinkedCellRef = (dto.autoSelectRule as any)?.linkedCellRef ?? (item.autoSelectRule as any)?.linkedCellRef ?? null;
        const siblingVars = await this.buildSiblingVars(item.budgetId, item.poolSection, item.id, ruleLinkedCellRef);
        const vars = { ...extractDimensionVars(fullBudget?.poolDimensions), ...extractProductVars(productSpecs), ...siblingVars };
        const cellRefMap = await this.buildBudgetCellRefMap(item.budgetId);
        try {
          effectiveQty = evaluateFormula(dto.formulaExpr, vars, cellRefMap);
        } catch (err: any) {
          // Se usa cellRef e nao resolve agora, deixa pro recalculateTotals depois
          const refs = extractCellRefs(dto.formulaExpr);
          if (refs.length === 0) {
            // Mensagem rica quando a formula usa sibling* e o erro pode ser por var indisponivel
            const diag = await this.diagnoseSiblingFailure(item.budgetId, item.poolSection, dto.formulaExpr);
            throw new BadRequestException(diag || `Formula invalida: ${err.message}`);
          }
          // mantem qty atual; recalc ajusta
        }
        qtyCalculated = effectiveQty;
        formulaExpr = dto.formulaExpr;
        autoCalculatedOverride = true;
      } else {
        // Limpa formula
        qtyCalculated = null;
        formulaExpr = null;
        autoCalculatedOverride = false;
      }
    }
    const newUnitPrice = dto.unitPriceCents ?? item.unitPriceCents;
    const totalCents = Math.round(effectiveQty * newUnitPrice);

    // Auto-link: se a descricao mudou e o item ainda nao tem vinculo (e DTO nao traz
    // productId/serviceId explicito), tenta match exato no cadastro. Idempotente:
    // nao desvincula nem sobrescreve vinculo existente.
    let autoProductId: string | undefined;
    let autoServiceId: string | undefined;
    if (
      dto.description !== undefined &&
      dto.description !== item.description &&
      dto.productId === undefined &&
      dto.serviceId === undefined &&
      !item.productId &&
      !item.serviceId
    ) {
      const matched = await this.findAutoLinkByDescription(dto.description, companyId);
      if (matched.productId) autoProductId = matched.productId;
      else if (matched.serviceId) autoServiceId = matched.serviceId;
    }

    const updated = await this.prisma.poolBudgetItem.update({
      where: { id: itemId },
      data: {
        slotName: dto.slotName,
        description: dto.description,
        unit: dto.unit,
        qty: dto.formulaExpr !== undefined && formulaExpr ? effectiveQty : dto.qty,
        qtyCalculated,
        formulaExpr,
        unitPriceCents: dto.unitPriceCents,
        totalCents,
        sortOrder: dto.sortOrder,
        notes: dto.notes,
        ...(dto.catalogConfigId !== undefined ? { catalogConfigId: dto.catalogConfigId } : {}),
        ...(dto.productId !== undefined ? { productId: dto.productId } : (autoProductId ? { productId: autoProductId } : {})),
        ...(dto.serviceId !== undefined ? { serviceId: dto.serviceId } : (autoServiceId ? { serviceId: autoServiceId } : {})),
        ...(dto.autoSelectRule !== undefined
          ? { autoSelectRule: (dto.autoSelectRule === null ? Prisma.JsonNull : dto.autoSelectRule) as Prisma.InputJsonValue }
          : {}),
        ...(dto.manualUnlink !== undefined ? { manualUnlink: dto.manualUnlink } : {}),
        ...(dto.previousQty !== undefined ? { previousQty: dto.previousQty } : {}),
        ...(autoCalculatedOverride !== undefined
          ? { isAutoCalculated: autoCalculatedOverride }
          : (dto.qty !== undefined || dto.unitPriceCents !== undefined
            ? { isAutoCalculated: false }
            : {})),
      },
    });

    await this.recalculateTotals(item.budgetId);

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_ITEM',
      entityId: itemId,
      action: 'UPDATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: item as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async removeItem(itemId: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const item = await this.prisma.poolBudgetItem.findFirst({
      where: { id: itemId, budget: { companyId, deletedAt: null } },
      include: { budget: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode remover items');
    }

    await this.prisma.poolBudgetItem.delete({ where: { id: itemId } });
    await this.recalculateTotals(item.budgetId);

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_ITEM',
      entityId: itemId,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: item as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  // ============== APLICAR TEMPLATE LINEAR (Padrao Juliano) ==============

  /**
   * Aplica o template "Linear" extraido da planilha de origem (ANDREIA SANTANA
   * - Orçamento 120614042026.xlsm aba Linear) ao orçamento atual.
   *
   * Para cada linha da planilha cria 1 PoolBudgetItem com:
   *  - slotName = coluna "Etapa" da planilha (rotulo do papel da linha)
   *  - description = coluna "Descricao" (produto/servico inicial sugerido)
   *  - unit/qty/unitPriceCents conforme planilha
   *  - poolSection = mapeamento da etapa (CONSTRUCAO, FILTRO, etc)
   *  - tenta vincular catalogConfigId/productId/serviceId procurando match
   *    pela `description` no PoolCatalogConfig/Product/Service do tenant
   *
   * So aplica se o orçamento estiver SEM items (RASCUNHO + items vazios) — pra
   * evitar duplicacao acidental.
   */
  async applyLinearTemplate(
    budgetId: string,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      include: { items: { select: { id: true } } },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode aplicar template');
    }
    if (budget.items.length > 0) {
      throw new BadRequestException(
        'Orçamento ja tem items. Apague todos antes de aplicar o template Linear, ou crie um orçamento novo.',
      );
    }

    // Carrega o JSON do template (bundled em scripts/pool-seed/linear_template.json)
    // Tenta varios caminhos pra cobrir dev (ts-node de src/) e prod (dist/) e
    // tambem container Docker (cwd=/app).
    const candidates = [
      path.join(__dirname, '../../scripts/pool-seed/linear_template.json'),
      path.join(__dirname, '../../../scripts/pool-seed/linear_template.json'),
      path.resolve(process.cwd(), 'scripts/pool-seed/linear_template.json'),
      path.resolve(process.cwd(), '../scripts/pool-seed/linear_template.json'),
    ];
    let template: Array<{ label: string; items: Array<any> }> | null = null;
    let lastError = '';
    for (const tplPath of candidates) {
      try {
        if (fs.existsSync(tplPath)) {
          template = JSON.parse(fs.readFileSync(tplPath, 'utf-8'));
          this.logger.log(`Linear template carregado de: ${tplPath}`);
          break;
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }
    if (!template) {
      throw new BadRequestException(
        `Template Linear nao encontrado. Caminhos tentados: ${candidates.join('; ')}. Erro: ${lastError}`,
      );
    }

    // Mapeia rotulos da planilha → PoolSection enum
    const SECTION_MAP: Record<string, string> = {
      'CONSTRUÇÃO': 'CONSTRUCAO',
      'FILTRO': 'FILTRO',
      'CASCATA': 'CASCATA',
      'SPA': 'SPA',
      'AQUECIMENTO': 'AQUECIMENTO',
      'ILUMINAÇÃO': 'ILUMINACAO',
      'CASA DE MAQUINAS': 'CASA_MAQUINAS',
      'OUTROS OPCIONAIS': 'OUTROS',
      'DISPOSITIVOS': 'DISPOSITIVOS',
      'ACIONAMENTOS ELÉTRICOS': 'ACIONAMENTOS',
      'BORDA E CALÇADA': 'BORDA_CALCADA',
      'EXECUÇÃO E ADICIONAIS': 'EXECUCAO',
    };

    // Carrega catalog completo do tenant (1x) pra fazer matching por descricao
    const catalogs = await this.prisma.poolCatalogConfig.findMany({
      where: { companyId },
      include: {
        product: { select: { id: true, description: true, salePriceCents: true, unit: true } },
        service: { select: { id: true, name: true, priceCents: true, unit: true } },
      },
    });
    const findCatalog = (descricao: string) => {
      if (!descricao) return null;
      const norm = descricao.toLowerCase().trim().substring(0, 30);
      for (const c of catalogs) {
        const candidato = c.product?.description?.toLowerCase()?.trim() || c.service?.name?.toLowerCase()?.trim();
        if (candidato && candidato.startsWith(norm.substring(0, 15))) return c;
      }
      return null;
    };

    // Cria todos os items em batch
    const itemsToCreate: Prisma.PoolBudgetItemCreateManyInput[] = [];
    let created = 0;
    let unmappedSections = new Set<string>();
    let globalSort = 0;

    for (const sec of template) {
      const poolSection = SECTION_MAP[sec.label];
      if (!poolSection) {
        unmappedSections.add(sec.label);
        continue;
      }
      for (const it of sec.items) {
        const cat = findCatalog(it.descricao);
        const qty = it.qty || 0;
        // Sistema eh autoritativo: unitPrice arredondado ao centavo,
        // totalCents = qty × unitPriceCents (auto consistente).
        const unitPriceCents = Math.round((it.valorUnit || 0) * 100);
        const totalCents = Math.round(qty * unitPriceCents);
        itemsToCreate.push({
          budgetId,
          poolSection: poolSection as any,
          sortOrder: globalSort++,
          cellRef: `L${itemsToCreate.length + 1}`,
          slotName: it.etapa || null,
          description: it.descricao || it.etapa || '(sem descricao)',
          unit: it.unit || 'UN',
          qty,
          unitPriceCents,
          totalCents,
          isAutoCalculated: false,
          isExtra: false,
          catalogConfigId: cat?.id || null,
          productId: cat?.productId || null,
          serviceId: cat?.serviceId || null,
        });
        created++;
      }
    }

    if (itemsToCreate.length > 0) {
      await this.prisma.poolBudgetItem.createMany({ data: itemsToCreate });
      await this.recalculateTotals(budgetId);
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: budgetId,
      action: 'TEMPLATE_APPLIED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: { template: 'LINEAR_DEFAULT', itemsCreated: created } as any,
    });

    return {
      itemsCreated: created,
      unmappedSections: [...unmappedSections],
    };
  }

  // ============== STATUS TRANSITIONS ==============

  async approve(id: string, companyId: string, user: AuthenticatedUser, approverName?: string) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status !== PoolBudgetStatus.RASCUNHO && budget.status !== PoolBudgetStatus.ENVIADO) {
      throw new BadRequestException(
        `Orçamento em status ${budget.status} não pode ser aprovado`,
      );
    }

    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: {
        status: PoolBudgetStatus.APROVADO,
        approvedAt: new Date(),
        approvedByName: approverName ?? user.email,
        approvedByType: 'INTERNAL',
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'STATUS_CHANGED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: budget as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async reject(id: string, companyId: string, user: AuthenticatedUser, reason?: string) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: {
        status: PoolBudgetStatus.REJEITADO,
        rejectedAt: new Date(),
        rejectedByName: user.email,
        rejectedReason: reason,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'STATUS_CHANGED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: budget as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async cancel(id: string, companyId: string, user: AuthenticatedUser, reason?: string) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: {
        status: PoolBudgetStatus.CANCELADO,
        cancelledAt: new Date(),
        cancelledByName: user.email,
        cancelledReason: reason,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'STATUS_CHANGED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: budget as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────
  // Salvar como modelo: captura items + defaults do orcamento
  // atual e cria PoolBudgetTemplate. Proximo orcamento criado
  // com esse template ja vem populado com tudo.
  // ─────────────────────────────────────────────────────────
  async saveAsTemplate(
    budgetId: string,
    companyId: string,
    user: AuthenticatedUser,
    payload: { name?: string; description?: string; isDefault?: boolean; templateId?: string },
  ) {
    await this.assertModuleActive(companyId);

    // Sem templateId = criar novo (precisa de nome). Com templateId = atualizar (nome opcional).
    const isUpdate = !!payload?.templateId;
    if (!isUpdate && (!payload?.name || payload.name.trim().length === 0)) {
      throw new BadRequestException('Nome do modelo e obrigatorio');
    }

    // Se atualizando, valida que o modelo existe e pertence a empresa
    let existingTemplate: { id: string; name: string } | null = null;
    if (isUpdate) {
      existingTemplate = await this.prisma.poolBudgetTemplate.findFirst({
        where: { id: payload.templateId, companyId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!existingTemplate) {
        throw new NotFoundException('Modelo nao encontrado');
      }
    }

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      include: {
        items: {
          orderBy: [{ poolSection: 'asc' }, { sortOrder: 'asc' }],
          select: {
            poolSection: true,
            sortOrder: true,
            slotName: true,
            description: true,
            unit: true,
            qty: true,
            unitPriceCents: true,
            formulaExpr: true,
          },
        },
      },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    // Snapshot dos items
    const itemsSnapshot = budget.items.map((it) => ({
      poolSection: it.poolSection,
      sortOrder: it.sortOrder,
      slotName: it.slotName,
      description: it.description,
      unit: it.unit,
      qty: it.qty,
      unitPriceCents: it.unitPriceCents,
      formulaExpr: it.formulaExpr,
      // Inclui autoSelectRule (regra de filtro/auto-selecao do produto). Permite
      // que novo orcamento criado a partir do template ja venha com a mesma logica.
      // Items com manualSelection=true NAO vinculam productId na criacao — o
      // operador escolhe na mao via catalog picker (que ja respeita a regra).
      autoSelectRule: (it as any).autoSelectRule ?? null,
    }));

    // Defaults
    const defaults = {
      validityDays: budget.validityDays,
      discountPercent: budget.discountPercent,
      taxesPercent: budget.taxesPercent,
      equipmentWarranty: budget.equipmentWarranty,
      workWarranty: budget.workWarranty,
      paymentTerms: budget.paymentTerms,
      earlyPaymentDiscountPct: budget.earlyPaymentDiscountPct,
      paymentTermId: budget.paymentTermId,
      sectionOrder: budget.sectionOrder,
    };

    if (payload.isDefault) {
      await this.prisma.poolBudgetTemplate.updateMany({
        where: {
          companyId,
          isDefault: true,
          deletedAt: null,
          ...(isUpdate ? { id: { not: payload.templateId } } : {}),
        },
        data: { isDefault: false },
      });
    }

    let template: { id: string; name: string };
    if (isUpdate && existingTemplate) {
      template = await this.prisma.poolBudgetTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          name: payload.name?.trim() || existingTemplate.name,
          description: payload.description !== undefined ? (payload.description || null) : undefined,
          isDefault: payload.isDefault,
          itemsSnapshot: itemsSnapshot as unknown as Prisma.InputJsonValue,
          defaults: defaults as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, name: true },
      });
    } else {
      template = await this.prisma.poolBudgetTemplate.create({
        data: {
          companyId,
          name: payload.name!.trim(),
          description: payload.description ?? null,
          isDefault: payload.isDefault ?? false,
          sections: [] as unknown as Prisma.InputJsonValue,
          itemsSnapshot: itemsSnapshot as unknown as Prisma.InputJsonValue,
          defaults: defaults as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, name: true },
      });
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_TEMPLATE',
      entityId: template.id,
      action: isUpdate ? 'UPDATED' : 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: { sourceBudgetId: budgetId, name: template.name } as unknown as Record<string, unknown>,
    });

    return template;
  }
}
