// v1.13.x — Calculadora de escoamento POR GRAVIDADE em tubo (Manning, superficie livre).
// Dimensiona o diametro do tubo que leva a agua transbordada da calha/mini-reservatorio
// (ou canaleta com ralos) ate a cisterna MASTER de uma piscina de borda infinita.
//
// FUNDAMENTAL: isto NAO eh o calculo do solar. O solar (PipeHeadLossService) eh tubo
// PRESSURIZADO (Darcy-Weisbach + Haaland, bomba empurrando, tubo cheio). Aqui a agua
// desce sozinha pela inclinacao, com ar em cima = escoamento livre em conduto =
// equacao de MANNING, tubo de proposito PARCIALMENTE cheio.
//
// Estudo de engenharia completo: memory/study_borda_infinita_tubulacao_gravidade.md
//
// Equacao de Manning (SI):  Q = (1/n) · A · R^(2/3) · S^(1/2)
//   n = rugosidade de Manning (PVC ~ 0.010); A = area molhada (m²);
//   R = raio hidraulico = A/P (m); S = caimento (m/m); V = Q/A.
// Tubo circular parcialmente cheio (profundidade h, diametro D, y = h/D):
//   theta = 2·arccos(1 − 2y)              [angulo central, rad]
//   A = (D²/8)·(theta − sin theta)
//   P = (D·theta)/2
//   R = A/P
// Verificacao: y=0.5 -> A = metade da cheia, R = D/4 (igual cheia) -> Q = 0.5·Q_cheio.
//
// Inputs (sizeGravityPipe):
//  - vazaoTransbordoM3h: caudal que desce o tubo (m³/h) — vazao de recirculacao/transbordo
//  - desnivelM: diferenca de altura captacao->master (m). Caimento S = desnivel / L_eff.
//  - comprimentoTuboM: comprimento horizontal do tubo (m)
//  - curvas90Qty: nº de curvas 90°. Cada curva "rouba" caimento (comprimento equivalente).
//  - fatorSegurancaPct: folga sobre a vazao (default 20)
//  - fillTargetRatio: enchimento de projeto, 0..1 (default 0.50; regra de piscina = 0.33)
//  - manningN: rugosidade (default 0.010 PVC)
//  - availableDnsMm: diametros comerciais a testar (default lista PVC esgoto/dreno)
//
// Outputs (GravityPipeResult): DN recomendado, % de enchimento real na vazao de projeto,
//  velocidade real, capacidade do DN no enchimento-alvo, caimento usado, comprimento
//  equivalente, suficiencia e avisos (caimento abaixo do minimo, velocidade baixa/alta).

import { Injectable } from '@nestjs/common';

export interface ManningFlow {
  vazaoM3s: number; // m³/s
  velocidadeMs: number; // m/s
  areaMolhadaM2: number; // m²
  raioHidraulicoM: number; // m
  fillRatio: number; // y = h/D usado (0..1)
}

export interface GravityPipeInputs {
  vazaoTransbordoM3h: number;
  desnivelM?: number;
  comprimentoTuboM?: number;
  curvas90Qty?: number;
  fatorSegurancaPct?: number;
  fillTargetRatio?: number;
  manningN?: number;
  availableDnsMm?: number[];
}

export interface GravityPipeResult {
  diametroMm: number; // DN recomendado (bore nominal, mm)
  fillRatioReal: number; // y na vazao de projeto (0..1)
  fillPercentReal: number; // y em % (0..100)
  velocidadeMs: number; // velocidade real na vazao de projeto (m/s)
  capacidadeM3hNoAlvo: number; // capacidade do DN escolhido no enchimento-alvo (m³/h)
  vazaoDesignM3h: number; // vazao de transbordo × (1 + fator seguranca) (m³/h)
  caimentoPct: number; // S usado em % (m/m × 100)
  comprimentoEquivalenteM: number; // L_tubo + curvas × L_eq (m)
  suficiente: boolean; // algum DN da lista comporta a vazao no enchimento-alvo?
  aviso: string | null;
}

// ============ CONSTANTES (estudo memory/study_borda_infinita_tubulacao_gravidade.md) ============

