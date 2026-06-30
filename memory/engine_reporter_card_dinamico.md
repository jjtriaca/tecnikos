---
name: engine_reporter_card_dinamico
description: EngineReporter dinâmicos — GRUPO dinâmico (container parentId/dynamic + condição cascata), IMAGEM dinâmica (imgRules), condições E/OU multi-regra com ruleCore compartilhado, preview por orçamento real. v1.15.14. LER antes de mexer em card/grupo/imagem/condição/picker/preview do canvas.
metadata:
  type: project
---

# Grupo dinâmico (EngineReporter / canvas de caixas) — ex-"card dinâmico"

Conceito proposto pelo Juliano (30/06): em vez de só "blocos dinâmicos" (layouts presos no código), um container que o operador molda na mão. Alinha com a visão "tudo editável, nada hardcode".

## NOME (v1.15.11): "Grupo dinâmico", NÃO "card dinâmico" nem "bloco dinâmico"
- "card" confundia com o Card (retângulo simples); "bloco" colidiria com os "blocos dinâmicos" (BLOCK type, na aba Campos & blocos) — o próprio conceito do qual o Juliano separou isso.
- Objeto PRÓPRIO na aba Inserir: **🃏 Card** (retângulo) + **🪄 Grupo dinâmico** (container). Flag `Box.dynamic=true`. SÓ grupo dinâmico (ou card legado v1.15.10 que já tem filhos) adota o que é inserido com ele selecionado.
- Ferramentas próprias na aba Layout quando selecionado (sem fantasma): selo + ⚡ Exigências (abre cond modal) + resumo ao vivo da regra + 🚫 Sempre aparece + 📦 Conteúdo (N) (seleciona os filhos). NÃO mostra Condição genérica nem Repetir (multiplicador = futuro). "Tornar dinâmico" foi REMOVIDO (Juliano: desnecessário).

## PREVIEW POR ORÇAMENTO REAL (v1.15.11) — conserto de raiz do "preview mente"
- O `SAMPLE_BUDGET` (orçamento FALSO fixo) era a fonte de N contratempos (L5=Quadro elétrico, validade=30). REMOVIDO do preview do canvas (só sobra no PageEditor legado de composição).
- Cabeçalho tem busca 🔎 (`GET /pool-budgets?search=` por código/cliente) → escolhe um orçamento REAL → `previewData = buildReportData(budget, labels)` (função EXPORTADA de `BudgetReportModal`, mesmo motor do PDF). Último escolhido salvo em localStorage `rp-preview-budget:<layoutId>`. Sem escolha = `BLANK_DATA` (vazio/zero).
- Assim `{validityDays}`/`{linha:Lx.*}`/cliente/dims resolvem com dado REAL — o que vê = o que imprime. Ao mexer no preview no futuro, NÃO ressuscitar SAMPLE_BUDGET; usar orçamento real.

