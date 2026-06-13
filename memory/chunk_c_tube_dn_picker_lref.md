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

## Follow-up v1.13.58 (teste Juliano ORCP-00001) — catalogo da linha vinculada + indicador da recirc
- **Catalogo da linha DIRIGIDA pelo Simulador** (`useTrocadorBomba`/`useSolarBomba`/`useSolarCollector`): essas regras tem SO a flag (sem where/filterDescription) -> `hasRule=false` no CatalogPickModal -> nao filtrava nada (trazia o catalogo inteiro). Fix: `isSimulatorBound` + `boundProductId` (de `env.trocadorBombaId` / `solarReport.selectedBombaId` / `solarReport.selectedCollector.productId`) -> lista mostra SO o produto vinculado + Sem Produto (botao virtual). Banner "dirigida pelo Simulador, troque la". Pra trocar = no Simulador.
- **Indicador da linha da recirc**: o passo de indicador roda no READ (`findOne` ~L1455, NAO grava em DB), pra qualquer item com `rule.indicator`. As templates `useTrocadorBomba`/`useSolarBomba` NAO tinham indicador. Adicionado: bomba de calor = "Vazao na faixa" (dentro/fora de [min,max]); solar = folga vs `vazaoSolarM3h`.
- **Var nova `vazaoTrocadorMinM3h`/`vazaoTrocadorMaxM3h`** = `heatingReport.selectedEquipment.vazaoMin/Max × quantity`, em `extractHeatingVars` + ALLOWED_VARS + FORMULA_VARS + AutoSelectModal dimVars + FormulaModal vars (NAO no CatalogPickModal ruleVars — so usada em indicador, nunca em where). **Sem vazaoMax cadastrada = sentinel 999999** (sem teto; so penaliza abaixo do min). Preset INDICATOR "Vazao dentro x fora da faixa (Bomba de Calor)" corrigido (usava `vazaoSolarM3h`=0 no backend p/ bomba de calor).
- O indicador multiplica `vazaoM3h` (spec do produto) por `itemQty` (CUMULATIVE_SPECS) -> recirc N em paralelo = vazao total vs alvo. Var-alvo ja vem × qtd da bomba de calor (sem dupla mult: vars nao sao multiplicadas, so specs).
- ⚠ Linhas ja configuradas: RE-APLICAR a template da recirc pra ganhar o indicador novo.

## Follow-up v1.13.59 — indicador da recirc usa VAZAO DE OPERACAO (nao o nominal)
- **Bug:** o indicador "Vazao na faixa" da linha mostrava 120% "Acima" enquanto o card do Simulador mostrava 0% "Dentro da faixa". Causa: o indicador lia `vazaoM3h` NOMINAL do cadastro (~13 m³/h), mas a bomba tem CURVA -> o Simulador usa o PONTO DE OPERACAO (4.14 m³/h = curva × resistencia, v1.13.31 `pumpOperatingPoint`). So a BOMBA DE CALOR diverge (trocador usa ponto de operacao); o SOLAR usa altura estatica = nominal (indicador solar ficou intocado, correto).
- **Fix:** persiste `env.trocadorBombaVazaoOperM3h` = vazao de operacao TOTAL (`selB.vazaoM3h × qtd`, do endpoint de candidatos). `setSelectedTrocadorBomba(...,vazaoOperTotalM3h)` + controller body `vazaoOperM3h`. Card persiste no effect da bomba (chave inclui a vazao oper -> re-persiste quando o pipe muda; prop `initialVazaoOper` evita re-persist a toa). Backend SO atualiza quando vem valor>0 (nao zera em transiente de candidatos carregando); limpa so quando productId=null.
- Var `trocadorBombaVazaoOperM3h` em `extractEnvVars` + ALLOWED_VARS + FORMULA_VARS + dimVars + FormulaModal vars. Indicador `useTrocadorBomba` + preset INDICATOR trocaram `vazaoM3h` -> `trocadorBombaVazaoOperM3h`.
- **Layout:** badge era `flex-wrap` e o texto longo ("Vazao na faixa (Bomba de Calor)" + "ACIMA DO MAXIMO") quebrava em varias linhas. Encurtado: label "Vazao recirc" + niveis "Abaixo"/"Na faixa"/"Acima" -> 1 linha (igual L44).
- Bomba SEM curva: endpoint retorna nominal como vazaoM3h -> operTotal = nominal × N (correto). Orcamento antigo (sem oper persistida): indicador fica "Abaixo" ate reabrir o Simulador 1× (persiste).

## Follow-up v1.13.60 — "Recalcular" reseta a recirc pro otimo (tubo+bomba+qtd)
- **Pedido:** trocar tubo pra 32mm + bomba aleatoria + qtd 2 e clicar "Recalcular" nao mudava nada. Deve voltar pro otimo (tubo auto + melhor bomba + auto-N); qtd 2 -> 1 se uma bomba unica atende.
- **Causa:** "Recalcular" (`onRecompute`) so recomputava o RELATORIO; tubo/bomba/qtd vivem no estado do `TrocadorPumpPipeCard`, intocados.
- **Fix:** botao "Recalcular" (BombaCalorTab) incrementa `recircResetToken` -> passado ao card -> useEffect reseta: `recompute(null)` (tubo DN auto-pick) + `pickBestBomba(candidates)` (melhor bomba + auto-N). `pickBestBomba` extraido (era inline no auto-default da useEffect de candidatos): menor que atende SOZINHA (N=1); senao a MAIOR; auto-N=teto(vazaoAlvo/vazaoBomba) [1,6]. `lastResetTokenRef` pula o mount inicial (token 0). Frontend-only.

## Gotcha — DN=0 (Simulador nao rodou)
`tuboEntradaMm >= 0` passa TODOS os tubos → orderBy pega o menor (indicador amarelo "maior que necessario"). Descricao das templates avisa pra dimensionar a tubulacao no Simulador antes. Nao e erro duro.

## Relacionado
[[heating_simulator_line_bond]] · [[feedback_autoselect_vars_frontend_backend]] · [[pool_pump_ponto_operacao]] · [[plano_recirc_quantidade]] (Chunk B) · [[pool_budget_rules]]
