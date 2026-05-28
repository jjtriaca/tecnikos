---
name: thermal_demand_service
description: Servico central de demanda termica (v1.12.84) — calcula kWh/mes necessario considerando TODOS os 14 fatores fisicos. Usado pela bomba solar, pode ser reusado pelo dimensionamento de bomba de calor e comparativo de fontes.
metadata:
  type: project
---

# ThermalDemandService — calculo central de demanda termica

**Arquivo:** [backend/src/pool-budget/thermal-demand.service.ts](../../../sistema-terceirizacao/backend/src/pool-budget/thermal-demand.service.ts)
**Endpoint:** `POST /pool-budgets/:id/thermal-demand`
**Versao:** v1.12.84 (28/05/2026)

## Por que existe

Antes (v1.12.78 a v1.12.83), o card da bomba solar calculava consumo eletrico no FRONTEND com formulas heuristicas (HSE × fator empirico). Tinha bugs:
- Capa termica nao impactava (campo nao chegava ao backend)
- Floor variavel por temp alvo era forcado (sem base fisica)
- Escala termica era proporcional ao ΔT (aproximacao crua)

Operador pediu: "calculo deveria ser em cima de quantas kcal/mes a piscina precisa, considerando capa, vento, temps, telhado, clima, eficiencia coletor — um calculo central que serve pra varias telas."

Esse service centraliza isso usando o motor `HeatingService.computeMonthlyHeatLoss()` (Tabela78 — modelo da industria) por composicao. Mesmo cara que ja dimensiona bomba de calor agora alimenta a bomba solar tambem.

## 14 fatores considerados

| # | Fator | Origem |
|---|---|---|
| 1 | Capa termica | `environmentParams.capaTermica` |
| 2 | Vento (FRACO/MOD/FORTE) | `environmentParams.velocidadeVento` |
| 3 | Temperatura alvo | `environmentParams.temperaturaAguaDesejada` |
| 4 | Temperatura inicial | `environmentParams.temperaturaInicialAgua` |
| 5 | Orientacao telhado | `environmentParams.orientacaoTelhado` (N/NE/L/SE/S/SO/O/NO) |
| 6 | Inclinacao telhado | `environmentParams.inclinacaoTelhadoGraus` |
| 7 | UF + cidade (clima) | `ClimateData` (temp_amb[12], radSol[12], humidity[12]) |
| 8 | Producao coletor m² | `solarReport.selectedCollector.kwhPorM2 + eficiencia` |
| 9 | Area piscina | `poolDimensions.area` |
| 10 | Volume piscina | `poolDimensions.volume` |
| 11 | Tipo construcao | `environmentParams.tipoConstrucao` (ABERTA/COBERTA/CLIMATIZADA) |
| 12 | Tipo piscina | `environmentParams.tipoPiscina` (PRIVATIVA/COLETIVA/SPA) |
| 13 | Utilizacao | `utilizacaoAno + utilizacaoSemana` |
| 14 | Extras | hidromassagem/cascata/borda infinita (qty + horas) |
| 15 | Qtd coletores | `solarReport.qtdColetores` (define oferta solar) |
| 16 | Latitude (UF) | `SOLAR_LATITUDE_ABS_BY_UF` |
| 17 | Umidade relativa | `ClimateData.humidity[12]` (afeta evaporacao) |

**Nao modelados** (impacto < 5% — desprezivel pro escopo):
- Sombreamento parcial do coletor
- Cor/material do fundo da piscina
- Altitude (atmosfera)

## Outputs do service

```typescript
interface ThermalDemandReport {
  monthly: Array<{
    monthIndex, monthName, tempAmbiente, humidity,
    qPerdasKwhDia, qPerdasKwhMes,           // demanda termica (Tabela78)
    qSolarKwhDia?, qSolarKwhMes?,            // oferta dos coletores
    coberturaSolarPct?,                       // qSolar/qPerdas × 100
    fatorUtilizacaoBomba?,                    // 0..1 fracao do HSE
    bombaHorasDia?, bombaConsumoKwhMes?,
  }>,
  // Agregados anuais
  qPerdasMediaKwhDia, qPerdasMediaKwhMes, qPerdasPicoKwhDia,
  qSolarMediaKwhDia?, qSolarMediaKwhMes?, coberturaSolarMediaPct?,
  bombaHorasDiaMedio?, bombaConsumoKwhMesMedio?, bombaPotenciaKW?,
  inputs: { ... }   // eco dos inputs pra debug + UI
}
```

