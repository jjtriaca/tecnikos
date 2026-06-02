---
name: sessao_217_summary
description: Sessao 217 (02/06/2026) — FASE 2 da Borda Infinita — religar evaporacao no aquecimento + volume dos reservatorios somado ao volume TOTAL da piscina (global). Code-complete local, aguardando deploy.
metadata:
  type: project
  date: 2026-06-02
---

# Sessao 217 (02/06/2026) — Borda Infinita FASE 2 (aquecimento + volume global)

Continuacao da [[sessao_216_summary]] (FASE 1 = dimensionar a borda). FASE 2 = **religar a borda no
Simulador de Aquecimento** + **somar o volume dos reservatorios ao volume TOTAL da piscina**.
Base v1.13.07. **CODE-COMPLETE local, type-clean (back+front), verificado numericamente — NAO deployado ainda.**

## DECISAO DE NEGOCIO (usuario escolheu)
"Volume total da piscina (afeta tudo)" — a agua dos reservatorios da borda (cisterna master + calhas)
soma no volume em TODO consumidor (aquecimento, solar, demanda termica, **fórmulas de linha que usam
`volume`**, base `POOL_VOLUME`). NAO so no aquecimento. Justificativa fisica: numa borda infinita o tanque
de compensacao faz parte do loop hidraulico — a agua dele tambem e tratada/aquecida.

## COMO FICOU (arquitetura)
- **`borda-infinita.service.ts`**: novo `heatingFeed` no report = { bordaTotalLengthM, alturaQuedaMediaM,
  vazaoMediaLminPorM, horasAtivaMediaDia (medias PONDERADAS POR COMPRIMENTO das N bordas),
  areaSuperficieAbertaM2, volumeTermicoExtraM3 }. Separei `areaFilmeExtraM2` vs `areaSuperficieAbertaExtraM2`
  nos totals. **FIX importante:** `masterVolumeM3` so conta se existe linha MASTER (antes somava o volume
  "recomendado" calculado da area mesmo sem borda = volume fantasma).
- **`heating.service.ts`**: novo input `bordaSuperficieAbertaM2` + termo de evaporacao de **agua parada**
  (mesma fisica da piscina, SEM capa, sem fator de filme/vazao, sempre ativa). O filme que cai continua no
  modelo escalar existente. Volume flui pelo `inputs.volumeM3` (ja somado). Report ganhou `bordaVolumeExtraM3`
  + `bordaSuperficieAbertaM2` (transparencia).
- **`heating-budget.service.ts`**: injeta BordaInfinitaService; `computeBordaHeatingFeed(dims)` le
  `poolDimensions.bordaInfinita[]` e roda o motor; `extractInputs` usa o feed (PRIORIDADE sobre o campo
  escalar legado `env.bordaInfinita*`) e faz `volumeM3 = basin + feed.volumeTermicoExtraM3`.
- **`pool-budget.service.ts`**: `enrichPoolDimensions(dims)` (try/catch — nunca derruba o save) calcula e
  GRAVA `poolDimensions.bordaVolumeExtraM3` no create + update. NAO altera `dims.volume` (geometrico).
- **Consumidores do volume somam o extra:** `formula-eval.extractDimensionVars` (var `volume`),
  `pool-formula.computeMetrics` (base POOL_VOLUME), `solar-budget` (volumeM3), `thermal-demand` (volumeM3).
- **Front:** simulador Bomba de Calor mostra volume TOTAL + legenda "inclui +X m³ da borda"; aba Solar usa
  total como base do override (senao o backend perde a borda ao receber o override do recalc); secao da borda
  com rotulos afirmativos; card do orcamento `[id]` mostra "(c/ borda infinita)".

## PROPRIEDADE DE SEGURANCA
Orcamentos antigos NAO tem linhas de borda (sistema multi-linha e novo, v1.13.x) -> `bordaVolumeExtraM3=0` ->
**zero impacto** em quotes existentes. Verificado: orcamento legado sem o campo = volume inalterado.
Sem dupla-contagem: aquecimento usa feed AO VIVO; demais usam o campo GRAVADO; ambos = basin + mesma borda
(mesmo motor, mesmas linhas).

## VERIFICACAO NUMERICA (ts-node, services puros)
- Cenario 8m borda / queda 30cm / reservatorio aberto 8×0,3 / cisterna master 3m³: volumeExtra=3,48 m³
  (0,48 reserv + 3,0 master), superficie aberta 2,4 m², filme 2,4 m². Demanda 29,6 -> 33,5 kW; tempo de
  aquecimento 16,05 -> 17,22 h (escala linear com volume). Sanity: sem borda -> tudo 0; borda sem master -> 0.
- Caminho financeiro: var `volume` 48 -> 51,48; `volume*2` 96 -> 102,96; POOL_VOLUME qty 72 -> 77,22;
  legado sem campo -> inalterado.

