# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 115 — Unificar Create/Edit OS + Fixes (CONCLUIDO)

## Ultima sessao: 115 (16/03/2026)
- Sessao 113: Revisao Workflow vs Spec + Fixes (v1.03.61)
- Sessao 114: Fix link mobile vs pageLayout config + DIRECTED fix + checklist UX (v1.03.65)
- Sessao 115: Unificar create/edit OS form (v1.03.66)

## O que foi feito nesta sessao:

### Unificacao Create/Edit OS (v1.03.66)
- [x] Backend: `items` adicionado ao `UpdateServiceOrderDto` (replace strategy: delete all + recreate)
- [x] Backend: `service-order.service.ts` processa items no update com recalculo de valueCents
- [x] Frontend: `NewOrderPage` aceita `editId` prop para modo dual
- [x] Frontend: `OrderForm` named export com Suspense wrapper
- [x] Frontend: useEffect carrega OS existente (client, items, address, city, tech assignment, timeouts, return, scheduling)
- [x] Frontend: handleSubmit usa PUT quando editId presente, POST quando criando
- [x] Frontend: Breadcrumb contextual (Nova OS vs Editar > OS Title)
- [x] Frontend: Status badge no header quando editando
- [x] Frontend: Terminal status warning + disabled submit
- [x] Frontend: Description textarea (edit mode only)
- [x] Frontend: Tempos Limite section (accept/en-route timeouts) em CollapsibleSection (edit mode only)
- [x] Frontend: Cancel link vai para detalhe da OS no edit mode
- [x] Frontend: Loading skeleton enquanto carrega OS para editar
- [x] Frontend: `orders/[id]/edit/page.tsx` reduzido de ~1250 linhas para 14 linhas (wrapper)
- [x] TypeScript clean (backend + frontend)

## Arquivos modificados:
- `backend/src/service-order/dto/update-service-order.dto.ts` — items field
- `backend/src/service-order/service-order.service.ts` — items processing no update
- `frontend/src/app/(dashboard)/orders/new/page.tsx` — dual mode create/edit
- `frontend/src/app/(dashboard)/orders/[id]/edit/page.tsx` — wrapper simples

## Pendente:
- Deploy v1.03.66
- FUTURO: Verificacao visual completa do workflow editor
- FUTURO: Mecanismo para clientes solicitarem melhorias
- FUTURO: Contrato do cliente com a Tecnikos
- FUTURO: Fix logradouro em dados importados do Sankhya
- FUTURO: Discutir/remover commissionBps global da empresa
- FUTURO: Workflow config "Respeitar tecnico direcionado"

## Versao atual: v1.03.66 (pronto para deploy)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
