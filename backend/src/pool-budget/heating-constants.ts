// Constantes e dados climaticos para o simulador de aquecimento (Trocador de Calor).
//
// Fontes:
// - Dados climaticos por UF (temp + umidade mensais): TAB006 Tholz X23-3
//   (compilados pela Tholz a partir de dados oficiais brasileiros)
// - Formula de Magnus pra pressao saturada do vapor d'agua: Alduchov-Eskridge (1996)
// - Constantes fisicas (calor latente, densidade): TAB006 + dados de engenharia padrao
// - Fatores de extras (hidromassagem, cascata, borda infinita): Planilha original Tholz X-23
//
// **Sistema NACIONAL**: cobre todos os 27 estados brasileiros via cidade-referencia
// (capital + cidades-polo). Operador escolhe UF + cidade no orcamento.

// ============ TIPOS ============

export type UFCode =
  | 'AC' | 'AL' | 'AM' | 'AP' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA'
  | 'MG' | 'MS' | 'MT' | 'PA' | 'PB' | 'PE' | 'PI' | 'PR' | 'RJ' | 'RN'
  | 'RO' | 'RR' | 'RS' | 'SC' | 'SE' | 'SP' | 'TO';

export type VentoLevel = 'INTERNA' | 'NULO' | 'FRACO' | 'MODERADO' | 'FORTE';
export type TipoPiscina = 'PRIVATIVA' | 'COLETIVA';
export type TipoConstrucao = 'ABERTA' | 'FECHADA';
export type UtilizacaoAno = 'ANO_TODO' | 'VERAO' | 'INVERNO';
export type UtilizacaoSemana = 'MES_TODO' | 'FIM_DE_SEMANA';
export type FonteEnergia = 'BOMBA_CALOR' | 'GLP' | 'GN' | 'ELETRICO';

export interface ClimateCity {
  name: string;
  // 12 valores (jan..dez), temperatura media mensal em Celsius
  tempMonthly: [number, number, number, number, number, number, number, number, number, number, number, number];
  // 12 valores (jan..dez), umidade relativa media mensal em fracao (0..1)
  humidityMonthly: [number, number, number, number, number, number, number, number, number, number, number, number];
}

export interface ClimateUF {
  uf: UFCode;
  ufName: string;
  capital: ClimateCity;
  // Cidades-polo adicionais com seus proprios dados climaticos (MVP: vazio para maioria,
  // expansao pos-MVP via /settings/heating-cities)
  cities: ClimateCity[];
}

// ============ DADOS CLIMATICOS POR UF ============
//
// Source: TAB006 - Dimensionamento Trocador de Calor Tholz X23-3
// Cada UF: capital + dados mensais (temp media + umidade media mensal).
//
// Cidades-polo (expansao pos-MVP):
// - PR: Maringa, Londrina, Foz do Iguacu
// - MT: Primavera do Leste, Sinop, Sorriso
// - RS: Caxias do Sul, Pelotas
// - SC: Joinville, Blumenau
// - SP: Sao Jose do Rio Preto, Ribeirao Preto, Campinas
// - MG: Uberlandia, Juiz de Fora
// Etc. Pode ser configurado por tenant em fase futura.

