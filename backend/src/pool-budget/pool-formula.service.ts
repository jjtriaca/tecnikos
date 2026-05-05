import { Injectable, Logger } from '@nestjs/common';
import { PoolDimensionsDto } from './dto/pool-dimensions.dto';

/**
 * Tipo de base que a fórmula usa pra calcular a quantidade automática.
 */
export type PoolFormulaBasis =
  | 'POOL_AREA'         // m² da piscina (length * width)
  | 'POOL_PERIMETER'    // m perímetro (2*(length + width))
  | 'POOL_VOLUME'       // m³ volume (area * depth)
  | 'WALL_AREA'         // m² parede lateral (perimeter * depth)
  | 'TILE_AREA'         // m² azulejo (paredes + fundo)
  | 'POOL_LENGTH'       // m comprimento
  | 'POOL_WIDTH'        // m largura
  | 'POOL_DEPTH'        // m profundidade
  | 'FIXED';            // valor fixo (não depende da piscina)

export interface PoolFormulaConfig {
  basis: PoolFormulaBasis;
  factor?: number;      // multiplicador (default 1)
  value?: number;       // pra basis=FIXED (qty fixa)
  minQty?: number;      // qty mínima (arredonda pra cima se cálculo der menor)
  roundUp?: boolean;    // arredonda pra cima (Math.ceil) — útil pra caixas, pacotes
}

export interface PoolConditionConfig {
  requires?: string[];  // exige flags (ex: AQUECIMENTO_SOLAR, SPA, CASCATA)
  excludes?: string[];  // exclui se flags estiverem ativas
}

/**
 * Computa as métricas básicas da piscina a partir das dimensões.
 * Preenche os campos derivados (area, perimeter, volume, wallArea, tileArea)
 * caso o usuário não tenha enviado.
 */
export interface ComputedPoolMetrics {
  length: number;
  width: number;
  depth: number;
  area: number;
  perimeter: number;
  volume: number;
  wallArea: number;
  tileArea: number;
}

@Injectable()
export class PoolFormulaService {
  private readonly logger = new Logger(PoolFormulaService.name);

  computeMetrics(dim: PoolDimensionsDto): ComputedPoolMetrics {
    const length = dim.length || 0;
    const width = dim.width || 0;
    const depth = dim.depth || 0;

    const area = dim.area ?? length * width;
    const perimeter = dim.perimeter ?? 2 * (length + width);
    const volume = dim.volume ?? area * depth;
    const wallArea = dim.wallArea ?? perimeter * depth;
    const tileArea = dim.tileArea ?? wallArea + area; // paredes + fundo

    return { length, width, depth, area, perimeter, volume, wallArea, tileArea };
  }

  /**
   * Calcula quantidade a partir de uma fórmula e métricas da piscina.
   * Retorna null se a fórmula for inválida.
   */
  calculateQty(
    formula: PoolFormulaConfig | null | undefined,
    metrics: ComputedPoolMetrics,
  ): number | null {
    if (!formula || !formula.basis) return null;

    const factor = formula.factor ?? 1;
    let raw: number;

    switch (formula.basis) {
      case 'POOL_AREA':
        raw = metrics.area * factor;
        break;
      case 'POOL_PERIMETER':
        raw = metrics.perimeter * factor;
        break;
      case 'POOL_VOLUME':
        raw = metrics.volume * factor;
        break;
      case 'WALL_AREA':
        raw = metrics.wallArea * factor;
        break;
      case 'TILE_AREA':
        raw = metrics.tileArea * factor;
        break;
      case 'POOL_LENGTH':
        raw = metrics.length * factor;
        break;
      case 'POOL_WIDTH':
        raw = metrics.width * factor;
        break;
      case 'POOL_DEPTH':
        raw = metrics.depth * factor;
        break;
      case 'FIXED':
        raw = (formula.value ?? 1) * factor;
        break;
      default:
        return null;
    }

    if (formula.roundUp) {
      raw = Math.ceil(raw);
    }
    if (formula.minQty != null && raw < formula.minQty) {
      raw = formula.minQty;
    }
    return Number(raw.toFixed(4));
  }

  /**
   * Verifica se a condicional bate com as flags da piscina.
   * Ex: condition = {requires: ["AQUECIMENTO_SOLAR"]} retorna true só se
   *     poolDimensions.hasAquecimentoSolar === true.
   */
  matchesCondition(
    condition: PoolConditionConfig | null | undefined,
    dim: PoolDimensionsDto,
  ): boolean {
    if (!condition) return true;

    const flags: Record<string, boolean | undefined> = {
      AQUECIMENTO_SOLAR: dim.hasAquecimentoSolar,
      SPA: dim.hasSpa,
      CASCATA: dim.hasCascata,
      AUTOMACAO: dim.hasAutomacao,
    };

    if (condition.requires?.length) {
      const allMatch = condition.requires.every((flag) => flags[flag] === true);
      if (!allMatch) return false;
    }
    if (condition.excludes?.length) {
      const anyMatch = condition.excludes.some((flag) => flags[flag] === true);
      if (anyMatch) return false;
    }
    return true;
  }
}
