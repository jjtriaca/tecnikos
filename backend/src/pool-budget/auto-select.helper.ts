/**
 * Auto-selecao de produto/servico em PoolBudgetItem baseada em regras dependentes
 * de variaveis da piscina (volume, area) + technicalSpecs do candidato (vazaoM3h, kcalH, ...).
 *
 * Estrutura da regra (JSON em PoolBudgetItem.autoSelectRule):
 * {
 *   filterCategoria: "Conjuntos de filtragem" | null,  // matcha technicalSpecs.categoriaPlanilha
 *   filterDescription: "filtro" | null,                 // ILIKE %x% em description/name
 *   where: "vazaoM3h * 1 >= volume * 0.25",             // condicao avaliada por candidato
 *   orderBy: "priceCents asc",                          // 1 chave + asc|desc (default asc)
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
  filterCategoria?: string | null;
  filterDescription?: string | null;
  where?: string | null;
  orderBy?: string | null;
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
  label: string;
  color: string;
  unit: string;
}

/**
 * Substitui variaveis e funcoes na expressao, retornando string normalizada
 * que pode ser passada pra Function eval. Reusa o mesmo padrao do formula-eval.
 */
function substituteVars(expr: string, vars: FormulaVars): string {
  // Decimal com virgula -> ponto
  let s = expr.replace(/(\d),(\d)/g, '$1.$2');

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
export function evaluateCondition(expr: string, vars: FormulaVars): boolean {
  if (!expr || !expr.trim()) return true; // sem condicao = aceita todos
  const normalized = substituteVars(expr, vars);

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
export function evaluateNumeric(expr: string, vars: FormulaVars): number {
  if (!expr || !expr.trim()) return 0;
  const normalized = substituteVars(expr, vars);
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
): IndicatorResult | null {
  const ind = rule?.indicator;
  if (!ind || !ind.expr) return null;
  const value = evaluateNumeric(ind.expr, vars);
  if (!Number.isFinite(value)) return null;
  // Acha o primeiro level cujo max >= value
  const levels = Array.isArray(ind.levels) ? ind.levels : [];
  const sorted = [...levels].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
  const matched = sorted.find((l) => value <= (l.max ?? Infinity));
  return {
    value,
    label: matched?.label || '',
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

export function filterCandidates<T extends { description?: string | null; name?: string | null; technicalSpecs?: any }>(
  candidates: T[],
  rule: AutoSelectRule,
): T[] {
  const { filterCategoria, filterDescription } = rule;
  return candidates.filter((c) => {
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
 * Avalia condicao `where` em cada candidato. Vars combinam orcamento + technicalSpecs do candidato.
 */
export function filterByWhere<T extends { technicalSpecs?: any }>(
  candidates: T[],
  rule: AutoSelectRule,
  baseVars: FormulaVars,
): T[] {
  if (!rule.where || !rule.where.trim()) return candidates;
  return candidates.filter((c) => {
    const specs = c.technicalSpecs && typeof c.technicalSpecs === 'object' ? c.technicalSpecs : {};
    const specVars: FormulaVars = {};
    for (const [k, v] of Object.entries(specs as Record<string, unknown>)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      const n = Number(v);
      if (Number.isFinite(n)) specVars[k] = n;
    }
    const merged = { ...baseVars, ...specVars };
    return evaluateCondition(rule.where!, merged);
  });
}

/**
 * Ordena candidatos por orderBy (com avaliacao de expressao por candidato).
 */
export function orderCandidates<T extends { technicalSpecs?: any; priceCents?: number; salePriceCents?: number; unitPriceCents?: number }>(
  candidates: T[],
  rule: AutoSelectRule,
  baseVars: FormulaVars,
): T[] {
  const parsed = parseOrderBy(rule.orderBy);
  if (!parsed) return candidates;
  const { expr, dir } = parsed;
  const valueOf = (c: T): number => {
    const specs = c.technicalSpecs && typeof c.technicalSpecs === 'object' ? c.technicalSpecs : {};
    const specVars: FormulaVars = {};
    for (const [k, v] of Object.entries(specs as Record<string, unknown>)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      const n = Number(v);
      if (Number.isFinite(n)) specVars[k] = n;
    }
    // Atalhos de campos comuns nao em specs
    const merged: FormulaVars = {
      ...baseVars,
      ...specVars,
      priceCents: c.priceCents ?? c.salePriceCents ?? c.unitPriceCents ?? 0,
      salePriceCents: c.salePriceCents ?? c.priceCents ?? c.unitPriceCents ?? 0,
    };
    const v = evaluateNumeric(expr, merged);
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
): T | null {
  const filtered1 = filterCandidates(candidates as any, rule);
  const filtered2 = filterByWhere(filtered1, rule, baseVars);
  const ordered = orderCandidates(filtered2 as any, rule, baseVars);
  return (ordered[0] as T) ?? null;
}
