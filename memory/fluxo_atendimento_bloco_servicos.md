---
name: fluxo-atendimento-bloco-servicos
description: Relatório técnico no fluxo de OS — grava-na-OS foi REVERTIDO; usar blocos do fluxo (Materiais/Serviços) que aparecem só na linha do tempo. Padrão pra criar bloco list-based.
metadata: 
  node_type: memory
  type: project
  originSessionId: 81a55b1c-f823-423a-92a3-dfc9a935eea1
---

**Relatório técnico da OS = blocos do Fluxo de Atendimento (workflow engine), NÃO campos na OS.** (v1.14.30→34, sessão 26/06/2026)

**Decisão revertida (NÃO repetir):** tentamos gravar `ServiceOrder.serviceDescription`/`materialsUsed` via o bloco Materiais + exibir em 2 quadros na tela da OS → **duplicou** (aparecia na linha do tempo E nos quadros). Juliano mandou descartar. As colunas `serviceDescription`/`materialsUsed` ficaram **DORMENTES** no banco (migration `20260626140000` aplicada, sem uso — não dropar sem necessidade). Os 2 quadros foram removidos de `orders/[id]/page.tsx`.

**Modelo final:** materiais e serviços são capturados por **blocos do fluxo** e aparecem **só na linha do tempo da OS** (timeline em `orders/[id]/page.tsx`, função `normaliseWfSteps` + render `hasMaterials`/`hasServices`). Materiais = caixa âmbar (descrição+qtd); Serviços = caixa azul com bullets (só descrição).

**Bloco "Serviços" (`SERVICES`)** = clone list-based do Materiais. Para criar/alterar bloco list-based, mexer em TODOS estes pontos (senão quebra silenciosamente):
1. `frontend/src/types/workflow-blocks.ts`: `BlockType` union + `BLOCK_CATALOG` (catálogo dirige paleta+ícone+nome via `createBlock`) + `getDefaultConfig`.
2. `WorkflowProperties.tsx`: editor da config do bloco.
3. `WorkflowBlockNode.tsx`: subtitle do nó.
4. `tech/orders/[id]/page.tsx` (mobile): state no componente raiz + **threading por props no `V2BlockAction`** (passagem + destructure + tipos) + payload em `handleAdvanceBlockV2` (`responseData`) + resets (2 lugares: success E o reset de troca de bloco) + `isDisabled` + o render do bloco.
5. `backend/workflow-engine.service.ts`: `ACTIONABLE_TYPES` (senão auto-executa e não pede ação) + `validateBlockRequirements` (case do tipo).
6. Timeline da OS: `getStepDetail` + flag `hasX` + box de render.

**Config dos dois blocos (v1.14.34):** `itemsRequired` (bool, default true; false = pode enviar com 0 itens — validar no mobile `isDisabled` E no backend), `minItems`, `minChars` (mín. de caracteres por linha; trava o "+" no mobile — no Materiais trava tb a Quantidade — + aviso âmbar; backend valida cada item informado mesmo se opcional). Materiais NÃO tem mais textarea de diagnóstico (removida — usar bloco Nota se precisar de texto livre).

⚠️ **Bloco já montado guarda a config salva** (JSON em `WorkflowTemplate.steps`); mudança de default só vale pra bloco NOVO. Pra config nova valer no bloco existente: abrir/ajustar/Salvar.
