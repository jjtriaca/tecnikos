---
name: plano-recirc-quantidade
description: "PLANO Chunk B — quantidade de bombas de recirculacao (N em paralelo) solar + bomba de calor. Modelo SIMPLES N=teto(vazaoAlvo/vazaoBomba) escolhido pelo Juliano. Passos exatos pra implementar (backend + frontend). Ler ANTES de executar."
metadata:
  type: project
---

# Plano: Quantidade das bombas de recirculacao (N em paralelo) — Chunk B da auditoria (definido 11/06)

> ✅ **IMPLEMENTADO + DEPLOYED v1.13.55 (bomba de calor) + v1.13.56 (solar).** Todos os passos abaixo executados, EXCETO: o `maxParalelo` relaxa o filtro mexendo so em `vazaoSolarM3h` (altura/K reais) — o indicador do backend fica relativo ao filtro relaxado (otimista), e o FRONT mostra o N real + "vazao total >= alvo" como autoridade. Solar: default NAO persiste (operador clica pra ativar). Plano original abaixo (referencia).

**Pedido (Juliano):** colocar a QUANTIDADE de bombas de recirculacao na **solar** E na **bomba de calor** — se nenhuma bomba atende a vazao necessaria SOZINHA, **multiplicar** (N em paralelo). As templates de FORMULA tem que buscar a quantidade tambem.

**Decisao travada (Juliano):** modelo SIMPLES — **N = teto(vazaoAlvo / vazaoBomba)**, clamp >= 1 (e um teto, ex 6). NAO usar fisica de bombas-em-paralelo (head-sharing) — so divisao de vazao. O operador pode ajustar o N.

## Estado atual (ja em prod, v1.13.52+)
- Recirc SOLAR: persiste `solarReport.selectedBombaId` (`setSelectedBomba`). Linha vincula via template `useSolarBomba`.
- Recirc CALOR: persiste `env.trocadorBombaId` (`setSelectedTrocadorBomba`). Linha vincula via `useTrocadorBomba`. Card = `TrocadorPumpPipeCard` (HeatingSimulatorModal).
- Candidatos: `solar-budget.service.listBombaCandidatesByFlow(companyId, vazaoAlvoM3h, alturaMca, ruleKey, vazaoMaxAlvoM3h)` — filtra `vazaoM3h >= vazaoSolarM3h` (=vazaoAlvo) via `filterByWhere`. **So retorna bombas que atendem SOZINHAS** -> lista vazia quando nenhuma atende. baseVars (L784): `{ vazaoSolarM3h: vazaoAlvo, vazaoMaxM3h, alturaTelhadoMca, frictionKResist }`.
- Fórmula da BOMBA DE CALOR ja usa esse padrao: `bombaCalorQty` (extractHeatingVars le `heatingReport.selectedEquipment.quantity`). ESPELHAR pra recirc.

## PASSOS (backend)

1. **Relaxar candidatos pra N paralelo** — `listBombaCandidatesByFlow` ganha param `maxParalelo = 1`:
   - `const vazaoFiltro = vazaoAlvoM3h / Math.max(1, maxParalelo);`
   - baseVars usa `vazaoSolarM3h: vazaoFiltro` (relaxa o where -> bombas com vazao efetiva >= vazaoAlvo/maxParalelo passam). MANTER `alturaTelhadoMca` e `frictionKResist` no valor REAL (pressao/ponto de operacao nao mudam).
   - `maxParalelo=1` (default) = comportamento ATUAL inalterado. So os cards de recirc passam 6. RISCO CONTIDO.
   - ⚠ indicador (folga) fica relativo a vazaoFiltro (otimista) — o FRONTEND recomputa N + folga real pra exibir.
   - Controller `trocador-bomba-candidates` (+ o do solar) ganha `?maxParalelo=`.

2. **Persistir a quantidade** (espelha o productId):
   - `setSelectedTrocadorBomba(budgetId, companyId, productId, qty)` -> grava `env.trocadorBombaQty` (default 1; delete quando productId=null). Controller `trocador-bomba-selection` body += `qty`.
   - `setSelectedBomba(...)` (solar) -> grava `solarReport.selectedBombaQty`. Controller `solar-bomba-selection` body += `qty`.

3. **Vars de formula** (formula-eval.ts):
   - `extractEnvVars` (le environmentParams): expor `trocadorBombaQty = Number(env.trocadorBombaQty) || 1`.
   - `extractSolarVars` (le solarReport): expor `solarBombaQty = Number(solarReport.selectedBombaQty) || 1`.
   - Adicionar ambos ao ALLOWED_VARS/FORMULA_VARS do backend.

## PASSOS (frontend)

4. **FORMULA_VARS** (page.tsx) += `trocadorBombaQty`, `solarBombaQty`.

5. **Receitas de formula** (FORMULA_RECIPES_PISCINA): 2 novas —
   - "🌀 Quantidade da bomba de recirculacao da Bomba de Calor (do Simulador)" -> expr `trocadorBombaQty`.
   - "🚰 Quantidade da bomba de recirculacao Solar (do Simulador)" -> expr `solarBombaQty`.

6. **Card TrocadorPumpPipeCard** (HeatingSimulatorModal, ja persiste selBombaId):
   - Passar `&maxParalelo=6` no fetch de `trocador-bomba-candidates`.
   - `const N = Math.max(1, Math.min(6, Math.ceil(vazaoAlvo / (selBomba.vazaoM3h || vazaoAlvo))))` — AUTO. Estado `selBombaQty` inicia do persistido (`initialBombaQty` via prop, de `env.trocadorBombaQty`) OU do auto-N quando muda a bomba.
   - UI: input "Quant." (estilo `EquipmentQuantityInput`) + chip "N× em paralelo" quando N>1 + linha "Vazao total: vazaoBomba×N = X m³/h (>= alvo Y)" verde/vermelho.
   - Persistir `selBombaQty` junto com selBombaId (endpoint `trocador-bomba-selection` body `{productId, qty}`) + `onPendingSave`.

7. **Card recirc SOLAR** (SolarTab, handleSelectBomba): mesmo — maxParalelo=6, auto-N, input Quant., persistir `qty` em `solar-bomba-selection`, chip N×.

## Como a linha do orcamento usa
- Operador aplica na linha da recirc: template auto-select **`useSolarBomba`/`useTrocadorBomba`** (produto) + receita de formula **`solarBombaQty`/`trocadorBombaQty`** (quantidade). Igual bomba de calor (useHeatingEquipment via override + `bombaCalorQty`).

## Teste (pool = sem preview, deploy direto)
- ORCP com vazao-alvo > maior bomba -> card mostra bomba menor + "N× em paralelo" + vazao total >= alvo. Linha da recirc com as 2 regras -> qty = N, produto = a bomba.

## Relacionado
- [[bomba_recirculacao_calor]] (mecanismo da recirc do calor), [[heating_simulator_line_bond]] (padrao var-formula bombaCalorQty), [[pool_budget_rules]] (auto-select).