export const GRAVITY_FLOW = {
  // Rugosidade de Manning do PVC liso (esgoto/dreno). BR usa ~0.010.
  MANNING_N_PVC: 0.010,
  // Enchimento de projeto: tubo de gravidade roda parcialmente cheio. 0.50 = meio cheio
  // (folga de ar/ventilacao + margem). Regra estetica de piscina usa 0.33 (mais conservador).
  FILL_TARGET_DEFAULT: 0.5,
  // Caimento minimo (NBR 10844, condutores horizontais): 0.5% = 0.005 m/m.
  SLOPE_MIN: 0.005,
  // Caimento default quando o operador nao informa desnivel/comprimento: 1.5%.
  SLOPE_DEFAULT: 0.015,
  // Cada curva 90° "rouba" caimento: tratada como comprimento equivalente = 30 × D
  // (joelho 90° raio longo ~ 30 diametros). Reduz o caimento efetivo S = desnivel / L_eff.
  BEND_EQ_DIAMETERS_PER_90: 30,
  // Fator de seguranca padrao sobre a vazao de transbordo.
  SAFETY_FACTOR_PCT: 20,
  // Velocidade auto-limpante minima (2 ft/s) e maxima recomendada em PVC.
  VELOCIDADE_MIN_MS: 0.6,
  VELOCIDADE_MAX_MS: 7.5,
  // Diametros comerciais PVC esgoto/dreno (bore nominal, mm). Pra esgoto o DN ~ diametro
  // interno (parede fina), entao usamos o DN como bore hidraulico (erro < 3%, dominado
  // pelas hipoteses de caimento/curvas/enchimento).
  COMMERCIAL_DNS_MM: [40, 50, 75, 100, 150, 200, 250, 300],
};

@Injectable()
export class GravityFlowService {
  /**
   * Escoamento de Manning num tubo circular parcialmente cheio.
   * @param diametroM diametro interno (m)
   * @param fillRatio y = h/D (0..1)
   * @param slope caimento S (m/m)
   * @param manningN rugosidade n
   */
  manningPartialFull(
    diametroM: number,
    fillRatio: number,
    slope: number,
    manningN: number = GRAVITY_FLOW.MANNING_N_PVC,
  ): ManningFlow {
    const D = Math.max(diametroM, 1e-6);
    const y = Math.min(Math.max(fillRatio, 1e-4), 1);
    const n = manningN > 0 ? manningN : GRAVITY_FLOW.MANNING_N_PVC;
    const S = Math.max(slope, 0);

    // Angulo central da secao molhada (rad).
    const theta = 2 * Math.acos(1 - 2 * y);
    // Area molhada e perimetro molhado.
    const area = (D * D / 8) * (theta - Math.sin(theta));
    const perimetro = (D * theta) / 2;
    const raioHidraulico = perimetro > 0 ? area / perimetro : 0;
    // Manning.
    const vazao = (1 / n) * area * Math.pow(raioHidraulico, 2 / 3) * Math.sqrt(S);
    const velocidade = area > 0 ? vazao / area : 0;

    return {
      vazaoM3s: vazao,
      velocidadeMs: velocidade,
      areaMolhadaM2: area,
      raioHidraulicoM: raioHidraulico,
      fillRatio: y,
    };
  }

