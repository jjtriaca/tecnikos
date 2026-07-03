---
name: sessao_230_summary
description: Sessao 230 (02/07, v1.15.47→55) — padronizacao seletores de linha + auto-selecao (editar linhas) + refs orfas/trava de exclusao + fixes editor pilha/rodape.
metadata:
  type: project
---

# Sessao 230 (02/07/2026) — v1.15.47 → v1.15.55

Frentes: **padronizacao de seletores de linha**, **auto-selecao (editar linhas sem resetar)**, **refs orfas de linha excluida + trava de exclusao**, e um fix no **editor de layout (pilha/rodape)**. Tudo em tenant_sls (unico com modulo piscina). Local=prod=**v1.15.55**, git limpo.

## Seletores de linha — PADRONIZACAO (v1.15.48) + REGRA #11
- **`LineIdentity`** (componente) e **`lineOptionLabel`** (helper) em [components/pool/LineRefPicker.tsx] = FONTE UNICA do display de linha: **Nº (Lx) + ITEM (slotName) + DESCRICAO (produto/"Sem Produto")**. Antes cada tela mostrava so `Lx + descricao` → linha Sem Produto irreconhecivel (ex: "Blower", "Kit SPA Anatomico"). Modelo de dados: `slotName`=coluna ITEM, `description`=produto vinculado.
- Aplicados em: LineRefPicker (roxo), Lista dinamica (EngineReporter), "Outras linhas" da formula, `lineCore` (dropdown de condicao/candidato de imagem/texto). **Deletei a copia LOCAL duplicada do `LineRefPicker` no quotes/pool** (-124 linhas) → importa a compartilhada.
- **REGRA #11** nova no CLAUDE.md (busca/filtro/seletor reusa componente pronto) + [[feedback_reusar_filtros_prontos]].

## Editor de layout — pilha/rodape (v1.15.48)
- **Auto-save da branding (fix data-loss):** `setBranding` ([pool/print-layouts/[id]/page.tsx]) so persistia pelo botao "Salvar" manual → Rod./Cab./cores/tamanho/margem voltavam ao valor do servidor ao recarregar. Agora `scheduleBrandingSave` (debounced 700ms, le `layoutRef` no fire).
- **Reflow da pilha ao mudar Rod./Cab.:** `repaginateStack` lia fMm mas so rodava em arrastar/Espaco/duplicar → mudar rodape nao movia blocos (CASCATA nao subia pra folha 1 com Rod=12). `reflowStacks`/`reflowAndCommit` (so com breakA4 ligado) disparados nos campos Rod./Cab. e toggles Cab/Rodape. `repaginateStack` ganhou param `brandOverride`.

## Auto-selecao — editar linhas (v1.15.49/50/51)
- **v1.15.49:** reeditar template NAO zera mais as linhas escolhidas. `extractLineRefsFromExpr(expr, unit)` le as linhas ja gravadas no where/indExpr (regex do `unit` do template, backreference p/ multi-LREF) e PRE-SELECIONA. Botao "Aplicar regra" ja tinha `disabled={!isDirty}`.
- **v1.15.50:** botao **"✏️ Editar linhas da regra"** (topo do modal) edita SO as linhas via swap in-place em where+indExpr+indExpr2, sem resetar filtros/criterio/indicador. Helpers `buildLineRefReplacement` + `detectRuleLineRef`. `applyLineRefSelection` ramifica editar-vs-aplicar-template.
- **v1.15.51:** lapis **"✏️ linhas"** no campo Calculo do indicador (`detectLineRefIn` + memo `indicatorLineRefInUse`). Decisao: criterio (where) e indicador (indExpr) SEMPRE nas mesmas linhas (divergir = folga medir linha diferente) → os 2 botoes editam consistente.

## Refs orfas de linha excluida + TRAVA (v1.15.52→55) — ver [[bug-refs-orfas-linha-excluida]]
- **Bug:** excluir linha nao limpava `prod(Lx)/qty(Lx)` nas formulas das outras. `formula-eval.ts` lancava erro → PASSO 2 (`if(!target) return false`) NUNCA resolvia o dependente → **qty CONGELAVA** obsoleta (L101 travado em 19h; correto 14,5h). Auto-select ja resolvia 0 (somava linha morta escondida).
- **v1.15.52/53 (redes de seguranca):** `formula-eval.ts` ref faltante→`(0)`; PASSO 2 `if(!target) return true`.
- **v1.15.54 (TRAVA, decisao Juliano):** `removeItem` BLOQUEIA excluir linha ainda referenciada (lista quem usa; desligar via "Editar linhas" primeiro). Front bloqueia tb. **Descartado auto-scrub→0** (deixava residuo `+0*0`).
- **v1.15.55 (bulk-delete etapa + ISOLAMENTO):** excluir etapa era linha-a-linha engolindo o erro da trava → etapa meio-excluida. Agora `POST /items/bulk-delete` (`removeItems`) atomico; `findSurvivorsReferencing(budgetId, refs[], excludeIds[])` so bloqueia se linha de FORA do conjunto usa (refs internas somem juntas). **Isolamento entre orcamentos/modelos garantido:** trava filtra `where:{budgetId}`; modelo=itemsSnapshot JSON independente; duplicar deep-copia. So 2 vias de exclusao (removeItem+removeItems), ambas com trava.
- **Limpeza de dados (SQL prod, value-neutral):** varredura dos 9 orcamentos → ORCP-0001 (L96/97/98→L82/95/101) e ORCP-0006 (L9→L11) tinham orfaos. AMBOS limpos (dead ref→0 + remocao de residuo leading/trailing; Postgres ARE tem lookahead, nao lookbehind). Verificado nos 9: **0 orfaos + 0 residuo**. qty corrige no proximo open/edit (login prod tem CAPTCHA, nao da p/ recalc via API). **ATENCAO ORCP-0006:** L11 `qty(L9)+qty(L10)`→`qty(L10)`; L10 tem qty=0 → concretagem vira 0 no recalc (avisado; provavelmente L10 precisa de qty ao revisar).

## Pendencias herdadas (nao mexidas nesta sessao)
Editor EngineReporter: auto-crescer Alt.pag quando pilha paginada passa da altura; cascata multi-select; mini-modal nas outras listas planas; indicador como COLUNA da Lista dinamica; migracao legado consumoKgM2/pesoKg (PARQUEADA); NFS-e OBRA flat vs aninhada; repetidor/multiplicador do grupo (PARADO). Ver [[sessao_229_summary]].