## Modelo fisico

**Demanda mensal (Tabela78):**
- `monthlyHeatLoss[m].qtotalKw` (potencia kW instantanea) × 24h × 30 dias = `qPerdasKwhMes`
- Considera convec, radiacao, evaporacao, conducao, extras
- ja tem multiplicadores de capa e vento embutidos

**Oferta solar mensal:**
- `qSolarKwhDia = qtdColetores × areaColM2 × radSol × eficiencia × fatorInstalacao`
- `fatorInstalacao = calcFatorInstalacao(orientacao, inclinacao, latitude)` — varia 0.40 (S, 0°) a 1.0 (N, lat°)

**Operacao da bomba:**
- `fator = min(1, qPerdas / qSolar)` — bomba opera fracao do sol necessaria pra repor perda
- `horasDia = HSE × fator` — HSE = radSol em kWh/m²/dia ≈ horas sol equivalente
- `consumoKwhMes = potenciaKW × horasDia × 30`

Quando piscina superdimensionada (qSolar >> qPerdas): fator → 0, bomba opera pouco.
Quando piscina sub-dimensionada (qSolar < qPerdas): fator = 1, bomba opera HSE inteiro (sol limita).

## Endpoint

```
POST /pool-budgets/:id/thermal-demand
Body: {
  tempAlvo?, tempInicial?, capaTermica?, vento?,
  qtdColetores?, orientacaoTelhado?, inclinacaoTelhadoGraus?,
  potenciaCv?,   // bomba selecionada
  areaPiscinaM2?, volumeM3?
}
```

Overrides permitem UI testar cenarios sem salvar o orcamento.

## Como reusar em outras telas

- **Dimensionamento bomba de calor**: ja usa heating.service.computeReport() — pode acessar `qPerdasKwhMes` direto pelo thermal-demand pra mostrar mes a mes.
- **Comparativo de fontes** (GLP/GN/Eletrico/BC): consumo anual = qPerdasMediaKwhMes × 12. Aplicar eficiencia/COP de cada fonte.
- **DRE termico do projeto**: kWh anuais perdidos × tarifa → custo de operacao do projeto.
- **Card de cobertura solar**: `coberturaSolarMediaPct` ja calculada.

## Integracao no Simulador Solar v1.12.84

Frontend [HeatingSimulatorModal.tsx](../../../sistema-terceirizacao/frontend/src/components/pool/HeatingSimulatorModal.tsx):

1. useEffect dispara POST `/thermal-demand` sempre que muda: `report`, `selectedBombaId`, `tempAguaDesejada`, `temperaturaInicial`, `orientacaoTelhado`, `inclinacaoTelhado`
2. Atualiza `thermalReport` state
3. No card da bomba, `computeConsumo()` LOCAL fica como fallback. Quando `thermalReport.bombaConsumoKwhMesMedio` esta presente, usa esse valor.

Capa/vento ja sao persistidos no `recomputeSolar` (v1.12.83), entao quando o usuario muda esses campos e clica Recalcular, o `report.computedAt` muda → useEffect dispara → thermal-demand busca o env atualizado do banco → consumo reflete a mudanca.

## Pontos a evoluir (futuro)

- DTO formal com class-validator (atualmente body solto)
- Cache de 30s no thermal-demand pra reduzir round-trips ao mudar slider
- Mostrar tabela mes a mes opcional no card (collapsible)
- Migrar `solar.service.computeSolarReport` pra consumir tambem o thermal-demand — eliminar modelo `°C/dia` paralelo
- Adicionar `tarifaKwhBRLCents` no input e retornar `custoMesCents` calculado no backend (atualmente frontend multiplica)
