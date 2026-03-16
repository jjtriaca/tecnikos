# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 124 — Plan Limits Enforcement (v1.03.83)

## Ultima sessao: 124 (16/03/2026)
- Sessao 121: Respeitar tecnico direcionado (v1.03.76-78)
- Sessao 122: Header billing indicators (v1.03.79)
- Sessao 123: Billing cycle + pro-rata + grandfather + structured plan features (v1.03.81-82)
- Sessao 124: Plan Limits Enforcement (v1.03.83)

## O que foi feito na sessao 124:

### Plan Limits Enforcement (v1.03.83)
- [x] Schema: Company +maxTechnicians, +maxAiMessages
- [x] Schema: User +chatIAEnabled, +deactivationCount, +lastDeactivatedAt
- [x] Schema: Partner +deactivationCount, +lastDeactivatedAt
- [x] Migration: 20260316090000_plan_limits_enforcement
- [x] user.service.ts: maxUsers check + chatIAEnabled + deactivation tracking
- [x] user.controller.ts: chatIAEnabled in POST/PUT
- [x] service-order.service.ts: maxOsPerMonth enforcement
- [x] partner.service.ts: maxTechnicians enforcement + deactivation tracking
- [x] chat-ia.service.ts: real maxAiMessages + chatIAEnabled check
- [x] auth.service.ts: me() retorna chatIAEnabled
- [x] tenant-migrator: syncTenantLimits inclui maxTechnicians/maxAiMessages
- [x] tenant.service.ts + asaas.service.ts: propagam novos campos para Company
- [x] Frontend: toggle chatIAEnabled no form de usuario
- [x] Frontend: ChatIA botao escondido para usuarios sem acesso
- [x] Build OK (backend + frontend tsc limpo)
- [ ] Deploy v1.03.83

## Pendente:

### BLOQUEADO
- **WhatsApp Business** — Conta desativada pelo Meta, recurso enviado. Apos reativacao: template aviso_os com CTA

### A FAZER
1. **Avaliacao/Feedback do servico** — Fluxo ponta a ponta (gerar token, enviar link ao cliente, UI gestor avaliar). Estudo salvo em memory/avaliacao-feedback-estudo.md
2. **Sistema de sugestoes** — Botao "Solicitar melhoria" no chat IA → sugestoes para Juliano
3. **Configuracoes empresa readonly** — Campos vem do onboarding/licenca, so "Buscar na Receita" atualiza. Responsavel Legal so troca via solicitacao (botao "Solicitar troca")
4. **Enforcement pendente**: supportLevel e allModulesIncluded (implementar quando sistema de suporte existir)
5. **Verificacao visual do workflow editor** — Revisao completa da UI
6. **Contrato do cliente com a Tecnikos**
7. **Frontend: mensagens de limite atingido + botoes de compra add-on** (para cada tela: users, OS, partners, chat)

## Versao atual: v1.03.83

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
- APIs externas com risco de ban (WhatsApp, Meta, Google): SEMPRE consultar memory/ antes de alterar
- IA embarcada tools: somente configs de ADMIN, nunca janela de entrada no sistema
- Sincronismo: atualizar memory, tools, wizard, prompt ao melhorar APIs
