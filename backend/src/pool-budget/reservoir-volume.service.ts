// v1.13.x — Volume do reservatorio de compensacao (tanque de transbordo / cisterna master)
// de uma piscina de borda infinita, e ALERTA de volume correto.
//
// Por que importa: a piscina + reservatorio sao vasos comunicantes. Quando a bomba PARA,
// a agua acima do nivel estatico (lamina em operacao + calha + deslocamento de banhistas)
// escoa por gravidade pro reservatorio — o "surge". Quando a bomba LIGA (e ela puxa DIRETO
// do master), ela esvazia o reservatorio enchendo a piscina ate transbordar. O master
// dimensiona pra: (a) ABSORVER o surge sem transbordar pro esgoto; (b) NAO SECAR (evitar
// a bomba puxar ar = cavitacao) rodando no maximo + maximo de banhistas.
//
// Estudo de engenharia completo: memory/study_borda_infinita_reservatorio.md
//
// Metodos (convergem pra ~5-10% do volume da piscina):
//  - Surge/drawback (o mais fisico): V = area_espelho × h, com h ≈ 5-10 cm (consenso ~10 cm).
//  - Deslocamento de banhistas: + N_banhistas × ~0,075 m³ (≈ 75 L/banhista).
//  - Regra PT por borda: ~450 L por metro linear de borda (cross-check).
//
// Inputs (computeMasterVolume):
//  - poolAreaM2: area do espelho d'agua (m²)
//  - poolVolumeM3?: volume da piscina (m³) — pra cross-check do % (5-10%)
//  - bordaTotalLengthM?: soma dos comprimentos de borda/lamina (m) — regra 450 L/m
//  - nBathers?: nº de banhistas (opcional)
//  - drawbackHeightM?: queda de nivel quando a bomba para (default 0,10 m)
//  - actualVolumeM3?: volume do master que o operador informou (comp×larg×prof)
//
// Outputs: volume recomendado, minimo absoluto, % do volume da piscina, e status/aviso
//  comparando o volume informado (BAIXO = risco cavitacao/transbordo; ALTO = superdimensionado).

import { Injectable } from '@nestjs/common';

export interface MasterVolumeInputs {
  poolAreaM2: number;
  poolVolumeM3?: number;
  bordaTotalLengthM?: number;
  nBathers?: number;
  drawbackHeightM?: number;
  actualVolumeM3?: number;
}

export type MasterVolumeStatus = 'OK' | 'BAIXO' | 'ALTO' | 'SEM_DADO';

export interface MasterVolumeResult {
  vSurgeM3: number; // area × drawback (queda de nivel quando bomba para)
  vBathersM3: number; // banhistas × 0,075
  vPerMeterM3: number; // borda × 0,45 (450 L/m) — cross-check
  recomendadoM3: number; // max(surge + banhistas, perMeter)
  minimoM3: number; // area × 0,05 (piso absoluto pra nao transbordar pro esgoto)
  pctDoVolumePiscina: number | null; // recomendado / volume piscina × 100
  actualM3: number | null;
  status: MasterVolumeStatus;
  aviso: string | null;
}

// ============ CONSTANTES (estudo memory/study_borda_infinita_reservatorio.md) ============

export const RESERVOIR_VOLUME = {
  // Queda de nivel da piscina quando a bomba para (surge). Consenso pratico ~10 cm.
  DRAWBACK_HEIGHT_DEFAULT_M: 0.10,
  // Piso absoluto: abaixo disso o surge transborda pro esgoto / bomba seca. ~5 cm.
  DRAWBACK_MIN_M: 0.05,
  // Deslocamento por banhista (~75 L). N_banhistas ~ 1 a cada 2-3 m².
  BATHER_DISPLACEMENT_M3: 0.075,
  // Regra PT: 450 L por metro linear de borda infinita.
  PER_METER_M3: 0.45,
  // Banda de referencia: reservatorio costuma ser 5-10% do volume da piscina.
  POOL_FRACTION_MIN: 0.05,
  POOL_FRACTION_MAX: 0.10,
  // Acima de N× o recomendado = superdimensionado (custo + massa termica extra pra aquecer).
  OVERSIZE_FACTOR: 3,
};