export const CLIMATE_DATA: ClimateUF[] = [
  {
    uf: 'AC', ufName: 'Acre',
    capital: {
      name: 'Rio Branco',
      tempMonthly: [26.6, 26.8, 27.0, 26.8, 25.6, 24.8, 24.9, 25.9, 26.9, 27.1, 26.9, 26.7],
      humidityMonthly: [0.87, 0.87, 0.87, 0.87, 0.84, 0.82, 0.76, 0.71, 0.73, 0.79, 0.83, 0.86],
    },
    cities: [],
  },
  {
    uf: 'AL', ufName: 'Alagoas',
    capital: {
      name: 'Maceio',
      tempMonthly: [26.3, 26.5, 26.5, 26.1, 25.3, 24.5, 23.8, 23.7, 24.3, 25.1, 25.8, 26.0],
      humidityMonthly: [0.80, 0.80, 0.81, 0.84, 0.87, 0.87, 0.88, 0.86, 0.84, 0.82, 0.80, 0.79],
    },
    cities: [],
  },
  {
    uf: 'AM', ufName: 'Amazonas',
    capital: {
      name: 'Manaus',
      tempMonthly: [26.8, 26.8, 26.9, 27.0, 27.1, 27.0, 27.0, 27.8, 28.2, 28.3, 27.9, 27.4],
      humidityMonthly: [0.84, 0.84, 0.85, 0.84, 0.84, 0.80, 0.76, 0.72, 0.70, 0.72, 0.76, 0.80],
    },
    cities: [],
  },
  {
    uf: 'AP', ufName: 'Amapa',
    capital: {
      name: 'Macapa',
      tempMonthly: [26.4, 26.2, 26.3, 26.5, 26.8, 26.8, 26.8, 27.4, 27.8, 28.1, 27.9, 27.4],
      humidityMonthly: [0.85, 0.87, 0.88, 0.88, 0.86, 0.84, 0.82, 0.79, 0.75, 0.74, 0.75, 0.79],
    },
    cities: [],
  },
  {
    uf: 'BA', ufName: 'Bahia',
    capital: {
      name: 'Salvador',
      tempMonthly: [26.8, 26.9, 27.0, 26.2, 25.3, 24.3, 23.8, 23.8, 24.5, 25.3, 25.9, 26.1],
      humidityMonthly: [0.794, 0.79, 0.798, 0.822, 0.831, 0.823, 0.815, 0.80, 0.796, 0.807, 0.815, 0.811],
    },
    cities: [],
  },
  {
    uf: 'CE', ufName: 'Ceara',
    capital: {
      name: 'Fortaleza',
      tempMonthly: [27.5, 27.1, 26.7, 26.6, 26.6, 26.2, 26.0, 26.3, 26.8, 27.3, 27.6, 27.7],
      humidityMonthly: [0.781, 0.814, 0.847, 0.852, 0.836, 0.81, 0.788, 0.753, 0.744, 0.74, 0.737, 0.759],
    },
    cities: [],
  },
  {
    uf: 'DF', ufName: 'Distrito Federal',
    capital: {
      name: 'Brasilia',
      tempMonthly: [22.2, 22.1, 22.3, 21.7, 20.4, 19.3, 19.0, 21.0, 22.2, 22.5, 22.1, 21.9],
      humidityMonthly: [0.75, 0.75, 0.77, 0.73, 0.69, 0.64, 0.58, 0.50, 0.52, 0.62, 0.75, 0.77],
    },
    cities: [],
  },
  {
    uf: 'ES', ufName: 'Espirito Santo',
    capital: {
      name: 'Vitoria',
      tempMonthly: [27.0, 27.7, 27.3, 25.9, 24.4, 23.1, 22.4, 22.9, 23.2, 24.1, 24.9, 26.0],
      humidityMonthly: [0.74, 0.77, 0.76, 0.76, 0.73, 0.77, 0.76, 0.74, 0.71, 0.74, 0.77, 0.76],
    },
    cities: [],
  },
  {
    uf: 'GO', ufName: 'Goias',
    capital: {
      name: 'Goiania',
      tempMonthly: [24.5, 24.6, 24.8, 24.3, 22.6, 21.2, 21.1, 23.1, 25.0, 25.3, 24.7, 24.3],
      humidityMonthly: [0.75, 0.75, 0.77, 0.73, 0.69, 0.64, 0.58, 0.50, 0.52, 0.62, 0.75, 0.77],
    },
    cities: [],
  },
  {
    uf: 'MA', ufName: 'Maranhao',
    capital: {
      name: 'Sao Luis',
      tempMonthly: [26.2, 26.3, 26.2, 26.4, 26.6, 26.7, 26.4, 26.9, 27.3, 27.5, 27.7, 27.0],
      humidityMonthly: [0.80, 0.83, 0.85, 0.86, 0.84, 0.81, 0.80, 0.77, 0.74, 0.73, 0.73, 0.74],
    },
    cities: [],
  },
  {
    uf: 'MG', ufName: 'Minas Gerais',
    capital: {
      name: 'Belo Horizonte',
      tempMonthly: [23.5, 23.9, 23.7, 22.4, 20.5, 19.2, 18.9, 20.5, 21.7, 22.6, 22.9, 22.9],
      humidityMonthly: [0.79, 0.751, 0.747, 0.739, 0.725, 0.714, 0.687, 0.645, 0.651, 0.698, 0.741, 0.78],
    },
    cities: [],
  },
  {
    uf: 'MS', ufName: 'Mato Grosso do Sul',
    capital: {
      name: 'Campo Grande',
      tempMonthly: [24.2, 25.3, 24.3, 23.8, 21.6, 20.7, 20.4, 22.5, 22.5, 24.8, 25.0, 25.1],
      humidityMonthly: [0.76, 0.76, 0.75, 0.71, 0.70, 0.67, 0.61, 0.52, 0.58, 0.65, 0.68, 0.74],
    },
    cities: [],
  },
  {
    uf: 'MT', ufName: 'Mato Grosso',
    capital: {
      name: 'Cuiaba',
      tempMonthly: [27.9, 27.8, 27.9, 27.4, 25.7, 24.1, 24.2, 26.2, 28.1, 25.6, 27.0, 27.8],
      humidityMonthly: [0.76, 0.77, 0.76, 0.74, 0.72, 0.66, 0.59, 0.50, 0.54, 0.63, 0.69, 0.74],
    },
    cities: [
      // Primavera do Leste (~600m altitude, mais frio que Cuiaba — estimativa baseada em climate-data.org)
      {
        name: 'Primavera do Leste',
        tempMonthly: [24.5, 24.6, 24.4, 23.8, 21.4, 20.0, 20.3, 22.5, 24.2, 24.5, 24.6, 24.5],
        humidityMonthly: [0.82, 0.83, 0.82, 0.78, 0.74, 0.68, 0.61, 0.52, 0.58, 0.68, 0.76, 0.80],
      },
    ],
  },
  {
    uf: 'PA', ufName: 'Para',
    capital: {
      name: 'Belem',
      tempMonthly: [26.5, 26.4, 26.4, 26.3, 27.0, 26.9, 26.7, 26.9, 26.9, 26.9, 27.1, 27.0],
      humidityMonthly: [0.87, 0.89, 0.89, 0.89, 0.86, 0.83, 0.82, 0.82, 0.82, 0.81, 0.81, 0.83],
    },
    cities: [],
  },
  {
    uf: 'PB', ufName: 'Paraiba',
    capital: {
      name: 'Joao Pessoa',
      tempMonthly: [27.3, 26.6, 25.6, 26.4, 25.9, 25.1, 23.6, 24.8, 23.6, 26.3, 26.5, 26.5],
      humidityMonthly: [0.72, 0.72, 0.74, 0.77, 0.79, 0.81, 0.81, 0.78, 0.73, 0.71, 0.71, 0.71],
    },
    cities: [],
  },
  {
    uf: 'PE', ufName: 'Pernambuco',
    capital: {
      name: 'Recife',
      tempMonthly: [26.5, 26.6, 26.5, 26.1, 25.4, 24.6, 24.0, 23.6, 24.5, 25.3, 26.1, 26.2],
      humidityMonthly: [0.73, 0.77, 0.80, 0.84, 0.85, 0.85, 0.85, 0.85, 0.78, 0.76, 0.74, 0.75],
    },
    cities: [],
  },
  {
    uf: 'PI', ufName: 'Piaui',
    capital: {
      name: 'Teresina',
      tempMonthly: [27.4, 26.3, 26.3, 27.2, 27.1, 26.8, 26.9, 27.0, 28.9, 29.6, 29.2, 28.7],
      humidityMonthly: [0.76, 0.80, 0.82, 0.82, 0.78, 0.72, 0.66, 0.58, 0.56, 0.57, 0.60, 0.66],
    },
    cities: [],
  },
  {
    uf: 'PR', ufName: 'Parana',
    capital: {
      name: 'Curitiba',
      tempMonthly: [21.5, 21.5, 20.6, 18.0, 15.7, 14.0, 13.8, 15.1, 16.1, 17.6, 19.3, 20.4],
      humidityMonthly: [0.79, 0.80, 0.80, 0.79, 0.82, 0.827, 0.81, 0.79, 0.82, 0.82, 0.80, 0.82],
    },
    cities: [
      // Maringa (mais quente que Curitiba — clima subtropical mais ameno, ~580m)
      {
        name: 'Maringa',
        tempMonthly: [25.0, 25.3, 24.5, 22.2, 19.5, 17.9, 17.6, 19.7, 21.2, 22.7, 24.1, 24.8],
        humidityMonthly: [0.74, 0.74, 0.74, 0.72, 0.74, 0.74, 0.69, 0.62, 0.65, 0.68, 0.68, 0.73],
      },
      // Londrina (~580m, clima subtropical similar a Maringa)
      {
        name: 'Londrina',
        tempMonthly: [24.0, 24.3, 23.5, 21.0, 18.0, 16.7, 16.4, 18.5, 20.2, 21.7, 23.0, 23.7],
        humidityMonthly: [0.75, 0.75, 0.75, 0.73, 0.75, 0.75, 0.70, 0.62, 0.65, 0.68, 0.69, 0.74],
      },
      // Foz do Iguacu (~165m, mais quente)
      {
        name: 'Foz do Iguacu',
        tempMonthly: [26.5, 26.5, 25.5, 22.5, 19.0, 17.5, 17.5, 19.0, 20.5, 22.5, 24.0, 25.5],
        humidityMonthly: [0.75, 0.77, 0.77, 0.77, 0.80, 0.81, 0.78, 0.72, 0.74, 0.74, 0.72, 0.74],
      },
    ],
  },
  {
    uf: 'RJ', ufName: 'Rio de Janeiro',
    capital: {
      name: 'Rio de Janeiro',
      tempMonthly: [26.4, 26.9, 26.4, 24.9, 23.4, 22.0, 21.9, 22.3, 22.1, 23.1, 24.4, 25.5],
      humidityMonthly: [0.77, 0.76, 0.79, 0.79, 0.79, 0.79, 0.79, 0.77, 0.78, 0.78, 0.79, 0.78],
    },
    cities: [],
  },
  {
    uf: 'RN', ufName: 'Rio Grande do Norte',
    capital: {
      name: 'Natal',
      tempMonthly: [27.5, 27.5, 27.5, 27.5, 27.0, 26.0, 25.5, 25.5, 26.0, 26.5, 27.5, 27.5],
      humidityMonthly: [0.76, 0.77, 0.78, 0.82, 0.83, 0.84, 0.83, 0.80, 0.77, 0.74, 0.74, 0.75],
    },
    cities: [],
  },
  {
    uf: 'RO', ufName: 'Rondonia',
    capital: {
      name: 'Porto Velho',
      tempMonthly: [26.0, 26.2, 25.2, 26.4, 25.8, 24.8, 25.0, 26.0, 26.8, 27.1, 26.7, 26.4],
      humidityMonthly: [0.88, 0.88, 0.88, 0.87, 0.85, 0.82, 0.77, 0.73, 0.77, 0.81, 0.85, 0.87],
    },
    cities: [],
  },
  {
    uf: 'RR', ufName: 'Roraima',
    capital: {
      name: 'Boa Vista',
      tempMonthly: [28.5, 28.5, 29.5, 29.0, 28.0, 27.5, 27.5, 28.0, 29.5, 29.5, 29.5, 28.5],
      humidityMonthly: [0.65, 0.63, 0.62, 0.69, 0.78, 0.80, 0.81, 0.77, 0.70, 0.68, 0.68, 0.67],
    },
    cities: [],
  },
  {
    uf: 'RS', ufName: 'Rio Grande do Sul',
    capital: {
      name: 'Porto Alegre',
      tempMonthly: [25.4, 25.5, 23.8, 20.8, 17.6, 15.1, 15.5, 16.0, 17.5, 19.7, 21.9, 24.0],
      humidityMonthly: [0.71, 0.74, 0.75, 0.77, 0.81, 0.82, 0.81, 0.79, 0.78, 0.74, 0.71, 0.69],
    },
    cities: [
      // Caxias do Sul (~760m altitude, mais frio)
      {
        name: 'Caxias do Sul',
        tempMonthly: [21.0, 20.8, 19.6, 16.6, 13.6, 12.0, 12.0, 13.3, 14.7, 17.0, 19.0, 20.3],
        humidityMonthly: [0.76, 0.78, 0.79, 0.81, 0.83, 0.85, 0.83, 0.79, 0.78, 0.76, 0.74, 0.73],
      },
    ],
  },
  {
    uf: 'SC', ufName: 'Santa Catarina',
    capital: {
      name: 'Florianopolis',
      tempMonthly: [24.7, 25.1, 24.1, 21.9, 19.3, 17.2, 16.9, 17.4, 18.2, 19.9, 21.7, 23.5],
      humidityMonthly: [0.82, 0.82, 0.82, 0.82, 0.83, 0.83, 0.83, 0.82, 0.82, 0.82, 0.80, 0.80],
    },
    cities: [
      // Joinville
      {
        name: 'Joinville',
        tempMonthly: [25.4, 25.8, 24.8, 22.5, 19.5, 17.5, 17.2, 17.8, 18.8, 20.7, 22.5, 24.2],
        humidityMonthly: [0.83, 0.83, 0.84, 0.84, 0.85, 0.85, 0.85, 0.84, 0.84, 0.83, 0.81, 0.81],
      },
      // Itajai (~14m, costa SC)
      {
        name: 'Itajai',
        tempMonthly: [25.1, 25.3, 24.4, 22.1, 19.6, 17.5, 17.1, 17.8, 18.7, 20.4, 22.2, 23.9],
        humidityMonthly: [0.83, 0.84, 0.84, 0.84, 0.85, 0.85, 0.85, 0.83, 0.83, 0.82, 0.81, 0.81],
      },
      // Blumenau
      {
        name: 'Blumenau',
        tempMonthly: [25.2, 25.4, 24.4, 22.0, 19.2, 17.2, 17.0, 17.8, 18.7, 20.4, 22.2, 24.0],
        humidityMonthly: [0.82, 0.83, 0.83, 0.83, 0.84, 0.84, 0.83, 0.81, 0.82, 0.82, 0.80, 0.80],
      },
    ],
  },
  {
    uf: 'SE', ufName: 'Sergipe',
    capital: {
      name: 'Aracaju',
      tempMonthly: [27.0, 26.6, 27.0, 26.5, 25.8, 25.0, 24.3, 24.3, 25.0, 25.8, 26.1, 26.5],
      humidityMonthly: [0.781, 0.766, 0.78, 0.796, 0.776, 0.773, 0.782, 0.782, 0.781, 0.787, 0.788, 0.79],
    },
    cities: [],
  },
  {
    uf: 'SP', ufName: 'Sao Paulo',
    capital: {
      name: 'Sao Paulo',
      tempMonthly: [23.0, 23.5, 22.5, 21.0, 19.0, 17.0, 16.5, 17.5, 17.5, 20.0, 21.0, 22.0],
      humidityMonthly: [0.80, 0.80, 0.80, 0.80, 0.80, 0.75, 0.75, 0.75, 0.80, 0.80, 0.80, 0.80],
    },
    cities: [
      // Campinas
      {
        name: 'Campinas',
        tempMonthly: [24.0, 24.3, 23.8, 22.2, 19.9, 18.2, 18.0, 19.7, 21.0, 22.4, 22.8, 23.5],
        humidityMonthly: [0.79, 0.79, 0.79, 0.77, 0.76, 0.74, 0.69, 0.62, 0.66, 0.71, 0.76, 0.79],
      },
      // Ribeirao Preto (mais quente, interior)
      {
        name: 'Ribeirao Preto',
        tempMonthly: [25.0, 25.0, 24.6, 23.4, 21.0, 19.7, 19.6, 21.7, 23.4, 24.4, 24.4, 24.7],
        humidityMonthly: [0.77, 0.76, 0.74, 0.69, 0.66, 0.61, 0.55, 0.48, 0.54, 0.63, 0.71, 0.78],
      },
      // Sao Jose do Rio Preto (interior, calor intenso)
      {
        name: 'Sao Jose do Rio Preto',
        tempMonthly: [26.0, 26.2, 25.8, 24.4, 21.6, 20.3, 20.1, 22.6, 24.6, 25.5, 25.5, 25.8],
        humidityMonthly: [0.74, 0.73, 0.70, 0.66, 0.62, 0.57, 0.51, 0.45, 0.51, 0.59, 0.67, 0.74],
      },
    ],
  },
  {
    uf: 'TO', ufName: 'Tocantins',
    capital: {
      name: 'Palmas',
      tempMonthly: [26.0, 26.0, 26.0, 27.0, 27.0, 26.5, 26.5, 28.0, 29.5, 28.5, 27.0, 26.5],
      humidityMonthly: [0.807, 0.815, 0.83, 0.83, 0.851, 0.861, 0.854, 0.829, 0.812, 0.813, 0.795, 0.78],
    },
    cities: [],
  },
];

