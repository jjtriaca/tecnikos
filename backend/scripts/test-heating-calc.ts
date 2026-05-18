// Validacao matematica do simulador de aquecimento.
// Roda: cd backend && npx ts-node scripts/test-heating-calc.ts
// Caso teste TAB006 (Tholz X23-3 oficial):
//   Volume 46.8 m³, area 36 m², MT (Cuiaba), temp 21→34, Externa, Moderada, Sem capa, Ano todo
//   Resultado esperado: Qtotal max ano = 45.5 kW (TAB006 Calculation P21)

import { HeatingService } from '../src/pool-budget/heating.service';

const svc = new HeatingService();

console.log('===== TESTE 1: TAB006 Tholz X23-3 (Cuiaba MT) =====');
const tab006 = svc.computeReport({
  areaM2: 36,
  volumeM3: 46.8,
  uf: 'MT',
  cidade: 'Cuiaba',
  tempAguaDesejada: 34,
  tempAguaInicial: 21,
  vento: 'MODERADO',
  tipoConstrucao: 'ABERTA',
  tipoPiscina: 'PRIVATIVA',
  capaTermica: false,
  utilizacaoAno: 'ANO_TODO',
  utilizacaoSemana: 'MES_TODO',
});

console.log('Cidade resolvida:', tab006.cityResolved);
console.log('Q max kW:', tab006.qtotalMaxKw, '(esperado: 45.5, tolerancia <±10%)');
console.log('Q avg kW:', tab006.qtotalAvgKw);
console.log('Mes critico:', tab006.qtotalMonthCritical, '(esperado: 7-8 = ago/set)');
console.log('Calor necessario Kcal/h:', tab006.calorNecessarioKcalH);
console.log('Calor necessario Btu/h:', tab006.calorNecessarioBtuH);
console.log('\nQtotal por mes (kW):');
tab006.monthlyHeatLoss.forEach((m) => {
  console.log(`  ${monthName(m.monthIndex)}: temp=${m.tempAr}°C  RH=${(m.humidity * 100).toFixed(0)}%  Qs=${m.qsKw}  Qs'=${m.qsExtraKw}  Qextras=${m.qsExtrasKw}  Qtotal=${m.qtotalKw}`);
});

console.log('\n===== TESTE 2: ANDREIA SANTANA (planilha original Tholz X-23) =====');
// Volume 33.09 m³, area 28.5 m², MT (PRIMAVERA DO LESTE), temp 21→33, MODERADO, capa SIM, ABERTA, PRIVATIVA, ANO TODO
// Resultado planilha original: calor_necessario = 7223.19 Kcal/h (=8.4 kW)
const andreia = svc.computeReport({
  areaM2: 28.5,
  volumeM3: 33.09,
  uf: 'MT',
  cidade: 'Primavera do Leste',
  tempAguaDesejada: 33,
  tempAguaInicial: 21,
  vento: 'MODERADO',
  tipoConstrucao: 'ABERTA',
  tipoPiscina: 'PRIVATIVA',
  capaTermica: true,
  utilizacaoAno: 'ANO_TODO',
  utilizacaoSemana: 'MES_TODO',
});

console.log('Cidade resolvida:', andreia.cityResolved);
console.log('Q max kW:', andreia.qtotalMaxKw);
console.log('Q max Kcal/h:', andreia.calorNecessarioKcalH, '(esperado planilha: 7223.19, mas planilha usa rule-of-thumb diferente)');
console.log('Q avg kW:', andreia.qtotalAvgKw);
console.log('Mes critico:', andreia.qtotalMonthCritical);

