// Seed de dados climaticos pra popular ClimateData no 1o acesso de cada tenant.
// Fontes:
//   - Temperatura + umidade: CLIMATE_DATA (heating-constants.ts, oriundo TAB006 Tholz)
//   - Radiacao solar: Atlas Brasileiro de Energia Solar (CRESESB/INPE) e Atlas Solarimetrico INMET,
//     valores mensais aproximados em kWh/m²/dia.
//
// O seed eh chamado por ClimateDataService.ensureSeeded(companyId) na 1a leitura
// de /settings/climate-data quando o tenant ainda nao tem dados.
//
// Cada registro gera uma linha por (uf, cidade=null|cidade-polo).

import { CLIMATE_DATA, UFCode } from './heating-constants';

// Radiacao solar mensal (kWh/m²/dia) por UF (capital) — jan..dez
// Valores compatibilizados com Atlas Brasileiro de Energia Solar (CRESESB/INPE 2017)
const SOLAR_RADIATION_BY_UF: Record<UFCode, [number, number, number, number, number, number, number, number, number, number, number, number]> = {
  AC: [4.8, 4.9, 4.9, 4.6, 4.5, 4.4, 4.7, 5.2, 5.1, 5.0, 4.9, 4.7],
  AL: [6.1, 6.2, 5.9, 5.4, 4.7, 4.1, 4.0, 4.7, 5.3, 5.8, 6.1, 6.1],
  AM: [4.6, 4.6, 4.5, 4.6, 4.5, 4.6, 4.8, 5.0, 5.2, 5.2, 5.0, 4.7],
  AP: [5.1, 5.0, 5.0, 5.0, 5.1, 5.3, 5.4, 5.6, 5.7, 5.6, 5.4, 5.3],
  BA: [6.1, 6.1, 5.9, 5.3, 4.6, 4.0, 4.0, 4.7, 5.4, 5.8, 6.0, 6.0],
  CE: [6.0, 5.8, 5.5, 5.4, 5.6, 5.7, 5.9, 6.1, 6.2, 6.3, 6.2, 6.1],
  DF: [5.6, 5.5, 5.3, 5.0, 4.8, 4.6, 4.8, 5.3, 5.5, 5.5, 5.3, 5.4],
  ES: [5.7, 5.7, 5.5, 5.0, 4.4, 4.0, 4.1, 4.5, 4.9, 5.3, 5.4, 5.6],
  GO: [5.7, 5.7, 5.5, 5.3, 5.0, 4.8, 5.0, 5.6, 5.7, 5.7, 5.5, 5.5],
  MA: [5.4, 5.2, 5.1, 5.1, 5.4, 5.4, 5.5, 5.8, 6.0, 6.0, 5.7, 5.5],
  MG: [5.7, 5.7, 5.4, 5.0, 4.5, 4.3, 4.5, 5.1, 5.4, 5.5, 5.4, 5.5],
  MS: [5.7, 5.6, 5.4, 5.0, 4.5, 4.3, 4.6, 5.3, 5.5, 5.6, 5.6, 5.7],
  // Cuiaba — usa valores DA PLANILHA original Tholz/Solis (referencia pro modulo)
  MT: [5.5, 5.2, 5.0, 4.5, 4.0, 3.6, 3.8, 4.5, 5.0, 5.3, 5.5, 5.6],
  PA: [4.8, 4.7, 4.7, 4.7, 4.9, 5.1, 5.2, 5.4, 5.5, 5.5, 5.3, 5.0],
  PB: [6.0, 6.0, 5.8, 5.2, 4.6, 4.0, 4.0, 4.6, 5.3, 5.8, 6.0, 6.0],
  PE: [6.0, 6.0, 5.8, 5.2, 4.6, 4.0, 4.0, 4.6, 5.3, 5.8, 6.0, 6.0],
  PI: [5.8, 5.6, 5.4, 5.4, 5.6, 5.7, 5.8, 6.1, 6.2, 6.2, 6.0, 5.9],
  PR: [5.5, 5.4, 5.0, 4.4, 3.7, 3.4, 3.6, 4.3, 4.6, 4.9, 5.5, 5.6],
  RJ: [5.6, 5.6, 5.3, 4.9, 4.3, 4.0, 4.1, 4.6, 4.7, 5.0, 5.3, 5.5],
  RN: [6.1, 6.0, 5.8, 5.3, 4.7, 4.2, 4.2, 4.8, 5.5, 5.9, 6.1, 6.1],
  RO: [4.7, 4.7, 4.6, 4.5, 4.4, 4.5, 4.8, 5.2, 5.2, 5.1, 4.9, 4.7],
  RR: [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.1, 5.4, 5.7, 5.7, 5.4, 5.1],
  RS: [6.0, 5.7, 5.0, 4.0, 3.2, 2.8, 3.0, 3.7, 4.3, 5.0, 5.9, 6.1],
  SC: [5.7, 5.4, 4.8, 3.9, 3.2, 2.9, 3.1, 3.7, 4.1, 4.7, 5.5, 5.8],
  SE: [6.0, 6.0, 5.8, 5.3, 4.6, 4.0, 4.0, 4.6, 5.3, 5.8, 6.0, 6.0],
  SP: [5.3, 5.3, 5.0, 4.5, 3.9, 3.7, 3.9, 4.5, 4.6, 4.9, 5.1, 5.3],
  TO: [5.4, 5.4, 5.3, 5.3, 5.4, 5.4, 5.6, 5.9, 5.9, 5.7, 5.5, 5.4],
};

