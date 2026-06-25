---
name: bomba_recirculacao_calor
description: Bomba de RECIRCULACAO da Bomba de Calor (aba Bomba de Calor do Simulador) — paridade com a bomba de recirculacao do Solar. Modelo de consumo por DEMANDA LIQUIDA (perda − ganho solar), tubulacao circuito FECHADO (inercia), regra de selecao INDEPENDENTE + templates, card de vazao. v1.13.14 → v1.13.17 (05/06/2026).
metadata:
  type: project
  versions: v1.13.14, v1.13.15, v1.13.16, v1.13.17
---

# Bomba de Recirculacao da Bomba de Calor

Aba **Bomba de Calor** do Simulador de Aquecimento (`frontend/src/components/pool/HeatingSimulatorModal.tsx`,
componente `TrocadorPumpPipeCard` + `BombaCalorTab`). Espelha a bomba de recirculacao do **Solar**.

## 1. Consumo eletrico mensal — modelo de DEMANDA LIQUIDA (v1.13.14)

A bomba de circulacao roda JUNTO com a bomba de calor, entao o consumo usa as **horas REAIS de operacao por mes**:

```
ganho_solar_dia (kWh) = radSolMonthly[mes] × area_superficie × ABSORCAO × coberturaSolar
demanda_liquida_dia   = max(0, perda_dia − ganho_solar_dia)   # perda_dia = qtotalKw × 24
horas/dia (mes)       = min(janela_horasFuncionamentoDia, demanda_liquida_dia / capacidade_kW)
P_eletrica_kW         = potenciaCv × 0.7355 / 0.65   # RENDIMENTO_BOMBA_MEDIO, MESMA constante do Solar
consumo_medio_mes_kWh = (Σ_12meses  P_eletrica × horas_mes × dias_mes) / 12   # = anual / 12 (igual Solar)
```

- **Inverno** (perda alta, sol baixo) → mais horas. **Verao com capa e alvo baixo** → perto de zero.
  **Alvo maior (35°C)** → ΔT sobe → perda sobe → mais horas mesmo no verao. **Bomba de calor mais potente**
  → menos horas (atinge o alvo mais rapido). Mes inativo (utilizacaoAno) → 0.
- **Backend:** `heating.service.ts` `computeReport` expoe `operatingHoursPerMonth[12]`, `operatingHoursPerDayAvg`,
  `operatingHoursDebug[{perdaKwhDia, ganhoSolarKwhDia, demandaLiquidaKwhDia, horasDia}]`. Reusa `city.radSolMonthly`
  (mesma base do Solar, via `buildClimateOverride`). Constantes `POOL_SOLAR_GAIN` em `heating-constants.ts`:
  `absorption: 0.8` (agua aberta), `coverTransmission: 0.5` (capa AZUL reflete — NAO eh coletor preto).
  `coberturaSolar = capaTermica ? 0.5 : 1.0` (sem capa = sol cheio).
- **Validacao/transparencia:** tabela "Perda termica mensal" ganhou linhas **☀ Ganho solar (kWh/d)** + **⏱ Horas/dia bomba**.
- **Card** (`TrocadorPumpPipeCard`): igual ao Solar — imagem + specs (cv/vazao/pressao/preco) + indicador + **⚡ Consumo
  medio (kWh/mes + R$/mes)** + 💡 tarifa (tenant global, MESMA do Solar, `/pool-budgets/solar-tarifa-kwh`).

### ⚠️ PARQUEADO (aguardando dados de campo do usuario):
1. **Calibrar** `absorption` (0.8) e/ou `coverTransmission` (0.5) com base nas linhas ☀/⏱ reais. ORCP-00003 e
   SEM capa (ganho a 0.8, sol cheio — NAO testa o 0.5; usar um caso COM capa pra testar).
2. **SO depois de calibrar:** ligar a MESMA demanda liquida na tabela de consumo da PROPRIA bomba de calor
   (hoje usa hora fixa `horasFuncionamentoDia` × qtotal/COP em `computeMonthlyConsumption` — 1 flag; muda custo de
   TODOS os orcamentos, por isso espera validacao).

## 2. Tubulacao — circuito FECHADO + inercia (v1.13.14/17)

> ⚠️ **"Circuito FECHADO" aqui = ALTURA MANOMETRICA (sifao), NAO isolamento de agua.** O tubo volta pro
> mesmo nivel (a piscina), entao o desnivel nao soma na altura (a coluna que sobe equilibra a que desce).
> NAO eh malha selada: a bomba de calor passa a **PROPRIA AGUA DA PISCINA** pelo trocador (titanio) e
> devolve — ela **PUXA agua da piscina pela succao, inclusive pelos RALOS DE FUNDO**. Logo a recirc da
> bomba de calor **CONTA na demanda dos ralos** (NBR 10339 — apontar a linha dela no seletor do template
> de ralo). [Corrigido na sessao 226: eu havia lido "fechado" como "nao puxa do fundo" — ERRADO. So o
> ciclo do GAS refrigerante eh selado; o lado da AGUA eh aberto pra piscina.]

