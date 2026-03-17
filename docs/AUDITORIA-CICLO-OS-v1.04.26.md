# AUDITORIA RIGOROSA — Ciclo Completo da OS (v1.04.26)
**Data**: 2026-03-16 | **Escopo**: Criacao → Fluxo → Aprovada + Painel Flutuante

---

## RESUMO EXECUTIVO

| Severidade | Qtd | Descricao |
|------------|-----|-----------|
| **P0 CRITICO** | 3 | Perda de dados, bypass de regras de negocio |
| **P1 ALTO** | 8 | Logica incorreta, falhas silenciosas |
| **P2 MEDIO** | 16 | Inconsistencias, gaps de validacao |
| **P3 BAIXO** | 9 | Performance, cosmetic, hardening |
| **TOTAL** | **36** | |

---

## P0 — CRITICOS (3)

### P0-01: Sem maquina de estados — updateStatus() aceita QUALQUER transicao
**Arquivos**: `service-order.service.ts` (updateStatus, linha 842)
**Descricao**: `updateStatus()` nao valida transicoes. Permite:
- ABERTA → APROVADA (pula workflow inteiro)
- CANCELADA → EM_EXECUCAO (ressuscita OS terminal)
- APROVADA → ABERTA (retrocede de terminal)
- Nao checa TERMINAL_STATUSES (checagem so existe em cancel/update/finalize)
**Impacto**: Qualquer usuario com role ADMIN/DESPACHO pode corromper o ciclo da OS via API
**Fix**: Adicionar mapa ALLOWED_TRANSITIONS e validar antes do update:
```typescript
const ALLOWED_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  ABERTA: ['OFERTADA', 'ATRIBUIDA', 'CANCELADA'],
  OFERTADA: ['ATRIBUIDA', 'ABERTA', 'CANCELADA'],
  ATRIBUIDA: ['A_CAMINHO', 'EM_EXECUCAO', 'ABERTA', 'CANCELADA'],
  A_CAMINHO: ['EM_EXECUCAO', 'ATRIBUIDA', 'CANCELADA'],
  EM_EXECUCAO: ['CONCLUIDA', 'AJUSTE', 'CANCELADA'],
  AJUSTE: ['EM_EXECUCAO', 'CANCELADA'],
  CONCLUIDA: ['APROVADA', 'AJUSTE'],
  APROVADA: [],
  CANCELADA: [],
  FINALIZADA: [],
};
```

### P0-02: 7 campos do link publico PERDIDOS no compile/save do workflow
**Arquivos**: `stage-config.ts` (compileToV2, linhas 1681-1693)
**Descricao**: O compile do linkConfig NAO inclui 7 campos que existem na UI:
1. `acceptLabel` — Label custom do botao Aceitar
2. `declineButton` — Se mostra botao Recusar
3. `declineLabel` — Label do botao Recusar
4. `declineRequireReason` — Se motivo e obrigatorio
5. `declineReasonMinLen` — Min caracteres do motivo
6. `declineReasonMaxLen` — Max caracteres do motivo
7. `autoAdvanceSeconds` — Timer de auto-avanco

**Impacto**: Usuario configura, salva, recarrega → tudo volta ao default. Perda silenciosa de dados.
**Fix**: Adicionar os 7 campos ao objeto linkConfig no compile E restaurar no decompile.

### P0-03: assign() nao checa status terminal
**Arquivos**: `service-order.service.ts` (assign, linha 792)
**Descricao**: Pode atribuir tecnico a OS CANCELADA, APROVADA ou FINALIZADA.
**Fix**: Adicionar `if (TERMINAL_STATUSES.includes(os.status)) throw ForbiddenException`

---

## P1 — ALTOS (8)

