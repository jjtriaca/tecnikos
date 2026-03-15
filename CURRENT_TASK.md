# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 111 — Melhorias Servicos + Checklists (CONCLUIDO)

## Ultima sessao: 111 (15/03/2026)
- Sessao 109: Simplificacao criacao OS + workflow-centric (v1.03.29 a v1.03.30)
- Sessao 110: Reorganizacao Nova OS + Servicos por Item (v1.03.31 a v1.03.33)
- Sessao 111: Melhorias Servicos + Checklists (v1.03.34)

## O que foi feito nesta sessao:

### Backend — defaultQty + checklists no Service (v1.03.34)
- [x] Schema: `defaultQty Int?` e `checklists Json?` adicionados ao model Service
- [x] Migration: 20260315030000_add_service_default_qty (ALTER TABLE ADD COLUMN defaultQty + checklists)
- [x] DTOs: defaultQty e checklists em CreateServiceDto e UpdateServiceDto
- [x] service.service.ts: defaultQty e checklists no create

### Frontend — Cadastro de Servicos melhorado (v1.03.34)
- [x] Interface Service: defaultQty e checklists adicionados
- [x] EMPTY_FORM: defaultQty e checklists
- [x] Coluna "Qtd Padrao" na tabela
- [x] Campo "Qtd Padrao" no formulario com hint
- [x] Editor visual de checklists: adicionar checklist → adicionar items → remover
- [x] Acoes na tabela: Editar + Duplicar + Excluir (antes so tinha Excluir)
- [x] handleDuplicate: copia todos os campos incluindo checklists
- [x] openEditForm: popula defaultQty e checklists

### Frontend — ServiceItemsSection (v1.03.34)
- [x] Interface ServiceOption: defaultQty adicionado
- [x] handleAddService: usa svc.defaultQty || 1 como quantidade inicial

### Variaveis de template (v1.03.34)
- [x] NOTIFY_VARS: {servicos_nomes} e {servicos_descricoes} adicionados
- [x] workflow-engine.service.ts: include items na query notifySO, interpolacao das novas variaveis

### Deploy
- [x] v1.03.34 deployed OK

## Arquivos criados/modificados:
- `backend/prisma/schema.prisma` — defaultQty + checklists no Service
- `backend/prisma/migrations/20260315030000_add_service_default_qty/migration.sql`
- `backend/src/service/dto/create-service.dto.ts` — defaultQty + checklists
- `backend/src/service/dto/update-service.dto.ts` — defaultQty + checklists
- `backend/src/service/service.service.ts` — defaultQty + checklists no create
- `backend/src/workflow/workflow-engine.service.ts` — include items + novas variaveis
- `frontend/src/app/(dashboard)/services/page.tsx` — defaultQty, checklists, Editar/Duplicar
- `frontend/src/components/os/ServiceItemsSection.tsx` — defaultQty na interface + uso
- `frontend/src/types/stage-config.ts` — NOTIFY_VARS com servicos_nomes/descricoes

## Pendente:
- FUTURO: Configuracao de momento dos checklists no workflow (ao_iniciar, ao_finalizar, livre)
- FUTURO: Mecanismo para clientes solicitarem melhorias
- FUTURO: Contrato do cliente com a Tecnikos (correcao de precos)
- FUTURO: Fix logradouro em dados importados do Sankhya (Rua/Av prefix)
- FUTURO: Discutir/remover commissionBps global da empresa
- FUTURO: Workflow config "Respeitar tecnico direcionado"

## Versao atual: v1.03.34 (deployed)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