## CADASTRAR / EDITAR — congelar orcamento (mesma sessao)
Feature de ciclo de vida pedida pelo usuario "pra nao termos problemas com orcamentos com futuras
features" (ex: a propria FASE 2 mudando preco de orcamentos ja finalizados).
- **Campo:** `PoolBudget.frozenAt DateTime?` (+ `frozenByName String?`). Migration
  `20260602160000_add_pool_budget_frozen_at` (nullable -> TenantMigrator propaga no `onApplicationBootstrap`).
- **Cadastrar** (botao azul ao lado de Aprovar) -> `POST :id/register` seta frozenAt=now. CONGELA edicao +
  recalculo automatico (totais/qty/heating/solar) e LIBERA o PDF. **Editar** (botao ambar) -> `POST :id/unregister`
  limpa frozenAt. REVERSIVEL — diferente do lock PERMANENTE de status APROVADO/CANCELADO.
- **Enforcement backend:** `assertNotFrozen()` em update/addItem/updateItem/removeItem/updateSections/applyLinear
  (lanca BadRequest "clique Editar"). `recalculateTotals` early-return se frozen. heating-budget + solar-budget
  `computeAndSaveReport` devolvem o report CACHEADO se frozen (sem recomputar/salvar).
- **Status NAO bloqueado** (decisao do usuario): aprovar/rejeitar/cancelar seguem normais num orcamento cadastrado.
- **Front ([id]/page.tsx):** `isFrozen = !!budget.frozenAt`; `isEditLocked = isLocked || isFrozen` aplicado em
  TODAS as edicoes (dimensoes/validade/secoes/itens click-to-edit). Status buttons ficam em `isLocked` (aparecem
  quando frozen). Selo "🔒 Cadastrado". Botao "Imprimir PDF" DESABILITADO ("em breve" — PDF do orcamento ainda
  nao existe; e proxima frente). Editor (new?edit=) protegido pelo backend (save rejeita).
- **PDF do orcamento:** decidido DEFERIR (usuario escolheu "focar no congelar; PDF depois"). Hoje so o simulador
  imprime; nao ha render do orcamento -> proxima frente.

## DUPLICAR orcamento + reforco do congelamento (mesma sessao)
- **Botao ⧉ Duplicar** (sempre visivel, inclusive cadastrado/aprovado) -> popup: titulo `/N` editavel
  (`nextVersionTitle`: incrementa /2->/3; na 1a vez embute o codigo do original) + checkbox **Atualizar precos**
  (marcado = puxa salePriceCents/priceCents ATUAL do catalogo; desmarcado = mantem snapshot do original).
- **Backend** `duplicate(id, {title?, updatePrices})` + `POST :id/duplicate`. COPIA FIEL: mesmas
  dimensoes/etapas/linhas/qty — NAO re-roda auto-select/formula (so refresca preco unitario se updatePrices).
  Liga `parentBudgetId` (historico) + `version+1`. Copia nasce RASCUNHO descongelada. Totais recalculados direto
  (mesma formula do recalculateTotals, sem o passo de auto-select). Copia heatingReport + solarHeaderImage tambem.
- **Aviso ao Editar** um cadastrado: modal recomenda Duplicar (manter historico) com [⧉ Duplicar] [Cancelar]
  [Continuar]. "Continuar" -> unregister (descongela). Pedido explicito do usuario.
- **Reforco do congelamento (robusto p/ qualquer etapa/linha auto-select, atual ou NOVA):** alem de
  recalculateTotals + heating/solar computeAndSaveReport (cache se frozen), agora `selectEquipmentOverride`
  (heating) e `setSolarOverride` (solar) tambem lancam BadRequest se frozen. Como o freeze e no nivel do
  recalculateTotals (generico por etapa/linha), qualquer auto-select novo ja entra congelado automaticamente.

## Tambem nesta sessao
- **Fix decimais Area/Volume:** `BigHighlightInput` (HeatingSimulatorModal) arredonda exibicao a 2 casas
  (`Math.round(v*100)/100`) — sumiu o "57,52000000" / "59,2679". Valor preciso continua no calculo.

## PENDENTE
- 🔴 **DEPLOY das 3 frentes** (FASE 2 + Cadastrar + decimais) — usuario pede pra perguntar antes — ver [[feedback_perguntar_antes_deploy]].
- 🟡 **PDF do orcamento** (render + botao Imprimir) — proxima frente (Cadastrar ja libera o gatilho).
- 🟡 Placeholder `{poolVolume}` de layout de impressao CUSTOM ainda usa volume geometrico (nicho, opt-in).
- 🟡 Calculo-rapido (simulate) do aquecimento e o sandbox manual usam ainda o campo escalar antigo (hipotetico).
- 🟡 Auditoria responsividade mobile (pendencia system-wide herdada).
