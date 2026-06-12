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

export const ALLOWED_VARS = [
  // Dimensoes basicas (primeira section ou unica)
  'length', 'width', 'depth',
  // Metricas agregadas (somatorios das sections)
  'area',          // m² - superficie d'agua (somatorio das sections)
  'perimeter',     // m - SOMATORIO das section perimeters (use perimExterno pra borda real)
  'volume',        // m³ - volume d'agua
  // Perimetros especificos (bounding box externo)
  'cantos',         // m/l - cantoneiras internas
  'perimExterno',   // m/l - perimetro externo borda (BORDA REAL — use pra parede pre-moldada externa)
  'perimInterno',   // m/l - perimetro paredes internas
  // Areas especificas (parede + fundo, pra impermeabilizacao/pintura)
  'areaParedeEFundo', // m² - area total parede + fundo (impermeabilizante, pintura)
  // Radier (concreto do fundo)
  'radierM2',         // m² - area do radier
  'radierEspessura',  // m  - espessura do radier
  'radierM3',         // m³ - volume de concreto do radier (= radierM2 * radierEspessura)
  // Escavacao
  'escavacao',        // m³ - volume de escavacao (terra removida)
  // Prazo
  'dias',
  // Aquecimento (aba CAPA da planilha original + simulador F1)
  'tempLocal',     // °C - temperatura media local
  'tempAgua',      // °C - temperatura agua desejada
  'vento',         // 0=NULO, 1=BAIXO/FRACO, 2=MODERADO, 3=FORTE
  'capa',          // 0=NAO, 1=SIM
  'construcao',    // 1=ABERTA, 2=FECHADA
  'hidromassagens',  // qtd unidades
  'cascataCm',       // largura cascata em cm
  'bordaInfinitaM',  // metros de borda infinita
  // Var calculada pelo HeatingService apos computeReport (kcal/h necessario na pior condicao)
  // Permite expressoes como: `kcalHNominal >= calorNecessarioKcalH` em regras de auto-select
  // de bomba de calor.
  'calorNecessarioKcalH',
  // v1.11.95: Quantity do equipamento escolhido no Simulador (selectedEquipment.quantity).
  // Permite linha do orcamento amarrar ao Simulador via formula="bombaCalorQty" — quando
  // operador troca Quant no Simulador (override) OU volta pra auto, a formula reavalia.
  'bombaCalorQty',
  // Fase 6 (Solar): qtd de coletores dimensionada na aba Solar (SolarReport.qtdColetores).
  // Linha "Coletor Solar" pode usar formulaExpr="solarQty" pra refletir o dimensionamento.
  'solarQty',
  // Numero de baterias do dimensionamento solar (numBaterias) — util pra acessorios.
  'solarNumBaterias',
  // v1.12.31: altura do telhado em MCA (1m geometrico = 1 MCA estatica).
  // Permite where='pressaoTrabalhoMca >= alturaTelhadoMca' na auto-select de bomba.
  'alturaTelhadoMca',
  // v1.13.55: quantidade de bombas de recirculacao (N em paralelo) escolhida no Simulador.
  // Linha da recirc usa formula `trocadorBombaQty` (bomba de calor) / `solarBombaQty` (solar).
  'trocadorBombaQty',
  'solarBombaQty',
  // v1.13.57 (Chunk C): DN (mm) do tubo dimensionado no card "Tubulacao — perda de carga"
  // do Simulador. solar = environmentParams.solarPipe.result.diametroDnMm; bomba de calor =
  // environmentParams.trocadorPipe.result.diametroDnMm. Linha do tubo usa auto-select
  // where='tuboEntradaMm >= solarPipeDnMm' (ou trocadorPipeDnMm) pra escolher o tubo do catalogo.
  'solarPipeDnMm',
  'trocadorPipeDnMm',
] as const;
const ALLOWED_FUNCTIONS = ['ceil', 'floor', 'round', 'min', 'max'] as const;
const CELL_REF_FUNCTIONS = ['qty', 'total', 'unitPrice'] as const;

// Variaveis dinamicas: areaSec1, areaSec2, ..., volumeSec1, volumeSec2, ...
// (uma por section da piscina, em ordem). Suporta numero arbitrario de sections.
const SECTION_VAR_PATTERN = /\b(areaSec|volumeSec)(\d+)\b/g;

// Permite chaves dinamicas (areaSecN, volumeSecN) alem das whitelisted.
export type FormulaVars = { [k: string]: number | undefined };

export interface CellRefData {
  qty: number;
  total: number;     // em REAIS (nao centavos)
  unitPrice: number; // em REAIS
  specs?: Record<string, number>; // technicalSpecs do produto/servico vinculado a essa linha
}

// Item do orcamento usado em agregacoes via funcao sum().
export interface BudgetItemForFormula {
  qty: number;
  specs?: Record<string, number> | null;
  categoria?: string | null; // categoriaPlanilha do produto vinculado
}

