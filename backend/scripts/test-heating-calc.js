// Validacao standalone (sem Nest) — replica logica de heating.service.ts + heating-constants.ts.

// ----- Constantes -----
const CLIMATE = {
  MT: {
    capital: {
      name: 'Cuiaba',
      tempMonthly: [27.9, 27.8, 27.9, 27.4, 25.7, 24.1, 24.2, 26.2, 28.1, 25.6, 27.0, 27.8],
      humidityMonthly: [0.76, 0.77, 0.76, 0.74, 0.72, 0.66, 0.59, 0.50, 0.54, 0.63, 0.69, 0.74],
    },
    cities: [
      {
        name: 'Primavera do Leste',
        tempMonthly: [24.5, 24.6, 24.4, 23.8, 21.4, 20.0, 20.3, 22.5, 24.2, 24.5, 24.6, 24.5],
        humidityMonthly: [0.82, 0.83, 0.82, 0.78, 0.74, 0.68, 0.61, 0.52, 0.58, 0.68, 0.76, 0.80],
      },
    ],
  },
  SC: {
    capital: {
      name: 'Florianopolis',
      tempMonthly: [24.7, 25.1, 24.1, 21.9, 19.3, 17.2, 16.9, 17.4, 18.2, 19.9, 21.7, 23.5],
      humidityMonthly: [0.82, 0.82, 0.82, 0.82, 0.83, 0.83, 0.83, 0.82, 0.82, 0.82, 0.80, 0.80],
    },
    cities: [
      {
        name: 'Itajai',
        tempMonthly: [25.1, 25.3, 24.4, 22.1, 19.6, 17.5, 17.1, 17.8, 18.7, 20.4, 22.2, 23.9],
        humidityMonthly: [0.83, 0.84, 0.84, 0.84, 0.85, 0.85, 0.85, 0.83, 0.83, 0.82, 0.81, 0.81],
      },
    ],
  },
  PR: {
    capital: {
      name: 'Curitiba',
      tempMonthly: [21.5, 21.5, 20.6, 18.0, 15.7, 14.0, 13.8, 15.1, 16.1, 17.6, 19.3, 20.4],
      humidityMonthly: [0.79, 0.80, 0.80, 0.79, 0.82, 0.827, 0.81, 0.79, 0.82, 0.82, 0.80, 0.82],
    },
    cities: [
      {
        name: 'Maringa',
        tempMonthly: [25.0, 25.3, 24.5, 22.2, 19.5, 17.9, 17.6, 19.7, 21.2, 22.7, 24.1, 24.8],
        humidityMonthly: [0.74, 0.74, 0.74, 0.72, 0.74, 0.74, 0.69, 0.62, 0.65, 0.68, 0.68, 0.73],
      },
    ],
  },
};

const WIND = { INTERNA: 0.3, NULO: 0, FRACO: 1, MODERADO: 2, FORTE: 3 };
const BETA_INV = 1 / 133.32;
const OTHER_LOSSES = 0.2;
const EXTRAS = { hidro: 150, cascataPerCm: 50, bordaInfinitaPerM: 1000 };
const CONV = { KWH_TO_KCAL: 860, KW_TO_BTU: 3412.97 };
const WATER = { densityKgPerL: 1, latentHeat: 2266, specificHeat: 4.2 };

function pressaoSat(t) {
  return 610.94 * Math.exp((17.625 * t) / (t + 243.04));
}

function getCity(uf, cidade) {
  const data = CLIMATE[uf];
  if (!data) throw new Error('UF nao encontrado: ' + uf);
  if (cidade) {
    const f = data.cities.find((c) => c.name.toLowerCase() === cidade.toLowerCase());
    if (f) return f;
  }
  return data.capital;
}

const SAFETY = { ANO_TODO: 1.10, VERAO: 1.05, INVERNO: 1.05 };

function computeMonthly(inputs) {
  const city = getCity(inputs.uf, inputs.cidade);
  const ventoEf = inputs.tipoConstrucao === 'FECHADA' ? 'INTERNA' : inputs.vento;
  const vw = WIND[ventoEf];
  const pb = pressaoSat(inputs.tempAguaDesejada);
  const ventoFactor = 0.0174 * vw + 0.0229;
  const capaFactor = inputs.capaTermica ? 0.6375 : 1.0;
  const hidro = Number(inputs.hidromassagensQtd) || 0;
  const cascata = Number(inputs.cascataLarguraCm) || 0;
  const borda = Number(inputs.bordaInfinitaM) || 0;
  const extrasKcal = hidro * EXTRAS.hidro + cascata * EXTRAS.cascataPerCm + borda * EXTRAS.bordaInfinitaPerM;
  const extrasKw = extrasKcal / CONV.KWH_TO_KCAL;

  const out = [];
  for (let m = 0; m < 12; m++) {
    const tempAr = city.tempMonthly[m];
    const humidity = city.humidityMonthly[m];
    const pq = pressaoSat(tempAr) * humidity;
    const deltaP = Math.max(0, pb - pq);

    const qsKw =
      BETA_INV *
      WATER.densityKgPerL *
      WATER.latentHeat *
      ventoFactor *
      deltaP *
      inputs.areaM2 *
      capaFactor /
      3600;

    const qsExtraKw = qsKw * OTHER_LOSSES;
    const qtotal = qsKw + qsExtraKw + extrasKw;
    out.push({ m, tempAr, humidity, qsKw: r1(qsKw), qsExtraKw: r1(qsExtraKw), qsExtrasKw: r1(extrasKw), qtotalKw: r1(qtotal) });
  }
  return out;
}

