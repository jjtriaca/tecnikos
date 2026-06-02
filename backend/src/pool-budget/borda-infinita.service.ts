// v1.13.x — Orquestrador do Sistema de Borda Infinita (multi-linha).
//
// Recebe as linhas (MASTER + SLAVEs) + contexto da piscina e devolve, por linha:
//  - vazao de transbordo da lamina, DN do tubo de gravidade (Manning), volume do reservatorio;
// e os TOTAIS do sistema:
//  - vazao de transbordo/bomba total, volume termico extra (Σ reservatorios + master),
//    area de evaporacao extra (laminas + superficies abertas) -> alimentam a FASE 2 (aquecimento).
// + o ALERTA de volume do master (a bomba do filtro puxa direto dele).
//
// Compoe GravityFlowService (tubo, Manning) + ReservoirVolumeService (volume/alerta).
// Estudos: memory/study_borda_infinita_tubulacao_gravidade.md + study_borda_infinita_reservatorio.md.
//
// Captacao do slave (3 modos):
//  - RESERVATORIO: calha/mini-reservatorio com volume -> tubo de gravidade -> master.
//  - CANALETA: canaleta com ralos (sem volume) -> tubo coletor -> master.
//  - DIRETO: borda derrama DIRETO no master (sem intermediario, sem tubo).

import { Injectable } from '@nestjs/common';
import { GravityFlowService, GravityPipeResult } from './gravity-flow.service';
import { ReservoirVolumeService, MasterVolumeResult } from './reservoir-volume.service';
import { BordaInfinitaSimulateDto, BordaLineDto } from './dto/borda-infinita-simulate.dto';

// ============ CONSTANTES (estudos da borda infinita) ============

export const BORDA_TRANSBORDO = {
  // Espessura de filme default (3-7mm pro efeito visual; 6mm = referencia da tabela).
  FILME_DEFAULT_MM: 6,
  // Vazao de transbordo a 6mm de filme: 2,593 m³/h por metro linear (estudo / S. Tarzia).
  FLOW_AT_6MM_M3H_PER_M: 2.593,
  // Escoamento sobre vertedor: Q ~ filme^1.5. Escala a vazao pra outras espessuras.
  WEIR_EXP: 1.5,
  // Largura tipica da canaleta (pra area de evaporacao quando aberta), quando nao informada.
  CANALETA_WIDTH_DEFAULT_M: 0.15,
  // Fator de surge: a drenagem (ralos+tubo) eh dimensionada pro PICO de ondas/banhistas (crianças),
  // nao so o filme estavel. Norma: tubo da calha >= 125% da recirculacao. Uso intenso -> 2 a 4x.
  // O VOLUME do surge eh absorvido pelo reservatorio master (ver reservoir-volume.service).
  SURGE_FACTOR_DEFAULT: 2.0,
};

// Capacidade de UM ralo (grelha) — escoa MENOS que a boca aberta de um tubo de mesmo
// diametro: a grelha funciona como VERTEDOR (lamina baixa) ou ORIFICIO (lamina alta), com
// area livre parcial (barras) + entupimento. Regra de drenagem: area livre da grelha deve
// ser 1,5-2x a area do tubo. Q_ralo = min(vertedor, orificio) × fator_entupimento.
// Ver memory/study_borda_infinita_tubulacao_gravidade.md (secao Ralos).
export const RALO = {
  ORIFICE_C: 0.67,        // coeficiente de orificio (grate inlet em sag)
  WEIR_C: 1.66,           // coeficiente de vertedor (SI; ~3.0 em unidades US)
  GRATE_FREE_RATIO: 0.5,  // fracao da area do bore que eh realmente aberta (barras da grelha)
  CLOG_FACTOR: 0.8,       // margem de entupimento/detritos
  DEFAULT_HEAD_M: 0.05,   // lamina d'agua tipica sobre o ralo na canaleta (5 cm)
  DEFAULT_DIAM_MM: 100,   // diametro de ralo assumido quando nao informado
};