// Map UF -> ClimateUF para lookup rapido
export const CLIMATE_BY_UF: Record<UFCode, ClimateUF> = CLIMATE_DATA.reduce(
  (acc, c) => ({ ...acc, [c.uf]: c }),
  {} as Record<UFCode, ClimateUF>,
);

// ============ PROPRIEDADES TERMODINAMICAS DO AR ============
//
// Pressao saturada do vapor d'agua via formula de Magnus (Alduchov-Eskridge, 1996).
// Precisao ~0.3% no range -40°C a +50°C. Substitui tabela com 1000 entradas.
//
// Ps(T) = 610.94 × exp(17.625 × T / (T + 243.04))   [em Pa]
// T em Celsius.

export function pressaoSaturadaPa(tempC: number): number {
  return 610.94 * Math.exp((17.625 * tempC) / (tempC + 243.04));
}

// ============ VELOCIDADE DO VENTO NA SUPERFICIE (m/s) ============
//
// Fonte: TAB006 Calculadora!F21
// - Interna (piscina coberta/fechada): 0.3 m/s (apenas convec. natural)
// - Externa: depende do vento ambiente

export const WIND_SPEED_BY_LEVEL: Record<VentoLevel, number> = {
  INTERNA: 0.3,
  NULO: 0,
  FRACO: 1,
  MODERADO: 2,
  FORTE: 3,
};

