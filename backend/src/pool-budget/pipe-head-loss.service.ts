// v1.12.34 — Calculadora de perda de carga em tubulacao (Darcy-Weisbach + Haaland).
// Replica fielmente o metodo da planilha de bombas Solis. Service puro (sem Prisma).
//
// Inputs:
//  - comprimentoM: comprimento da tubulacao horizontal (m)
//  - desnivelM: altura geometrica do telhado (m). 1m geometrico ≈ 1 MCA estatica.
//  - vazaoM3h: vazao de projeto (m³/h)
//  - temperaturaC: temperatura da agua (°C) — afeta densidade e viscosidade
//  - material: PVC | CPVC | PPR | COBRE
//  - diametroMm: diametro nominal externo (DN) em mm
//  - fatorSegurancaPct: fator de seguranca em % aplicado sobre o comprimento (default 20)
//  - joelho90Qty, teQty, registroQty, valvulaQty: contagem das conexoes
//
// Outputs:
//  - alturaManometricaTotal: perda dinamica + desnivel (MCA)
//  - perdaDinamica: perda na tubulacao por atrito (MCA)
//  - velocidade: velocidade do fluido (m/s) — alerta se >2,5
//  - reynolds: numero de Reynolds (-)
//  - atritoF: fator de atrito (Haaland)
//  - comprimentoEquivalente: L + L_conexoes + fator seguranca (m)
//  - aviso?: mensagem de alerta (ex: velocidade alta)

import { Injectable } from '@nestjs/common';

export type PipeMaterial = 'PVC' | 'CPVC' | 'PPR' | 'COBRE';

export interface PipeHeadLossInputs {
  comprimentoM: number;
  desnivelM: number;
  vazaoM3h: number;
  temperaturaC?: number;
  material: PipeMaterial;
  diametroMm: number;
  fatorSegurancaPct?: number;
  joelho90Qty?: number;
  teQty?: number;
  registroQty?: number;
  valvulaQty?: number;
  // v1.12.85: perda interna nos coletores em serie. Atraves de N coletores
  // ligados em SERIE (dentro de cada bateria + B baterias em serie), a agua
  // perde carga. Cada coletor tem ~0.15-0.30 mca a vazao nominal (datasheet
  // do fabricante). Solis usa ~0.20 mca/coletor como referencia.
  coletoresPorBateria?: number;     // N coletores em serie dentro da bateria
  batPorRamo?: number;              // B baterias em serie (paralelas nao somam)
  perdaPorColetorMca?: number;      // default 0.20 (mca por coletor a vazao nominal)
  // v1.12.94: perda de carga interna generica de um equipamento em serie na
  // tubulacao (ex: trocador de calor, ~1-3 mca a vazao nominal). Aditiva direto
  // na altura manometrica, igual as baterias do solar. Solar nao passa -> 0.
  perdaInternaExtraMca?: number;
  // CIRCUITO FECHADO (bomba de calor): a coluna de agua que SOBE eh equilibrada pela
  // que DESCE no retorno (sifao) — a carga estatica do desnivel se cancela e a bomba so
  // vence o ATRITO. Diferente do solar (circuito aberto com valvula ventosa, onde o
  // desnivel conta como carga estatica). Quando true, o desnivel NAO soma na altura
  // manometrica (mas ainda conta como atrito do tubo vertical em comprimento + 2×desnivel).
  closedLoop?: boolean;
}

export interface PipeHeadLossResult {
  alturaManometricaTotal: number; // MCA (perdaDinamica + perdaBaterias + desnivel)
  perdaDinamica: number; // MCA (atrito na tubulacao externa)
  perdaBateriasMca: number; // MCA (perda interna nos coletores em serie)
  perdaInternaExtraMca: number; // MCA (perda interna de equipamento em serie, ex: trocador)
  velocidade: number; // m/s
  reynolds: number;
  atritoF: number;
  comprimentoEquivalente: number; // m
  diametroDnMm: number; // mm (DN externo informado)
  diametroInternoMm: number; // mm (DI da tabela do material)
  material: PipeMaterial;
  aviso: string | null;
}

// Rugosidade absoluta por material (mm) — tabela "Dados Tubulacao" da Solis.
const ROUGHNESS_MM: Record<PipeMaterial, number> = {
  PVC: 0.015,
  CPVC: 0.007,
  PPR: 0.007,
  COBRE: 0.015,
};