export interface BordaLineResult {
  index: number;
  tipo: 'MASTER' | 'SLAVE';
  // SLAVE
  captacao?: 'RESERVATORIO' | 'CANALETA' | 'DIRETO';
  transbordoM3h?: number; // vazao da lamina dessa borda
  filmeAreaM2?: number; // area da lamina caindo (comprimento × altura de queda) — evaporacao
  evaporaSuperficieM2?: number; // superficie aberta do reservatorio/canaleta (evapora)
  reservatorioVolumeM3?: number; // volume do mini-reservatorio (modo RESERVATORIO)
  tubo?: GravityPipeResult | null; // dimensionamento do tubo de gravidade (modos RESERVATORIO/CANALETA)
  ralosSugeridos?: number; // nº de ralos sugerido pra canaleta (CANALETA)
  raloCapacidadeM3h?: number; // capacidade de cada ralo (m³/h) — menor que tubo aberto
  drenagemDesignM3h?: number; // vazao de projeto da drenagem = transbordo × surge (dimensiona ralos+tubo)
  tubosQty?: number; // nº de tubos de gravidade em paralelo (cada um leva drenagem ÷ nº)
  // MASTER
  masterVolume?: MasterVolumeResult;
  aviso?: string | null;
}

export interface BordaInfinitaTotals {
  bordaTotalLengthM: number;
  vazaoTransbordoTotalM3h: number;
  vazaoBombaSugeridaM3h: number;
  volumeTermicoExtraM3: number; // Σ reservatorios + master (entra na massa termica da FASE 2)
  areaEvaporacaoExtraM2: number; // Σ laminas + superficies abertas (entra na evaporacao da FASE 2)
  areaFilmeExtraM2: number; // Σ laminas que caem (comp × altura) — sem fator
  areaSuperficieAbertaExtraM2: number; // Σ superficies abertas (reservatorios/canaletas/master destampados)
}

// Resumo pronto pra alimentar o Simulador de Aquecimento (FASE 2). O HeatingService
// reusa o modelo de filme escalar (comprimento × altura × vazao × horas), entao
// agregamos as N bordas em medias PONDERADAS POR COMPRIMENTO (area de filme fica exata:
// total_len × altura_media = Σ len_i × altura_i). As superficies abertas evaporam como
// agua parada (modelo de superficie da piscina, sem capa). O volume entra na massa termica.
export interface BordaHeatingFeed {
  bordaTotalLengthM: number; // Σ comprimento das laminas
  alturaQuedaMediaM: number; // altura de queda media (ponderada por comprimento)
  vazaoMediaLminPorM: number; // vazao media L/min/m (ponderada por comprimento)
  horasAtivaMediaDia: number; // horas/dia media que a borda fica ligada (ponderada)
  areaSuperficieAbertaM2: number; // superficies abertas que evaporam (sem as laminas)
  volumeTermicoExtraM3: number; // Σ reservatorios + master -> soma no volume a aquecer
}

export interface BordaInfinitaReport {
  lines: BordaLineResult[];
  totals: BordaInfinitaTotals;
  master: MasterVolumeResult | null;
  avisos: string[];
  heatingFeed: BordaHeatingFeed;
}

@Injectable()
export class BordaInfinitaService {
  constructor(
    private readonly gravity: GravityFlowService,
    private readonly reservoir: ReservoirVolumeService,
  ) {}

  /** Vazao de transbordo por metro de borda (m³/h/m): direta (L/min/m) ou derivada do filme. */
  private transbordoM3hPerMeter(filmeMm?: number, vazaoLminM?: number): number {
    if (vazaoLminM && vazaoLminM > 0) return (vazaoLminM * 60) / 1000; // L/min/m -> m³/h/m
    const filme = filmeMm && filmeMm > 0 ? filmeMm : BORDA_TRANSBORDO.FILME_DEFAULT_MM;
    return BORDA_TRANSBORDO.FLOW_AT_6MM_M3H_PER_M * Math.pow(filme / 6, BORDA_TRANSBORDO.WEIR_EXP);
  }

