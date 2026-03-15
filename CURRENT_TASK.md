# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 114 — Fix link mobile vs pageLayout (EM ANDAMENTO)

## Ultima sessao: 114 (16/03/2026)
- Sessao 112: Fase 4 — Workflow UI Checklists (v1.03.51)
- Sessao 113: Revisao Workflow vs Spec + Fixes (v1.03.61)
- Sessao 114: Fix link mobile vs pageLayout config (v1.03.63)

## O que foi feito nesta sessao:

### Fix critico: link do tecnico nao respeitava pageLayout
- [x] Backend: `extractLinkConfig` retorna pageLayout e page2Layout
- [x] Backend: `filterChecklistsByLayout` filtra checklists por blocos enabled no pageLayout
- [x] Backend: adicionados campos extras ao response (city, state, contactPersonName, clientPartnerName, commissionCents)
- [x] Backend: include clientPartner na query getPublicView
- [x] Frontend: reescrita completa da renderizacao da oferta baseada em pageLayout
  - Info blocks renderizados na ordem do pageLayout (title, address, commission, value, deadline, clientName, contact, description, city, company)
  - Checklists renderizados na posicao correta do pageLayout (nao mais fixo)
  - Blocos de texto livre renderizados quando enabled
  - Fallback hardcoded para backward compat (sem pageLayout)
  - Distance exibido no primeiro card de info
- [x] TypeScript clean (backend + frontend)
- [x] Deploy v1.03.63 OK

## Arquivos modificados:
- `backend/src/public-offer/public-offer.service.ts` — include clientPartner, campos extras, filterChecklistsByLayout
- `frontend/src/app/p/[token]/page.tsx` — tipos atualizados, renderizacao por pageLayout

## Pendente:
- TESTAR: link do tecnico deve agora respeitar config do workflow
- FUTURO: Verificacao visual completa do workflow editor
- FUTURO: Fix tecnico DIRECTED assignment — assignedPartnerId nao definido
- FUTURO: Atualizar pagina editar OS para match com criar OS
- FUTURO: Mecanismo para clientes solicitarem melhorias
- FUTURO: Contrato do cliente com a Tecnikos
- FUTURO: Fix logradouro em dados importados do Sankhya
- FUTURO: Discutir/remover commissionBps global da empresa
- FUTURO: Workflow config "Respeitar tecnico direcionado"

## Versao atual: v1.03.63 (deployed)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
