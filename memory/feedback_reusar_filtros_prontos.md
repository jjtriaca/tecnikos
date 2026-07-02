---
name: feedback_reusar_filtros_prontos
description: Toda tela de busca/filtro/seletor de linha reusa componente pronto (LineRefPicker/LineIdentity); nunca lista paralela na unha.
metadata:
  type: feedback
---

Ao construir QUALQUER tela (ou trecho) que precise **buscar, filtrar, selecionar linha/etapa ou listar itens pra escolher**: estudar o padrao ja existente e REUSAR o componente/tela pronto. Nunca montar lista/filtro paralelo inline.

**Why:** o Juliano bate nessa tecla o tempo todo — quer o sistema TODO padronizado (mesmo visual, mesmo comportamento) pra nao ter que consertar as mesmas coisas em N lugares. Cada caminho paralelo = mais um lugar pra quebrar e re-arrumar.

**How to apply:**
- Seletor de linha/etapa do orcamento: usar `LineRefPicker` (mini-modal roxo agrupado+colapsado) OU o componente compartilhado **`LineIdentity`** (`components/pool/LineRefPicker.tsx`), que renderiza SEMPRE **Lx (numero) + ITEM (slotName) + DESCRICAO (produto/"Sem Produto")**. NUNCA so `Lx + descricao` — linha "Sem Produto" (ex: "Blower", "Kit SPA Anatomico") fica irreconhecivel.
- Tabelas: DraggableHeader + SortableHeader + FilterBar + Pagination + useTableParams + config rica (`<TableConfigButton>`).
- Regra pratica: `grep` por LineRefPicker / LineIdentity / FilterBar / mini-modal ANTES de criar UI de busca/selecao. Achou = estende. Nao achou = cria como componente COMPARTILHADO (nao inline numa tela so).

**Incidente v1.15.48 (02/07/2026):** modal "Lista dinamica" (EngineReporter) e "Outras linhas" da formula (FormulaModal) mostravam so `Lx + descricao do produto` → linhas Sem Produto irreconheciveis. Criado `LineIdentity` (fonte unica do display de linha) e aplicado nos 3 pontos (proprio LineRefPicker compartilhado, LineRefPicker local do quotes/pool, Lista dinamica, Outras linhas). Modelo de dados: `slotName`=nome proprio da linha (coluna ITEM), `description`=produto vinculado ou "Sem Produto".

Ver [[feedback_seguir_padroes_sistema]] (REGRA #9 — nao inventar hardcode paralelo) e a REGRA #11 do CLAUDE.md.