// Diametro interno (DI) por material e DN externo. Coluna 2 = DN externo, coluna 3 = DI.
// Replicado da aba "Dados Tubulacao" da Solis (R3-R11).
const DIAMETER_TABLE: Record<PipeMaterial, Array<{ dnMm: number; diMm: number }>> = {
  PVC: [
    { dnMm: 20, diMm: 17 }, { dnMm: 25, diMm: 21.6 }, { dnMm: 32, diMm: 27.8 },
    { dnMm: 40, diMm: 35.2 }, { dnMm: 50, diMm: 44 }, { dnMm: 60, diMm: 53.4 },
    { dnMm: 75, diMm: 66.6 }, { dnMm: 85, diMm: 75.6 }, { dnMm: 110, diMm: 97.8 },
  ],
  CPVC: [
    { dnMm: 15, diMm: 11.8 }, { dnMm: 22, diMm: 18 }, { dnMm: 28, diMm: 23 },
    { dnMm: 35, diMm: 28.6 }, { dnMm: 42, diMm: 34.4 }, { dnMm: 54, diMm: 44.2 },
    { dnMm: 73, diMm: 60 }, { dnMm: 89, diMm: 73.2 }, { dnMm: 114, diMm: 93.6 },
  ],
  PPR: [
    { dnMm: 20, diMm: 13.2 }, { dnMm: 25, diMm: 16.6 }, { dnMm: 32, diMm: 21.2 },
    { dnMm: 40, diMm: 26.6 }, { dnMm: 50, diMm: 33.2 }, { dnMm: 63, diMm: 42 },
    { dnMm: 75, diMm: 50 }, { dnMm: 90, diMm: 60 }, { dnMm: 110, diMm: 73.4 },
  ],
  COBRE: [
    { dnMm: 15, diMm: 14 }, { dnMm: 22, diMm: 20.8 }, { dnMm: 28, diMm: 26.8 },
    { dnMm: 35, diMm: 33.6 }, { dnMm: 42, diMm: 40.4 }, { dnMm: 54, diMm: 52.2 },
    { dnMm: 66, diMm: 64 }, { dnMm: 79, diMm: 76.6 }, { dnMm: 104, diMm: 101.6 },
  ],
};

// Comprimentos equivalentes (m) por conexao e DN externo (mm).
// Tabela "Perda de Carga" A50:H58 da Solis. Mesma referencia DN externo do PVC.
const FITTING_LENGTHS: Array<{ dnMm: number; joelho90: number; te: number; valvulaRet: number; registro: number }> = [
  { dnMm: 20, joelho90: 1.2, te: 0.8, valvulaRet: 2.7, registro: 0.2 },
  { dnMm: 25, joelho90: 1.5, te: 0.9, valvulaRet: 3.8, registro: 0.3 },
  { dnMm: 32, joelho90: 2.0, te: 1.5, valvulaRet: 4.9, registro: 0.4 },
  { dnMm: 40, joelho90: 3.2, te: 2.2, valvulaRet: 6.8, registro: 0.7 },
  { dnMm: 50, joelho90: 3.4, te: 2.3, valvulaRet: 7.1, registro: 0.8 },
  { dnMm: 60, joelho90: 3.7, te: 2.4, valvulaRet: 8.2, registro: 0.9 },
  { dnMm: 75, joelho90: 3.9, te: 2.5, valvulaRet: 9.3, registro: 0.9 },
  { dnMm: 85, joelho90: 4.3, te: 2.6, valvulaRet: 10.4, registro: 1.0 },
  { dnMm: 110, joelho90: 4.9, te: 3.3, valvulaRet: 12.5, registro: 1.1 },
];

// Propriedades da agua por temperatura (lookup table — Perda de Carga H2:J22 da Solis).
// densidade (kg/m³), viscosidade (Ns/m²)
const WATER_PROPS: Array<{ tempC: number; densidadeKgM3: number; viscosidadeNsM2: number }> = [
  { tempC: 0, densidadeKgM3: 1000, viscosidadeNsM2: 1.75e-3 },
  { tempC: 5, densidadeKgM3: 1000, viscosidadeNsM2: 1.52e-3 },
  { tempC: 10, densidadeKgM3: 1000, viscosidadeNsM2: 1.30e-3 },
  { tempC: 15, densidadeKgM3: 1000, viscosidadeNsM2: 1.15e-3 },
  { tempC: 20, densidadeKgM3: 998, viscosidadeNsM2: 1.02e-3 },
  { tempC: 25, densidadeKgM3: 997, viscosidadeNsM2: 8.91e-4 },
  { tempC: 30, densidadeKgM3: 996, viscosidadeNsM2: 8.0e-4 },
  { tempC: 35, densidadeKgM3: 994, viscosidadeNsM2: 7.18e-4 },
  { tempC: 40, densidadeKgM3: 992, viscosidadeNsM2: 6.51e-4 },
  { tempC: 45, densidadeKgM3: 990, viscosidadeNsM2: 5.94e-4 },
  { tempC: 50, densidadeKgM3: 988, viscosidadeNsM2: 5.41e-4 },
];

