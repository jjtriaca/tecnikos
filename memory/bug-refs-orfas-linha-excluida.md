---
name: bug-refs-orfas-linha-excluida
description: Excluir linha do orcamento piscina deixava refs orfas nas formulas de outras linhas → qty congelava + auto-select somava 0. Fix v1.15.52.
metadata:
  type: project
---

**Incidente (02/07/2026, v1.15.52):** ao excluir uma linha do orcamento de piscina, o sistema NAO limpava as referencias a ela (`prod(Lx,...)`, `qty(Lx)`, `total(Lx)`, `unitPrice(Lx)`) nas formulas das OUTRAS linhas. Resultado: refs orfas apontando pra cellRef que nao existe mais.

**Dois comportamentos (por avaliador):**
- **`formula-eval.ts`** (qty `formulaExpr`) LANCAVA `Error("Linha Lx nao existe")`. No recalc (`pool-budget.service.recalculateTotals`), PASSO 2 tinha `if (!target) return false` no `allDepsAvailable` → o item dependente NUNCA resolvia → **qty CONGELAVA** com valor obsoleto (incluia a linha ja apagada). Ex: excluir L98 travava a qty de L101 (Servico Eletrotecnica) em 19h; correto = 14,5h.
- **`auto-select.helper.ts`** (o `where`/indicator) ja resolvia ref faltante como **0** (nao quebrava) — mas somava a linha morta como 0 silenciosamente. No PREVIEW do front, aparecia "Nenhum candidato passa" (falso).

**Fix — camadas:**
1. **`formula-eval.ts` (v1.15.52)**: `prod/qty/total/unitPrice(Lx)` de linha inexistente resolve `(0)` em vez de throw (alinha com auto-select.helper). Rede de seguranca.
2. **`pool-budget.service.ts` PASSO 2 (v1.15.52)**: `if (!target) return true` — dep inexistente NAO bloqueia a resolucao (resolve como 0). Rede de seguranca.
3. **TRAVA de exclusao (v1.15.54, DECISAO DO JULIANO)**: `removeItem` (backend) BLOQUEIA (`BadRequestException`) excluir uma linha ainda referenciada em formula de outra (qty formulaExpr / autoSelectRule where/indicator) — `findSiblingsReferencing` lista quem usa; o operador tem que DESLIGAR primeiro (botao "✏️ Editar linhas" na auto-selecao, ou editar a formula de qty). Frontend (`removeItem` em quotes/pool) tambem bloqueia (defesa em profundidade — `alert` + return, nao chama a API). **Descartado o auto-scrub→0** (deixava residuo `+ 0 * 0`/`+ 0` na formula; Juliano: "nao pode ficar rastro"). Regra: [[feedback_backend_enforcement]].

**Diagnostico/limpeza (SQL prod tenant_sls):** so tenant_sls usa o modulo piscina. Varredura de 9 orcamentos: 2 com refs orfas — ORCP-00001 (L96/L97/L98 → L82/L95/L101) e ORCP-00006 (L9 → L11). ORCP-00001 limpo em 2 passos SQL (value-neutral): (1) refs mortas `prod(L9[678],...)`→`0`; (2) remocao do residuo `+ 0 * 0`/`+ 0` via `regexp_replace(... '\s*\+\s*0\s*\*\s*0','','g')` + `regexp_replace(... '\s*\+\s*0(?![.\d])','','g')` (Postgres ARE aceita lookahead). Verificado: 0 refs orfas + 0 residuo. **ORCP-00006 NAO tocado** (Juliano: outro layout, sera revisado inteiro). qty corrige no proximo recalc (fix deployado; L101 19h→14,5h).

**Regra aprendida:** avaliador de formula NUNCA deve quebrar recalc por ref faltante (resolve 0). Toda exclusao de linha DEVE limpar refs orfas nas irmas. Ver [[feedback_reusar_filtros_prontos]] (o botao "Editar linhas" v1.15.50/51 tambem re-limpa o where ao reeditar). Login prod exige CAPTCHA — nao da pra disparar recalc via API externamente; recalc dispara no proximo open/edit do orcamento.
