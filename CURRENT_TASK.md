# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 123 — Billing cycle + pro-rata + grandfather (v1.03.81)

## Ultima sessao: 123 (16/03/2026)
- Sessao 120: Session cleanup automatico + Logradouro fix + Commission removal
- Sessao 121: Respeitar tecnico direcionado (v1.03.76-78)
- Sessao 122: Header billing indicators (v1.03.79)
- Sessao 123: Billing cycle + pro-rata + grandfather + structured plan features (v1.03.81)

## O que foi feito na sessao 123:

### Billing Cycle + Pro-rata + Grandfather (v1.03.81)
- [x] Schema: Subscription +billingCycle, +creditBalanceCents, +pendingPlanId, +pendingPlanAt
- [x] Schema: Plan +maxTechnicians, +maxAiMessages, +supportLevel, +allModulesIncluded
- [x] Schema: Tenant snapshot fields (grandfather) — mesmos 4 campos do Plan
- [x] Migration SQL com populacao de dados
- [x] asaas.service.ts: upgrade reescrito com pro-rata + credito na 1a fatura
- [x] asaas.service.ts: novo schedulePlanDowngrade + cancelPendingDowngrade
- [x] asaas.service.ts: webhook aplica downgrade pendente + snapshot features
- [x] asaas.service.ts: getBillingStatus retorna novos campos
- [x] auth.controller.ts: endpoints /downgrade-plan e /cancel-downgrade
- [x] tenant.controller.ts: updatePlan grandfather (features NAO propagam, preco SIM)
- [x] tenant.service.ts: changePlan faz snapshot completo
- [x] Frontend billing page: saldo credito, downgrade pendente, botoes separados
- [x] Frontend admin plans: campos estruturados editaveis
- [x] HeaderBilling: badge downgrade pendente
- [x] Build OK (backend + frontend tsc limpo)
- [ ] Deploy v1.03.81

## Pendente:

### BLOQUEADO
- **WhatsApp Business** — Conta desativada pelo Meta, recurso enviado. Apos reativacao: template aviso_os com CTA

### A FAZER
1. **Avaliacao/Feedback do servico** — Fluxo ponta a ponta (gerar token, enviar link ao cliente, UI gestor avaliar). Estudo salvo em memory/avaliacao-feedback-estudo.md
2. **Sistema de sugestoes** — Botao "Solicitar melhoria" no chat IA → sugestoes para Juliano
3. **Configuracoes empresa readonly** — Campos vem do onboarding/licenca, so "Buscar na Receita" atualiza. Responsavel Legal so troca via solicitacao (botao "Solicitar troca")
4. **Mudancas de plano respeitam ciclo** — FEITO na sessao 123 (v1.03.81): pro-rata, downgrade no proximo ciclo, grandfather features
5. **Verificacao visual do workflow editor** — Revisao completa da UI
6. **Contrato do cliente com a Tecnikos**

## Versao atual: v1.03.81

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
