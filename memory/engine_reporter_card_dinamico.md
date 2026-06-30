---
name: engine_reporter_card_dinamico
description: EngineReporter dinâmicos UNIFICADOS (v1.15.16) — GRUPO (showIf), IMAGEM e TEXTO dinâmicos (candidatos DynCandidate com cond), TODOS no MESMO modal de condição (⚡, E/OU, multi-regra), ruleCore/lineCore compartilhados, operadores desc-contém/unitário/≠, preview por orçamento real. LER antes de mexer em grupo/imagem/texto/condição/picker/preview do canvas.
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

## v1.15.16 — UNIFICAÇÃO total (grupo/imagem/texto 100% iguais) + condições ricas
- **REGRA DE OURO:** os 3 dinâmicos (grupo, imagem, texto) usam **O MESMO modal de condição** (⚡, multi-regra E/OU). NUNCA criar modal/ícone/ferramenta paralela — o Juliano cobrou isso explicitamente. A linha-de-regra é o `ruleCore` (page.tsx, escopo do componente); o seletor de linha é o `lineCore` (extraído do ruleCore). Mexeu num → muda em todos.
- **Condição:** `Box.showIf: CondRule | CondGroup`. `evalCond(c, items)` (BudgetReport) avalia grupo-ou-regra (usado por boxShows E pelos candidatos). `condTarget` no page decide onde o modal grava (showIf do box OU `cond` de um candidato); `openCondFor(target, src)` / `saveCond()`.
- **Candidato (imagem/texto):** `DynCandidate = {cellRef(fonte), etapa, kind, cond:CondGroup}`. Lista ORDENADA (↑↓). 1º cujo `cond` bate (e resolve não-vazio) manda. **Múltiplas condições por candidato** = o cond é um CondGroup (modal traz 1, +Adicionar). Modal de candidatos ÚNICO (`candMode: image|text`); cada linha = `lineCore` (fonte) + ⚡ Exigências (abre o modal de condição pro cond daquele candidato).
- **Imagem:** `Box.imgRules: DynCandidate[]` → `resolveDynamicImage` (imagem do produto da linha). **Texto:** `Box.txtRules: DynCandidate[]` + `txtAttr` (campo: produto/qtd/valor/unitario/papel/prodCodigo/prodUnidade) → `resolveDynamicText` (via resolveAddressedToken). BoxContent TEXT/IMAGE usam os resolvers quando `Array.isArray(box.txtRules/imgRules)`.
- **Operadores (CondOp):** hasProduct/noProduct · qty(>,≥,=,≠,≤,<) · val(total R$, >..) · **unit**(unitário R$, >..) · **descHas/descNot** (procura `text` na description+productDesc). `CondRule.text` pro contém; `CondRule.kind` = filtro UI produto/serviço (NÃO avalia).
- **Compat v1.15.14:** candidato antigo era CondRule flat (op no topo). `candCond(c)` (resolver) e `migrateCand(c)` (editor) convertem pro {cellRef, cond}.
- **"Sem Produto"/"Sem Serviço"** = linha vazia: `isEmptyLineDesc` → token produto/descrição resolve vazio + listas pulam (v1.15.15).
- **Inserir N caixas:** `buildBox(kind,extra,cur)` PURO + `addBoxes([])` acumula (loop de addBox usava boxes velho e só a última vingava).

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