// ============ PROPRIEDADES DA AGUA ============
//
// Constantes pra calculo termodinamico (TAB006 Calculadora linhas 18-20, Hoja1 linha 8).

export const WATER_PROPS = {
  // Densidade da agua (kg/L)
  densityKgPerL: 1,
  // Calor latente de vaporizacao (kJ/kg) — valor medio (TAB006 usa 2266-2435 conforme estacao)
  latentHeatKjPerKg: 2266,
  // Calor especifico da agua (kJ/(kg·°C)) — TAB006 Hoja1!B8
  specificHeatKjPerKgC: 4.2,
};

// ============ CONSTANTES DO CALCULO ============
//
// Constantes da formula de Qs (TAB006 Calculadora F18, fator de unidade).
// Vem da formula original do fabricante (Tholz).
// O fator 1/133.32 converte Pa para mmHg na formula de transferencia de massa.

export const BETA_INV = 1 / 133.32; // ~ 0.0075 (1/mmHg em Pa)

// Fator de "outras perdas" (radiacao + conducao pela borda).
// TAB006 Calculacao R17-R18: Qs' = Qs × 0.2 (20% adicional).
export const OTHER_LOSSES_FACTOR = 0.2;

// ============ FATORES DE EXTRAS ============
//
// Hidromassagem e cascata: rule-of-thumb da planilha original Tholz/AstralPool
// (CALCULOS!D7, parcelas finais). Simples mas razoavel pra esses elementos.
//
// Borda infinita: NAO usar rule-of-thumb fixo de 1000 Kcal/h/m. Eh muito impreciso
// porque a perda real depende de altura de queda, vazao, e vento. Usamos modelo
// fisico (computeBordaInfinitaKw no heating.service) que aplica a mesma formula
// Qs da superficie sobre a area de filme da cascata, com multiplicador de vazao.

