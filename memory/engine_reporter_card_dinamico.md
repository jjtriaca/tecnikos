---
name: engine_reporter_card_dinamico
description: Card dinâmico do EngineReporter — card vira DONO dos campos (parentId) + condição em cascata. v1 condicional (v1.15.10). LER antes de mexer em card/condição/banda do canvas.
metadata:
  type: project
---

# Card dinâmico (EngineReporter / canvas de caixas)

Conceito proposto pelo Juliano (30/06): em vez de só "blocos dinâmicos" (layouts presos no código), o **card** do canvas vira um container que o operador molda na mão. Alinha com a visão "tudo editável, nada hardcode".

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