function r1(n) { return Math.round(n * 10) / 10; }

function summary(inputs, label) {
  console.log(`\n--- ${label} ---`);
  console.log(`  UF=${inputs.uf}, cidade=${inputs.cidade || '(capital)'}, V=${inputs.volumeM3}m³, A=${inputs.areaM2}m², ΔT=${inputs.tempAguaDesejada}°C, capa=${inputs.capaTermica}, vento=${inputs.vento}`);
  const monthly = computeMonthly(inputs);
  const qmaxRaw = Math.max(...monthly.map((m) => m.qtotalKw));
  const margin = SAFETY[inputs.utilizacaoAno || 'ANO_TODO'];
  const qmax = r1(qmaxRaw * margin);
  const qavg = r1(monthly.reduce((s, m) => s + m.qtotalKw, 0) / 12);
  const critic = monthly.findIndex((m) => m.qtotalKw === qmaxRaw);
  const monthName = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  console.log(`  → Qmax(raw)=${qmaxRaw}kW (${monthName[critic]}) × margem ${margin} = Qmax_final=${qmax}kW | Qavg_raw=${qavg}kW | Kcal/h=${Math.round(qmax * CONV.KWH_TO_KCAL)}`);
  console.log('  Mensais (kW):', monthly.map((m) => `${monthName[m.m]}=${m.qtotalKw}`).join(' '));
  return qmax;
}

// ===== TESTE 1: TAB006 =====
// Volume 46.8 m³, area 36 m², MT/Cuiaba, temp 34, ABERTA, MODERADO, sem capa, ANO TODO
// Esperado: Qtotal max = 45.5 kW
console.log('===== TESTE 1: TAB006 oficial (Cuiaba MT) =====');
console.log('TAB006 espera Qmax = 45.5 kW (mes Aug = "K"). Tolerancia: ±15%');
const t1 = summary({
  areaM2: 36, volumeM3: 46.8, uf: 'MT',
  tempAguaDesejada: 34, vento: 'MODERADO', tipoConstrucao: 'ABERTA',
  tipoPiscina: 'PRIVATIVA', capaTermica: false,
  utilizacaoAno: 'ANO_TODO',
}, 'Cuiaba MT (caso TAB006)');
console.log(`  ✓ Match: ${Math.abs(t1 - 45.5) / 45.5 < 0.15 ? 'OK' : 'FAIL'}`);

// ===== TESTE 2: ANDREIA SANTANA (Tholz original) =====
// Volume 33.09 m³, area 28.5 m², MT (Primavera?), temp 33, MODERADO, capa SIM
// Planilha original: 7223 Kcal/h = 8.4 kW (com fator 1.2 seguranca = 10 kW total)
console.log('\n===== TESTE 2: ANDREIA SANTANA (planilha original Tholz X-23) =====');
console.log('Planilha original (rule-of-thumb): 7223 Kcal/h ≈ 8.4 kW');
console.log('Nota: planilha usa fatores empiricos diferentes, esperado diferenca');
summary({
  areaM2: 28.5, volumeM3: 33.09, uf: 'MT', cidade: 'Primavera do Leste',
  tempAguaDesejada: 33, vento: 'MODERADO', tipoConstrucao: 'ABERTA',
  tipoPiscina: 'PRIVATIVA', capaTermica: true,
}, 'ANDREIA SANTANA');

// ===== TESTE 3: Comparativo cidades =====
console.log('\n===== TESTE 3: Comparativo cidades (mesma piscina, temp 30°C, com capa) =====');
const inputs3 = {
  areaM2: 36, volumeM3: 46.8, tempAguaDesejada: 30,
  vento: 'MODERADO', tipoConstrucao: 'ABERTA', tipoPiscina: 'PRIVATIVA', capaTermica: true,
};
summary({ ...inputs3, uf: 'MT', cidade: 'Cuiaba' }, 'Cuiaba MT (capital)');
summary({ ...inputs3, uf: 'MT', cidade: 'Primavera do Leste' }, 'Primavera MT');
summary({ ...inputs3, uf: 'SC', cidade: 'Florianopolis' }, 'Florianopolis SC');
summary({ ...inputs3, uf: 'SC', cidade: 'Itajai' }, 'Itajai SC');
summary({ ...inputs3, uf: 'PR', cidade: 'Curitiba' }, 'Curitiba PR');
summary({ ...inputs3, uf: 'PR', cidade: 'Maringa' }, 'Maringa PR');

// ===== TESTE 4: Pressao saturada (validar Magnus) =====
console.log('\n===== TESTE 4: Magnus formula (pressao saturada vapor) =====');
console.log('Esperado:');
console.log('  Ps(0°C)  = 611 Pa  | calc:', Math.round(pressaoSat(0)));
console.log('  Ps(15°C) = 1706 Pa | calc:', Math.round(pressaoSat(15)));
console.log('  Ps(21°C) = 2487 Pa | calc:', Math.round(pressaoSat(21)));
console.log('  Ps(25°C) = 3169 Pa | calc:', Math.round(pressaoSat(25)));
console.log('  Ps(34°C) = 5324 Pa | calc:', Math.round(pressaoSat(34)), '(TAB006 esperado: 5323.9)');
console.log('  Ps(50°C) = 12345 Pa | calc:', Math.round(pressaoSat(50)));