## v1.15.14 — IMAGEM DINÂMICA + condições multi-regra + ruleCore + picker-do-orçamento
- **Picker usa o ORÇAMENTO escolhido** (não o modelo) quando há um no preview: `tplLines/tplCustomSections/tplSectionOrder` viraram MEMOS (orçamento → senão modelo `model*`). Assim o L5 que você escolhe = o L5 que resolve. Sem orçamento, cai no modelo.
- **Condição (`Box.showIf`) = `CondRule | CondGroup`** (`{match:'all'|'any', rules:[]}`). `boxShows` aceita as 2 (compat regra única legada). Ops: hasProduct/noProduct/qty(>,≥,=,≠,≤,<)/**val**(R$, >,≥,=,≠,≤,<). `CondRule.kind` = filtro UI produto/serviço (NÃO entra na avaliação). Etapa=ESCOPO, linha FILTRADA pela etapa+kind (não-excludentes; linha tem prioridade na avaliação).
- **IMAGEM DINÂMICA** (objeto próprio na aba Inserir): `Box.imgRules: CondRule[]` ORDENADOS. `resolveDynamicImage(box,data)` (exportado) = imagem do produto da 1ª linha que bate a condição E tem imagem; senão tenta a próxima. BoxContent IMAGE usa isso quando `Array.isArray(box.imgRules)`. Editor com ↑↓/add/remove + selo fuchsia "🖼️ Imagem dinâmica" + botão "🎯 Candidatos (N)".
- **`ruleCore(r, onChange, lineLabel?)`** (page.tsx, escopo do componente): linha-de-regra COMPARTILHADA (tipo+etapa+linha+operador+valor) usada no modal de Condição E no de Imagem. Mexeu nela → muda nos dois. NÃO recriar inline.
- `sectionLabel` (BudgetReport) faz `.toUpperCase()` → nome da etapa em CAIXA ALTA na impressão (bate com orçamento+picker).

## Modelo mental
- 1 clique seleciona o card e mostra as ferramentas dele; o que você inserir com o card selecionado **vai pra dentro** dele (exclusivo do card).
- Nas ferramentas do card ficam **as exigências pra ele aparecer na impressão** (condição) — reusa o `showIf` que já existia (ferramenta ⚡ Condição).
- O card dinâmico **não mata** os blocos: dentro dele você bota campos soltos OU um bloco computado (datasheet, resumo financeiro). O card cuida de "aparece junto / some junto / sob qual regra".

## Dois sabores (decisão de escopo)
1. **Condicional** (FEITO no v1): aparece uma vez SE a regra bate; some inteiro (com os filhos) se não bate.
2. **Repetidor** (etapa 2, NÃO feito): clona N vezes, 1 por linha/etapa, preenchido com os dados daquele item — é o que **aposenta os blocos dinâmicos**. Já existe parcialmente como `band` (banda repetidora); a ideia é fundir a banda dentro do card (modo "repete por etapa/linha").

## Implementação v1 — DEPLOYED v1.15.10 (sabor condicional)
Arquivos: [BudgetReport.tsx] + [pool/print-layouts/[id]/page.tsx].
- **`Box.parentId`** (novo campo, opcional): liga a caixa ao CARD dono. Só 1 nível (card não vira filho de card). Persiste no JSON `pageConfig.boxes`; back-compat (sem parentId = topo).
- **Inserir dentro** (`addBox`): se um CARD está selecionado (region page, caixa nova ≠ CARD), nasce com `parentId` + posicionada/clampada nos limites do card.
- **Mover junto:** `onCanvasChange` (arraste) e `patchSelBox` (campos X/Y) — quando um CARD muda x/y, desloca os filhos pelo mesmo delta. (Resize do card NÃO move filhos; só delta de posição.)
- **Apagar junto:** `removeSelBox` agrega os filhos cujo `parentId` está sendo removido.
- **Condição em cascata:** `boxShowsCascade(box, pool, data)` exportado — true se `boxShows(box)` E (sem pai OU `boxShows(pai)`). Usado nos filtros de IMPRESSÃO (`paginateCanvasBoxes`, `CanvasPage`) e no DIMMING do editor (`CanvasEditor` `condHidden`). `pool` = lista onde achar o card pai (boxes da página/faixa).
- **UI (aba Layout):** selo "🃏 card dinâmico" quando um CARD está selecionado + botão "🔓 Soltar do card" (limpa parentId) quando a caixa selecionada tem dono.

## NÃO feito no v1 (refinar após Juliano testar na mão)
- **Clipping rígido** ("campo não vaza do card"): hoje nasce dentro mas pode ser arrastado pra fora. Render é PLANO (card = retângulo, filhos por cima via z) — clipping de verdade exigiria render aninhado (overflow hidden).
- **Coreografia 1-clique-seleciona-card / 2-cliques-entra-pra-editar**: hoje clica direto no campo (por cima) pra editar; card via área vazia ou árvore OBJETOS. Falta o "modo dentro do card" (foco/enter-exit).
- **Repetidor** (sabor #2 acima).
- Edge conhecidos: duplicar card NÃO duplica filhos (mantêm parentId antigo); group-move multi-seleção não arrasta filhos não-selecionados; resize pelo canto esquerdo/topo do card desloca filhos (muda x/y).

Ver [[engine_reporter]] (arquitetura geral) e [[plano_blocos_dinamicos_banda]] (banda/repetidor).