- `pipe-head-loss.service.ts` ganhou flag `closedLoop`. `trocador-budget.service` passa `closedLoop: true`.
- Operacao: o desnivel NAO soma na altura manometrica (sifao — a coluna que sobe eh equilibrada pela que desce).
  Mas a SELECAO usa `alturaSelecao = max(atrito, desnivel)` (frontend) pra a bomba **ROMPER A INERCIA** (encher a
  coluna pra COMECAR a circular). Aviso "⚠ nao rompe a inercia: X mca < desnivel Y m — nao circula".
- Diferente do Solar (circuito ABERTO, valvula ventosa — desnivel eh carga estatica continua).

## 3. Regra de selecao INDEPENDENTE (v1.13.16)

- Storage proprio: `Company.systemConfig.pool.trocadorBombaRule` (separado de `solarBombaRule`).
- Endpoints: `GET/POST /pool-budgets/heating/bomba-rule` (`solarBudget.get/setTrocadorBombaRule`).
- `listBombaCandidatesByFlow(companyId, vazao, altura, ruleKey, vazaoMax)` — `ruleKey='trocadorBombaRule'` no
  `trocador-bomba-candidates`. **Fallback:** trocadorBombaRule vazia → cai pra solarBombaRule (nao quebra).
- Front: ✨ no card "Bomba de circulacao recomendada" → abre `AutoSelectModal` (config propria). `ruleVersion`
  re-busca candidatos ao salvar. Modal renderizado na `BombaCalorTab`.

## 4. Templates (v1.13.17) — em `quotes/pool/[id]/page.tsx`

- **Regra** (`AUTOSELECT_TEMPLATES`): "🚰 Bomba de circulacao (Bomba de Calor) — vazao + altura/inercia".
  `where: vazaoM3h >= vazaoSolarM3h && pressaoTrabalhoMca >= alturaTelhadoMca` (a alturaTelhadoMca ja vem com
  inercia = max(atrito,desnivel) do frontend). `orderBy: vazaoM3h asc`.
- **Indicador** (`INDICATOR_TEMPLATES`): "Vazao dentro x fora da faixa (Bomba de Calor)". value = QUANTOS % esta
  FORA de [min,max]: `min(0,(vazaoM3h-vazaoSolarM3h)/max(vazaoSolarM3h,0.001)*100) + max(0,(vazaoM3h-vazaoMaxM3h)/max(vazaoMaxM3h,0.001)*100)`.
  Niveis: `<−0.001` Abaixo do minimo (red), `<=0` Dentro da faixa (emerald), `9999` Acima do maximo (orange).
- **Variaveis no contexto Trocador:** `vazaoSolarM3h` = vazao MIN × qtd (alvo), `vazaoMaxM3h` = vazao MAX × qtd,
  `alturaTelhadoMca` = altura com inercia. Backend `baseVars` em `listBombaCandidatesByFlow`. **vazaoMaxM3h eh VAR
  NOVA** — registrada em: backend baseVars + frontend `siblingVars` do modal (BombaCalorTab injeta vazaoSolarM3h/
  vazaoMaxM3h, senao o preview pegava a vazao da solar=0) + FORMULA allowed-vars list. (Ver
  [feedback_autoselect_vars_frontend_backend.md] — var nova precisa estar nos lugares certos.)

## 5. Outros

- **Card "Vazao de agua (min–max)"** (v1.13.16): KPI abaixo do Equivalente Btu na `BombaCalorTab`. `eq.vazaoMin/MaxM3h
  × quantity` (soma paralelo). Mostra "X – Y m³/h" ou "—" se nao cadastrada.
- **Restyle card equipamento** (v1.13.16): caixa verde (border-2 emerald) → SectionLabel "Bomba de calor selecionada"
  + dropdown ambar + card branco. Estetica do Solar.
- **Layout** (v1.13.15): card da recirc EMPILHADO (igual Solar) — "Tubulacao — perda de carga" + "Bomba de circulacao
  recomendada", nao mais grid 2-col.

## Arquivos
- Backend: `heating.service.ts` (demanda liquida + operatingHours), `heating-constants.ts` (POOL_SOLAR_GAIN),
  `pipe-head-loss.service.ts` (closedLoop), `trocador-budget.service.ts`, `solar-budget.service.ts`
  (get/setTrocadorBombaRule + listBombaCandidatesByFlow ruleKey/vazaoMax), `pool-budget.controller.ts` (endpoints).
- Frontend: `HeatingSimulatorModal.tsx` (TrocadorPumpPipeCard, BombaCalorTab, modal, card vazao, restyle),
  `quotes/pool/[id]/page.tsx` (AUTOSELECT_TEMPLATES + INDICATOR_TEMPLATES + vazaoMaxM3h allowed-var).

## Licao de build (RECORRENTE)
Gate local confiavel = `cd frontend && rm -rf .next && npm run build` (o `tsc` local da false-pass por `.next/dev/types`
stale). Ver [gotcha-tsc-incremental-false-pass.md]. Backend: `npx tsc --noEmit` eh confiavel.