  /** Capacidade de UM ralo (m³/h): min(vertedor, orificio) × entupimento. Ver RALO. */
  private raloCapacityM3h(diamMm: number, headM = RALO.DEFAULT_HEAD_M): number {
    const D = Math.max(diamMm, 1) / 1000;
    const h = Math.max(headM, 0.005);
    const g = 9.81;
    const perim = Math.PI * D;
    const areaFree = ((Math.PI * D * D) / 4) * RALO.GRATE_FREE_RATIO;
    const qWeir = RALO.WEIR_C * perim * Math.pow(h, 1.5); // m³/s (vertedor)
    const qOrif = RALO.ORIFICE_C * areaFree * Math.sqrt(2 * g * h); // m³/s (orificio)
    const q = Math.min(qWeir, qOrif) * RALO.CLOG_FACTOR;
    return Number((q * 3600).toFixed(1)); // m³/h
  }

  private reservoirVolume(line: BordaLineDto): number {
    const c = line.reservComprM ?? 0;
    const l = line.reservLargM ?? 0;
    const p = line.reservProfM ?? 0;
    if (c > 0 && l > 0 && p > 0) return Number((c * l * p).toFixed(3));
    // auto: area da calha × profundidade tipica (0,10 m), se tiver comp×larg
    if (c > 0 && l > 0) return this.reservoir.estimateReservoirVolume(c * l);
    return 0;
  }

  private masterActualVolume(line: BordaLineDto): number | null {
    if (line.masterCisternaPronta) {
      // cisterna pronta: usa o volume informado (valida vs recomendado); sem volume -> so recomenda.
      return line.masterCisternaVolumeM3 && line.masterCisternaVolumeM3 > 0 ? line.masterCisternaVolumeM3 : null;
    }
    const c = line.masterComprM ?? 0;
    const l = line.masterLargM ?? 0;
    const p = line.masterProfM ?? 0;
    if (c > 0 && l > 0 && p > 0) return Number((c * l * p).toFixed(3));
    return null;
  }

