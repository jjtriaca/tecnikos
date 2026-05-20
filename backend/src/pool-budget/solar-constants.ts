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

// ============ Fator orientacao do telhado — hemisferio sul (Brasil) ============
// Norte e o ideal (recebe sol direto o ano todo). Sul e o pior (sombra durante meses frios).
// Aplicado como multiplicador no ganho diario do coletor.
export const SOLAR_FATOR_ORIENTACAO: Record<string, number> = {
  N: 1.00,   // Norte — ideal
  NE: 0.97,
  NO: 0.97,
  L: 0.85,
  O: 0.85,
  SE: 0.78,
  SO: 0.78,
  S: 0.65,   // Sul — pior orientacao
};

// ============ Inclinacao otima do telhado ============
// Inclinacao ideal aproxima a latitude da cidade. Pra Brasil (latitudes -5° a -34°), o range util e ~15-35°.
// Fora desse range, o ganho cai. Aplica curva cosseno suave clampada em [0.55, 1.0].
export const SOLAR_INCLINACAO_OTIMA_DEFAULT = 20;  // graus — bom padrao pra Brasil central
export function calcFatorInclinacao(inclinacaoGraus: number, latitudeAbs?: number): number {
  // Sem latitude conhecida, usa default 20°
  const ideal = latitudeAbs ?? SOLAR_INCLINACAO_OTIMA_DEFAULT;
  const distancia = Math.abs(inclinacaoGraus - ideal);
  // Curva cosseno simples: cos(0)=1, cos(45)=0.71 — clampa em 0.55
  const fator = Math.cos((distancia * Math.PI) / 180);
  return Math.max(0.55, Math.min(1.0, fator));
}

// ============ Latitudes medias por UF (graus, valor absoluto) ============
// Usado pra calcular fator inclinacao otima ≈ latitude. Aproximacoes pelas capitais.
export const SOLAR_LATITUDE_ABS_BY_UF: Record<string, number> = {
  AC: 9.9, AL: 9.6, AM: 3.1, AP: 0.0, BA: 13.0, CE: 3.7,
  DF: 15.8, ES: 20.3, GO: 16.7, MA: 2.5, MG: 19.9, MS: 20.5,
  MT: 15.6, PA: 1.5, PB: 7.1, PE: 8.0, PI: 5.1, PR: 25.4,
  RJ: 22.9, RN: 5.8, RO: 8.8, RR: 2.8, RS: 30.0, SC: 27.6,
  SE: 10.9, SP: 23.5, TO: 10.2,
};

// ============ Bomba recomendada por vazao (planilha original "Bomba necessaria (Aprox)") ============
// Mapeia vazao em m³/h pra um modelo de bomba residencial/profissional.
// Mantem texto curto pra caber no card. Operador ajusta no orcamento final.
export function getBombaRecomendadaSolar(vazaoM3h: number): string {
  if (!vazaoM3h || vazaoM3h <= 0) return '—';
  if (vazaoM3h <= 4) return 'Bomba residencial 1/3 cv';
  if (vazaoM3h <= 8) return 'Bomba residencial 1/2 cv Syllenty';
  if (vazaoM3h <= 15) return 'Bomba profissional 1 cv';
  if (vazaoM3h <= 25) return 'Bomba profissional 2 cv';
  return 'Bomba industrial 3 cv ou superior';
}