function nearestByTemp(tempC: number): typeof WATER_PROPS[number] {
  // Acha a entrada mais proxima da temperatura informada.
  return WATER_PROPS.reduce((best, cur) =>
    Math.abs(cur.tempC - tempC) < Math.abs(best.tempC - tempC) ? cur : best,
  WATER_PROPS[0]);
}

function diametroInternoFor(material: PipeMaterial, dnMm: number): number {
  const table = DIAMETER_TABLE[material];
  // Exact match
  const exact = table.find((r) => r.dnMm === dnMm);
  if (exact) return exact.diMm;
  // Nearest fallback — se nao bate exato, pega o DN mais proximo
  const nearest = table.reduce((best, cur) =>
    Math.abs(cur.dnMm - dnMm) < Math.abs(best.dnMm - dnMm) ? cur : best,
  table[0]);
  return nearest.diMm;
}

function fittingLengthFor(dnMm: number): typeof FITTING_LENGTHS[number] {
  const exact = FITTING_LENGTHS.find((r) => r.dnMm === dnMm);
  if (exact) return exact;
  // Nearest fallback
  return FITTING_LENGTHS.reduce((best, cur) =>
    Math.abs(cur.dnMm - dnMm) < Math.abs(best.dnMm - dnMm) ? cur : best,
  FITTING_LENGTHS[0]);
}

// v1.12.35: limite de velocidade da Solis. >=2.5 m/s ja eh acima do recomendado
// (ruido + cavitacao + perda excessiva). Estritamente menor que 2.5 passa.
const VELOCIDADE_MAX_MS = 2.5;

@Injectable()
export class PipeHeadLossService {
  /**
   * v1.12.35: escolhe o MENOR diametro da lista que mantem velocidade <= 2,5 m/s.
   * Se nenhum atende (vazao muito alta), retorna o maior + aviso de subdimensionamento.
   */
  pickOptimalDiameter(material: PipeMaterial, vazaoM3h: number, availableDiametersMm: number[]): {
    diametroMm: number;
    velocidade: number;
    suficiente: boolean;
  } {
    const sorted = [...availableDiametersMm].sort((a, b) => a - b);
    if (sorted.length === 0 || vazaoM3h <= 0) {
      return { diametroMm: sorted[0] ?? 50, velocidade: 0, suficiente: false };
    }
    const vazaoM3s = vazaoM3h / 3600;
    for (const dnMm of sorted) {
      const diMm = diametroInternoFor(material, dnMm);
      const diM = diMm / 1000;
      const areaM2 = (Math.PI * Math.pow(diM, 2)) / 4;
      const velocidade = vazaoM3s / areaM2;
      if (velocidade < VELOCIDADE_MAX_MS) {
        return { diametroMm: dnMm, velocidade, suficiente: true };
      }
    }
    // Nenhum atende — usa o maior disponivel e marca como subdimensionado
    const maiorDn = sorted[sorted.length - 1];
    const maiorDi = diametroInternoFor(material, maiorDn) / 1000;
    const maiorArea = (Math.PI * Math.pow(maiorDi, 2)) / 4;
    return { diametroMm: maiorDn, velocidade: vazaoM3s / maiorArea, suficiente: false };
  }

