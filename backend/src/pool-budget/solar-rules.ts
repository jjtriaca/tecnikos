// Regras de dimensionamento solar configuraveis por modelo de coletor.
// Substituem o uso direto das constantes hardcoded em solar-constants.ts.
//
// Storage: Company.systemConfig.pool.solarRules: SolarRuleConfig[].
// Vinculacao 1:1 — uma regra aplica a um (poolType, model) especifico.
// Ver memory/project_solar_regras_configuraveis.md pra contexto da decisao.

import {
  SOLAR_BATERIA_MIN_COLETORES,
  SOLAR_BATERIA_MAX_COLETORES,
  SOLAR_BATERIA_MAX_M2,
  SOLAR_BATERIAS_MAX_SERIE,
  SOLAR_VAZAO_FATOR,
} from './solar-constants';

export interface SolarRules {
  minColetoresPorBateria: number;
  maxColetoresPorBateria: number;
  maxAreaPorBateriaM2: number;
  maxBateriasEmSerie: number;
  /** Vazao de projeto em L/h por m² (inteiro, default 252 = 4,2 L/min/m²) */
  vazaoProjetoLhPorM2: number;
}

export interface SolarRuleConfig {
  id: string;
  name: string;
  poolType: string;
  model: string;
  rules: SolarRules;
}

/** Defaults do sistema — usados quando nao ha regra cadastrada pro (tipo, modelo). */
export const SYSTEM_DEFAULT_SOLAR_RULES: SolarRules = {
  minColetoresPorBateria: SOLAR_BATERIA_MIN_COLETORES,
  maxColetoresPorBateria: SOLAR_BATERIA_MAX_COLETORES,
  maxAreaPorBateriaM2: SOLAR_BATERIA_MAX_M2,
  maxBateriasEmSerie: SOLAR_BATERIAS_MAX_SERIE,
  vazaoProjetoLhPorM2: Math.round(SOLAR_VAZAO_FATOR * 1000), // 0.252 -> 252
};

/**
 * Resolve as regras pra um coletor especifico.
 * Procura regra cadastrada com (poolType, model) exatos.
 * Sem match, retorna defaults do sistema.
 */
export function resolveRulesForCollector(
  product: { poolType?: string | null; model?: string | null } | null | undefined,
  configs: SolarRuleConfig[] | undefined,
): SolarRules {
  if (!product?.poolType || !product?.model || !configs?.length) {
    return SYSTEM_DEFAULT_SOLAR_RULES;
  }
  const found = configs.find(
    (c) => c.poolType === product.poolType && c.model === product.model,
  );
  return found?.rules ?? SYSTEM_DEFAULT_SOLAR_RULES;
}

/** Localiza a regra que se aplica a um (poolType, model). Retorna null se nao houver. */
export function findRuleForCollector(
  product: { poolType?: string | null; model?: string | null } | null | undefined,
  configs: SolarRuleConfig[] | undefined,
): SolarRuleConfig | null {
  if (!product?.poolType || !product?.model || !configs?.length) return null;
  return configs.find(
    (c) => c.poolType === product.poolType && c.model === product.model,
  ) ?? null;
}

/** Converte vazaoProjetoLhPorM2 (inteiro em L/h/m²) pra m³/h/m² usado nos calculos. */
export function vazaoFatorFromRules(rules: SolarRules): number {
  return rules.vazaoProjetoLhPorM2 / 1000;
}
