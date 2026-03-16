# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 126 — Landing Page Audit + Simplificacao + Add-on Multi-Type (v1.03.90-93)

## Ultima sessao: 126 (16/03/2026)
- Sessao 123: Billing cycle + pro-rata + grandfather + structured plan features (v1.03.81-82)
- Sessao 124: Plan Limits Enforcement + Audit + Single Session (v1.03.83-86)
- Sessao 125: Immediate Session Invalidation + Billing Audit (v1.03.87-89)
- Sessao 126: Landing Page Audit + Simplificacao + Add-on Multi-Type (v1.03.90-93)

## O que foi feito na sessao 126:

### Landing Page Audit + Structured Fields (v1.03.90)
- [x] PublicPlan interface: +maxTechnicians, maxAiMessages, supportLevel, allModulesIncluded
- [x] tenant-public.controller.ts: select inclui campos estruturados
- [x] LandingContent.tsx: feature list construida a partir de campos reais do banco
- [x] Corrigido: badges e informacoes divergentes entre admin e landing page

### Extra Features Filter + Badge Fix (v1.03.91)
- [x] skipPatterns regex para filtrar features redundantes do array legado
- [x] Badge "Tecnicos ilimitados" removido (era falso — Essencial=6, Profissional=10)

### Landing Page Simplificacao (v1.03.92)
- [x] Removidos: Segments, Features, Beta banner, badges, add-ons section, CTA section
- [x] Estrutura final: Header → Hero → Pioneer → Plans → Footer (~476 linhas removidas)
- [x] Pagina muito mais limpa e focada

### Add-on Multi-Type Mechanism (v1.03.93)
- [x] Schema: AddOn e AddOnPurchase expandidos com 4 tipos (OS, users, technicians, AI messages)
- [x] Migration: 20260316120000_addon_multi_type
- [x] Backend: CRUD add-ons suporta 4 tipos, createAddOnCheckout/purchaseAddOn/confirmAddOnPayment multi-type
- [x] creditAddOnToTenantCompany(): incrementa limites corretos na Company do tenant
- [x] Frontend: pagina admin /ctrl-zr8k2x/addons com form completo (4 quantidades + preco em R$)
- [x] Deploy v1.03.93

## Pendente:

### BLOQUEADO
- **WhatsApp Business** — Conta desativada pelo Meta, recurso enviado. Apos reativacao: template aviso_os com CTA

### A FAZER
1. **Definir precos dos add-ons** — Aguardando decisao do Juliano sobre valores
2. **Frontend: mensagens de limite atingido + botoes de compra add-on** (para cada tela: users, OS, partners, chat)
3. **Avaliacao/Feedback do servico** — Fluxo ponta a ponta (gerar token, enviar link ao cliente, UI gestor avaliar). Estudo salvo em memory/avaliacao-feedback-estudo.md
4. **Sistema de sugestoes** — Botao "Solicitar melhoria" no chat IA → sugestoes para Juliano
5. **Configuracoes empresa readonly** — Campos vem do onboarding/licenca, so "Buscar na Receita" atualiza. Responsavel Legal so troca via solicitacao (botao "Solicitar troca")
6. **Enforcement pendente**: supportLevel e allModulesIncluded (implementar quando sistema de suporte existir)
7. **Verificacao visual do workflow editor** — Revisao completa da UI
8. **Contrato do cliente com a Tecnikos**

## Sessao 126 (continuacao) — Add-on Pricing + Cleanup (v1.03.94)
- [x] Banners hardcoded removidos da pagina de planos
- [x] 9 pacotes add-on cadastrados com precos calculados logicamente
- [x] Pacote menor +25 OS adicionado a pedido do Juliano
- [x] Decisao: add-on NAO faz rollover (vale pro ciclo vigente)
- [x] Deploy v1.03.94

## Auditoria + Correcoes Criticas (v1.03.95)
- [x] Cron expireAddOnPurchases — reverte limites quando add-on expira
- [x] purchase-addon movido para /auth/ (autenticado, tenantId do session)
- [x] Onboarding: +maxTechnicians +maxAiMessages na Company
- [x] syncTenantLimits: GREATEST (nunca diminui por add-ons)
- [x] validate-code: rate limit 10/min
- [x] Webhook: log de warning quando add-on nao confirma
- [x] Index expiresAt no AddOnPurchase
- [x] Deploy v1.03.95

### Correcoes ALTOS (v1.03.96-97):
- [x] Endpoint publico purchase-addon removido (v1.03.96)
- [x] Anti-fraude cooldown users/technicos (24h dobra a cada vez)
- [x] Credito pro-rata aplicado via Asaas discount no webhook
- [x] Add-on checkout com externalReference + confirmAddOnById
- [x] Cron applyPendingDowngrades (00:30 daily)
- [x] Promocao anual: decrementa 12 meses por pagamento ANNUAL
- [x] Deploy v1.03.97

