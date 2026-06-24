---
name: sessao_225_summary
description: Sessao 225 (24/06/2026, v1.14.02→v1.14.06, 5 deploys) — modulo PISCINA. Investigacao "a formula nao conta a quantidade" (ORCP-00009) revelou 3 CAUSAS DISTINTAS (auto-select reseta qty / produto sem tempoMontagemH cadastrado / linha sem produto vinculado). Fixes: auto-select preserva qty (mesmo produto), botao Salvar trava sem alteracao (padrao system-wide), indicador "⚠ sem vinculo" em linhas orfas, e o SELETOR DE LINHAS COMPARTILHADO (LineRefPicker: agrupado por etapa/colapsado/filtrado por tipo/coluna ITEM) nos 2 montadores + reativado em Quadro/Fonte/Disjuntor + preset de indicador do Ralo de fundo.
metadata:
  type: project
---

# Sessao 225 (24/06/2026) — v1.14.02 → v1.14.06 (5 deploys)

Sessao inteira no **modulo Piscina**. Comecou com Juliano reportando "a formula nao conta a quantidade" no ORCP-00009 (etapa ACIONAMENTOS, linha "Servico de Eletrotecnica" com `sum("tempoMontagemH","@ACIONAMENTOS")`). A investigacao (SQL prod via SSH+psql, tenant_sls) revelou que NAO era 1 bug — eram **3 causas distintas**, e a multiplicacao em si funciona (a soma batia ao centavo). Dai saiu uma reforma do seletor de linhas. Tudo commitado+pushado.

## As 3 causas do "nao conta a quantidade" (diagnostico)
1. **Auto-select Fase B reseta a qty** — Fonte/Quadro tem `where` com `prod(LX)` → caem em Fase B (`forceReapply`) → re-selecionam o produto a CADA recalc e (sem formula) resetam a qty pro `defaultQty=1` (`processItem`). O "6" que o operador digitava voltava pra 1 sozinho. Como tudo estava em qty=1, multiplicar dava o mesmo que nao multiplicar → efeito invisivel. **Fix v1.14.02.**
2. **Produto sem `tempoMontagemH` cadastrado** — o Kit Aterramento (XLS-106) tinha o campo NULL quando diagnostiquei (18:41); Juliano cadastrou 1h depois (updatedAt 19:06 provou). Sem tempo = 0×qty = nao conta. **Dado, nao bug.** Mudar o cadastro NAO recalcula orcamentos abertos (so apos editar 1 linha).
3. **Linha sem produto vinculado** — L100 (Kit) mostrava nome+preco mas `productId=NULL` (orfa). Sem produto, `sum()` nao tem de onde ler o spec. Varredura: **~56 linhas orfas** no ORCP-00009 (BORDA_CALCADA 14/14, CASCATA 11/13, etc.; CONSTRUCAO 0). Vem do modelo (sistema parou de auto-vincular por descricao na v1.12.20). **Fix v1.14.03** (indicador visivel).

## Deploys
- **v1.14.02 — Auto-select preserva qty + botao Salvar trava sem alteracao.** (1) `processItem` so reseta pro `defaultQty` quando o produto REALMENTE muda (`productUnchanged = target.id===it.productId`); reescolhendo o MESMO produto vinculado, PRESERVA a qty do operador. Tubos (com formula) nao entram (REGRA #5). (2) Cadastro de Produtos: botao Salvar `disabled={saving || !isFormDirty}` (snapshot `pristineForm` ao abrir). **Gravado na CLAUDE.md** secao nova "Botoes de Salvar/Submit em Cadastros e Forms (System-Wide)".
- **v1.14.03 — Indicador "⚠ sem vinculo" em linhas orfas.** `isUnlinked = !productId && !serviceId && description && desc∉{Sem Produto,Sem Servico}` → nome em ambar + badge vermelho "⚠ sem vinculo"; clicar abre o catalogo. Resolve o "engano" (linha parecia vinculada). Pedido Juliano ("se nao tiver vinculado tem que aparecer sem produto / mostra erro na linha").
- **v1.14.04 — Seletor de linhas COMPARTILHADO (`LineRefPicker`).** 1 componente usado no AutoSelectModal (regra+indicador) E no FormulaModal (recipes needsLineRef): agrupa por etapa (colapsado), filtra por tipo, mostra **slotName (coluna ITEM)** + descricao + badge da spec + ×qty. **Quadro/Fonte** ganharam `lineRef` de volta (REVERTE v1.13.80 — agora o picker e organizado); **Disjuntor geral** convertido de `sum("amperagem")` pra `prod(LREF,...)*qtdLinha × 1.25` + lineRef (decisao Juliano: passar pro seletor). Detalhe em [[pool_budget_rules]] secao 9.
- **v1.14.05 — Fixes do seletor.** (1) Mostra linhas **Sem Produto** (filtro so por tipo, nao por vinculo — operador aponta a regra antes de vincular; reconhece pela coluna ITEM). (2) Etapas na **ordem do MODELO** (`sectionOrder` do budget, propagado page→ItemRow→modais→picker) — custom (AQUECEDOR SOLAR) na posicao certa, nao no fim.
- **v1.14.06 — Preset de indicador do Ralo + Quadro/Fonte reconectados.** Novo `INDICATOR_TEMPLATES` "Folga de vazao (Ralo de fundo)" com lineRef; + os presets de indicador Quadro/Fonte (que ainda eram "edite as linhas"/manuais) reconectados ao seletor.

## Licoes / gotchas desta sessao
- **"Nao conta a quantidade" pode ter multiplas causas** — nao assumir 1 bug. A multiplicacao do `sum()` funciona; o que falha e o redor (qty resetada / dado faltando / linha nao vinculada). Diagnostico autoritativo = SQL na prod (login bloqueia por CAPTCHA; usar SSH+psql tenant_sls).
- **Linha orfa (nome+preco, sem productId/serviceId)** e uma armadilha: funciona pro preco mas NAO pra formulas que leem spec de produto. Indicador "⚠ sem vinculo" agora sinaliza. Sistema nao auto-vincula por descricao (removido v1.12.20, de proposito).
- **`LineRefPicker`** e o novo componente compartilhado pros 2 montadores — qualquer melhoria de seletor de linha vai nele (nao duplicar).
- Reverter uma decisao do usuario (picker do Quadro/Fonte, rejeitado em v1.13.80) e OK quando ele pede de novo COM a melhoria que resolvia a rejeicao (lista plana → agrupada/colapsada).

## Estado / pendencias
- 🔜 Refino do "⚠ sem vinculo" nas linhas manuais legitimas (Pedagio/Frete/Deslocamento da etapa EXECUCAO) se incomodar (Juliano OK em deixar por ora).
- 🔜 Herdadas da sessao 224 (financeiro): migrar Conciliacao pro `CategorySelect`; validar em prod cartao-lote / repasse-devolucao de cheque / pagamento parcial (aguardam caso real).
- ⚠️ Modulo Piscina nao tem preview — validacao visual e na prod (Juliano testa). Toda a sessao foi deploy direto.
