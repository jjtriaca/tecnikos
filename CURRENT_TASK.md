# TAREFA ATUAL

## ✅ DEPLOYED v1.13.12 (03/06) — cadastro bomba de calor BRAND-AGNOSTIC. Doc completa: [memory/cadastro_bomba_calor_brand_agnostic.md]
## - Auto-converter capacidade kcal/kW/BTU (toggle "🔗", default ON, desmarca pra editar individual) — `syncCapacity` em products/page.tsx.
## - Dicas "?" + placeholders apontando o datasheet (cap=secao 18 BTU/condicao/modo; COP="COP a 50% capacidade" Ar15/26; consumo="Potencia de entrada"; vazao="Fluxo de agua" 12~18).
## - DERIVA COP brand-agnostic no calculo de consumo (heating.service): quando NAO ha COP cadastrado, COP = capacidade kW ÷ consumo kW, clamp [2.5, 8]. FALLBACK — equip com COP nao muda (verificado: 40/5.7=7.0; com copAt50=7.5 usa 7.5). Achado: o campo "Consumo medio" era IGNORADO; agora e usado.
## - ✅ CONFIG APLICADO (SQL prod, tenant_sls.Company.systemConfig.pool.typeRequiredFields["Bomba de calor"] = ["kcalHNominal","ratedInputPowerKW"]). COP fica OPCIONAL (nunca foi required — o "✓" nos rotulos era DECORATIVO, texto fixo, nao obrigatoriedade). Antes "Bomba de calor" nao tinha NENHUM obrigatorio -> dava pra salvar bomba vazia (foi o caso do 32c). Agora exige capacidade + consumo.
## - ✅ AUDITORIA dados maquinas (prod): 6 Tholz X23 (09c/14c/18c/26c/32c/40c) COMPLETAS+CONSISTENTES (BTU=kW×3412, kcal=kW×860 batem; todas com tipoEquipamento=BOMBA_CALOR, vazaoMin/Max, consumo, copAt50Air15/26, copMax). 32c (PRD-00251) estava VAZIA -> preenchida. 3 nao-Tholz (Top+9 XLS-30997, Top+7 XLS-31015, Ultra 19 XLS-31453) seguem 100% VAZIAS (sem datasheet — usuario preenche; passarao a exigir cap+consumo no proximo save).
##
## Prod: v1.13.12 (alinhado local == prod). BUNDLE NO AR:
## - Cisterna master: mensagem distingue ABAIXO DO MINIMO (vermelho) de abaixo-do-recomendado-acima-do-min (ambar), mostra deficit; so o grave bloqueia.
## - Vento: HelpHint "?" + opcoes (editor + simulador) Fraco=abrigado/Moderado=parc.aberto/Forte=exposto. Validacao de campo Inacio Ruaro -> [memory/heating_dimensioning_field_validation.md].
## - BOMBA DE CIRCULACAO + TUBOS na aba Bomba de Calor (NOVO): porte do mecanismo solar. Vazao-alvo = bomba de calor selecionada `vazaoMinM3h × qtd`. Avisa se faltar vazao. Backend expos `vazaoMin/MaxM3h` no report.selectedEquipment; reusa endpoints `trocador-pipe/recompute` + `trocador-bomba-candidates` + a regra de bomba do Solar. `TrocadorPumpPipeCard`.
## 🟡 PENDENTE bomba de circulacao: (1) inputs do tubo NAO persistem (efemero — resetam ao reabrir); (2) VERIFICAR RUNTIME na prod (pool=sem preview — testar cadastrando vazao numa bomba de calor).
##
## v1.13.10 e anteriores TUDO NO AR.
## v1.13.10: EDITAR LINHA (icone ✎ abaixo do ✕ -> AddItemModal em modo EDICAO: nome/tipo/etapa) +
## MODELO preserva formulas (saveAsTemplate captura `kind`/`cellRef`/`autoSelectRule` [este era bug — nao salvava]; applyItemsSnapshot PRESERVA cellRef -> formulas entre linhas qty(LX)/prod(LX) seguem validas).
## ⚠️ Modelos salvos ANTES da v1.13.10 nao tem autoSelectRule/cellRef — RE-SALVAR pra capturar.
## ⚠️ DEPLOY: `tsc --noEmit` com cache incremental deu FALSE-PASS (onEdit nao desestruturado passou local, quebrou no build do servidor). Verificar pre-deploy com `tsc --noEmit --incremental false` (ou apagar .tsbuildinfo). 1o deploy v1.13.10 abortou no build (prod intacta), fix + redeploy OK.

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
- ✅ Conferido: 6 Tholz X23 vs datasheet (kcal/COP/vazao OK). Pendente ainda: remover painel debug violeta (aguardando Solis 7+ baterias); preencher 3 nao-Tholz vazias.
- Roadmap: vazao min/max -> bomba de circulacao por curva; defaults de tubulacao configuraveis.

## Sessoes anteriores
- Sessao 215 (v1.12.94-98): Aba Bomba de Calor (datasheet clone da Solar). Sessao 214 (v1.12.94): consumo bomba solar calibrado + PDF.
