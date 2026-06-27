# EngineReporter — editor de relatório de impressão do orçamento (Piscina)

Subsistema NOVO (sessão 226, v1.14.14→29). Monta o PDF do orçamento de piscina com um **editor estilo
PowerPoint/Office**. Construído do ZERO (sem plataforma/lib pesada — é produto pra venda). **Ler ANTES de
mexer no editor de relatório.** Origem completa em [[sessao_226_summary]].

## Arquivos
- `frontend/src/components/pool/report/BudgetReport.tsx` — **RENDERIZADOR**. Recebe (data + layout.pages) e
  monta o A4 em `#budget-pdf-area`. `renderPageContent` → se a página tem `pageConfig.nodes` usa composição
  (cards), senão FIXED(html) / DYNAMIC(bloco). `renderBlockByType` (registry): COVER, PRODUCTS_BY_SECTION,
  BUDGET_SUMMARY, TERMS_CONDITIONS, PHOTOS_GALLERY, INSTALLMENTS, CUSTOM_TABLE, TEXT, IMAGE, **HEATING_BOMBA**,
  **HEATING_SOLAR**. `ReportNodeView`/`CompositionNodes` (recursivo) + `CompositionPreview` (exportado, sem
  `#budget-pdf-area` pra não duplicar id). Tipos exportados: `BudgetReportData`, `ReportNode`, `ReportBranding`.
- `frontend/src/components/pool/report/CompositionEditor.tsx` — árvore de cards (add/aninhar/reordenar/remover +
  inspector contextual + TEMPLATES, incl. "Capa comercial").
- `frontend/src/components/pool/report/RichTextEditor.tsx` — WYSIWYG de texto (contentEditable + barra que
  reflete a seleção; execCommand, sem lib). Usado no bloco TEXT.
- `frontend/src/components/pool/report/HeatingDatasheets.tsx` — `BombaDatasheetBlock` + `SolarDatasheetBlock`
  (display-only, do report cacheado). Gráfico `SeasonalCurve` é CÓPIA do modal (débito deliberado).
- `frontend/src/components/pool/report/BudgetReportModal.tsx` — liga ao orçamento REAL (`buildReportData`).
- `frontend/src/lib/printViaClone.ts` — print via clone no body (bíblia em `sistema_impressao_pdf_simulador.md`).
- `frontend/src/app/(dashboard)/pool/print-layouts/[id]/page.tsx` — **EDITOR RIBBON** (a tela). E `.../page.tsx`
  (lista de layouts). `PageEditor` (componente no mesmo arquivo) tem prop `inline`.
- Backend: `backend/src/pool-print-layout/*` (layout + páginas + `POST :id/asset` upload). Models
  `PoolPrintLayout` + `PoolPrintPage` (pageConfig Json). **`PoolPrintPage.pageConfig.nodes`** = árvore de cards
  (salva como type FIXED → SEM enum novo, SEM migration).

## Dados (placeholders no FIXED/TEXT)
`{clientName} {clientDocument} {clientCity} {budgetCode} {budgetDate} {budgetTitle} {budgetTotal} {poolLength/Width/Depth/Area/Volume/Perimeter} {validityDays} {date}`. Resolvidos em `resolvePlaceholders`. `clientCity` vem de `clientPartner.city/state` (findOne já traz `clientPartner:true`); `budgetDate` de `createdAt`.

## Editor RIBBON (layout PowerPoint — v1.14.27)
```
[barra título: nome + Imprimir exemplo]
[abas: Arquivo | Início | Inserir | Página | Estilo]  ← FIXO
[faixa de opções: ferramentas da aba ativa]           ← FIXO
[ Páginas (esquerda, só lista) | CENTRO: editor da pág. selecionada (largura cheia) OU folha/preview ]
```
- Ferramentas por aba: Início=fonte/tamanho/cor · Página=orientação/margem/fundo+gradiente/cabeçalho/rodapé ·
  Estilo=cor primária/destaque/logo · Arquivo=renomear/salvar/imprimir/duplicar(stub). Todas chamam `setBranding`
  (preview ao vivo) + `saveBranding`.
- Clicar página (esquerda) → `setEditingPage` → editor inline no centro (`PageEditor inline`, `key={id}` re-monta).
- O painel "Padrão do relatório" da esquerda está `hidden` (ferramentas migraram pra faixa). NÃO recriar lá.

## WYSIWYG — editar clicando na folha (Canva/Word)
Juliano escolheu "só a folha embaixo, clica no elemento e edita pelo ribbon". Estado:
- **A (parcial, FEITO):** `BudgetReport` tem props `editable`/`selectedPageId`/`onSelectPage` → página clicável +
  contorno na seleção. **Ainda NÃO ligado** no editor (dormindo — seleção de PÁGINA).
- **✅ B (FEITO, v1.14.37):** os NÓS da composição ficaram clicáveis na FOLHA. `ReportNodeView`/`CompositionNodes`/
  `CompositionPreview` ganharam props opcionais `selectedId`/`onSelectNode` (sem elas = render de impressão normal;
  `stopPropagation` seleciona o nó mais INTERNO, não o card-pai; contorno ciano 2px no selecionado). `CompositionEditor`
  aceita `selectedId`/`onSelectId` (seleção controlável de fora; senão estado interno — retrocompatível). No `PageEditor`
  (modo Composição) o state `selNode` liga montador↔folha: clicar num lado seleciona/edita no outro (TEXT abre o
  `RichTextEditor` do NodeInspector). Reusa o NodeInspector existente — NÃO recriar painel de propriedades.
- **🔜 C:** edição de texto inline na PRÓPRIA folha (ribbon Início agindo no texto selecionado) — hoje a formatação
  de texto é via RichTextEditor dentro do inspector. **D:** arrastar/posicionar.
- Editar nós → `setNodes` → salvar (`onSubmit`→`updatePage`, `pageConfig.nodes`).

## Regras
- Módulo Piscina: SEM preview no navegador — build-only + deploy (`feedback_preview_pool_budget`).
- Print: `printViaClone({areaId:"budget-pdf-area", cloneId:"budget-pdf-clone"})`; classes `.rp-*` são globais
  (bare), só `.report-page`/`.rp-page-body` ficam sob `#budget-pdf-area`.
- Datasheets: editar é no Simulador (HeatingSimulatorModal); o bloco do relatório é só LEITURA do cache.
