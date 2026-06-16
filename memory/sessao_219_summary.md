---
name: sessao-219-summary
description: "Sessao 219 (12-16/06/2026) — Chunk C da auditoria AutoSelect (templates de tubo por DN do Simulador + picker LREF) + iteracoes no indicador/catalogo da recirc + auto-recalcular ao abrir o Aquecimento + gatilho 'ao salvar' (backend, v1.13.66 item A) + fix bomba solar nao aparecia ao abrir (CAUSA REAL: maxParalelo derrubava o teto da regra solar, v1.13.68; v1.13.67 altura+nonce nao era a causa). v1.13.57 -> v1.13.68."
metadata:
  type: project
---

# Sessao 219 (12-16/06/2026) — Chunk C (auditoria AutoSelect) + recirc/auto-recalcular + gatilho ao salvar + fix maxParalelo (bomba solar). v1.13.57 → v1.13.68

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

## v1.13.67 — bomba SOLAR nao aparecia AO ABRIR (so no Recalcular). Causa: altura do campo LEGADO defasada
- **Sintoma (ORCP-00001):** abrir o Solar mostrava "Nenhuma bomba atende (vazao ≥ 3.39 + pressao ≥ 8.16)"; clicar Recalcular achava. Banco: vazao 3.39 + tubo 40mm/8.16 OK, mas `solarReport.selectedBombaId=NULL`.
- **CAUSA RAIZ (gotcha reusavel):** `listSolarBombaCandidates` lia a altura de `env.alturaTelhadoM` (campo LEGADO, retrocompat) que DIVERGIU de `env.solarPipe.result.alturaManometricaTotal` (a real/display=8.16). A legada estava mais alta (estado anterior) → where `pressaoTrabalhoMca >= alturaTelhadoMca` reprovava TODAS → lista vazia. Recalcular re-sincronizava a legada (via computeAndSavePipe) → achava. As 2 chaves de altura saem juntas do computeAndSavePipe, mas podem divergir quando um estado antigo so mexeu numa.
- **Fix #1 (backend):** `listSolarBombaCandidates` le `env.solarPipe.result.alturaManometricaTotal` (fonte de verdade) → fallback `alturaTelhadoM` → 0. Conserta todos os callers. v1.13.66 (redimensao no save) ja era consistente (recomputa o tubo antes), mas tambem passa a ler a fonte certa.
- **Fix #2 (frontend):** `solarRecalcNonce` (bumpado ao FINAL do `handleSolarRecalcular`, manual+auto-ao-abrir) forca o useEffect de candidatos a re-rodar com `solarResetPendingRef=true` → GRAVA a bomba otima na linha mesmo quando vazao/altura nao mudaram (antes so mostrava no display; a linha useSolarBomba nao recebia). Trocador ja era robusto (endpoint `?altura=` + resetToken) — intocado.
- ⚠️ Padrao a vigiar: `env.alturaTelhadoM` e LEGADO; preferir SEMPRE `env.solarPipe.result.alturaManometricaTotal` pra altura do solar.
- ⚠️ NOTA: v1.13.67 NAO resolveu o "bomba nao aparece" (continuou vazio). A altura nao estava defasada — a causa real foi outra (v1.13.68 abaixo). v1.13.67 (altura autoritativa + nonce) sao melhorias validas, so nao eram a causa.