// Radiacao solar pra cidades-polo conhecidas (pequenas variacoes por altitude/lat).
// Fallback: se cidade nao listada aqui, usa o da capital do UF.
const SOLAR_RADIATION_BY_CITY: Record<string, [number, number, number, number, number, number, number, number, number, number, number, number]> = {
  // MT — Primavera do Leste (altitude ~600m, levemente menos radiacao que Cuiaba)
  'Primavera do Leste': [5.4, 5.1, 4.9, 4.4, 3.9, 3.5, 3.7, 4.4, 4.9, 5.2, 5.4, 5.5],
  // PR — Maringa, Londrina, Foz do Iguacu (norte do PR, mais ensolarado que Curitiba)
  'Maringa': [5.8, 5.6, 5.2, 4.6, 4.0, 3.7, 3.9, 4.6, 5.0, 5.2, 5.7, 5.8],
  'Londrina': [5.7, 5.5, 5.1, 4.5, 3.9, 3.6, 3.8, 4.5, 4.9, 5.1, 5.6, 5.7],
  'Foz do Iguacu': [5.9, 5.7, 5.3, 4.7, 4.0, 3.6, 3.8, 4.6, 5.0, 5.3, 5.8, 5.9],
  // RS — Caxias do Sul (altitude ~760m, menos sol no inverno)
  'Caxias do Sul': [5.6, 5.3, 4.6, 3.6, 2.9, 2.5, 2.7, 3.4, 4.0, 4.7, 5.5, 5.7],
  // SC — Joinville, Itajai, Blumenau (clima litoraneo similar a Floripa)
  'Joinville': [5.6, 5.3, 4.7, 3.9, 3.2, 2.9, 3.0, 3.6, 4.0, 4.6, 5.4, 5.7],
  'Itajai': [5.7, 5.4, 4.8, 3.9, 3.2, 2.9, 3.1, 3.7, 4.1, 4.7, 5.5, 5.8],
  'Blumenau': [5.6, 5.3, 4.7, 3.8, 3.2, 2.9, 3.0, 3.7, 4.0, 4.6, 5.4, 5.7],
  // SP — Campinas, Ribeirao Preto, Sao Jose do Rio Preto (interior, mais ensolarado)
  'Campinas': [5.5, 5.5, 5.2, 4.6, 4.0, 3.8, 4.0, 4.6, 4.8, 5.1, 5.3, 5.5],
  'Ribeirao Preto': [5.7, 5.7, 5.5, 4.9, 4.4, 4.2, 4.5, 5.2, 5.3, 5.4, 5.5, 5.7],
  'Sao Jose do Rio Preto': [5.9, 5.9, 5.7, 5.1, 4.6, 4.4, 4.6, 5.3, 5.5, 5.6, 5.7, 5.9],
};

export interface ClimateSeedRecord {
  uf: string;
  cidade: string | null;
  ufName: string;
  monthlyData: {
    temp: number[];
    humidity: number[];
    radSol: number[];
  };
}

/**
 * Gera o conjunto completo de registros de seed (27 capitais + cidades-polo).
 * Usado por ClimateDataService.ensureSeeded.
 */
export function buildClimateSeed(): ClimateSeedRecord[] {
  const out: ClimateSeedRecord[] = [];
  for (const uf of CLIMATE_DATA) {
    const radCapital = SOLAR_RADIATION_BY_UF[uf.uf];
    // Capital (cidade = null = padrao do estado)
    out.push({
      uf: uf.uf,
      cidade: null,
      ufName: uf.ufName,
      monthlyData: {
        temp: [...uf.capital.tempMonthly],
        humidity: [...uf.capital.humidityMonthly],
        radSol: [...radCapital],
      },
    });
    // Cidades-polo (cada uma com cidade especifica)
    for (const city of uf.cities) {
      const radCity = SOLAR_RADIATION_BY_CITY[city.name] ?? radCapital;
      out.push({
        uf: uf.uf,
        cidade: city.name,
        ufName: uf.ufName,
        monthlyData: {
          temp: [...city.tempMonthly],
          humidity: [...city.humidityMonthly],
          radSol: [...radCity],
        },
      });
    }
  }
  return out;
}

/**
 * Retorna o seed pra um (uf, cidade) especifico — usado pelo botao "Restaurar padrao INMET".
 * Retorna null se nao tiver no seed (cidade adicionada pelo tenant manualmente).
 */
export function findSeedRecord(uf: string, cidade: string | null): ClimateSeedRecord | null {
  const all = buildClimateSeed();
  return all.find((r) => r.uf === uf && r.cidade === cidade) ?? null;
}
