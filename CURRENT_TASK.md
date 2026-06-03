# TAREFA ATUAL

## Prod: v1.13.09. PENDENTE DEPLOY v1.13.10 (2 itens, type-clean):
## NO AR (v1.13.09): FASE 2 Borda · Cadastrar/Editar · Duplicar · fix decimais · env-merge · largura canaleta · card calorias.
## 🔴 PENDENTE v1.13.10:
## - EDITAR LINHA: icone ✎ abaixo do ✕ na linha -> abre AddItemModal em modo EDICAO (nome/tipo Produto-Servico/etapa). Backend updateItem ja aceitava poolSection/kind/slotName.
## - MODELO preserva formulas: saveAsTemplate agora captura `kind`, `cellRef`, `autoSelectRule` (este NAO era salvo — bug). applyItemsSnapshot PRESERVA o cellRef original (formulas entre linhas qty(LX)/total(LX)/prod(LX) continuam validas no novo orcamento).

## (3) DUPLICAR ORCAMENTO (NOVO, sessao 217)
- Botao **⧉ Duplicar** (sempre visivel, inclusive cadastrado/aprovado). Endpoint `POST :id/duplicate {title?, updatePrices?}`.
- Popup: titulo pre-preenchido `/N` editavel (incrementa /2->/3; embute codigo na 1a vez) + checkbox **Atualizar precos** (marcado=puxa catalogo atual; desmarcado=mantem snapshot).
- COPIA FIEL: mesmas dimensoes/etapas/linhas/qty (NAO re-roda auto-select/formula). Liga via `parentBudgetId` (historico). Copia nasce RASCUNHO descongelada. Totais recalculados direto.
- **Aviso ao Editar** um cadastrado: modal recomenda Duplicar (manter historico); aceita em "Continuar" (descongela).
- **Congelamento robusto:** recalculateTotals + heating/solar computeAndSaveReport + selectEquipmentOverride + setSolarOverride TODOS travados quando frozen -> cobre qualquer etapa/linha de auto-select (atual ou nova).

## (2) CADASTRAR/EDITAR — congelar orcamento (NOVO, sessao 217)
- Campo `PoolBudget.frozenAt` (+ `frozenByName`). Migration `20260602160000_add_pool_budget_frozen_at` (nullable, TenantMigrator propaga no boot).
- Botao **Cadastrar** (ao lado de Aprovar) -> congela EDICAO + recalculo automatico (totais/qty/heating/solar) + libera PDF. **Editar** descongela. Reversivel (≠ lock permanente APROVADO).
- Backend: endpoints `POST :id/register` / `:id/unregister`; guard `assertNotFrozen` em update/addItem/updateItem/removeItem/updateSections/applyLinear; recalculateTotals + heating/solar computeAndSaveReport devolvem cache se frozen. Status (aprovar/rejeitar/cancelar) NAO bloqueado (decisao usuario).
- Front: `isEditLocked = isLocked || isFrozen` nas edicoes; selo "🔒 Cadastrado"; botao Imprimir PDF **desabilitado** ("em breve" — PDF do orcamento = proxima frente).
- Motivo: proteger orcamentos finalizados de mudancas FUTURAS de feature/calculo (ex: a propria FASE 2).

## ULTIMA FRENTE (sessao 216, 01-02/06): SISTEMA DE BORDA INFINITA — FASE 1 NO AR + Central de Avisos
**Resumo completo:** [memory/sessao_216_summary.md](memory/sessao_216_summary.md)
**Plano:** [memory/plano_sistema_borda_infinita.md](memory/plano_sistema_borda_infinita.md) · **Estudos:** reservatorio + tubulacao gravidade (Manning / ralos / surge).
- ✅ Backend: `gravity-flow` / `reservoir-volume` / `borda-infinita.service` + endpoint `POST /pool-budgets/borda-infinita/simulate` (tudo VERIFICADO numericamente).
- ✅ Frontend: `BordaInfinitaSection.tsx` (secao inline estilo Excel, dropdowns, "?", cisterna pronta+volume, surge, ralos, multitubo, altura em CM, tubo ✓suficiente/folgado/⚠insuficiente) + `CentralAvisos.tsx` (painel de avisos no topo+rodape, confirma no salvar se ha erro).
- ✅ Deployed v1.12.99 -> v1.13.07. Storage: `poolDimensions.bordaInfinita[]` (JSON livre, sem model Prisma).

## FASE 2 — FEITA (local, aguardando deploy) — ver [memory/sessao_217_summary.md](memory/sessao_217_summary.md)
- ✅ **Evaporacao religada:** lamina(s) da borda (medias ponderadas) + superficies abertas (agua parada, sem capa) voltam a contar no aquecimento. `heatingFeed` no BordaInfinitaService.
- ✅ **Volume TOTAL (global, decisao do usuario):** agua dos reservatorios soma no volume da piscina em TODO consumidor — aquecimento, solar, demanda termica, fórmulas de linha (`volume`), base `POOL_VOLUME`. Via `poolDimensions.bordaVolumeExtraM3` gravado no salvar (pool-budget.service `enrichPoolDimensions`).
- ✅ Sistema multi-linha tem prioridade sobre o campo escalar legado. Orcamentos SEM borda: extra=0, **zero impacto**.
- ✅ Front: simulador Bomba de Calor mostra volume total + quebra; aba Solar usa total no override; card do orcamento mostra "(c/ borda infinita)".
- 🟡 Follow-up opcional: placeholder `{poolVolume}` de layout de impressao CUSTOM ainda usa volume geometrico (nicho).

## PENDENCIA SYSTEM-WIDE
- 🟡 Auditoria de responsividade MOBILE de TODO o sistema (regra ja no CLAUDE.md "Responsividade / Mobile"; spawn task criado).

## Outros pendentes (menores)
- Central de Avisos: levar pra outros cadastros + expandir regras de faixa por campo.
- Conferir valores Tholz JA cadastrados no SLS vs datasheet (kcal/h/COP/vazao). Remover painel debug violeta (aguardando Solis 7+ baterias).
- Roadmap: vazao min/max -> bomba de circulacao por curva; defaults de tubulacao configuraveis.

## Sessoes anteriores
- Sessao 215 (v1.12.94-98): Aba Bomba de Calor (datasheet clone da Solar). Sessao 214 (v1.12.94): consumo bomba solar calibrado + PDF.
