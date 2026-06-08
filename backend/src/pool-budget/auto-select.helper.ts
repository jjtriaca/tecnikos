/**
 * Auto-selecao de produto/servico em PoolBudgetItem baseada em regras dependentes
 * de variaveis da piscina (volume, area) + technicalSpecs do candidato (vazaoM3h, kcalH, ...).
 *
 * Estrutura da regra (JSON em PoolBudgetItem.autoSelectRule):
 * {
 *   filterPoolType: "Cascata" | null,                   // matcha Product.poolType (campo top-level)
 *   filterCategoria: "Conjuntos de filtragem" | null,   // LEGADO: matcha technicalSpecs.categoriaPlanilha (mantido por compat)
 *   filterDescription: "filtro" | null,                 // ILIKE %x% em description/name
 *   where: "vazaoM3h * 1 >= volume * 0.25",             // condicao avaliada por candidato (opcional)
 *   orderBy: "priceCents asc",                          // 1 chave + asc|desc (default asc)
 *   manualSelection: true,                              // se true, engine NAO auto-vincula — so filtra candidatos
 *                                                       //   no catalog picker. Usuario escolhe na mao.
 *   indicator: {
 *     label: "Tempo de filtragem",
 *     expr: "volume / vazaoM3h",
 *     unit: "h",
 *     levels: [
 *       { max: 4, label: "Excelente", color: "green" },
 *       { max: 8, label: "Bom", color: "yellow" },
 *       { max: 999, label: "Ruim", color: "red" },
 *     ],
 *   } | null,
 * }
 */

import { ALLOWED_VARS, type FormulaVars } from './formula-eval';

const ALLOWED_FUNCTIONS = ['ceil', 'floor', 'round', 'min', 'max'] as const;
const SECTION_VAR_PATTERN = /\b(areaSec|volumeSec)(\d+)\b/g;

export interface AutoSelectRule {
  filterPoolType?: string | null;
  filterCategoria?: string | null;
  filterDescription?: string | null;
  where?: string | null;
  orderBy?: string | null;
  manualSelection?: boolean | null;
  // Vincula esse item a uma linha especifica como "equipamento principal"
  // (ex: tubo aponta pra L39 do Kit SPA). Quando preenchido, sibling* vem
  // SO do item com esse cellRef — elimina ambiguidade de "qual e o principal
  // da etapa". Sem ele, fallback pro comportamento generico (primeiro item
  // da etapa com cada chave).
  linkedCellRef?: string | null;
  // v1.12.26: quando true, ignora filtros e where — vincula direto ao coletor
  // selecionado no Simulador Solar (environmentParams.solarReport.selectedCollector.productId).
  useSolarCollector?: boolean | null;
  indicator?: AutoSelectIndicator | null;
}

export interface AutoSelectIndicator {
  label: string;
  expr: string;
  unit?: string | null;
  levels: AutoSelectIndicatorLevel[];
}

export interface AutoSelectIndicatorLevel {
  max: number;
  label: string;
  color: string; // 'green' | 'yellow' | 'red' | etc
}

export interface IndicatorResult {
  value: number;
  /** Nome do nivel correspondente ao valor calculado (ex: "Justo", "Adequado"). */
  label: string;
  /**
   * v1.12.66: nome geral da metrica (rule.indicator.label, ex: "Folga vazao").
   * Frontend exibe como prefixo antes do valor. Permite distinguir o "o que" da
   * metrica (Folga vazao) do "como esta" (Justo/Adequado/etc).
   */
  groupLabel: string;
  color: string;
  unit: string;
}

/**
 * Substitui variaveis e funcoes na expressao, retornando string normalizada
 * que pode ser passada pra Function eval. Reusa o mesmo padrao do formula-eval.
 *
 * Opcionalmente recebe cellRefSpecs: Map<cellRef, productSpecs> — quando definido,
 * a funcao prod(LX, "spec") e substituida pelo valor real da spec do produto
 * vinculado a linha LX. Compatibilidade com o helper do formula-eval.ts.
 */