## v1.13.68 — CAUSA REAL: maxParalelo derrubava o TETO da regra solar (lista de bombas vazia)
- **Causa raiz (gotcha forte):** `listBombaCandidatesByFlow` fazia `vazaoFiltro = vazaoAlvo / maxParalelo` e usava como `vazaoSolarM3h` na regra. Regra SOLAR TEM TETO (`vazaoM3h <= vazaoSolarM3h*1.5`): com maxParalelo=6 e alvo 3.39, a janela virava **[0.40, 0.85] m³/h** → REJEITAVA toda bomba real (4–5 m³/h) → "nenhuma bomba atende" na abertura. Regra TROCADOR so tem PISO (`>= vazaoSolarM3h`) → dividir so AMPLIA a lista → nunca quebrou. Regressao entrou no v1.13.56 (paralelo no solar). Antes disso o solar usava maxParalelo=1 (janela cheia) e funcionava — por isso "Recalcular do passado achava".
- **Fix (backend, gated por `ruleKey`):** SOLAR tenta N=1 (alvo CHEIO) primeiro; so relaxa p/ paralelo (alvo/maxParalelo) se NINGUEM atende sozinha. TROCADOR inalterado (sempre relaxa = original). `maxParalelo=1` = identico. Indicador usa o regime do filtro. Vale tb pra redimensao do save (v1.13.66 chama o mesmo metodo).
- **LICAO:** dividir a vazao-alvo por N (p/ incluir bombas em paralelo) so e seguro quando a regra tem SO piso. Se a regra tem TETO, dividir derruba o teto e exclui as bombas que atendem sozinhas. Validar o efeito nos DOIS lados da janela (piso E teto).
- 🟡 Resultado: Syllent 1/3cv (4.66 m³/h @ 8.34 mca, shutoff 18) aparece, ~37% acima do alvo 3.39 (menor de alta-pressao do catalogo) — indicador pode marcar vermelho; funcional.

## Tambem nesta sessao
- **v1.13.63 — Solar tubo auto nao subdimensiona:** alvo de velocidade do tubo solar baixado 2,5→1,5 m/s (`pickOptimalDiameter`, configuravel `pipeDefaults.solarMaxVelocidadeMs`) -> escolhe tubo maior -> menos pressao -> bomba do catalogo atende. + re-sync do pipe preserva "auto" (nao vira MANUAL forcando o DN persistido). + frontend `handleSolarRecalcular` faz `await recomputePipe(null)` antes do recompute (acaba a corrida). Validado: 32mm MANUAL/sem bomba -> 40mm AUTO/bomba escolhida.
- **v1.13.64 — comp/desnivel = default configuravel:** icone 💾 nos 2 cards salva comprimento/desnivel como padrao do tenant (`pipeDefaults.{solar,trocador}{ComprimentoM,DesnivelM}`); pre-preenche orcamento novo. Endpoints `GET/POST /pool-budgets/pipe-dim-defaults`.
- **v1.13.65 — conexoes = default configuravel POR CONTEXTO:** icone ⚙ (componente `PipeConnDefaultsButton`) nos 2 cards -> popover material/fator/joelhos/tes/registros/valvulas, SEPARADO solar×trocador (valvula default solar=1, trocador=0). Backend: getPipeDimDefaults retorna conexoes por contexto (fallback key legada flat -> hardcoded); os 2 calculos de tubo leem `tenantDefaults.{ctx}{Campo}`. setPipeDimDefault = merge parcial.
- **v1.13.62 — OS nao aprovada edita valor/horas:** `service-order.service.ts` bloqueava campos de atribuicao em OS terminal (CONCLUIDA/APROVADA) por PRESENCA (`requiredSpecializationIds`/`directedTechnicianIds` `!== undefined`) — o form de edicao manda esses campos inalterados, entao editar so valor/horas de uma OS concluida (nao aprovada) quebrava com ForbiddenException. Fix: helper `sameIds` (compara arrays ignorando ordem); os 2 checks agora so disparam em MUDANCA real (igual `techAssignmentMode`/`workflowTemplateId`). Conteudo (valor/horas/itens/endereco) editavel; trocar atribuicao em OS terminal segue bloqueado. Confirmado pelo Juliano em prod. (Se quiser trocar especializacao/tecnico em OS nao aprovada tb = tirar CONCLUIDA do lock, nao pedido.)

## Relacionado
[[chunk_c_tube_dn_picker_lref]] · [[bomba_recirculacao_calor]] · [[heating_simulator_line_bond]] · [[pool_pump_ponto_operacao]] · [[feedback_autoselect_vars_frontend_backend]]