  /**
   * Inverte Manning: acha o enchimento y (0..1) que escoa exatamente `vazaoAlvoM3s`
   * no diametro/caimento dados. Bisseccao na regiao monotonica (y <= 0.94, onde Q
   * cresce com y). Usado pra reportar o enchimento/velocidade REAIS na vazao de projeto.
   */
  solveFillForFlow(
    diametroM: number,
    vazaoAlvoM3s: number,
    slope: number,
    manningN: number = GRAVITY_FLOW.MANNING_N_PVC,
  ): number {
    if (vazaoAlvoM3s <= 0) return 0;
    let lo = 1e-4;
    let hi = 0.94; // pico de capacidade ~0.93-0.94; acima nao eh monotonico
    const qAt = (y: number) => this.manningPartialFull(diametroM, y, slope, manningN).vazaoM3s;
    // Se nem cheio-ate-0.94 comporta, satura em 0.94.
    if (qAt(hi) <= vazaoAlvoM3s) return hi;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (qAt(mid) < vazaoAlvoM3s) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * Dimensiona o tubo de gravidade: escolhe o MENOR diametro comercial que comporta
   * a vazao de projeto no enchimento-alvo. Caimento vem de desnivel/comprimento, com
   * as curvas alongando o tubo (roubando caimento). Reporta enchimento e velocidade
   * REAIS na vazao de projeto.
   */
  sizeGravityPipe(inputs: GravityPipeInputs): GravityPipeResult {
    const fator = (inputs.fatorSegurancaPct ?? GRAVITY_FLOW.SAFETY_FACTOR_PCT) / 100;
    const fillTarget = Math.min(Math.max(inputs.fillTargetRatio ?? GRAVITY_FLOW.FILL_TARGET_DEFAULT, 0.1), 0.94);
    const n = inputs.manningN ?? GRAVITY_FLOW.MANNING_N_PVC;
    const curvas = Math.max(inputs.curvas90Qty ?? 0, 0);
    const compTubo = Math.max(inputs.comprimentoTuboM ?? 0, 0);
    const desnivel = Math.max(inputs.desnivelM ?? 0, 0);
    const dns = [...(inputs.availableDnsMm ?? GRAVITY_FLOW.COMMERCIAL_DNS_MM)].sort((a, b) => a - b);

    const vazaoDesignM3h = Math.max(inputs.vazaoTransbordoM3h, 0) * (1 + fator);
    const vazaoDesignM3s = vazaoDesignM3h / 3600;

    // Caimento efetivo por DN: as curvas alongam o tubo (L_eff), reduzindo S = desnivel/L_eff.
    const slopeForDn = (dnMm: number): { S: number; lEff: number } => {
      const D = dnMm / 1000;
      const lEff = compTubo + curvas * GRAVITY_FLOW.BEND_EQ_DIAMETERS_PER_90 * D;
      let S: number;
      if (desnivel > 0 && lEff > 0) {
        S = Math.max(desnivel / lEff, GRAVITY_FLOW.SLOPE_MIN);
      } else {
        S = GRAVITY_FLOW.SLOPE_DEFAULT; // sem desnivel/comprimento informado -> caimento padrao
      }
      return { S, lEff };
    };

    const buildResult = (dnMm: number, suficiente: boolean): GravityPipeResult => {
      const D = dnMm / 1000;
      const { S, lEff } = slopeForDn(dnMm);
      const capAlvo = this.manningPartialFull(D, fillTarget, S, n).vazaoM3s;
      // Enchimento e velocidade REAIS na vazao de projeto.
      const yReal = this.solveFillForFlow(D, vazaoDesignM3s, S, n);
      const real = this.manningPartialFull(D, yReal, S, n);

      let aviso: string | null = null;
      if (!suficiente) {
        aviso = `Nenhum diametro da lista comporta ${vazaoDesignM3h.toFixed(1)} m³/h por gravidade nesse caimento — aumente o desnivel, reduza curvas ou use tubo maior.`;
      } else if (real.velocidadeMs > GRAVITY_FLOW.VELOCIDADE_MAX_MS) {
        aviso = `Velocidade ${real.velocidadeMs.toFixed(2)} m/s acima de ${GRAVITY_FLOW.VELOCIDADE_MAX_MS} m/s — reduza o caimento.`;
      } else if (real.velocidadeMs > 0 && real.velocidadeMs < GRAVITY_FLOW.VELOCIDADE_MIN_MS) {
        aviso = `Velocidade ${real.velocidadeMs.toFixed(2)} m/s abaixo de ${GRAVITY_FLOW.VELOCIDADE_MIN_MS} m/s (auto-limpante) — aumente o caimento ou reduza o diametro.`;
      } else if (desnivel > 0 && S <= GRAVITY_FLOW.SLOPE_MIN) {
        aviso = `Caimento no minimo (0,5%) — confira desnivel x comprimento; tubo pode entupir/golfar.`;
      }

      return {
        diametroMm: dnMm,
        fillRatioReal: Number(yReal.toFixed(3)),
        fillPercentReal: Number((yReal * 100).toFixed(1)),
        velocidadeMs: Number(real.velocidadeMs.toFixed(3)),
        capacidadeM3hNoAlvo: Number((capAlvo * 3600).toFixed(1)),
        vazaoDesignM3h: Number(vazaoDesignM3h.toFixed(1)),
        caimentoPct: Number((S * 100).toFixed(2)),
        comprimentoEquivalenteM: Number(lEff.toFixed(2)),
        suficiente,
        aviso,
      };
    };

    if (vazaoDesignM3s <= 0 || dns.length === 0) {
      return buildResult(dns[0] ?? 50, false);
    }

    // Menor DN cuja capacidade no enchimento-alvo cobre a vazao de projeto.
    for (const dnMm of dns) {
      const { S } = slopeForDn(dnMm);
      const capAlvo = this.manningPartialFull(dnMm / 1000, fillTarget, S, n).vazaoM3s;
      if (capAlvo >= vazaoDesignM3s) {
        return buildResult(dnMm, true);
      }
    }
    // Nenhum atende — retorna o maior + aviso de subdimensionamento.
    return buildResult(dns[dns.length - 1], false);
  }
}
