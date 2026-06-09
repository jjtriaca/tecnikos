# Feature PENDENTE — Configuração Rica de Tabela (per-aba) + PADRÃO SYSTEM-WIDE

**Status:** PENDENTE (planejada, não iniciada). Pedido do usuário (Juliano) em 09/06/2026.
**Começar por:** aba **A Receber** do Financeiro, depois **A Pagar**, depois as demais.

## O que o usuário pediu (literal)
> "No financeiro, vamos depois do botão limpar filtro um ícone de configuração da tela e das
> linhas, com riqueza de configuração da tela das linhas das colunas. ex: cor de fundo da linha
> que está sem NF, cor de fundo da linha que está vencida, quando diminuir a coluna quebrar o
> texto, quando diminuir a coluna apenas esconder o texto, tamanho das fontes coluna, linha,
> adicionar coluna esconder coluna... uma tela altamente rica em configurações onde praticamente
> zera o hardcode. **garanta que seja somente para a aba que está sendo aplicada. garanta que não
> seja função fantasma.** Talvez mais de 50 funções de ajustes."

E: **virar PADRÃO DO SISTEMA** — toda tela que mexermos, verificar se já tem; tela nova já nasce com isso. "Deveríamos ter feito desde o início."

## Regras inegociáveis desta feature
1. **PER-ABA (isolado):** cada config vale SÓ para a aba/tabela onde foi aplicada. Já garantido pelo `tableId` distinto (A Receber=`finance-v3-RECEIVABLE`, A Pagar=`finance-v3-PAYABLE`). A config nova usa o MESMO `tableId`.
2. **ZERO função fantasma:** todo toggle/opção DEVE ter efeito visível e real no render. Se não dá pra ligar no render, NÃO entra. Aceite: ligar a opção → ver o efeito na hora.
3. **SEGUIR O PADRÃO EXISTENTE (não inventar paralelo):** estender `useTableLayout`/`ColumnDefinition`/`DraggableHeader`, NÃO criar caminho hardcode novo. (CLAUDE.md "SEGUIR PADROES DO SISTEMA".)
4. **Componente COMPARTILHADO + reutilizável:** um único `<TableConfigButton>` + hook `useTableConfig(tableId,...)` que serve qualquer tabela (drop-in).

## Base existente (em cima dela construímos — NÃO recriar)
- `frontend/src/lib/types/table.ts`: `ColumnDefinition<T>` (id, label, sortable, align, className, render), `TableLayoutState` (version, columnOrder, columnWidths), `FilterDefinition`.
- `frontend/src/hooks/useTableLayout.ts`: persiste `{version, columnOrder, columnWidths}` em `localStorage["table-layout-${tableId}"]`. JÁ faz reorder + resize + reset, PER-TABELA. Tolera colunas novas/removidas (merge).
- `frontend/src/hooks/useTableParams.ts`: sort + filtros + paginação (persistKey).
- `components/ui/DraggableHeader` + `SortableHeader` + `FilterBar` + `Pagination`.
- Financeiro (`finance/page.tsx`): `buildEntryColumns(type)` → `ColumnDefinition<FinancialEntry>[]`; `useTableLayout("finance-v3-"+type, columns)` (L1072-1075); render `<table style={tableLayout:fixed}>` com `orderedColumns` + `DraggableHeader`.

## Arquitetura proposta
1. **Novo `TableConfigState`** (versionado) salvo em `localStorage["table-config-${tableId}"]` (separado do layout pra não conflitar). Migração por `version`.
2. **Hook `useTableConfig(tableId, columns, { signals })`** retorna:
   - `config` resolvido (merge default + salvo) + setters granulares.
   - `visibleColumns` (aplica show/hide + ordem do layout existente).
   - `getRowStyle(row)` — engine de regras condicionais (1ª regra que casa vence; ordem/on-off por regra).
   - `getColumnStyle(colId)` / `getColumnClass(colId)` — fonte/cor/align/overflow por coluna.
   - `getCellOverflowClass(colId)` — wrap | truncate | scroll.
3. **Engine de regras condicionais (cor de linha):** regra = `{ id, on, when:{signal|campo, op, valor}, style:{bg, text, bold, badge} }`. As condições referenciam **SINAIS que a tabela expõe** (data-aware → não vira fantasma). Cada tabela registra seus `signals`.
   - Sinais do Financeiro: `semNF` (nfseStatus vazio/none p/ RECEIVABLE), `vencida` (dueDate<hoje && !pago), `paga` (PAID), `cancelada`, `renegociada`, `parcelada`/`dividida` (SPLIT/installmentCount>0), + campo livre (planoDeContas, valor, parceiro, OS).