@Injectable()
export class ReservoirVolumeService {
  /**
   * Volume recomendado do master + alerta comparando com o volume informado.
   * A bomba do filtro puxa DIRETO do master -> volume baixo = cavitacao/transbordo.
   */
  computeMasterVolume(inputs: MasterVolumeInputs): MasterVolumeResult {
    const area = Math.max(inputs.poolAreaM2 ?? 0, 0);
    const drawback = inputs.drawbackHeightM ?? RESERVOIR_VOLUME.DRAWBACK_HEIGHT_DEFAULT_M;
    const bordaLen = Math.max(inputs.bordaTotalLengthM ?? 0, 0);
    const nBathers = Math.max(inputs.nBathers ?? 0, 0);
    const poolVol = inputs.poolVolumeM3 && inputs.poolVolumeM3 > 0 ? inputs.poolVolumeM3 : null;

    const vSurge = area * drawback;
    const vBathers = nBathers * RESERVOIR_VOLUME.BATHER_DISPLACEMENT_M3;
    const vPerMeter = bordaLen * RESERVOIR_VOLUME.PER_METER_M3;

    const recomendado = Math.max(vSurge + vBathers, vPerMeter);
    const minimo = area * RESERVOIR_VOLUME.DRAWBACK_MIN_M;
    const pctDoVolumePiscina = poolVol ? (recomendado / poolVol) * 100 : null;

    const actual = inputs.actualVolumeM3 && inputs.actualVolumeM3 > 0 ? inputs.actualVolumeM3 : null;

    let status: MasterVolumeStatus = 'SEM_DADO';
    let aviso: string | null = null;

    if (actual == null) {
      status = 'SEM_DADO';
      aviso = recomendado > 0
        ? `Volume do reservatorio nao informado — recomendado ~${recomendado.toFixed(2)} m³ (${(recomendado * 1000).toFixed(0)} L). A bomba puxa direto do master; dimensione o tanque por aqui.`
        : null;
    } else if (actual < minimo) {
      status = 'BAIXO';
      aviso = `Volume ${actual.toFixed(2)} m³ ABAIXO DO MINIMO (${minimo.toFixed(2)} m³). Risco: a bomba puxa direto do master e vai puxar ar/secar (cavitacao), ou o surge transborda pro esgoto quando a bomba para. Recomendado ~${recomendado.toFixed(2)} m³.`;
    } else if (actual < recomendado) {
      status = 'BAIXO';
      aviso = `Volume ${actual.toFixed(2)} m³ abaixo do recomendado (~${recomendado.toFixed(2)} m³ / ${(recomendado * 1000).toFixed(0)} L). Acima do minimo, mas sem margem pra banhistas/uso intenso — a bomba puxa direto, entao deixe folga.`;
    } else if (actual > recomendado * RESERVOIR_VOLUME.OVERSIZE_FACTOR) {
      status = 'ALTO';
      aviso = `Volume ${actual.toFixed(2)} m³ muito acima do recomendado (~${recomendado.toFixed(2)} m³) — superdimensionado (custo e massa termica extra pra aquecer). Confira.`;
    } else {
      status = 'OK';
      aviso = null;
    }

    return {
      vSurgeM3: Number(vSurge.toFixed(3)),
      vBathersM3: Number(vBathers.toFixed(3)),
      vPerMeterM3: Number(vPerMeter.toFixed(3)),
      recomendadoM3: Number(recomendado.toFixed(3)),
      minimoM3: Number(minimo.toFixed(3)),
      pctDoVolumePiscina: pctDoVolumePiscina == null ? null : Number(pctDoVolumePiscina.toFixed(1)),
      actualM3: actual == null ? null : Number(actual.toFixed(3)),
      status,
      aviso,
    };
  }

  /**
   * Volume estimado de um reservatorio/calha (auto), quando o operador nao tem as dimensoes:
   * area da superficie do reservatorio × profundidade tipica (0,10 m). Helper pra preencher
   * o "auto" da captacao tipo reservatorio. Para o master use computeMasterVolume.
   */
  estimateReservoirVolume(reservoirAreaM2: number, depthM = RESERVOIR_VOLUME.DRAWBACK_HEIGHT_DEFAULT_M): number {
    return Number((Math.max(reservoirAreaM2, 0) * Math.max(depthM, 0)).toFixed(3));
  }
}