export const EXTRAS_KCAL_H = {
  // Cada hidromassagem: +150 Kcal/h (rule-of-thumb) — quando 100% ativa.
  // Multiplicado por (horasSemana / 168) no calculo real.
  hidromassagemEach: 150,
  // Cada cm de cascata: +50 Kcal/h (rule-of-thumb) — quando 100% ativa.
  // Multiplicado por (horasSemana / 168) no calculo real.
  cascataPerCm: 50,
};

// Padrao de horas/semana que cascata e hidromassagem ficam ligadas, por tipo
// de piscina:
// - PRIVATIVA: 6h/sem (~50min/dia) — uso casual/decorativo
// - COLETIVA: 42h/sem (~6h/dia) — uso comercial intenso
// Se o cliente usa diferente, operador ajusta na UI.
// Borda infinita usa horas/DIA (granularidade diferente — borda em piscinas
// de luxo costuma ficar 24h/dia, modelada separadamente).
export function getExtraDefaultHorasSemana(
  tipoPiscina: TipoPiscina,
  _extra: 'cascata' | 'hidromassagem',
): number {
  return tipoPiscina === 'COLETIVA' ? 42 : 6;
}

// Fallback global (usado quando tipoPiscina nao for resolvido — raro)
export const EXTRAS_HORAS_SEMANA_DEFAULT = {
  cascata: 6,
  hidromassagem: 6,
};

