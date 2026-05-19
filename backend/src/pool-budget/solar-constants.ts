// Constantes do motor de calculo Solar — fieis a planilha original "ANDREIA SANTANA -
// Orçamento" / Solis Piscinas (abas SOLAR e CALCULOS_SOLAR).
//
// Toda alteracao aqui deve refletir os valores das Tabelas 69/71/74/78 + Fatores B15:D20.

// ============ Tabela71 — Capa termica (multiplicador da area de coletor) ============
// SOLAR!I25 = 'SIM' | 'NAO' (NAO=1.8 -> 80% mais coletor)
export const SOLAR_MULT_CAPA: Record<'SIM' | 'NAO', number> = {
  SIM: 1.0,
  NAO: 1.8,
};

// ============ Tabela74 — Vento (multiplicador da perda noturna) ============
// SOLAR!I26 = 'Fraco' | 'Moderado' | 'Forte'
export const SOLAR_MULT_VENTO: Record<'FRACO' | 'MODERADO' | 'FORTE', number> = {
  FRACO: 1.0,
  MODERADO: 1.25,
  FORTE: 1.5,
};

// ============ Tabela78 (col Q) — Perda termica base por mes ============
// Janeiro..Dezembro. Multiplicado por mult_capa * mult_vento -> perda_corrigida do mes.
export const SOLAR_PERDA_BASE_MENSAL: [number, number, number, number, number, number, number, number, number, number, number, number] = [
  1.0, 0.9, 1.1, 1.4, 1.6, 1.8, 1.8, 1.6, 1.4, 1.2, 1.0, 0.9,
];

// ============ Constantes globais (Fatores B15:D20) ============
// RadSol e InsolacaoHoras viraram dinamicos (vem do ClimateData) — esses sao defaults.
// Eficiencia e o fator 1400 sao constantes fisicas/empiricas.
export const SOLAR_EFICIENCIA_PADRAO = 0.65;        // Fatores B17
export const SOLAR_INSOLACAO_HORAS_PADRAO = 5;      // Fatores B18 (horas uteis/dia)
export const SOLAR_FATOR_ENERGIA_KCAL = 1400;       // Multiplicador na formula EnergiaSolar_kcal_hora
export const SOLAR_DELTA_REF_PADRAO = 13;           // Tabela78 col AC — referencia pra perda noturna

// ============ Dimensionamento — formula da vazao (H38) ============
export const SOLAR_VAZAO_FATOR = 0.254;             // m³/h por m² de coletor
export const SOLAR_BATERIA_MIN_COLETORES = 5;       // MIN coletores por bateria
export const SOLAR_BATERIA_MAX_COLETORES = 8;       // MAX coletores por bateria (= divisor inicial)
export const SOLAR_VAZAO_DOBRA_BATERIAS = 4;        // num_baterias >= 4 dobra a vazao

// ============ Defaults pro coletor (quando produto sem specs) ============
// Modelos Solis Tropicos da planilha original:
//   Solis 2.00x1.12 (2.24m²): kWh/m² 95.8, eficiencia 0.706
//   Solis 3.00x1.12 (3.36m²): kWh/m² 102.3, eficiencia 0.732
//   Solis 4.00x1.12 (4.48m²): kWh/m² 102.3, eficiencia 0.732
//   Solis 5.00x1.12 (5.60m²): kWh/m² 102.3, eficiencia 0.732
//   Solis 6.00x1.12 (6.72m²): kWh/m² 102.3, eficiencia 0.732
// Operador pode editar via Product.technicalSpecs (Fase 7 — backfill SLS):
//   technicalSpecs.areaM2, .kwhPorM2, .eficiencia, .tipoEquipamento='SOLAR'
export const SOLAR_DEFAULT_COLETOR_AREA_M2 = 4.48;        // Solis 4.00 = padrao mais usado
export const SOLAR_DEFAULT_COLETOR_KWH_M2 = 102.3;
export const SOLAR_DEFAULT_COLETOR_EFICIENCIA = 0.732;

// Mes do calendario (1=Jan..12=Dez) — usado pelo operador no dropdown "Escolha o mes pra visualizar"
export const SOLAR_MONTH_NAMES = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
