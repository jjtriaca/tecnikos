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
}

export interface BordaInfinitaReport {
  lines: BordaLineResult[];
  totals: BordaInfinitaTotals;
  master: MasterVolumeResult | null;
  avisos: string[];
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
    if (line.masterCisternaPronta) return null; // cisterna pronta -> sem dims, so recomenda o volume (compra-se >= recomendado)
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

    const lineResults: BordaLineResult[] = [];
    const avisos: string[] = [];

    let bordaTotalLengthM = 0;
    let vazaoTransbordoTotalM3h = 0;
    let volumeReservatoriosM3 = 0;
    let areaEvaporacaoM2 = 0;

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

      bordaTotalLengthM += bordaLen;
      vazaoTransbordoTotalM3h += transbordoM3h;

      // Area da lamina caindo (evaporacao — FASE 2 aplica o FILME_FACTOR).
      const filmeAreaM2 = Number((bordaLen * altura).toFixed(2));
      areaEvaporacaoM2 += filmeAreaM2;

      let reservatorioVolumeM3 = 0;
      let evaporaSuperficieM2 = 0;
      let tubo: GravityPipeResult | null = null;
      let lineAviso: string | null = null;

      if (captacao === 'RESERVATORIO') {
        reservatorioVolumeM3 = this.reservoirVolume(line);
        volumeReservatoriosM3 += reservatorioVolumeM3;
        if (line.reservAberto && line.reservComprM && line.reservLargM) {
          evaporaSuperficieM2 = Number((line.reservComprM * line.reservLargM).toFixed(2));
          areaEvaporacaoM2 += evaporaSuperficieM2;
        }
        tubo = this.gravity.sizeGravityPipe({
          vazaoTransbordoM3h: transbordoM3h,
          desnivelM: line.tuboDesnivelM,
          comprimentoTuboM: line.tuboComprimentoM,
          curvas90Qty: line.curvas90Qty,
          fillTargetRatio: fillTarget,
          manningN,
        });
      } else if (captacao === 'CANALETA') {
        if (line.canaletaAberta && line.canaletaComprM) {
          evaporaSuperficieM2 = Number(
            (line.canaletaComprM * BORDA_TRANSBORDO.CANALETA_WIDTH_DEFAULT_M).toFixed(2),
          );
          areaEvaporacaoM2 += evaporaSuperficieM2;
        }
        tubo = this.gravity.sizeGravityPipe({
          vazaoTransbordoM3h: transbordoM3h,
          desnivelM: line.tuboDesnivelM,
          comprimentoTuboM: line.tuboComprimentoM,
          curvas90Qty: line.curvas90Qty,
          fillTargetRatio: fillTarget,
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
    const masterVolumeM3 = masterActual ?? master.recomendadoM3;
    // Superficie do master que evapora (se aberto).
    if (masterLine?.masterAberto && masterLine.masterComprM && masterLine.masterLargM) {
      areaEvaporacaoM2 += Number((masterLine.masterComprM * masterLine.masterLargM).toFixed(2));
    }

    if (masterLine) {
      const masterIdx = lines.indexOf(masterLine);
      lineResults.push({ index: masterIdx, tipo: 'MASTER', masterVolume: master, aviso: master.aviso });
    } else {
      avisos.push('Nenhuma linha MASTER definida — adicione a cisterna principal (a bomba puxa dela).');
    }

    const volumeTermicoExtraM3 = Number((volumeReservatoriosM3 + masterVolumeM3).toFixed(3));

    const totals: BordaInfinitaTotals = {
      bordaTotalLengthM: Number(bordaTotalLengthM.toFixed(2)),
      vazaoTransbordoTotalM3h: Number(vazaoTransbordoTotalM3h.toFixed(2)),
      vazaoBombaSugeridaM3h: Number(vazaoTransbordoTotalM3h.toFixed(2)),
      volumeTermicoExtraM3,
      areaEvaporacaoExtraM2: Number(areaEvaporacaoM2.toFixed(2)),
    };

    // Ordena pra refletir a ordem das linhas no input.
    lineResults.sort((a, b) => a.index - b.index);

    return { lines: lineResults, totals, master: masterLine ? master : null, avisos };
  }
}