// ============ BORDA INFINITA — modelo fisico ============
//
// Quando a agua transborda pela borda infinita, forma um filme/cortina caindo.
// A area desse filme expoe agua quente ao ar, gerando perda de calor por:
// - Evaporacao adicional (mesma fisica de Qs da superficie, mas sem capa)
// - Conducao com o ar (incluida no fator de outras perdas)
//
// area_filme = comprimento × altura_queda × filme_factor (textura/turbulencia)
// Qs_borda = ρ × γ × ventoFactor × ΔP × area_filme × vazao_factor / 3600  [kW]
//
// Defaults razoaveis se usuario nao especifica:
// - altura_queda: 0.5 m (queda baixa, borda nivel)
// - vazao: 30 L/min/m (vazao tipica de bomba de 0.5 cv)

export const BORDA_INFINITA = {
  // Multiplicador na area do filme (texturizacao da queda d'agua expande area real)
  FILME_FACTOR: 1.5,
  // Vazao de referencia em L/min por metro linear de borda
  VAZAO_REFERENCIA_LMIN_M: 30,
  // Vazao minima factor (vazao baixa = filme fino, menos area)
  VAZAO_FACTOR_MIN: 0.5,
  // Vazao maxima factor (vazao alta plateua — agua escorre rapido sem aumentar area util)
  VAZAO_FACTOR_MAX: 2.0,
  // Defaults pra quando user nao preenche altura/vazao
  DEFAULT_ALTURA_M: 0.5,
  DEFAULT_VAZAO_LMIN_M: 30,
  // Horas/dia que a bomba da borda fica ligada. 24h = sempre ativa.
  // Se ligada so quando piscina em uso (~8-12h), perda diaria cai proporcionalmente.
  DEFAULT_HORAS_ATIVA_DIA: 24,
};