### P1-01: messageDispatch.enabled = true em TODAS as etapas no decompile
**Arquivos**: `stage-config.ts` (mapBlockToStage, linha 2378)
**Descricao**: Decompile de bloco NOTIFY seta `messageDispatch.enabled = true` incondicionalmente. Na ABERTA isso e correto (UI mostra messageDispatch). Nas outras etapas (ATRIBUIDA, EM_EXECUCAO, CONCLUIDA) a UI mostra toggles simples (notifyGestor/notifyCliente), mas o compile usa o path do messageDispatch (ignorando toggles simples).
**Impacto**: Edicoes nos toggles simples de notificacao sao SILENCIOSAMENTE DESCARTADAS no save.
**Fix**: So setar `messageDispatch.enabled = true` quando `stage.status === 'ABERTA'`.

### P1-02: _disableOtherFinancial nunca tratado pelo parent
**Arquivos**: `StageSection.tsx` (linha 2019), `workflow/page.tsx`
**Descricao**: Ao habilitar financeiro na APROVADA com CONCLUIDA ja habilitada, dialog confirma e seta `_disableOtherFinancial: otherStatus`. Mas o parent NUNCA processa esse flag.
**Impacto**: Exclusividade mutua de lancamento financeiro entre CONCLUIDA/APROVADA nao funciona. Ambas ficam habilitadas = lancamento duplicado.
**Fix**: Tratar `_disableOtherFinancial` no onChange do parent, desabilitando a outra etapa.

### P1-03: markArrived() sem validacao de accessKey
**Arquivos**: `public-offer.service.ts` (markArrived, linha 1173)
**Descricao**: Aceita qualquer requisicao com o token, sem verificar accessKey, sem checar se a oferta foi aceita, sem checar se o tecnico e o atribuido. Qualquer pessoa com a URL pode disparar a chegada.
**Fix**: Adicionar validacao de accessKey + verificar que a oferta esta em estado aceito.

### P1-04: isUrgent sempre false — trigger morto
**Arquivos**: `orders/new/page.tsx` (linha ~700)
**Descricao**: Frontend hardcoda `isUrgent: false`. Nao ha toggle de urgencia na UI. Triggers `os_urgent_created` e `urgent_created` nunca disparam por criacao manual.
**Impacto**: Workflows com trigger de OS urgente sao inuteis.
**Fix**: Decidir se urgencia vem do workflow selecionado (BY_WORKFLOW) ou se precisa de toggle na UI.

### P1-05: BY_AGENDA nunca acionado — frontend envia BY_WORKFLOW
**Arquivos**: `orders/new/page.tsx`
**Descricao**: Frontend sempre envia `techAssignmentMode: "BY_WORKFLOW"` quando usa fluxo. O codigo backend que trata BY_AGENDA (auto-assign + status ATRIBUIDA) nunca e atingido. O scheduling de agenda funciona por outro caminho (scheduleConfig do workflow), mas o enum BY_AGENDA e dead code.
**Impacto**: Logica especifica de BY_AGENDA no backend e dead code.
**Fix**: Ou remover BY_AGENDA do backend, ou detectar scheduleConfig no workflow e setar BY_AGENDA automaticamente.

### P1-06: DIRECTED + auto-assign conflita com TechReviewModal
**Arquivos**: `service-order.service.ts` (create)
**Descricao**: Modo DIRECTED auto-atribui o primeiro tecnico (status ATRIBUIDA) ANTES de checar TECH_REVIEW_SCREEN. Se o modal abre e o operador escolhe outro tecnico, a OS ja tem o tecnico errado atribuido.
**Fix**: Mover a checagem de TECH_REVIEW_SCREEN para ANTES do auto-assign. Se shouldReview=true, NAO auto-atribuir.

### P1-07: Stale closures no polling do DispatchContext
**Arquivos**: `DispatchContext.tsx` (linhas 160-233, 267-293)
**Descricao**: O useEffect de polling depende de `dispatches.length` e le `dispatches` do closure externo. Apos uma remocao, o poll ainda itera sobre referencia stale. O `resendNotification` tem problema similar.
**Fix**: Usar ref para ler dispatches atuais dentro do poll, ou usar functional updater pattern.

