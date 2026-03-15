# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 109 — Simplificacao criacao OS + workflow-centric (EM ANDAMENTO)

## Ultima sessao: 109 (15/03/2026)
- Sessao 107: Fix GPS + Hints + Workflow Cleanup + Cheguei + Radio (v1.03.13 a v1.03.21)
- Sessao 108: Radio unificado com paineis expansiveis (v1.03.22 a v1.03.28)
- Sessao 109: Simplificacao criacao OS + workflow-centric (v1.03.29)

## O que foi feito nesta sessao:

### Simplificacao do formulario Nova OS — v1.03.29 — JA FEITO
- [x] Removido "Por agenda" e "Urgente" como opcoes separadas no Tipo de Atendimento
- [x] Mantidos: "Por especializacao", "Direcionado", "Por fluxo de atendimento"
- [x] Fluxos como "OS URGENTE" e "CLT Agenda" agora sao workflows normais selecionaveis
- [x] Dropdown de workflows mostra APENAS workflows ativos (activeOnly=true)
- [x] Backend: query param `activeOnly` no GET /workflows (nao quebra pagina de gerenciamento)
- [x] TechAssignmentSection: removido BY_AGENDA, URGENT do type, removido showExtendedModes
- [x] page.tsx Nova OS: removido isAgendaMode, effectiveMode, checkbox "Retorno urgente"
- [x] Agenda CLT continua funcionando via workflow com scheduleConfig (hasAgendaFromWorkflow)
- [x] isUrgent agora sempre false (urgencia definida pelo workflow, nao pelo form)
- [x] Build frontend OK, Build backend OK

## Arquivos modificados:
- `frontend/src/components/os/TechAssignmentSection.tsx` — Tipo simplificado (3 modos)
- `frontend/src/app/(dashboard)/orders/new/page.tsx` — Removida logica BY_AGENDA/URGENT
- `backend/src/workflow/workflow.controller.ts` — Query param activeOnly
- `backend/src/workflow/workflow.service.ts` — Filtro isActive condicional

## Pendente:
- Deploy v1.03.29
- Futuro: Configuracao no workflow para "Respeitar tecnico direcionado"
- Futuro: Gatilhos condicionais no workflow (match por especializacao, modo, etc.)

## Versao atual: v1.03.29 (local, pronto para deploy)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