// ============ FATORES DE CONVERSAO ============

export const CONVERSIONS = {
  // 1 kWh = 860 Kcal (eletrico direto, sem COP)
  KWH_TO_KCAL: 860,
  // 1 W medio em Kcal/h (planilha Tholz original: kcalH = W × 0.8598)
  WATT_TO_KCAL_H: 0.8598,
  // 1 Kcal/h em Btu/h
  KCAL_TO_BTU: 3.9683,
  // 1 Btu/h em kW
  BTU_TO_KW: 0.000293,
  // 1 kW em Btu/h
  KW_TO_BTU: 3412.97,
  // Poder calorifico do GLP (Kcal/Kg)
  GLP_KCAL_PER_KG: 11100,
  // Poder calorifico do Gas Natural (Kcal/m³)
  GN_KCAL_PER_M3: 8800,
  // Eficiencia tipica do aquecedor a GLP
  GLP_EFICIENCIA: 0.84,
  // Eficiencia tipica do aquecedor a GN
  GN_EFICIENCIA: 0.70,
  // Eficiencia tipica de aquecedor eletrico direto (resistencia, ~95%)
  ELETRICO_EFICIENCIA: 0.95,
};

// ============ MARGEM DE SEGURANCA ============
//
// Aplicada ao Qmax (resultado final, antes de selecionar equipamento).
// Origem: TAB006 P21 quando "Ano Todo" usa C21 que multiplica internamente por ~1.25.
// Coincide com planilha original Tholz X-23 (CALCULOS!D7 usa fator 1.2).
//
// Por que: o calculo fisico estima a perda media — sistema real deve cobrir picos
// de uso (banhistas, vento extremo, dias sem sol, etc) com margem.