console.log('\n===== TESTE 3: Selecao do equipamento =====');
const candidates = [
  { productId: 'p1', modelName: 'Tholz X23-09C', kcalHNominal: 8168, kwNominal: 9.5, copAt50Capacity: 14.6, ratedInputPowerKW: 0.97 },
  { productId: 'p2', modelName: 'Tholz X23-14C', kcalHNominal: 11590, kwNominal: 13.48, copAt50Capacity: 14.5, ratedInputPowerKW: 0.955 },
  { productId: 'p3', modelName: 'Tholz X23-18C', kcalHNominal: 15897, kwNominal: 18.49, copAt50Capacity: 13.5, ratedInputPowerKW: 1.46 },
  { productId: 'p4', modelName: 'Tholz X23-26C', kcalHNominal: 21924, kwNominal: 25.5, copAt50Capacity: 14.1, ratedInputPowerKW: 2.04 },
  { productId: 'p5', modelName: 'Tholz X23-40C', kcalHNominal: 34392, kwNominal: 40, copAt50Capacity: 15, ratedInputPowerKW: 3.145 },
];
const sel = svc.selectEquipment(candidates, andreia.qtotalMaxKw, 'ANO_TODO');
console.log('Selecionado ANDREIA:', sel?.modelName, 'loadRatio:', sel?.loadRatio.toFixed(2), 'adequate:', sel?.isAdequate);

const sel2 = svc.selectEquipment(candidates, tab006.qtotalMaxKw, 'ANO_TODO');
console.log('Selecionado TAB006:', sel2?.modelName, 'loadRatio:', sel2?.loadRatio.toFixed(2), 'adequate:', sel2?.isAdequate);

console.log('\n===== TESTE 4: Tempo de elevacao =====');
const time = svc.computeTimeToHeat(46.8, 13, 34392);
console.log('Tempo (V=46.8m³, ΔT=13, Tholz X23-40C 34392 Kcal/h):', time, '(TAB006 espera ~20.6h)');

console.log('\n===== TESTE 5: Diferentes cidades =====');
['Cuiaba', 'Primavera do Leste'].forEach((cidade) => {
  const r = svc.computeReport({
    areaM2: 36, volumeM3: 46.8, uf: 'MT', cidade,
    tempAguaDesejada: 34, vento: 'MODERADO', tipoConstrucao: 'ABERTA',
    tipoPiscina: 'PRIVATIVA', capaTermica: false,
    utilizacaoAno: 'ANO_TODO', utilizacaoSemana: 'MES_TODO',
  });
  console.log(`  ${cidade.padEnd(20)} → Qmax=${r.qtotalMaxKw}kW (mes ${r.qtotalMonthCritical}: ${monthName(r.qtotalMonthCritical)})`);
});

['Florianopolis', 'Itajai', 'Joinville'].forEach((cidade) => {
  const r = svc.computeReport({
    areaM2: 36, volumeM3: 46.8, uf: 'SC', cidade,
    tempAguaDesejada: 30, vento: 'MODERADO', tipoConstrucao: 'ABERTA',
    tipoPiscina: 'PRIVATIVA', capaTermica: true,
    utilizacaoAno: 'ANO_TODO', utilizacaoSemana: 'MES_TODO',
  });
  console.log(`  ${cidade.padEnd(20)} → Qmax=${r.qtotalMaxKw}kW (mes ${r.qtotalMonthCritical}: ${monthName(r.qtotalMonthCritical)})`);
});

['Sao Paulo', 'Campinas', 'Ribeirao Preto'].forEach((cidade) => {
  const r = svc.computeReport({
    areaM2: 36, volumeM3: 46.8, uf: 'SP', cidade,
    tempAguaDesejada: 30, vento: 'MODERADO', tipoConstrucao: 'ABERTA',
    tipoPiscina: 'PRIVATIVA', capaTermica: true,
    utilizacaoAno: 'ANO_TODO', utilizacaoSemana: 'MES_TODO',
  });
  console.log(`  ${cidade.padEnd(20)} → Qmax=${r.qtotalMaxKw}kW (mes ${r.qtotalMonthCritical}: ${monthName(r.qtotalMonthCritical)})`);
});

function monthName(i: number): string {
  return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][i];
}
