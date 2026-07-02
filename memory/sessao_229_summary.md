---
name: sessao_229_summary
description: Sessao 229 (02/07, v1.15.41→47) — EngineReporter pilha/paginacao A4 no editor + fix data-loss de pagina no autosave
metadata:
  type: project
---

# Sessao 229 (02/07/2026) — EngineReporter: pilha / paginacao A4 no editor

Frente: **EngineReporter — GRUPO EMPILHADO (pilha) + quebra A4 no editor**. Layout de teste: "Piscina Pre Moldada" (id `692900a6-1788-44be-90c7-3abe9c59f066`), pagina **Itens** (id `7aeb83d3-...`), orcamento ORCP-00001. Arquivos: [frontend/src/components/pool/report/BudgetReport.tsx] (guia, applyStackFlow, paginateStackFlow) e [frontend/src/app/(dashboard)/pool/print-layouts/[id]/page.tsx] (editor).

## Linha do tempo (v1.15.41 → v1.15.47)
- **v1.15.42** — Guia de quebra A4 "honesta" data-driven (`stackBreakYs`), removeu as faixas fixas de cab/rodape por folha. **REVERTIDO.**
- **v1.15.43** — Fix drift do `applyStackFlow` (ancora em `min(C.y+PAD, 1oFilho)` em vez de `C.y+PAD`). **REVERTIDO.**
- **v1.15.44** — **REVERT total** de BudgetReport.tsx pro estado da v1.15.41 (`git checkout ec560573 -- <arquivo>`). Juliano: "tava tudo certo na v1.15.41, diferenca ~5mm, bloco ficava na folha, de la pra ca estragou". A guia FIXA (faixas cab/rodape por folha a cada A4 + linha "✂ A4 · pag N") era o que ele queria. `stackBreakYs` removido; `applyStackFlow` original de volta.
- **v1.15.45** — Campo **Espaco (stackGap)** reposiciona os grupos AO VIVO no editor (antes so refluia no print).
- **v1.15.46** — **FIX data-loss: contaminacao de pagina no autosave** (ver abaixo). Bug de raiz serio.
- **v1.15.47** — **AUTO-QUEBRA de folha na pilha ao vivo** (`repaginateStack`) — grupo que estoura a folha pula pro topo da proxima (abaixo do cabecalho); duplicar leva o clone pra proxima folha.

## Bug de raiz IMPORTANTE (v1.15.46) — contaminacao de pagina no autosave
Sintoma: a pagina "Itens" foi **renomeada sozinha pra "Apresentacao"** + perdeu `breakA4` + Rodape (ficou `noFooter=true`) — TODOS valores da OUTRA pagina. Consequencias em cascata: guia sem rodape (rodape desligado), ultimo bloco ia ate 297 (sem rodape reservado, util=297 em vez de 281).
**Causa:** `scheduleSave` ([page.tsx]) e debounced (700ms) mas lia nome/tamanho/HF/bg de **refs MUTAVEIS na hora que o timeout DISPARAVA** (`pageNameRef.current`, `pageSizeRef.current`, `pageHFRef.current`, `pageBgRef.current`). Trocar de pagina dentro dos 700ms → refs ja apontam pra pagina nova → o save pendente da ANTIGA grava os valores da NOVA por cima (renomeia + zera config).
**Fix:** SNAPSHOT de `snapPageId/snapName/snapHF/snapSize/snapBg` **no momento da chamada** de scheduleSave (nao no fire). Diagnostico via SQL direto no prod (`tenant_sls."PoolPrintPage"` / `"PoolPrintLayout"`). **Padrao geral: autosave debounced NUNCA deve ler estado mutavel no fire — snapshotar na chamada.**

## repaginateStack (v1.15.47) — WYSIWYG da pilha
`repaginateStack(list, containerId)` ([page.tsx]): re-empilha os grupos filhos do container-pilha; quando `breakA4`, um grupo que nao cabe ate `(folha+1)*a4H - fMm` PULA pro topo da proxima folha `(folha+1)*a4H + hMm` (abaixo do cabecalho). Mantem 1o grupo no lugar, move subarvore (`subtreeIds`), cresce o container. `a4H/hMm/fMm` iguais aos da guia (headerHmm/footerHmm, so contam se ha boxes e nao desabilitado na pagina). Idempotente (recalcula do 1o grupo). Chamado em: `patchSelBox` (Espaco), `duplicateSelBox` (se `anchorParent.stack` — clone pula de folha), `onCanvasCommit` (ao soltar arraste/resize). Espelha `applyStackFlow`+`paginateStackFlow` do print → editor bate com "Imprimir exemplo".

## Dados reais uteis (pagina Itens, medidos via SQL)
- Container pilha `bp5rd7dq`: CARD stack, `y=72`, `stackGap=1`. Grupos filhos (por y): CONSTRUCAO(y73,h65.5), REVESTIMENTO(139.5,35), REJUNTE(175.7,35), FILTRO(211.5,35), CASCATA(247.5,35, bottom 282.5). Cada grupo tem TEXT/IMAGE/LIST como filhos.
- Branding: header 22mm, footer 16mm (Juliano baixou p/ 12), headerBoxes/footerBoxes = 1 cada (footer = `{validityDays}`). heightMm da pagina = 600 (=~2 folhas A4). `applyStackFlow` (print) usa `cursorY=C.y+PAD(3)` → drift de ~+2mm vs cru (foi REVERTIDO o fix disso; convive).

## PENDENCIAS / follow-ups desta frente
- **Aguardando Juliano validar v1.15.47** (auto-quebra + duplicar pra proxima folha) na tela e no Imprimir exemplo.
- **Auto-crescer Alt.pag (heightMm)** quando a pilha paginada passa da altura de trabalho — hoje folhas alem de heightMm CLIPAM no canvas (Juliano avisado; faz na mao aumentando Alt.pag).
- Restaurar na tela (Juliano ja fez): renomear "Apresentacao"→"Itens" + remarcar Rodape na pagina Itens (foi contaminada pelo bug v1.15.46).

## Pendencias herdadas da sessao 228 (nao mexidas)
onCanvasGroupMove multi-select nao cascateia subarvore; mini-modal agrupado nas outras listas planas; indicador como COLUNA da Lista dinamica; migracao legado consumoKgM2/pesoKg (PARQUEADA); NFS-e OBRA flat vs aninhada; repetidor/multiplicador do grupo (PARADO). Ver [[sessao_228_summary]] e [[engine_reporter_card_dinamico]].