// Extrai cellRefs referenciados em uma formula. Reconhece qty/total/unitPrice/prod.
export function extractCellRefs(expr: string | null | undefined): string[] {
  if (!expr) return [];
  const refs = new Set<string>();
  // qty(LX), total(LX), unitPrice(LX)
  const p1 = new RegExp(`\\b(${CELL_REF_FUNCTIONS.join('|')})\\s*\\(\\s*(L\\d+)\\s*\\)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = p1.exec(expr)) !== null) refs.add(m[2]);
  // prod(LX, "key")
  const p2 = /\bprod\s*\(\s*(L\d+)\s*,\s*"[a-zA-Z_][a-zA-Z0-9_]*"\s*\)/g;
  while ((m = p2.exec(expr)) !== null) refs.add(m[1]);
  return Array.from(refs);
}

export function evaluateFormula(
  expr: string,
  vars: FormulaVars,
  cellRefs: Map<string, CellRefData> = new Map(),
  budgetItems: BudgetItemForFormula[] = [],
): number {
  if (!expr || expr.trim() === '') throw new Error('Formula vazia');

  // Aceita decimal com virgula (padrao BR) — auto-converte "0,1" -> "0.1".
  // So matcha digito-virgula-digito SEM espaco. Em "min(area, 10)" tem espaco apos
  // a virgula, entao continua como separador de argumento.
  let normalized = expr.replace(/(\d),(\d)/g, '$1.$2');

  // sum("spec") — soma spec_value × qty de todos os items do orcamento (com produto vinculado)
  // sum("spec", "categoriaPlanilha") — somatorio filtrado pela categoria do produto
  normalized = normalized.replace(
    /\bsum\s*\(\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*(?:,\s*"([^"]*)"\s*)?\)/g,
    (_m, key: string, cat?: string) => {
      let total = 0;
      for (const it of budgetItems) {
        const specs = it.specs;
        if (!specs) continue;
        const v = Number(specs[key]);
        if (!Number.isFinite(v) || v === 0) continue;
        if (cat && cat.trim()) {
          const c = (it.categoria || '').toLowerCase().trim();
          if (c !== cat.toLowerCase().trim()) continue;
        }
        const q = Number(it.qty) || 0;
        total += v * q;
      }
      return `(${total})`;
    },
  );

  // prod(LX, "spec") — pega spec do produto vinculado a linha LX
  normalized = normalized.replace(
    /\bprod\s*\(\s*(L\d+)\s*,\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*\)/g,
    (_m, ref: string, key: string) => {
      const data = cellRefs.get(ref);
      if (!data) throw new Error(`Linha ${ref} nao existe`);
      const v = Number(data.specs?.[key] ?? 0);
      return `(${v})`;
    },
  );

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

  // Substitui variaveis dinamicas areaSecN / volumeSecN (uma por section da piscina)
  normalized = normalized.replace(SECTION_VAR_PATTERN, (_m, prefix: string, num: string) => {
    const key = `${prefix}${num}`;
    const v = Number(vars[key] ?? 0);
    return `(${v})`;
  });

  // Substitui cada variavel pelo valor (entre parenteses pra preservar precedencia)
  for (const name of ALLOWED_VARS) {
    const v = Number(vars[name] ?? 0);
    normalized = normalized.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${v})`);
  }

  // Variaveis adicionais (technicalSpecs do produto/servico vinculado, etc).
  // Substitui qualquer chave nao-whitelisted que esteja em `vars`. Filtra keys
  // unsafe (so identifiers alfanumericos validos).
  const allowedSet = new Set<string>(ALLOWED_VARS as readonly string[]);
  for (const [key, val] of Object.entries(vars)) {
    if (val == null) continue;
    if (allowedSet.has(key)) continue;
    if (/^(areaSec|volumeSec)\d+$/.test(key)) continue; // ja tratado pelo SECTION_VAR_PATTERN
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
    const v = Number(val);
    if (!Number.isFinite(v)) continue;
    normalized = normalized.replace(new RegExp(`\\b${key}\\b`, 'g'), `(${v})`);
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

// Mapeia strings da UI pra numeros (vento/capa/construcao).
// Vento: 0=NULO/sem vento, 1=BAIXO/FRACO, 2=MODERADO, 3=FORTE
const VENTO_MAP: Record<string, number> = {
  NULO: 0, BAIXO: 1, FRACO: 1, MODERADO: 2, FORTE: 3,
};
const CAPA_MAP: Record<string, number> = { SIM: 1, NAO: 0, NÃO: 0 };
const CONSTRUCAO_MAP: Record<string, number> = { ABERTA: 1, FECHADA: 2 };

// Le technicalSpecs (Json livre) do produto ou servico vinculado a uma linha do orcamento
// e expoe os campos numericos como variaveis utilizaveis na formula (ex: pesoKg, consumoKgM2,
// vazaoM3h, kcalHMin, ...). Permite formulas como `ceil(consumoKgM2 * area / pesoKg)`.
export function extractProductVars(specs: unknown): FormulaVars {
  if (!specs || typeof specs !== 'object') return {};
  const out: FormulaVars = {};
  for (const [k, v] of Object.entries(specs as Record<string, unknown>)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

// Le environmentParams do orcamento e converte strings em numeros pra usar em formulas.
export function extractEnvVars(environmentParams: any): FormulaVars {
  if (!environmentParams || typeof environmentParams !== 'object') return {};
  const e = environmentParams as Record<string, any>;
  const vars: FormulaVars = {};
  if (typeof e.temperaturaMediaLocal === 'number') vars.tempLocal = e.temperaturaMediaLocal;
  else if (typeof e.temperatura === 'number') vars.tempLocal = e.temperatura; // legado
  if (typeof e.temperaturaAguaDesejada === 'number') vars.tempAgua = e.temperaturaAguaDesejada;
  if (typeof e.velocidadeVento === 'number') vars.vento = e.velocidadeVento;
  else if (typeof e.velocidadeVento === 'string') vars.vento = VENTO_MAP[e.velocidadeVento.toUpperCase()] ?? 0;
  if (typeof e.capaTermica === 'boolean') vars.capa = e.capaTermica ? 1 : 0;
  else if (typeof e.capaTermica === 'string') vars.capa = CAPA_MAP[e.capaTermica.toUpperCase()] ?? 0;
  else if (typeof e.capaTermica === 'number') vars.capa = e.capaTermica;
  if (typeof e.tipoConstrucao === 'string') vars.construcao = CONSTRUCAO_MAP[e.tipoConstrucao.toUpperCase()] ?? 0;
  else if (typeof e.tipoConstrucao === 'number') vars.construcao = e.tipoConstrucao;
  // Extras (simulador de aquecimento F1)
  if (typeof e.hidromassagensQtd === 'number') vars.hidromassagens = e.hidromassagensQtd;
  if (typeof e.cascataLarguraCm === 'number') vars.cascataCm = e.cascataLarguraCm;
  if (typeof e.bordaInfinitaM === 'number') vars.bordaInfinitaM = e.bordaInfinitaM;
  // v1.12.31: altura do telhado em metros — 1m ≈ 1 MCA estatica. Permite regras
  // de auto-select de bomba: where='pressaoTrabalhoMca >= alturaTelhadoMca'.
  if (typeof e.alturaTelhadoM === 'number') vars.alturaTelhadoMca = e.alturaTelhadoM;
  // v1.13.55: N em paralelo da bomba de recirculacao da BOMBA DE CALOR (default 1). A linha
  // da recirc usa formula `trocadorBombaQty` pra refletir a quantidade do Simulador.
  vars.trocadorBombaQty = Number(e.trocadorBombaQty) || 1;
  // v1.13.57 (Chunk C): DN (mm) do tubo dimensionado no Simulador (card "Tubulacao — perda de
  // carga"). Habilita auto-select do tubo do orcamento: where='tuboEntradaMm >= solarPipeDnMm'
  // (solar) / 'tuboEntradaMm >= trocadorPipeDnMm' (bomba de calor). 0 quando ainda nao dimensionou.
  vars.solarPipeDnMm = Number(e.solarPipe?.result?.diametroDnMm) || 0;
  vars.trocadorPipeDnMm = Number(e.trocadorPipe?.result?.diametroDnMm) || 0;
  return vars;
}

// Le calorNecessarioKcalH do heatingReport cacheado (resultado do Simulador de Aquecimento).
// Permite que regras de auto-select de Bomba de Calor referenciem essa variavel:
//   where: 'kcalHNominal >= calorNecessarioKcalH'
//   indicator.expr: '(kcalHNominal - calorNecessarioKcalH) / calorNecessarioKcalH * 100'
export function extractHeatingVars(heatingReport: any): FormulaVars {
  if (!heatingReport || typeof heatingReport !== 'object') return {};
  const r = heatingReport as Record<string, any>;
  const vars: FormulaVars = {};
  if (typeof r.calorNecessarioKcalH === 'number') vars.calorNecessarioKcalH = r.calorNecessarioKcalH;
  // v1.11.95: bombaCalorQty = quantity do equipamento selecionado no Simulador. Linhas
  // com formula="bombaCalorQty" se atualizam automaticamente quando user muda Quant
  // ou clica "voltar auto" no Simulador.
  const selectedQty = Number(r?.selectedEquipment?.quantity);
  if (Number.isFinite(selectedQty) && selectedQty > 0) {
    vars.bombaCalorQty = selectedQty;
  } else {
    vars.bombaCalorQty = 1; // fallback se ainda nao computou
  }
  return vars;
}

/**
 * Fase 6 (Solar): popula vars do dimensionamento solar a partir do SolarReport.
 *  - solarQty = qtdColetores (output do SolarService.computeSolarReport)
 *  - solarNumBaterias = numBaterias
 *
 * Linha "Coletor Solar" pode usar formulaExpr="solarQty" — atualiza automaticamente
 * quando operador clica "Recalcular dimensionamento" na aba Solar.
 */
export function extractSolarVars(solarReport: any): FormulaVars {
  if (!solarReport || typeof solarReport !== 'object') return {};
  const r = solarReport as Record<string, any>;
  const vars: FormulaVars = {};
  const qtd = Number(r.qtdColetores);
  if (Number.isFinite(qtd) && qtd > 0) {
    vars.solarQty = qtd;
  } else {
    vars.solarQty = 0;
  }
  const nbat = Number(r.numBaterias);
  if (Number.isFinite(nbat) && nbat >= 0) {
    vars.solarNumBaterias = nbat;
  }
  // v1.12.40: vazao calculada pelo Simulador Solar (soma dos coletores).
  // Habilita regra de auto-select "Bomba do Coletor Solar":
  //   where='vazaoM3h >= vazaoSolarM3h && pressaoTrabalhoMca >= alturaTelhadoMca'
  const vazaoTotal = Number(r.vazaoTotalM3h);
  if (Number.isFinite(vazaoTotal) && vazaoTotal > 0) {
    vars.vazaoSolarM3h = vazaoTotal;
  }
  // v1.13.55: N em paralelo da bomba de recirculacao SOLAR (default 1). Linha da recirc
  // solar usa formula `solarBombaQty` pra refletir a quantidade do Simulador.
  vars.solarBombaQty = Number(r.selectedBombaQty) || 1;
  return vars;
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
    cantos: typeof d.cantos === 'number' ? d.cantos : undefined,
    perimExterno: typeof d.perimetroExternoBorda === 'number' ? d.perimetroExternoBorda : undefined,
    perimInterno: typeof d.perimetroParedesInternas === 'number' ? d.perimetroParedesInternas : undefined,
    areaParedeEFundo: typeof d.areaParedeEFundo === 'number' ? d.areaParedeEFundo : undefined,
    radierM2: typeof d.radierM2 === 'number' ? d.radierM2 : undefined,
    radierEspessura: typeof d.radierEspessura === 'number' ? d.radierEspessura : undefined,
    radierM3: typeof d.radierM3 === 'number'
      ? d.radierM3
      : (typeof d.radierM2 === 'number' && typeof d.radierEspessura === 'number'
          ? d.radierM2 * d.radierEspessura
          : undefined),
    escavacao: typeof d.escavacaoM3 === 'number' ? d.escavacaoM3 : undefined,
  };

  // Se tem sections[], agrega area/volume e usa primeira pra dimensoes
  if (Array.isArray(d.sections) && d.sections.length > 0) {
    let totalArea = 0;
    let totalVolume = 0;
    d.sections.forEach((s: any, idx: number) => {
      let area = 0;
      if (typeof s.area === 'number') area = s.area;
      else if (typeof s.length === 'number' && typeof s.width === 'number') area = s.length * s.width;
      let volume = 0;
      if (typeof s.volume === 'number') volume = s.volume;
      else if (typeof s.length === 'number' && typeof s.width === 'number' && typeof s.depth === 'number') {
        volume = s.length * s.width * s.depth;
      }
      totalArea += area;
      totalVolume += volume;
      // Variaveis individuais por section (areaSec1, areaSec2, ..., volumeSec1, ...)
      direct[`areaSec${idx + 1}`] = area;
      direct[`volumeSec${idx + 1}`] = volume;
    });
    if (totalArea > 0) direct.area = totalArea;
    if (totalVolume > 0) direct.volume = totalVolume;
    const first = d.sections[0];
    if (first && direct.length === undefined && typeof first.length === 'number') direct.length = first.length;
    if (first && direct.width === undefined && typeof first.width === 'number') direct.width = first.width;
    if (first && direct.depth === undefined && typeof first.depth === 'number') direct.depth = first.depth;
  }

  // FASE 2 — soma a agua dos reservatorios da Borda Infinita no volume total da piscina
  // (decisao do usuario: volume total afeta tudo, inclusive formulas de linha que usam
  // `volume`). bordaVolumeExtraM3 e gravado em poolDimensions no salvar (pool-budget.service).
  const bordaExtra = Number(d.bordaVolumeExtraM3);
  if (Number.isFinite(bordaExtra) && bordaExtra > 0) {
    direct.volume = (Number(direct.volume) || 0) + bordaExtra;
  }

  return direct;
}