4. **`<TableConfigButton tableId columns config signals onChange>`** — ⚙ depois de "Limpar Filtros" + painel (drawer/modal) com seções agrupadas. Reutilizável em qualquer tela.

## As ~50+ opções (agrupadas)
**A. Colunas (por coluna):** 1 mostrar/esconder · 2 reordenar (já existe) · 3 largura (já existe) · 4 alinhamento override · 5 ao estreitar: quebrar | truncar | scroll · 6 tamanho da fonte · 7 peso da fonte · 8 cor do texto · 9 cor de fundo (header/célula) · 10 fixar (sticky esq/dir) · 11 renomear rótulo · 12 casas decimais/símbolo (colunas de valor).

**B. Linhas:** 13 altura (compacta/normal/confortável/px) · 14 fonte base da linha · 15 zebra on/off + cor · 16 cor de hover · 17 borda entre linhas (none/sutil/forte)+cor · 18 padding vertical.

**C. Cores condicionais (engine):** 19 fundo SEM NF · 20 fundo VENCIDA · 21 fundo PAGA · 22 fundo CANCELADA/renegociada · 23 fundo por plano de contas · 24 fundo por faixa de valor · 25 fundo por parceiro/OS · 26 cor de texto condicional · 27 negrito condicional · 28 badge/ícone condicional (⚠) · 29 ordem/prioridade + on-off por regra · 30 regra custom (campo+operador+valor→estilo).

**D. Tipografia (tabela):** 31 família (system/mono) · 32 tamanho base · 33 tamanho cabeçalho · 34 peso cabeçalho · 35 cor cabeçalho (texto+fundo) · 36 MAIÚSCULAS no cabeçalho.

**E. Texto/overflow (global + override por coluna):** 37 padrão: quebrar | truncar | scroll · 38 nº de linhas no wrap (1/2/livre) · 39 tooltip com texto completo quando truncado · 40 break-word/normal.

**F. Comportamento:** 41 densidade geral (preset) · 42 rodapé de totais on/off · 43 coluna de ações on/off · 44 posição das ações (esq/dir) · 45 linhas por página · 46 cabeçalho fixo (sticky) on/off · 47 numeração de linhas · 48 checkbox de seleção on/off · 49 texto de "vazio" customizável · 50 (futuro) modo card no mobile.

**G. Gestão:** 51 resetar pro padrão (só esta aba) · 52 exportar/importar config (JSON) · 53 (futuro) salvar como padrão da empresa vs só meu · 54 selo "config customizada ativa".

## Rollout
1. **A Receber** (`finance-v3-RECEIVABLE`) — primeiro.
2. **A Pagar** (`finance-v3-PAYABLE`).
3. Parcelas, Conciliação, Resumo, Resultados.
4. Demais tabelas (OS, Orçamentos, Cadastros, Fiscal...).

## Plano por FASES (recomendação — evita 50 fantasmas de uma vez)
- **Fase 1 (MVP, o que ele citou):** ⚙ + painel; mostrar/esconder coluna; engine de cor de linha (sem NF / vencida / paga); overflow wrap|truncate por coluna+global; tamanho de fonte (coluna+linha). ~15 opções, TODAS reais. Só A Receber.
- **Fase 2:** fonte/cor/align/sticky por coluna; densidade/zebra/hover/borda de linha; tipografia do cabeçalho. Estende A Pagar.
- **Fase 3:** construtor de regra custom; export/import; padrão-da-empresa vs por-usuário; "Visões" salvas com nome.

## Decisão de NEGÓCIO pendente (perguntar antes da Fase 1)
**Escopo da persistência:** (a) por-usuário-por-dispositivo (localStorage — igual ao layout de hoje, mais simples); (b) por-usuário sincronizado (backend, cross-device); (c) padrão-da-empresa + override por usuário. Recomendo começar (a) e evoluir pra (b)/(c) na Fase 3.

## PADRÃO SYSTEM-WIDE (também no CLAUDE.md, seção Tabelas)
- Toda tela com tabela que formos MEXER: verificar se já tem a config rica; se não, ADICIONAR (drop-in do `<TableConfigButton>`).
- Tela NOVA com tabela: já nasce com a config rica (padrão obrigatório, assim que o componente compartilhado existir — Fase 1).
- Nunca recriar hardcode: usar o componente/hook compartilhado.