// Calibrado contra TAB006 (caso oficial Tholz: Cuiaba MT, V=46.8m³, A=36m², ΔT=34°C,
// MODERADO, sem capa, ano todo → esperado 45.5 kW. Meu calc bruto da 42.6 kW; aplicando
// 1.10 = 46.9 kW (erro 3%)).
// Pra Verao/Inverno (ja pegam max dos meses ativos), margem menor.

// Reduzida v1.11.74: 1.10 → 1.05 pra aproximar planilha TAB006 do fabricante.
// O calculo bruto ja inclui pico mensal × extras × outras perdas (20%); margem
// adicional alta inflava o dimensionamento e empurrava pra equipamento maior.
// Ano todo sai 5% maior que o pico bruto (pra cobrir dias atipicos).
export const SAFETY_MARGIN = {
  ANO_TODO: 1.05,
  VERAO: 1.05,
  INVERNO: 1.05,
};

// ============ LIMITES DE SELECAO DO EQUIPAMENTO ============
//
// Folga minima de capacidade pra escolher o equipamento (TAB006 Calculation A32).
// Qtotal_max / capacidade_kW <= 0.7 (folga >= 30%)
// Acima de 1.0 (overcapacidade): equipamento subdimensionado.

// Fator de capacidade efetiva em condicoes de inverno (ar ~15°C). Bombas de calor
// inverter tem capacidade nominal medida em ar 26°C; em ar 15°C (inverno BR), a
// capacidade real cai pra ~85% da nominal (compressor trabalha mais com menos delta
// de calor pra absorver). Calibrado contra planilha TAB006 do fabricante Tholz:
// X23-40C esperado 21,28h, calculado 21,8h (erro <3%). X23-26C esperado 34,70h,
// calculado 34,4h. v1.11.83.
export const WINTER_CAPACITY_FACTOR = 0.85;

// MAX_LOAD_RATIO relaxado v1.11.74: 0.7 → 0.9 (rejeitar acima de 90%).
// Antes (0.7) o auto-select preferia equipamento 40% mais caro pra ter 30% de
// folga. A planilha TAB006 do fabricante aceita carga ~100%. Carga ate 90% eh
// pratica usual da industria (deixa 10% de margem pra dia atipico).
export const EQUIPMENT_SELECTION = {
  MAX_LOAD_RATIO: 0.9, // Carga maxima recomendada (folga >= 11%)
  MIN_LOAD_RATIO: 0.3, // Carga minima recomendada (folga <= 70%, evitar superdimensionar)
};

// ============ HORAS DE FUNCIONAMENTO ============
//
// Defaults pra estimativa de consumo diario (TAB006 Hoja1 B19, B20).

export const HEATING_OPERATION_DEFAULTS = {
  hoursPerDay: 15,
  taxaFuncionamento: 0.5, // % de operacao em escala (inverter)
};

// ============ UTILIDADES ============

/**
 * Retorna os indices dos meses ativos baseado no modo de utilizacao.
 * - ANO_TODO: jan..dez (0..11)
 * - VERAO: Out, Nov, Dez, Jan, Fev, Mar (Hemisferio Sul) — meses 9,10,11,0,1,2
 * - INVERNO: Abr..Set — meses 3..8
 */
export function getActiveMonths(mode: UtilizacaoAno): number[] {
  if (mode === 'VERAO') return [9, 10, 11, 0, 1, 2];
  if (mode === 'INVERNO') return [3, 4, 5, 6, 7, 8];
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
}
