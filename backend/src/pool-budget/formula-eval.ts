// Avaliador seguro de expressao aritmetica para auto-calculo de qty no PoolBudgetItem.
//
// Variaveis suportadas:
//   - Dimensoes: length, width, depth, area, perimeter, volume.
//   - Prazo: dias (duracao estimada da obra; computada excluindo o proprio item — sem circularidade).
// Funcoes suportadas: ceil(x), floor(x), round(x), min(a,b), max(a,b).
// Referencias entre linhas: qty(LX), total(LX), unitPrice(LX) onde LX = cellRef da linha.
// Operadores: + - * / ( ) e numero literal (decimal com .)
//
// Estrategia: substitui cada variavel pelo seu valor numerico, valida que sobrou apenas
// caracteres aritmeticos seguros + nomes de funcoes whitelisted, e usa Function pra avaliar.
// Como o input e sanitizado, nao ha risco de injecao de codigo.

const ALLOWED_VARS = ['length', 'width', 'depth', 'area', 'perimeter', 'volume', 'dias'] as const;
const ALLOWED_FUNCTIONS = ['ceil', 'floor', 'round', 'min', 'max'] as const;
const CELL_REF_FUNCTIONS = ['qty', 'total', 'unitPrice'] as const;

export type FormulaVars = Partial<Record<typeof ALLOWED_VARS[number], number>>;

export interface CellRefData {
  qty: number;
  total: number;     // em REAIS (nao centavos)
  unitPrice: number; // em REAIS
}

// Extrai cellRefs referenciados em uma formula (ex: "qty(L7) + total(L8)" -> ["L7", "L8"])
export function extractCellRefs(expr: string | null | undefined): string[] {
  if (!expr) return [];
  const refs = new Set<string>();
  const pattern = new RegExp(`\\b(${CELL_REF_FUNCTIONS.join('|')})\\s*\\(\\s*(L\\d+)\\s*\\)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(expr)) !== null) refs.add(m[2]);
  return Array.from(refs);
}

export function evaluateFormula(
  expr: string,
  vars: FormulaVars,
  cellRefs: Map<string, CellRefData> = new Map(),
): number {
  if (!expr || expr.trim() === '') throw new Error('Formula vazia');

  // Decimal so com ponto. Virgula reservada como separador de argumento de funcao.
  let normalized = expr;

  // Substitui chamadas a cellRef ANTES das vars (pra nao confundir 'L1' com identifier solto)
  for (const fn of CELL_REF_FUNCTIONS) {
    normalized = normalized.replace(
      new RegExp(`\\b${fn}\\s*\\(\\s*(L\\d+)\\s*\\)`, 'g'),
      (_match, ref: string) => {
        const data = cellRefs.get(ref);
        if (!data) throw new Error(`Linha ${ref} nao existe`);
        const v = Number(data[fn] ?? 0);
        return `(${v})`;
      },
    );
  }

  // Substitui cada variavel pelo valor (entre parenteses pra preservar precedencia)
  for (const name of ALLOWED_VARS) {
    const v = Number(vars[name] ?? 0);
    normalized = normalized.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${v})`);
  }

  // Valida: depois de remover funcoes whitelisted, nao deve sobrar nenhum identifier alfa
  const fnPattern = new RegExp(`\\b(${ALLOWED_FUNCTIONS.join('|')})\\b`, 'g');
  const stripped = normalized.replace(fnPattern, '');
  if (/[a-zA-Z_]/.test(stripped)) {
    throw new Error('Variavel ou funcao nao reconhecida na formula');
  }
  if (!/^[\d.\s+\-*/(),]*$/.test(stripped)) {
    throw new Error('Caracter invalido na formula');
  }

  let result: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const fn = Function(
      'ceil', 'floor', 'round', 'min', 'max',
      `"use strict"; return (${normalized});`,
    );
    result = fn(Math.ceil, Math.floor, Math.round, Math.min, Math.max);
  } catch {
    throw new Error('Sintaxe invalida na formula');
  }

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Resultado invalido (NaN/Infinity)');
  }
  return result;
}

// Extrai variaveis financeiras a partir do JSON de poolDimensions do orcamento.
// Aceita formato { length, width, depth, area, perimeter, volume } com sub-secoes opcionais.
// Se houver sections[] (piscinas com formatos irregulares), soma as areas/volumes.
export function extractDimensionVars(poolDimensions: any): FormulaVars {
  if (!poolDimensions || typeof poolDimensions !== 'object') return {};
  const d = poolDimensions as Record<string, any>;

  // Caso simples (1 secao): root tem os valores diretos
  const direct: FormulaVars = {
    length: typeof d.length === 'number' ? d.length : undefined,
    width: typeof d.width === 'number' ? d.width : undefined,
    depth: typeof d.depth === 'number' ? d.depth : undefined,
    area: typeof d.area === 'number' ? d.area : undefined,
    perimeter: typeof d.perimeter === 'number' ? d.perimeter : undefined,
    volume: typeof d.volume === 'number' ? d.volume : undefined,
  };

  // Se tem sections[], agrega area/volume e usa primeira pra dimensoes
  if (Array.isArray(d.sections) && d.sections.length > 0) {
    let totalArea = 0;
    let totalVolume = 0;
    for (const s of d.sections) {
      if (typeof s.area === 'number') totalArea += s.area;
      else if (typeof s.length === 'number' && typeof s.width === 'number') totalArea += s.length * s.width;
      if (typeof s.volume === 'number') totalVolume += s.volume;
      else if (typeof s.length === 'number' && typeof s.width === 'number' && typeof s.depth === 'number') {
        totalVolume += s.length * s.width * s.depth;
      }
    }
    if (totalArea > 0) direct.area = totalArea;
    if (totalVolume > 0) direct.volume = totalVolume;
    const first = d.sections[0];
    if (first && direct.length === undefined && typeof first.length === 'number') direct.length = first.length;
    if (first && direct.width === undefined && typeof first.width === 'number') direct.width = first.width;
    if (first && direct.depth === undefined && typeof first.depth === 'number') direct.depth = first.depth;
  }

  return direct;
}
