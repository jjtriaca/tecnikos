# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 110 — Reorganizacao Nova OS + Servicos por Item (EM ANDAMENTO)

## Ultima sessao: 110 (15/03/2026)
- Sessao 108: Radio unificado com paineis expansiveis (v1.03.22 a v1.03.28)
- Sessao 109: Simplificacao criacao OS + workflow-centric (v1.03.29 a v1.03.30)
- Sessao 110: Reorganizacao Nova OS + Servicos por Item

## O que foi feito nesta sessao:

### Backend — ServiceOrderItem + commissionBps — JA FEITO (sessao anterior)
- [x] Model ServiceOrderItem no schema.prisma (serviceOrderId, serviceId, serviceName, unit, qty, unitPriceCents, commissionBps)
- [x] commissionBps adicionado ao model Service
- [x] Migration manual: 20260315020000_add_service_order_items/migration.sql
- [x] DTOs: commissionBps em CreateServiceDto e UpdateServiceDto
- [x] service.service.ts: commissionBps no create, sortBy validado
- [x] service-order.service.ts: cria ServiceOrderItems apos criar OS, inclui items no findOne
- [x] create-service-order.dto.ts: items array aceito

### Frontend — Pagina de Servicos (commissionBps) — JA FEITO
- [x] Interface Service: commissionBps adicionado
- [x] EMPTY_FORM: commissionBps: ""
- [x] openEditForm: popula commissionBps
- [x] handleSave: envia commissionBps convertido (% → bps)
- [x] Coluna "Comissao" adicionada a tabela
- [x] Campo "Comissao (%)" no formulario

### Frontend — ServiceItemsSection (NOVO) — JA FEITO
- [x] Componente `frontend/src/components/os/ServiceItemsSection.tsx` criado
- [x] Lookup de servicos do catalogo (filtro status=active)
- [x] Tabela: Servico | Qtd (editavel) | Un | Valor Unit | Comissao % | Total | Remover
- [x] Total geral calculado
- [x] Prevencao de duplicatas

### Frontend — Nova OS Reorganizada — JA FEITO
- [x] Nova ordem: Cliente → Titulo → Endereco (aberto) → Tipo Atendimento → Servicos → Prazo → Agendamento → Retorno
- [x] REMOVIDO: campo Descricao (vem do servico)
- [x] REMOVIDO: campo Valor solto (vem dos items)
- [x] REMOVIDO: campo Comissao/Valor tecnico (vem do catalogo de servicos)
- [x] REMOVIDO: Tempo para aceitar (definido no fluxo)
- [x] REMOVIDO: Tempo para clicar a caminho (definido no fluxo)
- [x] Endereco: sempre aberto (nao colapsavel), Contato no Local movido para dentro
- [x] Endereco reordenado: Rua/Av + No | Bairro + Cidade | UF + CEP | Complemento
- [x] Agendamento: toggle ON/OFF (nao colapsavel), mostra data/hora quando ativado
- [x] Submit calcula valueCents e commissionBps a partir dos items
- [x] Build frontend OK, Build backend OK

## Arquivos criados/modificados:
- `frontend/src/components/os/ServiceItemsSection.tsx` — NOVO componente
- `frontend/src/app/(dashboard)/services/page.tsx` — commissionBps na interface, form, tabela
- `frontend/src/app/(dashboard)/orders/new/page.tsx` — REESCRITO com nova ordem
- `backend/src/service/service.service.ts` — commissionBps no validSorts

## Pendente:
- [ ] Deploy
- [ ] Atualizar version.json
- FUTURO: Fix logradouro em dados importados do Sankhya (Rua/Av prefix)
- FUTURO: Discutir/remover commissionBps global da empresa
- FUTURO: Workflow config "Respeitar tecnico direcionado"

## Versao atual: v1.03.30 (deployed) — mudancas locais pendentes de deploy

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
