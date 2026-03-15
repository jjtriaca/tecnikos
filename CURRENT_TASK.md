# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 113 — Revisao Workflow vs Spec (EM ANDAMENTO)

## Ultima sessao: 113 (15/03/2026)
- Sessao 111: Melhorias Servicos + Checklists (v1.03.34)
- Sessao 112: Fase 4 — Workflow UI Checklists (v1.03.51)
- Sessao 113: Revisao Workflow vs Spec + Fixes (v1.03.57)

## O que foi feito nesta sessao:

### Revisao etapa-por-etapa contra CHECKLIST_WORKFLOW_SPEC.md
- [x] ABERTA: OK (conforme spec)
- [x] OFERTADA: OK (conforme spec)
- [x] A_CAMINHO: OK (conforme spec)
- [x] ATRIBUIDA: OK (conforme spec)
- [x] EM_EXECUCAO: Convertido para execLinkLayout ordenavel, removido Ferramentas/Materiais
- [x] CONCLUIDA: Convertido para concLinkLayout ordenavel
- [x] Fix race condition: checkbox + techActions em single onChange
- [x] Removido bl_12/bl_13 (Texto livre 2/3) do decompiler
- [x] PhotoRequirementList inline no bloco foto EM_EXECUCAO
- [x] Labels melhorados: "Assinatura do cliente", placeholders descritivos
- [x] Step sub-toggles: "Exigir foto"/"Exigir nota"
- [x] Deploy v1.03.57 OK

## Arquivos modificados:
- `frontend/src/types/stage-config.ts` — execLinkLayout, concLinkLayout, compiler/decompiler
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — UI ordenavel EM_EXECUCAO/CONCLUIDA

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

### Extras implementados (v1.03.57 → v1.03.61)
- [x] Foto por momento: "Durante o serviço" + hints de posição no link
- [x] Formulário rico: unidade (30+ chips), largura mobile, multiline, validação
- [x] Formulário em todas as etapas: ABERTA p2, ATRIBUIDA, EM_EXEC, CONCLUIDA, APROVADA
- [x] APROVADA: formulário do gestor (tema emerald)

### Revisão completa do fluxo mobile (v1.03.61)
- [x] Ferramentas/EPI e Materiais mantidos FORA da EM_EXECUCAO (decisão do Juliano)
- [x] Cada stage independente com seu próprio techActions.form.fields
- [x] page2Layout, execLinkLayout, concLinkLayout: compiler/decompiler com merge OK
- [x] Sem conflito de dados entre forms de stages diferentes

## Versao atual: v1.03.61 (deployed)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
