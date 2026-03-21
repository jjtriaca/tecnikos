---
name: Workflow V3 Rules
description: Regras absolutas do Engine V3 - blocos controlam tudo, OS nasce ABERTA, sem hard-code
type: feedback
---

OS nasce com status ABERTA (nao pode ser NULL no banco). Blocos do workflow controlam tudo a partir dai.

**Why:** Juliano corrigiu que NULL nao e valido — o Prisma/PostgreSQL precisa de um status inicial. A OS nasce ABERTA e o primeiro bloco Status muda para o que o gestor configurou (ex: OFERTADA).

**How to apply:**
- NUNCA tentar setar status NULL na criacao da OS
- O engine executeWorkflowFromStart() auto-executa blocos do START e muda status via blocos
- NENHUMA logica pre-fixada — blocos controlam: status, notificacoes, GPS, tudo
- Se houver problema de transicao, criar NOVO BLOCO, nunca hard-code no engine

## Regra: Zero UI hardcoded — Blocos fornecem tudo (20/03/2026)

**Principio:** O codigo do celular e um RENDERIZADOR puro. Ele sabe COMO desenhar cada tipo de bloco, mas NUNCA decide O QUE mostrar. Labels, cores, icones, textos de botao — tudo vem da config do bloco.

**Regras:**
1. NENHUM texto de botao hardcoded no codigo (proibido "Confirmar ✓", "Registrar localização", etc.)
2. Cada bloco que precisa de confirmacao usa `confirmButton` na config (label, color, icon) — mesma estrutura do ACTION_BUTTONS
3. Se o gestor nao configurar, usa default por tipo (FOTO="Enviar fotos", INFO="Entendi", etc.) — mas o default e definido no BUILDER ao criar o bloco, nao no codigo do celular
4. GPS sempre auto-captura e auto-avanca. Sem botao interno. Se precisa de confirmacao antes, usa bloco separado (STATUS/ACTION_BUTTONS antes do GPS)
5. Se um bloco ja resolve um problema (ex: ACTION_BUTTONS tem renderizacao de botao), REUTILIZAR a infraestrutura dele em vez de criar logica nova
6. NUNCA duplicar codigo de renderizacao — extrair em componentes/funcoes compartilhadas
