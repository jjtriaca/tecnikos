# Auditoria Rigorosa: Fluxo de Criacao de OS

**Data**: 2026-03-16
**Arquivos auditados**:
- `frontend/src/app/(dashboard)/orders/new/page.tsx`
- `backend/src/service-order/service-order.service.ts`
- `backend/src/service-order/dto/create-service-order.dto.ts`
- `backend/prisma/schema.prisma` (referencia)

---

## PROBLEMAS ENCONTRADOS

### P1-01 — `description` nunca e enviado na criacao (P1 HIGH)
**Arquivo**: `frontend/.../new/page.tsx` linhas 920-932 e 659-703
**Descricao**: O campo `description` so e renderizado quando `isEditMode` e `true` (linha 920). No modo criacao, o usuario nao ve o campo e o payload nunca inclui `description`. Alem disso, no `handleSubmit`, `description` so e adicionado ao payload dentro do bloco `if (isEditMode)` (linha 707).
**Impacto**: OS criadas nunca tem descricao, mesmo que o DTO aceite o campo.
**Correcao sugerida**: Se a descricao e desejada na criacao, renderizar o campo tambem no modo criacao e incluir `description` no payload fora do bloco `isEditMode`. Se foi decisao de negocio nao ter descricao na criacao, nao e bug.

---

### P1-02 — `isUrgent` sempre `false` no frontend (P1 HIGH)
**Arquivo**: `frontend/.../new/page.tsx` linha 700
**Descricao**: O payload sempre envia `isUrgent: false` (hardcoded). Nao existe nenhum toggle/checkbox na UI para o usuario marcar uma OS como urgente. O backend tem toda a logica de workflow para OS urgentes (`os_urgent_created`, `urgent_created` automation event), mas o frontend nunca ativa.
**Impacto**: Funcionalidade de OS urgente e inacessivel na tela de criacao. Workflows com trigger `os_urgent_created` nunca serao acionados via criacao manual.
**Correcao sugerida**: Adicionar checkbox "OS Urgente" na UI, similar ao checkbox de retorno.

---

### P2-01 — Sem protecao contra double-click/double-submit (P2 MEDIUM)
**Arquivo**: `frontend/.../new/page.tsx` linhas 573-775
**Descricao**: O botao submit e desabilitado com `disabled={loading}` (linha 1356), e o state `loading` e setado como `true` na linha 576. Isso FUNCIONA para desabilitar o botao, mas existe um gap: se o usuario clicar duas vezes muito rapido antes do React re-render, `handleSubmit` pode ser chamado duas vezes antes de `loading` virar `true`. O `e.preventDefault()` nao protege contra isso.
**Impacto**: Em conexoes lentas ou computadores lentos, pode criar OS duplicada.
**Correcao sugerida**: Usar `useRef` para um flag booleano de submissao imediata (sincrono), checado no inicio de `handleSubmit` antes de qualquer `await`.

---

### P2-02 — `deadlineAt` nao validado no frontend (date no passado) (P2 MEDIUM)
**Arquivo**: `frontend/.../new/page.tsx` linha 665; `backend/.../dto/create-service-order.dto.ts` linha 30
**Descricao**: O campo `deadlineAt` e `required` na UI (input type datetime-local), mas nao ha validacao se a data e no futuro. O DTO backend valida apenas `@IsDateString()` — aceita qualquer data, inclusive datas passadas.
**Impacto**: Usuario pode criar OS com prazo ja vencido.
**Correcao sugerida**: Adicionar validacao no frontend (comparar com `new Date()`) e/ou no backend com `@MinDate()` ou validacao customizada.

---

### P2-03 — `techAssignmentMode` DTO aceita qualquer string (P2 MEDIUM)
**Arquivo**: `backend/.../dto/create-service-order.dto.ts` linha 75
**Descricao**: O campo `techAssignmentMode` e tipado como `@IsString()` com comentario `'BY_SPECIALIZATION' | 'DIRECTED' | 'BY_WORKFLOW'`, mas nao tem validacao `@IsIn()`. Um payload malicioso pode enviar qualquer valor (ex: `"FOOBAR"`). O backend nao fara match com nenhum modo e vai cair no default `BY_SPECIALIZATION` (linha 85 do service), mas e uma validacao frouxa.
**Impacto**: Nenhum crash, mas comportamento silencioso — valor invalido e aceito e gravado no banco sem erro.
**Correcao sugerida**: Usar `@IsIn(['BY_SPECIALIZATION', 'DIRECTED', 'BY_WORKFLOW', 'BY_AGENDA'])` no DTO.

---

