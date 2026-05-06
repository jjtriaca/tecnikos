// Avaliador seguro de expressao aritmetica para auto-calculo de qty no PoolBudgetItem.
//
// Variaveis suportadas: length, width, depth, area, perimeter, volume.
// Operadores: + - * / ( ) e numero literal (com . decimal).
//
// Estrategia: substitui cada variavel pelo seu valor numerico, valida que sobrou apenas
// caracteres aritmeticos seguros, e usa Function pra avaliar. Como o input e sanitizado
// (so digitos/operadores/parens), nao ha risco de injecao de codigo.

const ALLOWED_VARS = ['length', 'width', 'depth', 'area', 'perimeter', 'volume'] as const;

export type FormulaVars = Partial<Record<typeof ALLOWED_VARS[number], number>>;

export function evaluateFormula(expr: string, vars: FormulaVars): number {
  if (!expr || expr.trim() === '') throw new Error('Formula vazia');

  // Normaliza: troca virgula decimal por ponto
  let normalized = expr.replace(/,/g, '.');

  // Substitui cada variavel pelo valor (entre parenteses pra preservar precedencia)
  for (const name of ALLOWED_VARS) {
    const v = Number(vars[name] ?? 0);
    normalized = normalized.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${v})`);
  }

  // Apos substituicao, so deve sobrar: digitos, ponto, espaco, parens, + - * /
  // Se sobrou algo alfa, e variavel nao reconhecida.
  if (/[a-zA-Z_]/.test(normalized)) {
    throw new Error('Variavel nao reconhecida na formula');
  }
  if (!/^[\d.\s+\-*/()]*$/.test(normalized)) {
    throw new Error('Caracter invalido na formula');
  }

  let result: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    result = Function(`"use strict"; return (${normalized});`)();
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
