# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 112 — Fase 4 Workflow UI (CONCLUIDO)

## Ultima sessao: 112 (15/03/2026)
- Sessao 111: Melhorias Servicos + Checklists (v1.03.34)
- Sessao 112: Fase 4 — Workflow UI Checklists (v1.03.51)

## O que foi feito nesta sessao:

### Fase 4 — Workflow UI (StageSection) — v1.03.51
- [x] stage-config.ts: gps_button/enroute_button no LinkPageBlock, page2Layout defaults
- [x] ABERTA Page 1: blocos checklist ordenaveis no pageLayout com inline mode/required config
- [x] ABERTA Page 2: GPS/en-route/checklists como page2Layout ordenavel (substitui toggles hardcoded)
- [x] ABERTA: Pergunta movida para antes do botao Aceitar
- [x] ATRIBUIDA: filtrado para so checklists relevantes (toolsPpe, materials, custom) + observacao
- [x] EM_EXECUCAO: secao renomeada "Pagina do Link", itens ordenaveis + footer info
- [x] CONCLUIDA: secao renomeada "Pagina do Link", filtrado finalCheck/custom + foto/assinatura/observacao
- [x] Compiler/Decompiler: GPS/en-route derivados do page2Layout, backward compat
- [x] Build TypeScript limpo (zero erros)
- [x] Deploy v1.03.51 OK

## Arquivos modificados:
- `frontend/src/types/stage-config.ts` — LinkPageBlock types, page2Layout defaults, compiler/decompiler
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — UI reestruturada para checklists

## Pendente:
- FUTURO: Verificacao visual completa do workflow editor (preview nao autenticou)
- FUTURO: Fix tecnico DIRECTED assignment — assignedPartnerId nao definido
- FUTURO: Atualizar pagina editar OS para match com criar OS
- FUTURO: Configuracao de momento dos checklists no workflow
- FUTURO: Mecanismo para clientes solicitarem melhorias
- FUTURO: Contrato do cliente com a Tecnikos
- FUTURO: Fix logradouro em dados importados do Sankhya
- FUTURO: Discutir/remover commissionBps global da empresa
- FUTURO: Workflow config "Respeitar tecnico direcionado"

## Versao atual: v1.03.51 (deployed)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