### P1-08: markEnRoute() NAO muda status para A_CAMINHO
**Arquivos**: `public-offer.service.ts` (markEnRoute, linha 611)
**Descricao**: So seta `enRouteAt`. Status permanece ATRIBUIDA. O status A_CAMINHO existe no enum mas nunca e setado pelo fluxo do link publico.
**Impacto**: OS aparece como ATRIBUIDA no sistema mesmo com tecnico a caminho. Dashboard incorreto.
**Fix**: `markEnRoute()` deve atualizar status para A_CAMINHO se status atual for ATRIBUIDA.

---

## P2 — MEDIOS (16)

### P2-01: cancel() nao limpa PendingWorkflowWait
**Descricao**: Timer de WAIT_FOR pode disparar apos cancelamento.
**Fix**: Resolver todos os waits pendentes com reason 'OS_CANCELLED'.

### P2-02: A_CAMINHO bloqueia advanceStep do workflow
**Descricao**: `advanceStep/advanceBlockV2` permite status ATRIBUIDA, EM_EXECUCAO, AJUSTE mas NAO A_CAMINHO. Tecnico em transito nao consegue avancar o workflow.
**Fix**: Adicionar A_CAMINHO aos status permitidos.

### P2-03: Race condition em advanceStep
**Descricao**: getProgressV2 (read) esta FORA da transaction. Duas requests simultaneas podem criar step logs duplicados.
**Fix**: Mover read para dentro da transaction, ou adicionar unique constraint em (serviceOrderId, blockId).

### P2-04: TECH_REVIEW_SCREEN so detecta V2, nao V3
**Descricao**: Checagem usa `def?.version === 2`. Workflows V3 sao ignorados.
**Fix**: Converter V3→V2 antes de procurar o bloco, ou checar ambos formatos.

### P2-05: Notificacao duplicada no assign()
**Descricao**: assign() chama AMBOS `notifyStatusChange()` E `executeStageNotifications()`. Tecnico pode receber mensagem duplicada.
**Fix**: Usar apenas executeStageNotifications quando workflow esta anexado.

### P2-06: executeStageNotifications segue so chain linear
**Descricao**: Segue ponteiros `next` mas ignora `yesBranch/noBranch` de CONDITION. Notificacoes em branches sao silenciosamente puladas.
**Fix**: Logar warning quando CONDITION encontrado, ou implementar traversal de branches.

### P2-07: STATUS block do workflow pode setar qualquer status
**Descricao**: `executeSystemBlock(STATUS)` aplica targetStatus sem validacao de transicao. Designer pode criar fluxo ABERTA→APROVADA.
**Fix**: Usar a mesma validacao ALLOWED_TRANSITIONS do P0-01.

### P2-08: Checklist obrigatorio nao enforced no backend
**Descricao**: `checklistConfig` define `required: 'REQUIRED'` mas backend nao impede transicao para CONCLUIDA sem checklists completos.
**Fix**: Validar checklists obrigatorios antes de permitir status CONCLUIDA.

### P2-09: Tecnico pode repetir acoes anteriores (backwards flow)
**Descricao**: `markEnRoute`, `startTracking`, `markArrived` podem ser chamados multiplas vezes, sobrescrevendo timestamps.
**Fix**: Idempotencia: se campo ja preenchido, retornar valor existente sem atualizar.

### P2-10: acceptDirect() silenciosa em OS ja aceita
**Descricao**: Se OS ja tem assignedPartnerId + acceptedAt, o metodo nao faz nada mas retorna sucesso + accessKey.
**Fix**: Adicionar `if (so?.acceptedAt) throw BadRequest('OS ja aceita')`.

### P2-11: DispatchPanel renderiza para TODOS os usuarios
**Descricao**: Componente montado no layout do dashboard sem checagem de role.
**Fix**: `if (!hasRole(user, 'ADMIN', 'DESPACHO')) return null`.

### P2-12: Notification controller sem @Roles
**Descricao**: Endpoint `resend` acessivel por FINANCEIRO, LEITURA, etc.
**Fix**: Adicionar `@Roles(UserRole.ADMIN, UserRole.DESPACHO)` ao resend.

