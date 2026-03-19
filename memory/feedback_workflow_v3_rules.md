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