  /**
   * Calcula a perda de carga total numa tubulacao (Darcy-Weisbach + Haaland).
   * Replica o metodo da planilha Solis. Service puro, sem efeitos colaterais.
   */
  compute(inputs: PipeHeadLossInputs): PipeHeadLossResult {
    const tempC = inputs.temperaturaC ?? 25;
    const fator = (inputs.fatorSegurancaPct ?? 20) / 100;
    const joelhos = inputs.joelho90Qty ?? 0;
    const tes = inputs.teQty ?? 0;
    const registros = inputs.registroQty ?? 0;
    const valvulas = inputs.valvulaQty ?? 0;

    const dnMm = inputs.diametroMm;
    const diMm = diametroInternoFor(inputs.material, dnMm);
    const diM = diMm / 1000; // metros
    const fittings = fittingLengthFor(dnMm);
    const props = nearestByTemp(tempC);

    // Comprimento total equivalente (Solis GUI!D13):
    //   (comprimento + 2*desnivel) * (1 + fator) + (joelho*L_eq_joelho + te*L_eq_te + ...)
    // O 2*desnivel adiciona a tubulacao vertical (sobe e desce).
    const compHorizontalEVertical = inputs.comprimentoM + 2 * inputs.desnivelM;
    const compComSeguranca = compHorizontalEVertical * (1 + fator);
    const compConexoes =
      joelhos * fittings.joelho90 +
      tes * fittings.te +
      registros * fittings.registro +
      valvulas * fittings.valvulaRet;
    const comprimentoEquivalente = compComSeguranca + compConexoes;

    // Area da secao (m²) e velocidade (m/s)
    const areaM2 = (Math.PI * Math.pow(diM, 2)) / 4;
    const vazaoM3s = inputs.vazaoM3h / 3600;
    const velocidade = vazaoM3s / areaM2;

    // Reynolds (-)
    const reynolds = (props.densidadeKgM3 * velocidade * diM) / props.viscosidadeNsM2;

    // Atrito de Darcy via aproximacao de Haaland (mais estavel que Colebrook iterativa):
    //   1/sqrt(f) = -1.8 * log10((6.9/Re) + (eps/(3.7*D))^1.11)
    //   f = (1 / x)^2 onde x = -1.8 * log10(...)
    const rugosidadeMm = ROUGHNESS_MM[inputs.material];
    const ratio = rugosidadeMm / (dnMm * 3.7); // usa DN externo conforme Solis (B9/(B2*3.7))
    const term = (6.9 / reynolds) + Math.pow(ratio, 1.11);
    const xLog = -1.8 * Math.log10(term);
    const atritoF = 1 / Math.pow(xLog, 2);

    // Perda dinamica (Darcy-Weisbach): h = f * (L/D) * (v²/2g)
    const g = 9.8;
    const perdaDinamica = atritoF * (comprimentoEquivalente / diM) * (Math.pow(velocidade, 2) / (2 * g));

    // v1.12.85: perda interna nos coletores em serie. Total de coletores num
    // ramo serie = coletoresPorBateria × batPorRamo. Cada coletor tem perda
    // ~0.20 mca a vazao nominal. Baterias em PARALELO nao somam (vazao se
    // divide, mas perda por ramo eh a mesma).
    const coletPorBat = inputs.coletoresPorBateria ?? 0;
    const batSerie = inputs.batPorRamo ?? 0;
    const perdaUnitaria = inputs.perdaPorColetorMca ?? 0.20;
    const perdaBateriasMca = coletPorBat * batSerie * perdaUnitaria;

    // v1.12.94: perda interna de equipamento em serie (ex: trocador de calor).
    // Aditiva direto na altura manometrica. Solar nao passa -> 0.
    const perdaInternaExtra = inputs.perdaInternaExtraMca ?? 0;

    // Altura manometrica total = perda dinamica + perda baterias + perda interna extra + desnivel geometrico.
    // CIRCUITO FECHADO (bomba de calor): o desnivel NAO soma (a subida eh equilibrada pela descida
    // no retorno — sifao); a bomba so vence o atrito. Circuito aberto (solar): desnivel = carga estatica.
    const cargaEstaticaDesnivel = inputs.closedLoop ? 0 : inputs.desnivelM;
    const alturaManometricaTotal = perdaDinamica + perdaBateriasMca + perdaInternaExtra + cargaEstaticaDesnivel;

    // Aviso de velocidade alta (Solis alerta >=2.5 m/s)
    let aviso: string | null = null;
    if (velocidade >= VELOCIDADE_MAX_MS) {
      aviso = `Velocidade ${velocidade.toFixed(2)} m/s atingiu/passou o limite de 2,5 m/s — aumente o diametro do tubo pra reduzir perda e ruido.`;
    }

    return {
      alturaManometricaTotal: Number(alturaManometricaTotal.toFixed(3)),
      perdaDinamica: Number(perdaDinamica.toFixed(3)),
      perdaBateriasMca: Number(perdaBateriasMca.toFixed(3)),
      perdaInternaExtraMca: Number(perdaInternaExtra.toFixed(3)),
      velocidade: Number(velocidade.toFixed(3)),
      reynolds: Math.round(reynolds),
      atritoF: Number(atritoF.toFixed(5)),
      comprimentoEquivalente: Number(comprimentoEquivalente.toFixed(2)),
      diametroDnMm: dnMm,
      diametroInternoMm: diMm,
      material: inputs.material,
      aviso,
    };
  }
}