## Correcoes MEDIOS (v1.03.98):
- [x] Race condition webhook: atomic updateMany(status != ACTIVE) impede ativacao duplicada
- [x] Invoice template null-safe: fallback para template padrao se config.serviceDescriptionTemplate null
- [x] Auto-emit deduplication: verifica se ja existe invoice no mes antes de emitir
- [x] Overdue cron idempotency: subscription marcada SUSPENDED apos block (nao reprocessa)
- [x] Onboarding transaction: Company + CodeCounter + User em $transaction atomico
- [x] CreatePlanDto: priceCents @Min(1), priceYearlyCents @Min(1)
- [x] Planos admin: tenant count visivel, botao Reativar para planos inativos
- [x] Add-ons admin: botao Reativar para pacotes inativos
- [x] Landing page: erro visivel se API falhar (em vez de falha silenciosa)
- [x] Dead fields (osUsedThisMonth, osResetDate, extraOsPurchased): mantidos (write-only, inofensivos)
- [x] Deploy v1.03.98

## WhatsApp Safety Fixes (v1.04.00):
- [x] NFS-e: sendText → sendTextWithTemplateFallback(forceTemplate:true)
- [x] Quote (envio/aprovacao/recusa): +forceTemplate:true
- [x] Estudo completo em memory/whatsapp-audit-2026-03.md
- [x] Deploy v1.04.00

## OS Limit Counter Fix (v1.04.03):
- [x] Reauditoria 3 fases: 22 fixes verificados OK
- [x] Bug: monthlyUsage() excluia deletadas (deletedAt: null) mas enforcement contava todas
- [x] Fix: removido deletedAt: null de monthlyUsage() — counter agora inclui deletadas
- [x] Fix: removido deletedAt: null de duplicate() enforcement — consistente com create()
- [x] Regra de negocio: OS deletadas CONTAM no limite mensal (evita burla por create+delete)
- [x] Deploy v1.04.03

## Tenant Suspend + Upgrade + Add-on Fixes (v1.04.04-05):
- [x] Bug CRITICO: upgrade aplicava plano/limites ANTES do pagamento — reescrito para so aplicar no webhook PAYMENT_CONFIRMED
- [x] Bug CRITICO: webhook SUBSCRIPTION_DELETED suspendia tenant sem checar se tinha outra subscription ACTIVE (causou bloqueio da SLS)
- [x] SLS revertida para Essencial (plano correto, nao pagou upgrade)
- [x] Add-on cards: mostravam "+0 ordens" para todos — agora mostra quantidade correta por tipo (users, techs, msgs IA)
- [x] Mensagem de erro/sucesso: scroll automatico para ficar visivel
- [x] Deploy v1.04.04, v1.04.05

## WhatsApp Notification Fix (v1.04.08-09):
- [x] Bug: OS com DIRECTED/BY_AGENDA nao enviava WhatsApp (assign() nunca chamado)
- [x] Fix: notificacao adicionada no create() quando auto-assign acontece
- [x] Fix: notifyStatusChange() usava canal MOCK — corrigido para WHATSAPP
- [x] Exclamacao na OS = "Atrasada!" (deadlineAt no passado, nao e bug)

## Painel de Despacho Flutuante — Fase 1 (v1.04.10):
- [x] Schema: +whatsappMessageId, +errorDetail no Notification
- [x] WhatsApp: sendTextWithTemplateFallback retorna { success, messageId, error }
- [x] NotificationService: salva whatsappMsgId, novo resend(), getDispatchStatus()
- [x] NotificationController: POST /:id/resend
- [x] ServiceOrderService: create() retorna _dispatch com status da notificacao
- [x] ServiceOrderController: GET /:id/dispatch-status (lightweight polling)
- [x] DispatchContext + DispatchPanel flutuante
- [x] OS creation: toast feedback + addDispatch automatico
- [x] Notificacoes page: botao Reenviar para FAILED

## Painel de Despacho — Rewrite + WhatsApp Fix (v1.04.11):
- [x] Fix: link publico /p/{token} nao aparecia no WhatsApp para DIRECTED/BY_AGENDA (removido guard !osAlreadyAssigned)
- [x] Fix: duplicidade de notificacao (removido notifyStatusChange duplicado no create)
- [x] Fix: create() agora await executeStageNotifications e retorna _dispatch corretamente
- [x] DispatchPanel reescrito: cada OS = card flutuante individual
- [x] Cards arrastaveis com posicao salva no backend (User.preferences JSONB)
- [x] Click-to-focus com z-index management
- [x] Cascade from center para novos cards
- [x] Timeline horizontal compacta (emojis 6px, labels 8px)
- [x] Icones TechStatus reduzidos (7px emoji + 10px text)
- [x] Info rica: descricao, cliente, valor, datas, endereco, badges URGENTE/RETORNO
- [x] Global minimize button (icon + badge count)
- [x] Semi-transparente (93% opacity + backdrop-blur)
- [x] SessionStorage persistence para IDs de dispatch
- [x] Migration: User.preferences JSONB
- [x] Endpoints: GET/PATCH /users/me/preferences
- [x] Deploy v1.04.11

## Versao atual: v1.04.11

## Precos antigos de referencia (hardcoded, nunca formalizados):
- +100 OS/mes: R$127
- +200 OS/mes: R$227
- +300 OS/mes: R$297
- +1 usuario gestor: R$47

## Planos atuais em producao:
- Essencial R$197/mes (2 users, 72 OS, 6 techs, 50 AI msgs)
- Profissional R$397/mes (4 users, 198 OS, 10 techs, 200 AI msgs)
- Enterprise R$697/mes (8 users, 594 OS, ilimitado techs, 800 AI msgs)

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