### P2-04 — `BY_AGENDA` e aceito no backend mas nao existe no frontend (P2 MEDIUM)
**Arquivo**: `backend/.../service-order.service.ts` linhas 88, 138, 223
**Descricao**: O backend tem logica especial para `techAssignmentMode === 'BY_AGENDA'` (auto-atribui tecnico, status ATRIBUIDA, trigger `os_agenda_created`). Mas o frontend nao tem a opcao "BY_AGENDA" no `TechAssignmentMode` — as opcoes sao BY_SPECIALIZATION, DIRECTED, BY_WORKFLOW. O modo BY_AGENDA parece ser ativado implicitamente quando um workflow tem `scheduleConfig` + agendaSelection, mas o frontend envia `techAssignmentMode: "BY_WORKFLOW"` nesses casos (linha 676), nao "BY_AGENDA".
**Impacto**: O path `BY_AGENDA` do backend (linhas 138-142) nunca e atingido via frontend, porque o frontend sempre envia `BY_WORKFLOW` mesmo com agenda. No entanto, o `assignedPartnerId` E enviado (linha 682), e o backend trata isso na condicao `data.techAssignmentMode === 'BY_AGENDA' && data.assignedPartnerId` — que NUNCA e verdadeira porque o mode e "BY_WORKFLOW".
**Impacto real**: Quando o usuario seleciona um tecnico na agenda CLT e submete, o tecnico NAO e pre-atribuido, a OS fica em ABERTA em vez de ATRIBUIDA, e o `assignedPartnerId` e ignorado. A funcionalidade de agendamento CLT esta QUEBRADA para o fluxo de pre-atribuicao.
**Correcao sugerida**: Ou (a) mudar o frontend para enviar `techAssignmentMode: "BY_AGENDA"` quando `hasAgendaFromWorkflow && agendaSelection`, ou (b) mudar o backend para verificar `assignedPartnerId` independente do mode.

---

### P2-05 — `items` no DTO sem validacao de campos internos (P2 MEDIUM)
**Arquivo**: `backend/.../dto/create-service-order.dto.ts` linhas 154-155
**Descricao**: O campo `items` e tipado como `{ serviceId: string; quantity: number }[]` mas nao tem `@ValidateNested()` nem `@Type()` para transformar/validar os objetos internos. O `class-validator` nao valida automaticamente objetos plain — aceita qualquer formato.
**Impacto**: Um payload com `items: [{ serviceId: 123, quantity: "abc" }]` passaria a validacao do DTO. O backend faz `findMany` e `|| 1` como fallback (linha 167), mas e uma brecha de validacao.
**Correcao sugerida**: Criar uma classe `CreateServiceItemDto` com `@IsString() serviceId` e `@IsNumber() @Min(1) quantity`, e usar `@ValidateNested({ each: true }) @Type(() => CreateServiceItemDto)`.

---

### P2-06 — Conflito DIRECTED + auto-assign com skipNotifications (P2 MEDIUM)
**Arquivo**: `backend/.../service-order.service.ts` linhas 94-148 e 232-256
**Descricao**: Quando `techAssignmentMode === 'DIRECTED'` com tecnicos selecionados, o backend auto-atribui o primeiro tecnico (linhas 144-148, status ATRIBUIDA). Mas DEPOIS, o codigo verifica `shouldReview` (skipNotifications ou TECH_REVIEW_SCREEN no workflow). Se `shouldReview` e `true`, retorna `_pendingReview` com os candidatos.
**Problema**: O tecnico JA foi atribuido (status ATRIBUIDA, assignedPartnerId setado) ANTES da review. Se o usuario na TechReviewModal escolher um tecnico diferente, a OS ja esta atribuida ao primeiro. O `dispatchNotifications` method (linha 393-396) atualiza `directedTechnicianIds` e pode atribuir outro, mas o fluxo e confuso e pode gerar inconsistencia.
**Correcao sugerida**: Quando shouldReview e detectado, NAO fazer auto-assign do DIRECTED — deixar pendente para a TechReviewModal decidir.

---

### P3-01 — `scheduledEndAt` nao existe no sistema (P3 LOW)
**Descricao**: O schema Prisma nao tem `scheduledEndAt`. So tem `scheduledStartAt` + `estimatedDurationMinutes`. Isso e consistente — o frontend calcula a duracao e nao precisa de end date separado. Nao e bug, apenas nota.

---

