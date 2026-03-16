# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 125 — Immediate Session Invalidation + Billing Audit (v1.03.89)

## Ultima sessao: 125 (16/03/2026)
- Sessao 122: Header billing indicators (v1.03.79)
- Sessao 123: Billing cycle + pro-rata + grandfather + structured plan features (v1.03.81-82)
- Sessao 124: Plan Limits Enforcement + Audit + Single Session (v1.03.83-86)
- Sessao 125: Immediate Session Invalidation + Billing Audit (v1.03.87-89)

## O que foi feito na sessao 125:

### Immediate Session Invalidation (v1.03.87-88)
- [x] auth.types.ts: +sessionId em JwtPayload e AuthenticatedUser
- [x] auth.service.ts: issueAccessToken() aceita sessionId
- [x] auth.service.ts: login() cria session PRIMEIRO, depois gera JWT com sessionId
- [x] auth.service.ts: refresh() idem — session antes, JWT depois
- [x] jwt.strategy.ts: validate() verifica session ativa no DB a cada request
- [x] jwt.strategy.ts: session revogada → UnauthorizedException imediato
- [x] Frontend api.ts: 401 apos falha de refresh → redirect para /login?expired=1
- [x] Frontend login/page.tsx: banner "Sessao encerrada" quando ?expired=1
- [x] Deploy v1.03.87 e v1.03.88 — CONCLUIDO, testado bidirecional OK

### Billing Page Audit (v1.03.89)
- [x] asaas.service.ts: getBillingStatus() corrigido — busca Promotion, calcula desconto real
- [x] asaas.service.ts: retorna planId + planPriceCents para comparacao upgrade/downgrade
- [x] tenant-public.controller.ts: +maxTechnicians, maxAiMessages, supportLevel, allModulesIncluded no select
- [x] billing/page.tsx: PlanCard com todas features, preco anual, "Apos promocao" indicator
- [x] billing/page.tsx: filtra plano atual das listas de upgrade/downgrade
- [x] Deploy v1.03.89 — CONCLUIDO

### Investigacao chatIAEnabled toggle
- [x] Codigo verificado — toggle existe e funciona corretamente no form de usuarios
- [x] Provavel causa do relato: deploy ainda nao tinha sido feito no momento

## Pendente:

### BLOQUEADO
- **WhatsApp Business** — Conta desativada pelo Meta, recurso enviado. Apos reativacao: template aviso_os com CTA

### A FAZER
1. **Mecanismo de Add-on** — Planejar compra de add-ons (usuarios, OS, msgs IA, tecnicos)
2. **Avaliacao/Feedback do servico** — Fluxo ponta a ponta (gerar token, enviar link ao cliente, UI gestor avaliar). Estudo salvo em memory/avaliacao-feedback-estudo.md
3. **Sistema de sugestoes** — Botao "Solicitar melhoria" no chat IA → sugestoes para Juliano
4. **Configuracoes empresa readonly** — Campos vem do onboarding/licenca, so "Buscar na Receita" atualiza. Responsavel Legal so troca via solicitacao (botao "Solicitar troca")
5. **Enforcement pendente**: supportLevel e allModulesIncluded (implementar quando sistema de suporte existir)
6. **Verificacao visual do workflow editor** — Revisao completa da UI
7. **Contrato do cliente com a Tecnikos**
8. **Frontend: mensagens de limite atingido + botoes de compra add-on** (para cada tela: users, OS, partners, chat)

## Versao atual: v1.03.89

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