function substituteVars(
  expr: string,
  vars: FormulaVars,
  cellRefSpecs?: Map<string, Record<string, unknown>>,
): string {
  // Decimal com virgula -> ponto
  let s = expr.replace(/(\d),(\d)/g, '$1.$2');

  // Operadores logicos em portugues/SQL -> JS. Templates pre-prontos foram
  // escritos com `and`/`or` literal (estilo SQL/Python), mas Function eval so
  // aceita `&&`/`||`. Sem essa conversao, qualquer letra residual cai no check
  // de var desconhecida (linha do return false) e a regra rejeita TODOS os
  // candidatos. Incidente F3 do Simulador de Aquecimento — template "Bomba de
  // Calor (preciso)" silenciosamente nao escolhia ninguem.
  s = s.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');

  // prod(LX, "spec") — substitui pela spec do produto da linha LX (cross-line reference)
  if (cellRefSpecs) {
    s = s.replace(
      /\bprod\s*\(\s*(L\d+)\s*,\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*\)/g,
      (_m, ref: string, key: string) => {
        const specs = cellRefSpecs.get(ref);
        const v = specs ? Number(specs[key] ?? 0) : 0;
        return `(${Number.isFinite(v) ? v : 0})`;
      },
    );
  } else {
    // Sem cellRefSpecs disponivel: ainda substitui pra 0 (nao quebra parser)
    s = s.replace(/\bprod\s*\(\s*L\d+\s*,\s*"[a-zA-Z_][a-zA-Z0-9_]*"\s*\)/g, '(0)');
  }

  // Substitui sectionVar dinamicamente
  s = s.replace(SECTION_VAR_PATTERN, (_m, prefix: string, num: string) => {
    const key = `${prefix}${num}`;
    return `(${Number(vars[key] ?? 0)})`;
  });

  // Substitui vars whitelisted
  for (const name of ALLOWED_VARS) {
    const v = Number(vars[name] ?? 0);
    s = s.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${v})`);
  }

  // Substitui vars dinamicas (productSpecs etc)
  const allowedSet = new Set<string>(ALLOWED_VARS as readonly string[]);
  for (const [key, val] of Object.entries(vars)) {
    if (val == null) continue;
    if (allowedSet.has(key)) continue;
    if (/^(areaSec|volumeSec)\d+$/.test(key)) continue;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
    const v = Number(val);
    if (!Number.isFinite(v)) continue;
    s = s.replace(new RegExp(`\\b${key}\\b`, 'g'), `(${v})`);
  }

  return s;
}

/**
 * Avalia condicao booleana (ex: "vazaoM3h * 1 >= volume * 0.25") com vars.
 * Aceita operadores aritmeticos, comparacao (>= <= == != > <), logicos (&& ||).
 * Retorna false em caso de erro de sintaxe.
 */
export function evaluateCondition(
  expr: string,
  vars: FormulaVars,
  cellRefSpecs?: Map<string, Record<string, unknown>>,
): boolean {
  if (!expr || !expr.trim()) return true; // sem condicao = aceita todos
  const normalized = substituteVars(expr, vars, cellRefSpecs);

  // Remove funcoes whitelisted antes de validar
  const fnPattern = new RegExp(`\\b(${ALLOWED_FUNCTIONS.join('|')})\\b`, 'g');
  const stripped = normalized.replace(fnPattern, '');
  if (/[a-zA-Z_]/.test(stripped)) return false; // var/funcao desconhecida
  if (!/^[\d.\s+\-*/(),<>=!&|]*$/.test(stripped)) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const fn = Function(
      'ceil', 'floor', 'round', 'min', 'max',
      `"use strict"; return (${normalized});`,
    );
    const result = fn(Math.ceil, Math.floor, Math.round, Math.min, Math.max);
    return !!result;
  } catch {
    return false;
  }
}

/**
 * Avalia expressao numerica com vars (ex: "volume / vazaoM3h"). Retorna NaN em erro.
 * Difere do `evaluateFormula` por nao throw — auto-select nao deve quebrar recalc.
 */
export function evaluateNumeric(
  expr: string,
  vars: FormulaVars,
  cellRefSpecs?: Map<string, Record<string, unknown>>,
): number {
  if (!expr || !expr.trim()) return 0;
  const normalized = substituteVars(expr, vars, cellRefSpecs);
  const fnPattern = new RegExp(`\\b(${ALLOWED_FUNCTIONS.join('|')})\\b`, 'g');
  const stripped = normalized.replace(fnPattern, '');
  if (/[a-zA-Z_]/.test(stripped)) return NaN;
  if (!/^[\d.\s+\-*/(),]*$/.test(stripped)) return NaN;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const fn = Function(
      'ceil', 'floor', 'round', 'min', 'max',
      `"use strict"; return (${normalized});`,
    );
    const r = fn(Math.ceil, Math.floor, Math.round, Math.min, Math.max);
    return typeof r === 'number' && Number.isFinite(r) ? r : NaN;
  } catch {
    return NaN;
  }
}

/**
 * Calcula o indicator (label, color, value) baseado na regra e nas vars.
 * Retorna null se a regra nao tem indicator ou se a expr resulta em NaN.
 */
export function evaluateIndicator(
  rule: AutoSelectRule | null | undefined,
  vars: FormulaVars,
  cellRefSpecs?: Map<string, Record<string, unknown>>,
): IndicatorResult | null {
  const ind = rule?.indicator;
  if (!ind || !ind.expr) return null;
  const value = evaluateNumeric(ind.expr, vars, cellRefSpecs);
  if (!Number.isFinite(value)) return null;
  // Acha o primeiro level cujo max >= value
  const levels = Array.isArray(ind.levels) ? ind.levels : [];
  const sorted = [...levels].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
  const matched = sorted.find((l) => value <= (l.max ?? Infinity));
  return {
    value,
    label: matched?.label || '',
    groupLabel: ind.label || '',
    color: matched?.color || 'slate',
    unit: ind.unit || '',
  };
}

/**
 * Parse `orderBy` em formato "<expr> asc|desc" ou "<expr>" (default asc).
 * Retorna { expr, dir } ou null se invalido.
 */
function parseOrderBy(orderBy: string | null | undefined): { expr: string; dir: 1 | -1 } | null {
  if (!orderBy || !orderBy.trim()) return null;
  const m = orderBy.trim().match(/^(.+?)\s+(asc|desc)$/i);
  if (m) return { expr: m[1].trim(), dir: m[2].toLowerCase() === 'desc' ? -1 : 1 };
  return { expr: orderBy.trim(), dir: 1 };
}

/**
 * Aplica filter da regra contra um array de candidatos (Product ou Service).
 * Filter = combinacao de filterCategoria (matcha technicalSpecs.categoriaPlanilha)
 * e filterDescription (matcha description/name case-insensitive).
 */
// Normaliza string removendo acentos pra match case+accent-insensitive.
// Sem isso, filtro 'conexoes' nao matcha 'conexões' (incidente v1.11.03).
// ̀-ͯ e o range de combining diacritical marks gerados por NFD.
function normalizeForMatch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filterCandidates<T extends { description?: string | null; name?: string | null; technicalSpecs?: any; poolType?: string | null }>(
  candidates: T[],
  rule: AutoSelectRule,
): T[] {
  const { filterPoolType, filterCategoria, filterDescription } = rule;
  return candidates.filter((c) => {
    // filterPoolType matcha Product.poolType (campo top-level) — preferido.
    // Service nao tem poolType, entao essa regra so filtra produtos.
    if (filterPoolType && filterPoolType.trim()) {
      const t = (c as any).poolType;
      if (!t || normalizeForMatch(String(t)) !== normalizeForMatch(filterPoolType.trim())) {
        return false;
      }
    }
    // filterCategoria (LEGADO) matcha technicalSpecs.categoriaPlanilha. Mantido pra
    // compat com regras antigas que ainda usam esse campo.
    if (filterCategoria && filterCategoria.trim()) {
      const cat = c.technicalSpecs?.categoriaPlanilha;
      if (!cat || normalizeForMatch(String(cat)) !== normalizeForMatch(filterCategoria.trim())) {
        return false;
      }
    }
    if (filterDescription && filterDescription.trim()) {
      const desc = normalizeForMatch(c.description || c.name || '');
      if (!desc.includes(normalizeForMatch(filterDescription.trim()))) return false;
    }
    return true;
  });
}

/**
 * v1.12.41: interpola a curva caracteristica da bomba (Product.pumpCurve) pra obter
 * a vazao entregue numa altura manometrica alvo. Pra altura > altura maxima da curva,
 * a bomba nao vence — retorna vazao 0. Pra altura < minima cadastrada, retorna vazao
 * maxima (extrapolacao pra direita).
 *
 * pumpCurve: Array<{vazaoM3h, alturaMca}> ordenado por altura crescente.
 * Retorna { vazaoInterpolada, shutOffHead } ou null se a curva eh invalida.
 *
 * Uso: auto-select de bomba — substitui specVars.vazaoM3h e specVars.pressaoTrabalhoMca
 * pelos valores reais da curva, deixando a regra "vazaoM3h >= X && pressaoTrabalhoMca >= Y"
 * funcionar com precisao de curva caracteristica.
 */
export function interpolatePumpCurve(
  pumpCurve: unknown,
  targetAltura: number,
): { vazaoInterpolada: number; shutOffHead: number } | null {
  if (!Array.isArray(pumpCurve) || pumpCurve.length < 2) return null;
  const points: Array<{ v: number; a: number }> = [];
  for (const p of pumpCurve) {
    if (!p || typeof p !== 'object') continue;
    const v = Number((p as any).vazaoM3h);
    const a = Number((p as any).alturaMca);
    if (Number.isFinite(v) && Number.isFinite(a) && v >= 0 && a >= 0) {
      points.push({ v, a });
    }
  }
  if (points.length < 2) return null;
  points.sort((p1, p2) => p1.a - p2.a);
  const minA = points[0].a;
  const maxA = points[points.length - 1].a;
  const maxV = Math.max(...points.map((p) => p.v));
  if (!Number.isFinite(targetAltura) || targetAltura < 0) {
    return { vazaoInterpolada: maxV, shutOffHead: maxA };
  }
  if (targetAltura > maxA) {
    return { vazaoInterpolada: 0, shutOffHead: maxA };
  }
  if (targetAltura <= minA) {
    return { vazaoInterpolada: maxV, shutOffHead: maxA };
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (targetAltura >= p1.a && targetAltura <= p2.a) {
      const ratio = (targetAltura - p1.a) / (p2.a - p1.a);
      const vazao = p1.v + ratio * (p2.v - p1.v);
      return { vazaoInterpolada: Math.max(0, vazao), shutOffHead: maxA };
    }
  }
  return { vazaoInterpolada: 0, shutOffHead: maxA };
}

/**
 * Ponto de operacao de uma bomba num circuito FECHADO dominado por atrito (trocador/
 * bomba de calor): intersecao da curva da bomba (altura cai com a vazao) com a curva de
 * resistencia do sistema a = kResist * vazao^2 (atrito cresce com vazao²). Retorna a vazao
 * REAL entregue (onde a bomba equilibra a perda do tubo) + shut-off head.
 *
 * Diferente de interpolatePumpCurve (vazao numa altura FIXA — certo pro Solar, circuito
 * aberto com altura estatica; errado pro trocador, onde a perda varia com a vazao²).
 */
export function pumpOperatingPoint(
  pumpCurve: unknown,
  kResist: number,
): { vazaoInterpolada: number; shutOffHead: number } | null {
  if (!Array.isArray(pumpCurve) || pumpCurve.length < 2) return null;
  if (!Number.isFinite(kResist) || kResist <= 0) return null;
  const points: Array<{ v: number; a: number }> = [];
  for (const p of pumpCurve) {
    if (!p || typeof p !== 'object') continue;
    const v = Number((p as any).vazaoM3h);
    const a = Number((p as any).alturaMca);
    if (Number.isFinite(v) && Number.isFinite(a) && v >= 0 && a >= 0) points.push({ v, a });
  }
  if (points.length < 2) return null;
  points.sort((p1, p2) => p1.v - p2.v);
  const shutOff = Math.max(...points.map((p) => p.a));
  const maxV = points[points.length - 1].v;
  // f(v) = altura_bomba(v) - kResist*v^2 : positivo em vazao baixa, negativo em vazao alta.
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const f1 = p1.a - kResist * p1.v * p1.v;
    const f2 = p2.a - kResist * p2.v * p2.v;
    if (f1 >= 0 && f2 <= 0) {
      const denom = f1 - f2;
      const t = denom !== 0 ? f1 / denom : 0;
      const vop = p1.v + t * (p2.v - p1.v);
      return { vazaoInterpolada: Math.max(0, vop), shutOffHead: shutOff };
    }
  }
  // Sem cruzamento: bomba nao vence nem na vazao minima -> 0; senao entrega ao menos a vazao max da curva.
  const f0 = points[0].a - kResist * points[0].v * points[0].v;
  if (f0 < 0) return { vazaoInterpolada: 0, shutOffHead: shutOff };
  return { vazaoInterpolada: maxV, shutOffHead: shutOff };
}

/**
 * Extrai specs numericos do candidato + sobrescreve com valores interpolados da
 * pumpCurve quando aplicavel (v1.12.41). Quando candidato tem pumpCurve cadastrada
 * e baseVars.alturaTelhadoMca > 0, substitui:
 *  - specVars.vazaoM3h = vazao interpolada na altura alvo (precisao curva real)
 *  - specVars.pressaoTrabalhoMca = shut-off head (altura maxima da curva)
 *
 * Bombas sem curva mantem o comportamento legado (technicalSpecs estaticos).
 */
function extractCandidateSpecs(
  candidate: { technicalSpecs?: any; pumpCurve?: any },
  baseVars: FormulaVars,
): FormulaVars {
  const specs = candidate.technicalSpecs && typeof candidate.technicalSpecs === 'object'
    ? candidate.technicalSpecs : {};
  const specVars: FormulaVars = {};
  for (const [k, v] of Object.entries(specs as Record<string, unknown>)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n)) specVars[k] = n;
  }
  const alturaAlvo = Number(baseVars.alturaTelhadoMca);
  const frictionK = Number((baseVars as any).frictionKResist);
  if (Number.isFinite(frictionK) && frictionK > 0) {
    // Circuito fechado (trocador): vazao no PONTO DE OPERACAO (curva da bomba x resistencia do tubo ∝ vazao²).
    const op = pumpOperatingPoint(candidate.pumpCurve, frictionK);
    if (op) {
      specVars.vazaoM3h = op.vazaoInterpolada;
      specVars.pressaoTrabalhoMca = op.shutOffHead;
    }
  } else if (Number.isFinite(alturaAlvo) && alturaAlvo > 0) {
    // Circuito aberto (solar): vazao na altura estatica alvo (comportamento original).
    const interp = interpolatePumpCurve(candidate.pumpCurve, alturaAlvo);
    if (interp) {
      specVars.vazaoM3h = interp.vazaoInterpolada;
      specVars.pressaoTrabalhoMca = interp.shutOffHead;
    }
  }
  return specVars;
}

/**
 * Avalia condicao `where` em cada candidato. Vars combinam orcamento + technicalSpecs do candidato.
 */
export function filterByWhere<T extends { technicalSpecs?: any; pumpCurve?: any }>(
  candidates: T[],
  rule: AutoSelectRule,
  baseVars: FormulaVars,
  cellRefSpecs?: Map<string, Record<string, unknown>>,
): T[] {
  if (!rule.where || !rule.where.trim()) return candidates;
  return candidates.filter((c) => {
    const specVars = extractCandidateSpecs(c, baseVars);
    const merged = { ...baseVars, ...specVars };
    return evaluateCondition(rule.where!, merged, cellRefSpecs);
  });
}

/**
 * Ordena candidatos por orderBy (com avaliacao de expressao por candidato).
 */
export function orderCandidates<T extends { technicalSpecs?: any; pumpCurve?: any; priceCents?: number; salePriceCents?: number; unitPriceCents?: number }>(
  candidates: T[],
  rule: AutoSelectRule,
  baseVars: FormulaVars,
  cellRefSpecs?: Map<string, Record<string, unknown>>,
): T[] {
  const parsed = parseOrderBy(rule.orderBy);
  if (!parsed) return candidates;
  const { expr, dir } = parsed;
  const valueOf = (c: T): number => {
    const specVars = extractCandidateSpecs(c, baseVars);
    const merged: FormulaVars = {
      ...baseVars,
      ...specVars,
      priceCents: c.priceCents ?? c.salePriceCents ?? c.unitPriceCents ?? 0,
      salePriceCents: c.salePriceCents ?? c.priceCents ?? c.unitPriceCents ?? 0,
    };
    const v = evaluateNumeric(expr, merged, cellRefSpecs);
    return Number.isFinite(v) ? v : Number.MAX_SAFE_INTEGER;
  };
  return [...candidates].sort((a, b) => (valueOf(a) - valueOf(b)) * dir);
}

/**
 * Pipeline completo: filter + where + orderBy + take 1.
 * Retorna o melhor candidato ou null. T eh permissivo (qualquer objeto)
 * pra suportar Product e Service com campos diferentes (id, unit, etc).
 */
export function selectBestCandidate<T extends Record<string, any>>(
  candidates: T[],
  rule: AutoSelectRule,
  baseVars: FormulaVars,
  cellRefSpecs?: Map<string, Record<string, unknown>>,
): T | null {
  const filtered1 = filterCandidates(candidates as any, rule);
  const filtered2 = filterByWhere(filtered1, rule, baseVars, cellRefSpecs);
  const ordered = orderCandidates(filtered2 as any, rule, baseVars, cellRefSpecs);
  return (ordered[0] as T) ?? null;
}
