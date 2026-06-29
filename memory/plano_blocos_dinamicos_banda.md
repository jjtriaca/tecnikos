---
name: plano-blocos-dinamicos-banda
description: "PLANO (grande, multi-sessão) — Blocos dinâmicos do EngineReporter: BANDA REPETIDORA + fluxo/paginação automática + motor de regras (condições com operadores) + campos do cadastro do produto. Confirmado por Juliano 29/06. LER antes de mexer."
metadata:
  type: project
---

# Blocos Dinâmicos do EngineReporter — Banda Repetidora (PLANO confirmado 29/06)

## Visão (Juliano confirmou "Sim isso")
Montar o relatório do orçamento de piscina como o PDF modelo (TIPO DE CONSTRUÇÃO, CONJUNTO FILTRANTE, CASCATA, HIDROMASSAGEM,
DISPOSITIVOS, RALOS…) — uma LINHA por etapa/produto, com título + itens + descrição + imagem. **Tudo montado na unha no canvas,
ligando cada pedaço a um campo do orçamento. ZERO hardcode, zero bloco "pré-montado"** (ele REJEITOU o `PRODUCTS_BY_SECTION`
automático). Quer "a melhor maneira" (tipo Crystal/Jasper/VBA), não a mais fácil.

## Requisitos (todos do Juliano)
1. **Banda repetidora:** desenha 1 linha-modelo no canvas → o motor REPETE por cada item da coleção (etapas OU linhas).
2. **Fluxo/paginação automática:** quando a banda não cabe na página, QUEBRA pra página nova e continua (3,4,5…) — igual Excel.
3. **Motor de regras por banda:** condições tipo `SE etapa=X linha=Y qtd>0 → banda A; SENÃO sem produto → banda T; SE qtd<=0 → esconde`.
   Condição = `{campo: etapa|linha|qtd|produto, operador: tem/não-tem/>/>=/=/<=/<, valor}` + ação. Avalia em ordem, 1ª que bate vence
   (= "monta o próximo que atende" / fallback).
4. **Campos do CADASTRO do produto:** quando a linha tem produto, puxar do cadastro: imagem, código, descrição, ficha técnica
   (technicalSpecs), unidade — não só o snapshot da linha.

## Decisões de arquitetura (reusar o que existe — REGRA #9)
- **Mini-modal etapa→linha = `LineRefPicker`** (já é o MESMO da autoseleção; importado em print-layouts/[id]/page.tsx:12,
  abre via botão "🔗 Campo de etapa/linha…" no painel Campos & Blocos, estado `pickLine`). Reusar pra LIGAR banda + condição.
- **Banda = GRUPO de caixas** (reusa o multi-select/group-move já feito v1.14.95+) + um binding (coleção) + regras. As caixas
  da banda usam contexto **ATUAL** (item corrente): `{linha:ATUAL.produto}`, `{etapa.nome}`, etc.
- **Condição** já existe no nível de PÁGINA (`conditionRule = {requires:[etapas]}`, BudgetReport.tsx:201 `pageShows`). Estender
  pra nível de CAIXA/banda com operadores ricos.
- **Tokens ligados** já existem: `{linha:Lx.produto|descricao|qtd|valor|unitario}`, `{etapa:X.total}`, `{poolArea}`
  (resolver `resolveAddressedToken` / flat map em BudgetReport.tsx ~L337-353).

## Dados disponíveis (já carregados — NÃO precisa migration)
- Backend `pool-budget.service.ts:1606` (findFirst do relatório) já inclui por item:
  `product {id, code, description, imageUrl, technicalSpecs, defaultQty, isSystemProduct}` e
  `service {id, code, name, imageUrl, technicalSpecs}`.
- Frontend `BudgetReportModal.buildReportData` monta `items[]` (hoje só leva `imageUrl`, `cellRef`, etc.) — precisa CARREGAR
  os campos do cadastro (productCode, productDescription, productImageUrl, productSpecs) por item.

## Plano em FASES (testar cada uma; deploy incremental)
- **Fase 1a — Campos do cadastro do produto** (COMEÇAR AQUI): buildReportData leva product/service fields por item; resolver
  ganha sub-campos `{linha:Lx.prodImagem|prodCodigo|prodDescricao|prodUnidade|prodSpec:<key>}`; IMAGE box aceita TOKEN como url
  (imagem dinâmica do produto); catálogo ganha grupo "Produto (cadastro)".
- **Fase 1b — Condição por caixa ✓ (v1.15.03):** `Box.showIf = {cellRef?|etapa?, op, value?}` (JSON no box, salva/carrega sem
  migration). `boxShows(box,data)` avalia: alvo = linha(cellRef) OU etapa OU todas; op = hasProduct/noProduct/qtyGt/Gte/Eq/Lte/Lt.
  `CanvasPage` (impressão) FILTRA `.filter(boxShows)`; `CanvasEditor` esmaece (opacity .32) + contorno tracejado âmbar + selo ⚡
  (`condSummary` no tooltip). UI: botão "⚡ Condicao" na barra Layout (após Tras) → modal (inputs linha/etapa + select op + valor).
  PENDENTE refino: trocar inputs de texto da linha/etapa pelo LineRefPicker (Juliano pediu o mini-modal).
- **Fase 2 — Banda repetidora ✓ (v1.15.04):** `Box.band = {id, source:"linhas"|"etapas"}` (caixas com mesmo band.id = banda).
  `bandCollection(source,data)` = refs (cellRefs OU codigos de etapa). `expandBandsForPrint(boxes,data)` clona a banda por item,
  offset Y = i*altura, e troca `ATUAL`→ref no html/url (`applyBandRef`). CanvasPage (impressão) usa expand; CanvasEditor mostra
  SÓ o template + selo 🔁 ×N (não expande, pra editar). UI: botão "🔁 Repetir" na barra Layout → modal (Por linha / Por etapa /
  Remover banda). Token ATUAL: `{linha:ATUAL.produto}`, `{linha:ATUAL.prodImagem}`, `{etapa:ATUAL.nome}`.
  PENDENTE: preview do template no editor resolve ATUAL→"" (mostra vazio); listar N itens dentro de banda-por-etapa (nested).
- **Fase 3 — Paginação automática:** medir altura, fluir pra páginas novas; cab/rodapé repetem; "continua…".
- **Fase 4 — Fallback/variações:** banda com variações por prioridade (1ª condição que bate).

## Gotchas
- Print é `printViaClone` (A4 fixo). Paginação automática (Fase 3) é o maior lift — medir altura real e quebrar.
- NÃO recriar bloco automático paralelo. Banda é composição de caixas ligadas, não um render hardcoded.
- Ver [[plano_enginereporter_biblia_campos]] (catálogo de campos) e [[engine_reporter]].