### P2-13: Polling sequencial (N+1 requests por intervalo)
**Descricao**: For-of com 10 dispatches = 10 requests sequenciais. Se cada demora 200ms = 2s por ciclo.
**Fix**: Promise.allSettled para polling paralelo, ou endpoint batch.

### P2-14: DTO sem validacao — techAssignmentMode aceita qualquer string
**Descricao**: Sem `@IsIn()` no campo. items[] sem `@ValidateNested()`.
**Fix**: Adicionar validacoes ao DTO.

### P2-15: Variable buttons inserem no final, nao na posicao do cursor
**Descricao**: TextAreaField usa `onChange(value + v.var)`. Regra do CLAUDE.md exige insercao na posicao do cursor via selectionStart/selectionEnd.
**Fix**: Adicionar useRef ao textarea e usar setRangeText() no click do chip.

### P2-16: Variable buttons faltando em campos de alerta de proximidade
**Descricao**: Campos de mensagem de alerta na A_CAMINHO usam TextField sem suporte a vars.
**Fix**: Trocar para TextAreaField com prop vars.

---

## P3 — BAIXOS (9)

### P3-01: DELAY/SLA/RESCHEDULE — stubs sem warning
**Descricao**: Blocos ignorados silenciosamente pelo workflow engine. Sem logger.warn.
**Fix**: Adicionar log de warning no default case de executeSystemBlock.

### P3-02: CONDITION answer comparison fragil
**Descricao**: String matching case-sensitive duplicado em dois lugares. Falta 'S', 'YES', etc.
**Fix**: Extrair helper isYesAnswer() com toLowerCase().

### P3-03: DUPLICATE_OS nao gera code
**Descricao**: prisma.create direto sem CodeGeneratorService. OS duplicada fica sem codigo sequencial.

### P3-04: V1 advanceStep nao chama executeStageNotifications
**Descricao**: Workflows V1 pulam blocos de stage (NOTIFY/FINANCIAL). Aceitavel se V1 e legado.

### P3-05: Preferencias de posicao dos cards acumulam infinitamente
**Descricao**: `dispatchPos_{osId}` salvo nas preferences do usuario. Nunca limpo.
**Fix**: Limpar posicoes ao remover dispatch.

### P3-06: formatDate definida mas nao usada (dead code)
**Descricao**: DispatchPanel.tsx tem funcao nao utilizada.

### P3-07: initialLoadRef/prefsLoadedRef nao resetam no logout
**Descricao**: Se usuario troca de conta sem reload, dispatches do usuario anterior persistem.
**Fix**: Resetar refs quando user.id muda.

### P3-08: Token do link publico sem expiracao pos-aceite
**Descricao**: Apos aceite, accessKey nao tem TTL. Link funciona indefinidamente.
**Fix**: Adicionar TTL pos-aceite (ex: 72h apos revokedAt).

### P3-09: submitPosition sem rate limit
**Descricao**: Endpoint publico sem @Throttle. Spam de posicoes possivel.
**Fix**: Adicionar @Throttle ao endpoint.

---

## RESUMO DE ACOES IMEDIATAS (Top 10)

| # | Achado | Esforco |
|---|--------|---------|
| P0-01 | Maquina de estados (ALLOWED_TRANSITIONS) | ~1h |
| P0-02 | 7 campos link perdidos no compile | ~30min |
| P0-03 | assign() checar terminal | ~5min |
| P1-01 | messageDispatch.enabled condicional ao stage | ~15min |
| P1-02 | _disableOtherFinancial handler no parent | ~20min |
| P1-03 | markArrived() accessKey validation | ~15min |
| P1-06 | DIRECTED + TechReview — checar ANTES do auto-assign | ~20min |
| P1-08 | markEnRoute() setar A_CAMINHO | ~10min |
| P2-11 | DispatchPanel role check | ~5min |
| P2-12 | Notification @Roles | ~5min |