  compute(dto: BordaInfinitaSimulateDto): BordaInfinitaReport {
    const lines = Array.isArray(dto.lines) ? dto.lines : [];
    const fillTarget = dto.fillTargetRatio;
    const manningN = dto.manningN;
    const surge = Math.max(dto.surgeFactor ?? BORDA_TRANSBORDO.SURGE_FACTOR_DEFAULT, 1);

    const lineResults: BordaLineResult[] = [];
    const avisos: string[] = [];

    let bordaTotalLengthM = 0;
    let vazaoTransbordoTotalM3h = 0;
    let volumeReservatoriosM3 = 0;
    let areaFilmeM2 = 0; // laminas que caem (comp × altura)
    let areaSuperficieAbertaM2 = 0; // superficies abertas (reservatorios/canaletas/master destampados)
    // Acumuladores ponderados por comprimento pra agregar N bordas em escalares (FASE 2).
    let sumLenAlturaM = 0; // Σ comp × altura -> altura media
    let sumLenVazaoLmin = 0; // Σ comp × vazao(L/min/m) -> vazao media
    let sumLenHoras = 0; // Σ comp × horas/dia -> horas media

    // Master line (topologia estrela: um master). Usa o primeiro tipo MASTER.
    const masterLine = lines.find((l) => l.tipo === 'MASTER') ?? null;

    // ----- SLAVES -----
    lines.forEach((line, index) => {
      if (line.tipo !== 'SLAVE') return;

      const captacao = (line.captacao as BordaLineResult['captacao']) ?? 'RESERVATORIO';
      const bordaLen = Math.max(line.bordaLengthM ?? 0, 0);
      const altura = Math.max(line.alturaQuedaM ?? 0, 0);
      const perM = this.transbordoM3hPerMeter(line.filmeMm, line.vazaoLminM);
      const transbordoM3h = Number((perM * bordaLen).toFixed(2));
      const vazaoLminPorM = perM * (1000 / 60); // m³/h/m -> L/min/m (modelo de filme do heating)
      const horasDia = line.horasDia != null && line.horasDia > 0 ? line.horasDia : 24;

      bordaTotalLengthM += bordaLen;
      vazaoTransbordoTotalM3h += transbordoM3h;
      sumLenAlturaM += bordaLen * altura;
      sumLenVazaoLmin += bordaLen * vazaoLminPorM;
      sumLenHoras += bordaLen * horasDia;

      // Area da lamina caindo (evaporacao — FASE 2 aplica o FILME_FACTOR).
      const filmeAreaM2 = Number((bordaLen * altura).toFixed(2));
      areaFilmeM2 += filmeAreaM2;

      let reservatorioVolumeM3 = 0;
      let evaporaSuperficieM2 = 0;
      let tubo: GravityPipeResult | null = null;
      let ralosSugeridos: number | undefined;
      let raloCapacidadeM3h: number | undefined;
      let drenagemDesignM3h: number | undefined;
      let lineAviso: string | null = null;

      // Drenagem (ralos + tubo) dimensionada pro SURGE de ondas/banhistas (crianças) —
      // tem que esvaziar a canaleta rapido pra nao transbordar, nao so o filme estavel.
      const tubos = Math.max(line.tubosQty ?? 1, 1); // pode usar varios tubos em paralelo (diametros menores)
      if (captacao === 'RESERVATORIO' || captacao === 'CANALETA') {
        drenagemDesignM3h = Number((transbordoM3h * surge).toFixed(2));
      }
      if (captacao === 'RESERVATORIO') {
        reservatorioVolumeM3 = this.reservoirVolume(line);
        volumeReservatoriosM3 += reservatorioVolumeM3;
        if (line.reservAberto && line.reservComprM && line.reservLargM) {
          evaporaSuperficieM2 = Number((line.reservComprM * line.reservLargM).toFixed(2));
          areaSuperficieAbertaM2 += evaporaSuperficieM2;
        }
        tubo = this.gravity.sizeGravityPipe({
          vazaoTransbordoM3h: (drenagemDesignM3h ?? transbordoM3h) / tubos,
          desnivelM: line.tuboDesnivelM,
          comprimentoTuboM: line.tuboComprimentoM,
          curvas90Qty: line.curvas90Qty,
          fillTargetRatio: fillTarget,
          fatorSegurancaPct: 0,
          manningN,
        });
      } else if (captacao === 'CANALETA') {
        // Ralos: cada ralo (grelha) escoa MENOS que a boca de um tubo aberto. Sugere a quantidade.
        const raloDiam = line.raloDiamMm && line.raloDiamMm > 0 ? line.raloDiamMm : RALO.DEFAULT_DIAM_MM;
        raloCapacidadeM3h = this.raloCapacityM3h(raloDiam);
        ralosSugeridos = raloCapacidadeM3h > 0 ? Math.max(1, Math.ceil((drenagemDesignM3h ?? transbordoM3h) / raloCapacidadeM3h)) : 1;
        if (line.canaletaAberta && line.canaletaComprM) {
          // Area da canaleta aberta que evapora = comprimento × largura (informada OU default).
          const canalLarg = line.canaletaLargM && line.canaletaLargM > 0 ? line.canaletaLargM : BORDA_TRANSBORDO.CANALETA_WIDTH_DEFAULT_M;
          evaporaSuperficieM2 = Number((line.canaletaComprM * canalLarg).toFixed(2));
          areaSuperficieAbertaM2 += evaporaSuperficieM2;
        }
        tubo = this.gravity.sizeGravityPipe({
          vazaoTransbordoM3h: (drenagemDesignM3h ?? transbordoM3h) / tubos,
          desnivelM: line.tuboDesnivelM,
          comprimentoTuboM: line.tuboComprimentoM,
          curvas90Qty: line.curvas90Qty,
          fillTargetRatio: fillTarget,
          fatorSegurancaPct: 0,
          manningN,
        });
      }
      // captacao === 'DIRETO': sem volume intermediario, sem tubo (cai no master).

      if (tubo?.aviso) lineAviso = tubo.aviso;
      if (lineAviso) avisos.push(`Borda ${index + 1}: ${lineAviso}`);

      lineResults.push({
        index,
        tipo: 'SLAVE',
        captacao,
        transbordoM3h,
        filmeAreaM2,
        evaporaSuperficieM2: evaporaSuperficieM2 || undefined,
        reservatorioVolumeM3: captacao === 'RESERVATORIO' ? reservatorioVolumeM3 : undefined,
        tubo,
        tubosQty: tubo ? tubos : undefined,
        ralosSugeridos,
        raloCapacidadeM3h,
        drenagemDesignM3h,
        aviso: lineAviso,
      });
    });

    // ----- MASTER (volume + alerta) -----
    const masterActual = masterLine ? this.masterActualVolume(masterLine) : null;
    const master = this.reservoir.computeMasterVolume({
      poolAreaM2: dto.poolAreaM2,
      poolVolumeM3: dto.poolVolumeM3,
      bordaTotalLengthM,
      nBathers: dto.nBathers,
      actualVolumeM3: masterActual ?? undefined,
    });
    if (master.aviso) avisos.push(`Reservatorio master: ${master.aviso}`);

    // Volume do master que conta na massa termica: usa o real informado, senao o recomendado.
    // SO conta se existe uma linha MASTER de fato — sem master, nada de volume fantasma
    // (computeMasterVolume sempre "recomenda" um volume a partir da area, mesmo sem borda).
    const masterVolumeM3 = masterLine ? (masterActual ?? master.recomendadoM3) : 0;
    // Superficie do master que evapora (se aberto).
    if (masterLine?.masterAberto && masterLine.masterComprM && masterLine.masterLargM) {
      areaSuperficieAbertaM2 += Number((masterLine.masterComprM * masterLine.masterLargM).toFixed(2));
    }

    if (masterLine) {
      const masterIdx = lines.indexOf(masterLine);
      lineResults.push({ index: masterIdx, tipo: 'MASTER', masterVolume: master, aviso: master.aviso });
    } else {
      avisos.push('Nenhuma linha MASTER definida — adicione a cisterna principal (a bomba puxa dela).');
    }

    const volumeTermicoExtraM3 = Number((volumeReservatoriosM3 + masterVolumeM3).toFixed(3));
    const areaEvaporacaoExtraM2 = Number((areaFilmeM2 + areaSuperficieAbertaM2).toFixed(2));

    const totals: BordaInfinitaTotals = {
      bordaTotalLengthM: Number(bordaTotalLengthM.toFixed(2)),
      vazaoTransbordoTotalM3h: Number(vazaoTransbordoTotalM3h.toFixed(2)),
      vazaoBombaSugeridaM3h: Number(vazaoTransbordoTotalM3h.toFixed(2)),
      volumeTermicoExtraM3,
      areaEvaporacaoExtraM2,
      areaFilmeExtraM2: Number(areaFilmeM2.toFixed(2)),
      areaSuperficieAbertaExtraM2: Number(areaSuperficieAbertaM2.toFixed(2)),
    };

    // Resumo pro Simulador de Aquecimento (FASE 2): medias ponderadas por comprimento
    // (a area de filme fica exata: total_len × altura_media = Σ len_i × altura_i).
    const heatingFeed: BordaHeatingFeed = {
      bordaTotalLengthM: Number(bordaTotalLengthM.toFixed(2)),
      alturaQuedaMediaM: bordaTotalLengthM > 0 ? Number((sumLenAlturaM / bordaTotalLengthM).toFixed(3)) : 0,
      vazaoMediaLminPorM: bordaTotalLengthM > 0 ? Number((sumLenVazaoLmin / bordaTotalLengthM).toFixed(1)) : 0,
      horasAtivaMediaDia: bordaTotalLengthM > 0 ? Number((sumLenHoras / bordaTotalLengthM).toFixed(1)) : 24,
      areaSuperficieAbertaM2: Number(areaSuperficieAbertaM2.toFixed(2)),
      volumeTermicoExtraM3,
    };

    // Ordena pra refletir a ordem das linhas no input.
    lineResults.sort((a, b) => a.index - b.index);

    return { lines: lineResults, totals, master: masterLine ? master : null, avisos, heatingFeed };
  }
}
