---
name: chunk-c-tube-dn-picker-lref
description: "Chunk C (v1.13.57) — templates de TUBO vinculadas ao DN do Simulador (solarPipeDnMm/trocadorPipeDnMm) + porte do picker LREF pro AutoSelectModal. env.trocadorPipe agora persiste. Ler antes de mexer em auto-select de tubo, no card de tubulacao do trocador, ou nas templates LREF."
metadata:
  type: project
---

# Chunk C — Templates de tubo (DN do Simulador) + picker LREF (v1.13.57, 12/06/2026)

Fecha a auditoria do AutoSelect/Formula (Chunks A+B+C). Pedido do Juliano: "buscar o tubo em mm na pagina do aquecedor/solar/bomba de calor — ambos tubulacao perda de carga".

## Parte 1 — Tubo do orcamento vinculado ao DN calculado no Simulador
Padrao **var-formula line-bond** (Simulador dirige, linha reflete) — ver [[heating_simulator_line_bond]]. O card "Tubulacao — perda de carga" (Darcy) ja calcula o DN (mm); 2 templates novas escolhem o tubo do catalogo por esse DN:
- "🚿 Tubo da tubulacao Solar (DN do Simulador)" → `where: tuboEntradaMm >= solarPipeDnMm`
- "🚿 Tubo da tubulacao Bomba de Calor (DN do Simulador)" → `where: tuboEntradaMm >= trocadorPipeDnMm`
- Indicador = folga em mm (vermelho <DN, verde =DN, amarelo >DN). orderBy `tuboEntradaMm asc` (menor que cobre).

**Vars novas** `solarPipeDnMm` / `trocadorPipeDnMm`:
- Solar: `env.solarPipe.result.diametroDnMm` (ja persistia).
- Bomba de calor: `env.trocadorPipe.result.diametroDnMm` (**passou a persistir** nesta versao).
- Populadas nos **6 lugares** (regra [[feedback_autoselect_vars_frontend_backend]]): back `ALLOWED_VARS` + `extractEnvVars` (formula-eval.ts); front `FORMULA_VARS` + AutoSelectModal `dimVars` + FormulaModal `vars` + CatalogPickModal `ruleVars`.

## env.trocadorPipe agora PERSISTE (antes stateless — pendencia v1.13.12 resolvida)
- `computeTrocadorPipe(companyId, dto, budgetId?)` grava `env.trocadorPipe = {inputs, result}` (MERGE, espelha `SolarBudgetService` env.solarPipe) quando `budgetId` vem. Sem budgetId = stateless (retrocompat).
- Controller `recomputeTrocadorPipe` agora **async + recalcula** (`service.recalculateTotals(id)`) — igual o `solar-pipe/recompute` (L416). E o que faz a linha do tubo refletir o DN novo.
- Card `TrocadorPumpPipeCard` (HeatingSimulatorModal): prop `initialPipe` (= env.trocadorPipe) inicializa comprimento/desnivel/pipeResult (nao reseta mais a 30/4); auto-recompute no mount tambem dispara se a vazao salva diverge (troca de equipamento); `onChanged?.()` apos recompute (reflete ao fechar).
- recalculateTotals devolve cache se frozen → seguro em orcamento congelado.

## Parte 2 — Picker LREF portado pro AutoSelectModal (era so do FormulaModal)
- Templates "Tubo mesmo diametro" + "Grade de fundo NBR" tem `lineRef: { unit, combine }`. `unit` = sub-expressao com LREF (1 contribuicao de linha); aparece igual em where E indicator.
- Ao aplicar template com lineRef: abre seletor de linha(s) (estilo violeta, lista TODAS as linhas com cellRef = cross-etapa, mostra a spec detectada). Confirma → troca `unit` (substituicao literal, `s.split(unit).join(replacement)`) no where + indicator: 1 linha = `unit[Lx]`; varias = soma `(a + b)` (combine 'sum', Grade) ou `max(a, b)` (combine 'max', Tubo).
- **Trava ao salvar** (`handleSave`): bloqueia `LREF` cru no where/indicator (regex `/\bLREF\b/`) — LREF nao casa no `prod(L\d+)` do motor → rejeitaria todos os candidatos silenciosamente. Acabou editar LREF na mao.

## Gotcha — DN=0 (Simulador nao rodou)
`tuboEntradaMm >= 0` passa TODOS os tubos → orderBy pega o menor (indicador amarelo "maior que necessario"). Descricao das templates avisa pra dimensionar a tubulacao no Simulador antes. Nao e erro duro.

## Relacionado
[[heating_simulator_line_bond]] · [[feedback_autoselect_vars_frontend_backend]] · [[pool_pump_ponto_operacao]] · [[plano_recirc_quantidade]] (Chunk B) · [[pool_budget_rules]]
