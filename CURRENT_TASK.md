# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 122+ — Correcoes Arquiteturais Workflow (CONCLUIDO)

## Ultima sessao: 122+ (14/03/2026)
- Sessao 120: Triggers, Conflito, Especializacao, Templates, Client Onboarding (v1.02.64-71)
- Sessao 121: Security Hardening + Access Geo (v1.02.72-73)
- Sessao 121+: isUrgent, Reorganizacao Form, Fix Trigger, Auditoria (v1.02.83-85)
- Sessao 122+: Correcoes Arquiteturais Workflow (v1.02.86)

## O que foi feito nesta sessao:

### 4 Correcoes Arquiteturais baseadas na Auditoria (v1.02.86)
- [x] 1. Remocao completa do conceito isDefault (7 arquivos backend+frontend)
- [x] 2. Trigger-based workflow selection via findWorkflowByTrigger()
- [x] 3. Remocao DELAY e SLA (tipos, UI, compile/decompile, backend handlers, presets)
- [x] 4. Reordenacao de campos no StageSection (scheduleConfig primeiro)
- [x] 5. Ghost triggers removidos (quote_request_created, quote_created)
- [x] Build backend ✅ frontend ✅
- [x] Deploy v1.02.86

## Arquivos modificados:
- `backend/src/workflow/workflow-engine.service.ts` — findWorkflowByTrigger, removido DELAY/SLA/RESCHEDULE
- `backend/src/service-order/service-order.service.ts` — trigger matching em create/assign
- `backend/src/workflow/workflow.service.ts` — removido isDefault
- `backend/src/partner/partner.service.ts` — orderBy sortOrder
- `backend/src/whatsapp/whatsapp.service.ts` — orderBy sortOrder
- `frontend/src/types/stage-config.ts` — removido sla/delay types, ghost triggers, presets fix
- `frontend/src/app/(dashboard)/workflow/page.tsx` — removido isDefault
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — removido SLA/DELAY toggles, reorder
- `frontend/src/components/os/TechAssignmentSection.tsx` — removido isDefault badge

## Versao atual: v1.02.86 (em producao)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
