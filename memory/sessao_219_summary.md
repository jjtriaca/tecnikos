---
name: sessao-219-summary
description: "Sessao 219 (12-16/06/2026) — Chunk C da auditoria AutoSelect (templates de tubo por DN do Simulador + picker LREF) + iteracoes no indicador/catalogo da recirc + auto-recalcular ao abrir o Aquecimento + gatilho 'ao salvar' (backend, v1.13.66 fecha o item A). v1.13.57 -> v1.13.66."
metadata:
  type: project
---

# Sessao 219 (12-16/06/2026) — Chunk C (auditoria AutoSelect) + recirc/auto-recalcular + gatilho ao salvar. v1.13.57 → v1.13.66

Fecha a auditoria AutoSelect/Formula do modulo Piscina (Chunks A+B feitos antes; C aqui) + varias iteracoes de teste do Juliano no ORCP-00001 (aba Bomba de Calor). Doc detalhada da frente: [[chunk_c_tube_dn_picker_lref]].

## Arco de versoes
- **v1.13.57 — Chunk C:** (1) templates de TUBO vinculadas ao DN do Simulador (`solarPipeDnMm`/`trocadorPipeDnMm`, le o DN do card "Tubulacao — perda de carga"); **env.trocadorPipe passou a PERSISTIR** (antes stateless; resolve pendencia v1.13.12 dos inputs efemeros). (2) **picker LREF** portado pro AutoSelectModal (templates "Tubo mesmo diametro" + "Grade NBR" ganharam seletor de linha; soma/max; trava de LREF cru ao salvar).
- **v1.13.58 (teste Juliano):** (1) catalogo da linha vinculada ao Simulador (useTrocadorBomba/useSolarBomba/useSolarCollector) mostra SO o produto do Simulador + Sem Produto (antes 167). (2) indicador "Vazao na faixa" na linha da recirc da bomba de calor (var-alvo `vazaoTrocadorMin/MaxM3h`).
- **v1.13.59:** indicador da recirc usa a **vazao de OPERACAO** (`trocadorBombaVazaoOperM3h`, persistida) em vez do nominal — bate com o card (bomba com curva opera != nominal). Layout do badge compactado (rotulos curtos).
- **v1.13.60:** "Recalcular" (Bomba de Calor) reseta a recirc pro OTIMO (tubo→auto, bomba→melhor, qtd→auto-N; 2→1 se uma atende). `pickBestBomba` extraido + `recircResetToken`.
- **v1.13.61:** **auto-recalcular ao ABRIR** o Aquecimento (Solar + Bomba de Calor) + **paridade do Recalcular do Solar** (Solar agora reseta igual; e o auto-default do Solar passou a PERSISTIR com manual=false — antes era so display, a linha useSolarBomba nao refletia).

## Decisoes do Juliano (travadas)
- Recalcular = **SEMPRE refazer pro otimo** (descarta ajuste manual). Auto-disparar ao ABRIR e ao SALVAR.
- Confirmado: o Solar JA tinha tubo/bomba/qtd; faltava resetar igual + persistir o auto-default.

## Item A FEITO — v1.13.66 (gatilho "AO SALVAR o orcamento", backend)
- **`pool-budget.service.redimensionarRecirc(budgetId, companyId)`** + `recalculateTotals(budgetId, {redimensionarRecirc})`. SO o `update()` (save do orcamento) passa a flag; edicao de linha/reorder/create NAO disparam. Roda apos o heatingReport fresco e ANTES do PASS 0, com re-leitura do budget (linha useSolarBomba/useTrocadorBomba vincula no mesmo recalc). Injeta SolarBudgetService+TrocadorBudgetService (DI aciclico).
- **Solar:** `computeAndSaveReport` (sem overrides = re-le ajustes persistidos + re-sincroniza tubo DN-auto). ⚠️ GOTCHA: o recompute substitui `solarReport` pelo output do `simulate()`, que NAO carrega `selectedBombaId/qty/manual` → DROPA a bomba escolhida → re-escolho a otima + re-gravo SEMPRE (`setSelectedBomba(manual=false)`); sem candidata = RESTAURA a anterior (save nunca desvincula a linha). **Trocador:** comp/desnivel preservados (env.trocadorPipe.inputs → default tenant → 30/4) → `computeTrocadorPipe` (DN auto) → `alturaSelecao=max(atrito,desnivel)` → `listBombaCandidatesByFlow('trocadorBombaRule', maxParalelo=6)` → pickBest (= front) → grava so se mudou (computeTrocadorPipe faz MERGE, preserva trocadorBombaId).
- **Decisao:** "sempre refazer pro otimo, descarta ajuste manual" nos DOIS (igual ao "abrir"). Seguro: congelado nem chega (early-return); try/catch por ramo + no caller (nunca quebra o save); determinista (idempotente). Custo: save dimensional recomputa o relatorio solar + 1 write da bomba (valor estavel) — aceitavel.

## Tambem nesta sessao
- **v1.13.63 — Solar tubo auto nao subdimensiona:** alvo de velocidade do tubo solar baixado 2,5→1,5 m/s (`pickOptimalDiameter`, configuravel `pipeDefaults.solarMaxVelocidadeMs`) -> escolhe tubo maior -> menos pressao -> bomba do catalogo atende. + re-sync do pipe preserva "auto" (nao vira MANUAL forcando o DN persistido). + frontend `handleSolarRecalcular` faz `await recomputePipe(null)` antes do recompute (acaba a corrida). Validado: 32mm MANUAL/sem bomba -> 40mm AUTO/bomba escolhida.
- **v1.13.64 — comp/desnivel = default configuravel:** icone 💾 nos 2 cards salva comprimento/desnivel como padrao do tenant (`pipeDefaults.{solar,trocador}{ComprimentoM,DesnivelM}`); pre-preenche orcamento novo. Endpoints `GET/POST /pool-budgets/pipe-dim-defaults`.
- **v1.13.65 — conexoes = default configuravel POR CONTEXTO:** icone ⚙ (componente `PipeConnDefaultsButton`) nos 2 cards -> popover material/fator/joelhos/tes/registros/valvulas, SEPARADO solar×trocador (valvula default solar=1, trocador=0). Backend: getPipeDimDefaults retorna conexoes por contexto (fallback key legada flat -> hardcoded); os 2 calculos de tubo leem `tenantDefaults.{ctx}{Campo}`. setPipeDimDefault = merge parcial.
- **v1.13.62 — OS nao aprovada edita valor/horas:** `service-order.service.ts` bloqueava campos de atribuicao em OS terminal (CONCLUIDA/APROVADA) por PRESENCA (`requiredSpecializationIds`/`directedTechnicianIds` `!== undefined`) — o form de edicao manda esses campos inalterados, entao editar so valor/horas de uma OS concluida (nao aprovada) quebrava com ForbiddenException. Fix: helper `sameIds` (compara arrays ignorando ordem); os 2 checks agora so disparam em MUDANCA real (igual `techAssignmentMode`/`workflowTemplateId`). Conteudo (valor/horas/itens/endereco) editavel; trocar atribuicao em OS terminal segue bloqueado. Confirmado pelo Juliano em prod. (Se quiser trocar especializacao/tecnico em OS nao aprovada tb = tirar CONCLUIDA do lock, nao pedido.)

## Relacionado
[[chunk_c_tube_dn_picker_lref]] · [[bomba_recirculacao_calor]] · [[heating_simulator_line_bond]] · [[pool_pump_ponto_operacao]] · [[feedback_autoselect_vars_frontend_backend]]