### P3-02 — `acceptTimeoutMinutes` e `enRouteTimeoutMinutes` nao enviados na criacao (P3 LOW)
**Arquivo**: `frontend/.../new/page.tsx` linhas 659-703
**Descricao**: Os campos de timeout so sao mostrados e enviados no modo edicao (linhas 709-720). Na criacao, o DTO aceita esses campos, mas o frontend nao os envia. O backend usa `undefined` como fallback, que no schema significa "usar do fluxo" (null).
**Impacto**: Nenhum — e o comportamento esperado (criar usa os tempos do fluxo). Mas impede que o usuario customize tempos na criacao.
**Correcao**: Decisao de negocio se quer permitir customizar na criacao.

---

### P3-03 — `getCandidateTechnicians` nao filtra por `companyId` no modo DIRECTED (P3 LOW)
**Arquivo**: `backend/.../service-order.service.ts` linhas 325-341
**Descricao**: No modo DIRECTED, a query busca tecnicos por `id: { in: data.directedTechnicianIds }` mas nao filtra por `companyId`. Os IDs vem do frontend (que ja filtrou), mas um payload manipulado poderia incluir IDs de tecnicos de outra empresa (em contexto multi-tenant).
**Impacto**: Baixo — a OS ja e criada com os IDs, esta funcao so retorna os dados para exibicao na TechReviewModal. Mas e uma boa pratica filtrar por companyId.
**Correcao sugerida**: Adicionar `companyId` na clausula `where`.

---

### P3-04 — Geocoding falha silenciosa (P3 LOW)
**Arquivo**: `frontend/.../new/page.tsx` linhas 625-631
**Descricao**: Se `geocodeAddress` retornar `null`, `lat` e `lng` ficam `undefined` no payload e a OS e criada sem coordenadas. Nao ha aviso ao usuario.
**Impacto**: OS sem coordenadas nao aparecera corretamente no mapa. Funcionalidades de proximidade (tracking, alerta de chegada) nao funcionarao.
**Correcao sugerida**: Mostrar um aviso (nao bloqueante) ao usuario quando geocoding falha.

---

### P3-05 — `clientPartnerId` no backend aceita string vazia (P3 LOW)
**Arquivo**: `backend/.../service-order.service.ts` linha 111
**Descricao**: O backend usa `data.clientPartnerId || undefined`, transformando string vazia em `undefined`. O DTO tem `@IsNotEmpty()` no `clientPartnerId` (linha 38), o que deveria bloquear string vazia. No entanto, a validacao do frontend ja garante que o cliente e selecionado (linha 580).
**Impacto**: Nenhum — dupla protecao funciona.

---

### P3-06 — Valor da OS calculado no frontend, nao revalidado no backend (P3 LOW)
**Arquivo**: `frontend/.../new/page.tsx` linhas 564, 664; `backend/.../service-order.service.ts` linhas 108, 152-175
**Descricao**: O `valueCents` e calculado no frontend pela soma dos itens (linha 564) e enviado no payload (linha 664). O backend salva esse valor direto (linha 108) e TAMBEM cria os items (linhas 152-175), mas NAO recalcula/valida se `valueCents` === soma dos items. Um payload manipulado poderia enviar `valueCents: 0` com items que somam 10000.
**Impacto**: O valor da OS pode nao corresponder aos items. Financeiro pode ficar inconsistente.
**Correcao sugerida**: No backend, recalcular `valueCents` a partir dos items (precos atuais do banco) em vez de confiar no frontend.

---

### P3-07 — Commission BPS calculado no frontend, nao revalidado (P3 LOW)
**Arquivo**: `frontend/.../new/page.tsx` linhas 565-571, 696-697
**Descricao**: Similar ao P3-06: `commissionBps` e `techCommissionCents` sao calculados no frontend e enviados no payload. O backend salva sem recalcular.
**Impacto**: Um payload manipulado poderia definir comissao zero ou inflada.
**Correcao sugerida**: Recalcular no backend baseado nos items.

---

## RESUMO

| Severidade | Quantidade | IDs |
|-----------|-----------|-----|
| P0 (Critico) | 0 | — |
| P1 (Alto) | 2 | P1-01, P1-02 |
| P2 (Medio) | 6 | P2-01 a P2-06 |
| P3 (Baixo) | 7 | P3-01 a P3-07 |

### Top 3 para corrigir primeiro:
1. **P2-04** — Agendamento CLT quebrado (BY_AGENDA nunca ativado) — funcionalidade nao funciona
2. **P2-06** — DIRECTED + auto-assign conflita com TechReviewModal — pode gerar OS com tecnico errado
3. **P1-02** — isUrgent sempre false — funcionalidade inacessivel

### Items que NAO sao bugs (decisoes de negocio):
- P1-01 (description na criacao) — pode ter sido intencional nao mostrar
- P3-02 (timeouts na criacao) — pode ter sido intencional nao mostrar
- P3-01 (scheduledEndAt) — nao existe e nao precisa
