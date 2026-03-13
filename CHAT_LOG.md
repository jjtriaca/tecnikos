# CHAT LOG — Historico de Conversas e Decisoes

---

## REGRA PERMANENTE (decidida pelo Juliano):
- **Claude decide toda a parte tecnica sozinho e executa sem perguntar**
- Juliano nao tem conhecimento tecnico de construcao
- Claude so para se for uma decisao de NEGOCIO (funcionalidade, UX, prioridade do produto)
- Decisoes tecnicas (arquitetura, libs, padroes, ordem de implementacao): Claude decide e faz

## HISTORICO ANTERIOR:
- Sessoes 2-50 (20/02 a 25/02/2026) arquivadas em `CHAT_LOG_ARCHIVE_20260220-20260225.md`
- Sessoes 51-95 (04/03 a 10/03/2026): NFS-e, Fiscal, Multi-tenant, Seguranca, PPID, Add-ons, Analytics
- Resumo: sistema construido do zero ate v1.02.17

---

## 2026-03-11 — Sessao 96: SEO + Landing Page + Programa Pioneiro + SLS Obras (v1.02.16-17)

### SEO + Indexacao Google (v1.02.16)
- robots.ts, sitemap.ts, metadata completa (OpenGraph, Twitter, canonical)
- JSON-LD (SoftwareApplication + Organization) com CNPJ
- Layouts com metadata para /signup e /(auth) (noindex)

### Landing Page + Programa Pioneiro + SEO (v1.02.17)
- Beta banner no hero, 8 segmentos, 6 funcionalidades
- Programa Pioneiro: 5 vagas (Piscinas, Telecom, Clima, Solar, Seguranca)
- Modal de condicoes com aceite, auto-preenchimento voucher no signup
- Endpoint GET /public/saas/pioneer-slots (vagas dinamicas)
- 5 Promotions criadas no banco: R$15/mes por 6 meses (plano Essencial)
- SEO: ~30 keywords, JSON-LD duplo, header com nav, footer expandido

### Remocao Licenca SLS Obras
- Backup em `/opt/tecnikos/backups/sls_obras_public_data_backup.sql`
- Schema `tenant_sls` dropado, Tenant status SUSPENDED
- Dados no schema public preservados para futura restauracao

### Deploys: v1.02.16, v1.02.17

---

## 2026-03-11 — Sessao 97: SMTP + PPID Producao + Chat IA (v1.02.18-19 + Chat IA)

### SMTP Producao — CONCLUIDO
- docker-compose.production.yml: adicionadas todas as env vars faltantes (SMTP, PPID, Turnstile, Encryption, Base Domain, Anthropic)
- Credenciais: contato@tecnikos.com.br / *Ju290480! via smtp.zoho.com:587
- Test email enviado e recebido com sucesso

### PPID Producao — PENDENTE
- Credenciais configuradas: contato@tecnikos.com.br
- API api.ppid.com.br retornando 404 em todos os endpoints — API fora do ar
- Juliano vai contatar suporte PPID via WhatsApp

### Dashboard fix (v1.02.18) + Pioneer badge clickable (v1.02.19) — CONCLUIDO

### Chat IA — Assistente Inteligente + Onboarding Guiado — EM ANDAMENTO

**Decisoes do Juliano:**
- Provider: Anthropic Claude (Haiku 4.5), custo centralizado
- Contexto do sistema (tools para consultar OS, clientes, financeiro)
- Painel flutuante (chatbot) em todas as paginas
- Boas-vindas no primeiro acesso + guia de configuracoes iniciais
- 9 wizards: Perfil Empresa, Email SMTP, WhatsApp, Workflow, Usuarios, Tecnicos, Fiscal, Pagamento, Automacao
- Dados da empresa nao editaveis manualmente (somente via CNPJ lookup)
- Limites por plano: Essencial=50, Profissional=200, Enterprise=800 msgs/mes

**Backend — CONCLUIDO:**
- Prisma: ChatIAConversation + ChatIAMessage + campos Company (chatIAMonthlyMsgs, chatIAMonthReset, onboardingDismissed)
- Migration 20260311180000_chat_ia_models criada e aplicada
- Modulo: chat-ia.module.ts, chat-ia.service.ts, chat-ia.controller.ts, chat-ia.guard.ts, chat-ia.tools.ts, chat-ia.onboarding.ts, dto/send-message.dto.ts
- @anthropic-ai/sdk instalado
- 7 tools: buscar_ordens_servico, buscar_clientes, resumo_dashboard, buscar_financeiro, buscar_tecnicos, info_empresa, verificar_configuracao
- Endpoints: POST /message, GET /welcome, GET /onboarding-status, GET /usage, GET /conversations, GET /:id/messages, DELETE /:id, GET /status
- Backend compila limpo (tsc --noEmit OK)

**Frontend — CONCLUIDO:**
- ChatIAContext.tsx: estado global (isOpen, messages, conversations, usage, onboarding)
- ChatIAButton.tsx: FAB bottom-right com pulse de onboarding + badge de uso
- ChatIAMessage.tsx: bolhas user/assistant com markdown simples + action buttons
- ChatIAInput.tsx: textarea auto-resize + Enter envia + limite de msgs
- ChatIAPanel.tsx: painel flutuante 400x600 com header, historico, typing indicator
- Integrado no AuthLayout.tsx (ChatIAProvider + ChatIAPanel)
- Frontend compila limpo (next build OK)

**Pendente:**
- ~~ANTHROPIC_API_KEY~~ CONCLUIDO (v1.02.20)
- ~~Deploy para producao~~ CONCLUIDO (v1.02.20)
- ~~Testar end-to-end~~ CONCLUIDO (v1.02.21-22)

---

## 2026-03-11 — Sessao 98: Chat IA Deploy + Melhorias (v1.02.20-22)

### Chat IA Deploy (v1.02.20)
- ANTHROPIC_API_KEY configurada no servidor
- Deploy bem-sucedido, chat funcional em producao

### System Prompt Fix (v1.02.21)
- IA estava inventando funcionalidades que nao existem (orcamentos, etc)
- System prompt reescrito com lista explicita de modulos existentes vs nao existentes

### Chat IA Melhorias (v1.02.22)
- Auto-open no primeiro acesso (localStorage)
- Mobile fullscreen (inset-0 em telas pequenas)
- FAB escondido no mobile quando painel aberto

### PPID — BLOQUEADO (aguardando PPID)
- API retornando 404 porque PPID migrou para nova versao da API
- Suporte confirmou via WhatsApp (11 95675-7384): "nova versao, documentacao nao disponibilizada ainda"
- Cadastro feito como PF (nao encontrou opcao PJ)
- Testes funcionaram por um dia, depois parou
- PPID parou de responder — sem previsao de retorno
- **Bloqueado ate eles fornecerem nova documentacao**

### Asaas (Pagamentos SaaS) — CONFIGURADO
- Codigo 100% implementado (Asaas provider, service, webhooks, admin panel)
- Conta Asaas criada e aprovada (SLS Obras Ltda, Plano Basico Gratuito)
- Chave API de producao gerada e configurada no servidor
- ASAAS_ENV=production, ASAAS_API_KEY=$aact_prod_..., ASAAS_WEBHOOK_TOKEN configurado
- Webhook configurado: https://tecnikos.com.br/api/webhooks/asaas
  - Eventos: Todos de Cobrancas (PAYMENT_*) + Assinaturas (SUBSCRIPTION_*)
  - Token de autenticacao: tecnikos_asaas_webhook_token_2026_secure_v1
  - API v3, tipo envio nao sequencial, fila de sincronizacao ativa

### Wizards de Onboarding (v1.02.24) — CONCLUIDO
- 9 wizards com instrucoes detalhadas campo por campo
- Perfil da Empresa, Email SMTP (presets Gmail/Outlook/Zoho), WhatsApp Business
- Workflow, Usuarios/Permissoes, Tecnicos, Fiscal/NFS-e (Focus NFe completo)
- Formas de Pagamento, Regras de Automacao
- Welcome message melhorada: barra de progresso visual, checklist com status
- Context prefix injeta wizard ativo com instrucoes especificas para o proximo pendente
- Deploy v1.02.24 OK

### Chat IA Streaming SSE (v1.02.23) — CONCLUIDO
- Backend: novo endpoint POST /chat-ia/message-stream com SSE
- Service: streamClaude() com streaming API do Anthropic SDK
- Suporta tool_use loop com streaming (max 6 iteracoes)
- Frontend: fetch + ReadableStream para parsear SSE events
- Eventos: delta (texto), buttons (botoes), thinking (tool exec), done, error
- Bouncing dots somem quando texto comeca a aparecer
- Deploy v1.02.23 OK

---

## 2026-03-12 — Sessao 99/100: Modulo de Orcamentos (Quotes) — COMPLETO

### Decisoes do Juliano (Sessao 99):
1. Relacao com OS: ambos (standalone + vinculado a OS)
2. Fluxo de aprovacao: ambos (link cliente + aprovacao interna), configuravel no fluxo
3. Conteudo: servicos + produtos + mao de obra, configuravel, descontos
4. Quem cria: ADMIN e DESPACHO
5. Entrega: WhatsApp/link configuravel, PDF na geracao de OS, aprovacao dispara acoes configuraveis
6. Adicional: upload de orcamentos PDF de lojas parceiras, opcao de enviar ambos orcamentos

### Implementacao Completa (Sessao 99-100):

**Backend (novo modulo: src/quote/):**
- Prisma: QuoteStatus, QuoteItemType enums, Quote, QuoteItem, QuoteAttachment models
- Migration: 20260312000000_quote_module
- CodeGenerator: QUOTE -> ORC-00001
- quote.service.ts: CRUD + send + approve/reject + cancel + duplicate + createOsFromQuote + cron expiracao
- quote.controller.ts: 13 endpoints REST com @Roles + upload attachments (Multer)
- quote-public.controller.ts: @Public() /q/:token (aprovacao publica)
- quote-pdf.service.ts: PDF A4 profissional com pdfkit
- quote.module.ts: NotificationModule, AuditModule, MulterModule

**Frontend:**
- /quotes (lista): stats cards, FilterBar, DraggableHeader, Pagination, acoes
- /quotes/new: builder com items dinamicos, catalogo, descontos, anexos PDF, totais real-time
- /quotes/[id]/edit: edicao pre-carregada
- /quotes/[id]: detalhe com acoes (enviar, aprovar, rejeitar, cancelar, duplicar, PDF, gerar OS)
- /q/[token]: pagina publica mobile-first para aprovacao pelo cliente

**Builds:** Backend tsc OK, Frontend next build OK

---

## 2026-03-12 — Sessao 101: Senha Forte no Signup + Planos Pendentes

### Decisoes do Juliano:
- PPID bloqueado: suporte confirmou nova versao da API sem documentacao, parou de responder
- Senha do gestor: deve ser definida NO CADASTRO (antes do pagamento)
- Validacao de senha forte obrigatoria

### Senha Forte no Signup — CONCLUIDO
**Backend:**
- `tenant-public.controller.ts`: campo `password` no body do signup, validacao forte (8+ chars, maiuscula, minuscula, numero, especial)
- `tenant-public.controller.ts`: bcrypt hash antes de provisionar, salva hash no Tenant
- `tenant.service.ts`: `passwordHash` no provisionTenant data
- `tenant-onboarding.service.ts`: aceita `providedPasswordHash` opcional, usa no lugar de senha temporaria
- `asaas.service.ts`: webhook de pagamento passa `tenant.passwordHash` para onboarding
- Prisma: campo `passwordHash` no model Tenant + migration `20260312100000_tenant_password_hash`
- Welcome email: se usuario definiu senha, mostra "a senha que voce definiu" em vez de exibir senha

**Frontend:**
- `signup/page.tsx` Step 2: campos Senha + Confirmar Senha com toggle de visibilidade
- Validacao visual em tempo real: barra de progresso (5 segmentos), checklist de regras
- Botao "Continuar" desabilitado ate senha forte + confirmacao igual
- Senha enviada no payload do signup

**Builds:** Backend tsc OK, Frontend next build OK

### Decisoes do Juliano — Senhas de Usuarios:
1. **Criacao de usuario pelo gestor**: convite por email com link para definir senha (sem digitar senha no formulario)
2. **Esqueci minha senha**: email com link de redefinicao (token expira em 1h), funciona para gestores e usuarios
3. Senha forte obrigatoria em TODOS os fluxos (signup, convite, reset)

### Convite por Email + Esqueci Minha Senha — CONCLUIDO

**Prisma:**
- User model: `passwordHash` nullable, adicionados `passwordResetToken`, `passwordResetExpiresAt`, `invitedAt`, `passwordSetAt`
- Migration `20260312110000_user_password_reset`

**Backend:**
- `auth.service.ts`: metodos `forgotPassword()`, `validateResetToken()`, `resetPassword()`, `sendInviteEmail()`, `resendInvite()`
- `auth.controller.ts`: endpoints `POST /auth/forgot-password`, `GET /auth/reset-password/:token`, `POST /auth/reset-password`
- `auth.module.ts`: importa EmailModule
- `user.controller.ts`: create sem senha (invite flow), endpoint `POST /users/:id/resend-invite`
- `user.module.ts`: importa AuthModule (forwardRef)
- `user.service.ts`: password opcional no create, invitedAt populado, `getCompanyName()`, findAll retorna invitedAt/passwordSetAt
- Login bloqueia usuarios que nao definiram senha ainda (mensagem clara)
- Reset de senha revoga todas as sessoes (force re-login)

**Frontend:**
- `/reset-password/[token]/page.tsx`: pagina standalone com validacao de senha forte, barra de forca, checklist
- Login: modal "Esqueci minha senha" com envio de email funcional (substitui placeholder)
- `/users/page.tsx`: removido campo senha na criacao, mensagem "convite por email", coluna Status (Ativo/Convite enviado), botao "Reenviar convite"
- `middleware.ts`: `reset-password` nas rotas publicas

**Builds:** Backend tsc OK, Frontend next build OK

### Melhoria Pendente — Audit Log Completo
- **Decisao do Juliano**: todo tipo de lancamento ou edicao deve gravar log de auditoria
- Ja implementado em: Users, Partners, ServiceOrders, Finance
- Falta revisar/adicionar em: Quotes, Workflow, Automation, Settings (email, fiscal, whatsapp), NFS-e, Products/Services, Company profile
- Objetivo: rastreabilidade completa de quem fez o que e quando em todo o sistema

### Verificacao de Identidade — Migrar PPID → Verificacao Manual
- **Decisao do Juliano**: PPID fora do ar, Didit descartado, adotar verificacao manual
- Fluxo: coleta docs no signup → admin analisa manualmente → aprova/rejeita

---

## 2026-03-12 — Sessao 102/103: Verificacao Manual de Documentos (COMPLETO)

### Decisoes do Juliano:
1. Verificacao manual: sistema coleta documentos, Juliano analisa antes de ativar
2. Documentos: Cartao CNPJ (PDF), RG/CNH frente+verso, 3 selfies (perto/medio/longe)
3. QR code no signup para usar celular para fotos
4. Sistema bloqueado (OS/Financeiro/Orcamentos desabilitados) ate aprovacao
5. Gestor pode LOGAR enquanto docs estao pendentes (para configurar sistema)
6. Banner no topo mostra status (pendente/aprovado/recusado)
7. Sidebar links visiveis mas desabilitados quando pendente
8. Settings/Configuracoes acessiveis durante pendencia
9. Quando recusado: banner mostra motivo, botao leva para reenvio de docs
10. Apos reenvio: volta para analise novamente

### Implementacao Completa:

**Schema Prisma:**
- Model VerificationSession (token, 6 URLs docs, uploadedCount, uploadComplete, reviewStatus, rejectionReason, expiresAt)
- Campo passwordHash no Tenant
- Migration aplicada

**Backend (novo modulo: src/verification/):**
- verification.module.ts, verification.service.ts, verification.controller.ts
- Endpoints publicos: create-verification, GET /:token, GET /:token/status, POST /:token/upload, POST /:token/resubmit
- Endpoint autenticado: GET tenant-verification-status (para frontend banners)
- Upload local em uploads/verification/{sessionId}/
- Resubmit: cria nova sessao a partir de sessao rejeitada

**Backend (admin review em tenant.controller.ts):**
- GET /admin/tenants/pending-verifications
- GET /admin/tenants/:id/verification
- POST /admin/tenants/:id/approve-verification
- POST /admin/tenants/:id/reject-verification

**Backend (modificacoes):**
- tenant.middleware.ts: permite PENDING_VERIFICATION/PENDING_PAYMENT passar (marca req.tenantStatus)
- tenant-public.controller.ts: signup roda onboarding imediatamente (nao so no approve)
- auth.controller.ts: /auth/me retorna tenantStatus
- chat-ia.service.ts: welcome message avisa sobre verificacao pendente
- PPID modulo removido (ppid.module.ts, ppid.service.ts deletados)

**Frontend:**
- AuthContext: tenantStatus + verificationInfo + refreshVerification
- VerificationBanner.tsx: banner amber (pendente), red (recusado + motivo + botao reenviar), green (aprovado)
- AuthLayout.tsx: integra banner + passa tenantPending ao Sidebar
- Sidebar.tsx: ALLOWED_WHEN_PENDING set, links desabilitados com cadeado
- /verify/[token]/page.tsx: upload mobile-first + tela de rejeicao com motivo + resubmit
- Admin tenants page: badge pendentes, modal review com grid docs 2x3, aprovar/rejeitar
- signup/page.tsx: removido codigo PPID morto

**Builds:** Backend tsc OK, Frontend next build OK

---

## 2026-03-12 — Sessao 104: Fixes + Rastreamento de Tentativas de Cadastro (v1.02.25-29)

### Verify page — Rejeicao + Resubmit (v1.02.27)
- verification.service.ts: retorna rejectionReason no getSessionByToken
- verification.service.ts: metodo resubmitFromRejected (cria nova sessao a partir de rejeitada)
- verification.controller.ts: endpoint POST /verification/:token/resubmit
- /verify/[token]/page.tsx: tela de REJECTED com motivo + resubmit, tela de APPROVED

### SLS Obras Cadastro Fix (v1.02.28)
- Removido tenant SLS Obras SUSPENDED do banco (schema ja dropado)
- Fix CNPJ lookup 403: adicionado User-Agent + Accept headers no fetch da BrasilAPI
- Mascara CNPJ (XX.XXX.XXX/XXXX-XX) e telefone ((XX) XXXXX-XXXX) no signup

### Rastreamento Completo de Tentativas de Cadastro (v1.02.29)

**Problema:** SignupAttempt model/endpoints/admin page existiam mas o signup NUNCA chamava.
Erros no signup (como CNPJ 403) faziam clientes desistir silenciosamente.

**Schema Prisma:**
- SignupAttempt: +lastStep (Int, 1-5), +lastError (String?), +completedAt (DateTime?)
- Migration: 20260312140000_signup_attempt_step_tracking

**Backend:**
- POST /signup-attempt: agora faz upsert (aceita id opcional → UPDATE se fornecido, CREATE se nao)
- Aceita novos campos: lastStep, lastError, completedAt
- PATCH /signup-attempt/:id/criticism: envia email ao admin (contato@tecnikos.com.br) com resumo HTML

**Frontend signup:**
- Estado attemptId, showReportForm, reportMessage, reportSending, reportSent
- saveAttempt() fire-and-forget com keepalive:true em cada transicao de step
- sendReport() para PATCH criticism com email ao admin
- renderError() com link "Teve um problema? Nos avise" + textarea inline
- Tracking em: plano selecionado, dados preenchidos, signup OK/erro, docs OK/erro, pagamento OK/erro, voucher

**Frontend admin (/ctrl-zr8k2x/signup-attempts):**
- Interface: lastStep, lastError, completedAt
- Lista: badge "Step X — Nome" com cores por step, texto de erro truncado
- Modal: barra de progresso visual (5 circulos + conectores), nome do step, erro em destaque, data conclusao

**Builds:** Backend tsc OK, Frontend next build OK
**Deploy:** v1.02.29 OK

### Erro Prisma "type does not exist" — CORRIGIDO (v1.02.30)
- Causa: tenant_connection.service.ts definia search_path sem `public`
- Fix: `?schema=${schemaName},public` inclui public no search_path
- Vaga PIONEIRO-PISCINAS resetada (currentUses 1→0), tenant SLS apagado

### Signup Melhorias (v1.02.30)
- Campo "Nome empresa" REMOVIDO — auto-preenchido pelo CNPJ lookup
- Dados CNPJ em painel read-only (razao social, endereco, situacao com badge)
- Botao "Consultar CNPJ" azul com spinner, Continuar exige CNPJ consultado
- Step 5: reenvio de email com countdown 60s + edicao de email
- Backend: POST /resend-welcome (atualiza email no Tenant + User + Company)

### Rastreamento de Origem UTM (v1.02.30)
- Schema: +referrer, +utmSource/Medium/Campaign/Term/Content, +landingPage
- Frontend: captura document.referrer + URL params, envia no primeiro saveAttempt
- Admin: secao "Origem do Acesso" no modal

### Asaas fix: /subscribe permite ACTIVE sem subscription (voucher users)

**Builds:** Backend tsc OK, Frontend next build OK
**Deploy:** v1.02.30 OK

---

## 2026-03-12 — Sessao 105: Emissao NFS-e via Asaas (v1.02.31)

### Pedido do Juliano:
- Botao "Emitir Nota Fiscal" ao lado de cada empresa ativa no admin
- Modal com dados pre-preenchidos (nome, CNPJ, valor do plano)
- Opcao de emissao automatica ao confirmar pagamento
- Integrado com Asaas
- SLS Obras nao emite NF para si mesma (teste da integracao)
- Ultimo passo do signup NAO emite NF automaticamente

### Implementacao Completa:

**Schema Prisma:**
- Model SaasInvoice: tenantId, asaasInvoiceId, status, value, serviceDescription, taxes, PDF/XML urls, error tracking
- Model SaasInvoiceConfig: singleton config (autoEmitOnPayment, municipalService, default taxes, template)
- Migration: 20260312160000_saas_invoice
- Relacao Tenant → SaasInvoice[]

**Backend (asaas.provider.ts):**
- createInvoice, getInvoice, listInvoices, authorizeInvoice, updateInvoice, cancelInvoice
- getMunicipalServices, setSubscriptionInvoiceSettings
- getMunicipalOptions, getFiscalInfo, saveFiscalInfo
- Webhook events adicionados: INVOICE_CREATED, INVOICE_AUTHORIZED, INVOICE_CANCELED, INVOICE_ERROR, etc

**Backend (asaas.service.ts):**
- getInvoiceConfig / updateInvoiceConfig: gestao do singleton config
- issueInvoice: emissao completa (local record + Asaas API), template de descricao, taxes defaults
- listInvoices: listagem paginada com filtros
- cancelInvoice: cancela local + Asaas
- handleInvoiceWebhook: processa AUTHORIZED/CANCELED/ERROR/SYNCHRONIZED etc, atualiza PDF/XML
- Auto-emit: no PAYMENT_CONFIRMED/RECEIVED, se config.autoEmitOnPayment, emite automaticamente

**Backend (asaas-webhook.controller.ts):**
- Adicionado dispatch para events INVOICE_* → asaasService.handleInvoiceWebhook

**Backend (tenant.controller.ts):**
- POST /:id/issue-invoice — emitir NF para tenant
- GET /invoices/list — listar NFs com filtros
- DELETE /invoices/:invoiceId — cancelar NF
- GET /invoices/config — obter config fiscal
- PUT /invoices/config — atualizar config fiscal
- GET /invoices/fiscal-info — info fiscal do Asaas
- GET /invoices/municipal-services — servicos municipais disponiveis

**Frontend (ctrl-zr8k2x/invoices/page.tsx):**
- Tab "Notas Emitidas": tabela com empresa, valor, status (badges coloridos), NF#, data, acoes
- Tab "Configuracao Fiscal": auto-emit toggle, servico municipal, impostos padrao (6 campos), ISS retido, template descricao com variaveis clicaveis
- Modal "Emitir NF": selecao empresa, dados pre-preenchidos, valor do plano, descricao override, observacoes, data
- Modal "Detalhes": info completa, impostos, PDF/XML download, erro se houver
- Aceita ?tenantId=xxx na URL para abrir modal pre-selecionado

**Frontend (ctrl-zr8k2x/tenants/page.tsx):**
- Botao "Emitir NF" (verde) na coluna Acoes para tenants ACTIVE
- Redireciona para /ctrl-zr8k2x/invoices?tenantId=xxx

**Frontend (Sidebar.tsx):**
- "Notas Fiscais" adicionado ao SAAS_NAV (entre Empresas e Planos)

**Builds:** Backend tsc OK, Frontend next build OK

### Dashboard Analytics — Tooltips + Interno vs Externo

**Pedido do Juliano:**
- Dados de acesso mais claros com explicacoes
- Distinguir acessos internos (Claude VM, Juliano, bots) dos visitantes reais
- Tooltips (?) com hover que explica cada metrica

**Backend (tenant.controller.ts - getAnalytics):**
- Detecta IPs internos: servidor Hetzner (178.156.240.163), localhost
- Detecta UAs internos: HeadlessChrome, Puppeteer, ClaudeBot, bots (Google, Bing, Ahrefs, Semrush, etc)
- Classifica cada evento como interno ou externo
- Novos campos: internalPageviews, externalPageviews, internalSessions, externalSessions
- externalConversion: taxa de conversao baseada apenas em visitantes reais
- ipBreakdown: top 15 IPs com contagem, classificacao, User-Agent
- Devices agora exclui bots (conta apenas externos)

**Frontend (ctrl-zr8k2x/page.tsx):**
- Componente Tooltip: botao ? com popup ao hover, posicionado acima
- Tooltips em TODAS as metricas: KPIs, MRR, funil, visitantes, conversoes, dispositivos, rejeicoes, planos
- Alerta amarelo quando ha acessos internos detectados (mostra contagem real vs interno)
- KPI "Visitantes" agora mostra "Visitantes Reais" (externos apenas)
- Taxa de conversao usa externalConversion (base visitantes reais)
- Funil usa externalPageviews como base
- Secao "Detalhes por IP" (colapsavel): tabela com IP, acessos, tipo (interno/visitante), User-Agent
- Quick links: adicionado "Notas Fiscais"

**Builds:** Backend tsc OK, Frontend next build OK

---

## 2026-03-12 — Sessao 106-107: Gatilho no Fluxo de Atendimento (v1.02.31-35)

### Deploy v1.02.31 — CONCLUIDO
- Builds verificados: backend tsc + frontend next build OK
- Deploy script executado com sucesso
- Migration 20260312160000_saas_invoice aplicada em producao (SaasInvoice + SaasInvoiceConfig)
- Backup pre-deploy salvo: pre-deploy-1.02.31-20260312_130158.sql.gz
- Health check: v1.02.31 online em https://tecnikos.com.br/api/health
- Git commit + push + tag OK

### Pendencias guardadas:
1. SLS Obras: refazer cadastro pelo fluxo correto
2. Teste end-to-end completo: signup → docs → review → approve/reject
3. Teste emissao NF via admin (Asaas)
4. Config fiscal Asaas (inscricao municipal, CNAE, etc)
5. Audit log review (pendente desde sessao 101)

### Fluxo de Atendimento — Gatilho (Trigger) — CONCLUIDO

**Pedido do Juliano:**
- Primeira etapa do fluxo deve ser "Quando:" com seletor de gatilho
- Gatilhos: OS criada, Retorno criado, Solicitacao de orcamento, Orcamento criado, Cliente criado, Tecnico criado, Fornecedor criado
- Manter etapas de OS abaixo como estao por enquanto (polir com o tempo)
- "Retorno" = OS de retorno/revisita

**Implementacao:**

**Types (stage-config.ts):**
- Interface TriggerDefinition (id, entity, event, label, icon, description)
- Constante TRIGGER_OPTIONS com 7 opcoes
- WorkflowFormConfig: `triggerEvent: string` → `trigger: TriggerDefinition`
- createDefaultConfig: trigger = TRIGGER_OPTIONS[0] (os_created)
- Presets atualizados para usar TRIGGER_OPTIONS[0]
- compileToV2: persiste trigger no JSON {entity, event, triggerId}
- decompileFromV2: restaura trigger (por triggerId ou entity+event fallback)

**UI (workflow/page.tsx):**
- Secao "Quando:" entre Presets e Etapas com grid 3 colunas de cards
- Card selecionado: borda azul, bg azul, checkmark
- Resumo mostra "⚡ trigger.label" antes da contagem de etapas

**Backend (workflow.service.ts):**
- validateStepsV2: aceita trigger opcional, valida entity contra whitelist

**Builds:** Backend tsc OK, Frontend next build OK

### Deploy v1.02.32 — Gatilho no Fluxo
- Deploy OK, health check v1.02.32

### Sessao 107 — Melhorias do Gatilho (v1.02.33-35)

**Feedback do Juliano:**
1. Remover secao "Onboarding de Tecnico" antiga (substituida pelo trigger)
2. Trigger deve ser collapsible (recolhido por default, seta para expandir)
3. Auto-recolher quando sair do viewport (scroll para baixo)
4. Cards de opcoes do gatilho devem ser 75% menores
5. Numerar "Quando:" como Etapa 1, etapas OS a partir de 2
6. Seta de conexao entre trigger e etapas
7. Corrigir badge "scheduleConfig" sem label na etapa minimizada

**Implementacao v1.02.33:**
- Trigger collapsible com `triggerExpanded` state (default false)
- IntersectionObserver para auto-collapse quando sai do viewport
- Cards compactos: grid-cols-4, text-[11px], px-2 py-1.5
- Removido TechnicianOnboardingSection do render + validacao

**Implementacao v1.02.35:**
- Trigger numerado como "1. ⚡ Quando:" (Etapa 1)
- StageSection: `index + 2` (etapas OS comecam em 2)
- Seta de conexao entre trigger e primeira etapa OS (mesmo estilo das setas entre etapas)
- AUTO_ACTION_LABELS: adicionados scheduleConfig ("Regime de agenda") e gestorApproval ("Aprovacao do gestor")

**Builds:** Backend tsc OK, Frontend next build OK
**Deploys:** v1.02.33, v1.02.35 OK

---

## 2026-03-12 — Sessao 108: Promo/Slug so trava apos pagamento (v1.02.36-39)

### Tela de revisao de tecnicos (v1.02.36)
- techReviewScreen no stage-config.ts: { enabled, allowEdit }
- UI no StageSection entre selecao de tecnico e disparo de mensagens
- Compile/decompile TECH_REVIEW_SCREEN block
- Deploy v1.02.36

### Slug so trava apos pagamento (v1.02.37)
- LOCKED_STATUSES = ['ACTIVE', 'BLOCKED', 'SUSPENDED']
- check-slug, signup duplicate checks: so consideram tenants LOCKED
- Cleanup de tenants PENDING abandonados (drop schema + delete record)
- Deploy v1.02.37

### Fix Prisma tenant connection (v1.02.38)
- Bug: ?schema=tenant_sls,public → Prisma trata como schema literal (nao search_path)
- Fix: removido ",public" da URL em tenant-connection.service.ts
- PostgreSQL enums do schema public sao acessiveis sem search_path
- Deploy v1.02.38

### REGRA CRITICA: Promo so consome vaga apos pagamento (v1.02.39)
**Pedido do Juliano:** "quem pagar primeiro tem o direito!!!"

**Problema:** Signup incrementava currentUses da promocao ANTES do pagamento. Signup abandonado consumia a vaga permanentemente.

**Solucao:**
1. Novo campo `Tenant.promoCode` (migration) — armazena o codigo usado
2. Signup NAO incrementa currentUses (removido)
3. `activate()` incrementa currentUses (so apos pagamento confirmado)
4. `pioneer-slots`: conta tenants ATIVOS com aquele promoCode vs maxUses
5. `validate-code`: conta tenants ATIVOS com aquele promoCode vs maxUses
6. `provisionTenant`: duplicate check respeita LOCKED_STATUSES
7. Reset currentUses PIONEIRO-PISCINAS (era 1, agora 0 — nenhum tenant ativo)
8. createSchema: excluir tabelas SaaS do copy (SignupAttempt, SaasEvent, etc)

**Decisao do Juliano:** SLS Obras continua no schema public ate certificacao completa.

### Email lowercase no signup
- Input email forcado lowercase (.toLowerCase() no onChange)
- CSS class "lowercase" para visual

**Builds:** Backend tsc OK, Frontend next build OK
**Deploys:** v1.02.36, v1.02.37, v1.02.38, v1.02.39 OK

### Fix enum types no tenant schema (v1.02.40-42)
- Bug: `type "tenant_sls.UserRole[]" does not exist` — Prisma com `?schema=tenant_xxx` so enxerga types do schema
- Fix v1.02.40: copiar todos os enum types de public para tenant schema durante createSchema()
- Fix v1.02.41: detectar array enums (`_UserRole` → `UserRole`) via udt_schema + data_type ARRAY
- Fix v1.02.42: DROP DEFAULT antes de ALTER TYPE (defaults referenciam public enum, bloqueiam ALTER)
- Abordagem final 3 passos: DROP DEFAULT → ALTER TYPE → SET DEFAULT com regex remap do schema
- 7 colunas afetadas: User.roles, BankStatementLine.status, FinancialEntry.status, FinancialInstallment.status, PendingWorkflowWait.status, Quote.status, ServiceOrder.status
- Tenant SLS limpo (PENDING_VERIFICATION dropado)
- Deploys: v1.02.40, v1.02.41, v1.02.42 OK

---

## 2026-03-12 — Sessao 109: Upload Cartao CNPJ no Signup

### Pedido do Juliano:
- "o cartao do cnpj tem que ter a opcao de carregar em pdf antes do qr code e se subir ja pula a etapa"
- Upload do Cartao CNPJ como atalho no step 3 do signup
- Se subir, pula a verificacao completa de documentos

### Implementacao:
**Frontend (signup/page.tsx):**
- Step 3: APENAS upload Cartao CNPJ (obrigatorio, drag & drop + click)
- CNPJ card upload → auto-advance para pagamento/conclusao (1.2s delay visual)
- Removida opcao "Nao tenho" — Cartao CNPJ e obrigatorio
- Link para consultar em receita.fazenda.gov.br

### Selfie: 2 selfies + Camera frontal auto-open com guia retangular

**Pedido do Juliano:**
- Reduzir de 3 para 2 selfies (remover selfieFar "longe")
- Camera frontal abre automaticamente na etapa de selfie
- Retangulo guia para enquadrar o rosto

**Backend (verification.service.ts):**
- DOC_TYPES: removido selfieFar (agora 5: cnpjCard, docFront, docBack, selfieClose, selfieMedium)
- uploadComplete agora conta 5/5

**Frontend (verify/[token]/page.tsx) — REESCRITO:**
- Camera frontal auto-open via getUserMedia({ facingMode: "user" })
- Video live feed espelhado (scaleX(-1)) com guia retangular (cantos azuis)
- Botao "Tirar foto" captura frame → canvas → blob
- Sem botao Galeria — so camera. Se camera falhar, mostra "Selecionar foto"
- Cleanup camera ao sair do step

**Frontend (admin tenants):** Removido selfieFar do grid de docs (5 em vez de 6)

### Fix Galeria removida da selfie + Asaas API Key (v1.02.44)
- Removido botao "Galeria" da tela de selfie — quando camera ativa, so aparece "Tirar foto"
- Se camera falhar, mostra "Selecionar foto" (fallback necessario)
- Asaas API Key: chave testada diretamente no container → API retorna "invalid_access_token"
- Chave completa e correta no container (152 chars, 2x$ signs), mas Asaas rejeita
- Juliano gerou nova chave no painel Asaas → atualizada no servidor → **FUNCIONANDO**

Builds: Backend tsc OK, Frontend next build OK

---

## 2026-03-13 — Sessao 111: Cobranca Recorrente + Bloqueio por Inadimplencia (v1.02.50)

### Pedido do Juliano:
- Pagamentos recorrentes mensais conforme plano
- Pioneer: 6 meses a R$15, depois preco cheio
- Se no 7o dia nao pagou → BLOCK tenant
- Tela do gestor: banner avisando vencimento/atraso/bloqueio iminente
- PIX/boleto: pagamento manual. Cartao: automatico pelo Asaas

### Implementacao:

**Schema Prisma:**
- `Subscription.overdueAt DateTime?` — marca quando ficou inadimplente
- `Subscription.originalValueCents Int?` — valor cheio para restaurar apos promo
- Migration `20260313040000_subscription_overdue_promo`

**Backend (asaas.service.ts) — Promo Pioneer Fix:**
- Removido sistema de `discount` do Asaas (so funcionava 1 pagamento)
- Agora cria subscription NO valor promocional (ex: R$15 em vez de R$49)
- `originalValueCents` salva valor cheio do plano
- `promotionMonthsLeft` decrementa a cada PAYMENT_CONFIRMED
- Quando promo acaba: `asaas.updateSubscription()` atualiza valor para preco cheio
- Log: "Promo ended for subscription X: updated to full price R$49.00"

**Backend (asaas.service.ts) — Bloqueio por Inadimplencia:**
- PAYMENT_OVERDUE: seta `overdueAt = now()` (se nao ja setado)
- PAYMENT_CONFIRMED: limpa `overdueAt`, reativa tenant se bloqueado
- `@Cron('0 7 * * *')` checkOverdueSubscriptions(): busca PAST_DUE com overdueAt > 7 dias → block

**Backend (auth.controller.ts) — Billing Status Endpoint:**
- `GET /auth/billing-status`: retorna status, daysUntilDue, daysOverdue, hoursUntilBlock, isPromo
- AuthModule agora importa TenantModule (forwardRef) para acessar AsaasService

**Frontend — BillingBanner.tsx:**
- Componente global em AuthLayout.tsx (apos VerificationBanner)
- Fetch `/auth/billing-status` ao montar, refresh a cada 30min
- 4 estados visuais:
  1. BLOCKED (red-700): "Conta bloqueada por inadimplencia" + link "Ver assinatura"
  2. PAST_DUE (red-600): "Pagamento atrasado ha X dias. Sera bloqueado em Yd Zh." + "Regularizar"
  3. DUE_TODAY (amber-500): "Sua fatura vence hoje" + botao dismiss
  4. Nenhum banner se tudo ok
- Botao X para dismiss (exceto BLOCKED que nao some)

Builds: Backend tsc OK, Frontend next build OK

---

## 2026-03-13 — Sessao 111 (cont): Fix Fluxo de Pagamento Completo

### Pedido do Juliano:
- Tela de pagamento PIX mostrou "pagamento concluido" sem QR code → deveria esperar confirmacao
- Esperava ver QR code do PIX na nossa tela de pagamento (nao so no Asaas)
- Email de boas-vindas: link "Acessar o Sistema" nao abre no host sls.tecnikos.com.br
- "Estude melhor esse fluxo, use padroes de finalizacao de pagamentos, projete tudo e conclua"

### Problemas encontrados:
1. PIX QR code nunca exibido — subscribe retorna so message, nenhum dado de pagamento
2. Boleto URL nunca exibido — mesma situacao
3. Welcome email enviado ANTES do pagamento (durante signup)
4. Email diz "ativada com sucesso" quando tenant ainda esta PENDING
5. Link do email vai para tecnikos.com.br/login, nao para slug.tecnikos.com.br/login
6. Step 5 mostra "Cadastro realizado!" imediatamente em vez de aguardar pagamento

### Solucao implementada:

**Backend (asaas.provider.ts):**
- `getPixQrCode(paymentId)`: retorna encodedImage (base64) + payload (copia e cola) + expirationDate
- `getIdentificationField(paymentId)`: retorna linha digitavel do boleto + barCode

**Backend (asaas.service.ts):**
- `getFirstPaymentInfo()`: busca 1o pagamento da subscription (retry 3x com 1.5s), obtem QR code PIX ou linha digitavel boleto
- `getPaymentStatus(tenantId)`: retorna status do tenant + subscription para polling frontend
- Welcome email movido: agora chamado em PAYMENT_CONFIRMED (nao mais no signup)

**Backend (tenant-public.controller.ts):**
- `/subscribe` retorna `paymentInfo` com QR code/boleto
- Novo endpoint `GET /payment-status/:tenantId` para polling

**Backend (tenant-onboarding.service.ts):**
- `sendWelcomeEmailForTenant()`: metodo publico separado
- Email usa subdominio: `https://${slug}.${baseDomain}/login`
- Email diz "Pagamento confirmado, documentos em analise" (nao mais "ativada")

**Frontend (signup/page.tsx):**
- Step 4 com PIX: mostra QR code (base64 image), codigo copia e cola, data expiracao, spinner "Aguardando confirmacao"
- Step 4 com Boleto: mostra linha digitavel com botao copiar, link para ver boleto completo, spinner "Aguardando compensacao"
- Polling `/payment-status/:tenantId` a cada 5s → quando confirmado, avanca para step 5
- Step 5: icone verde checkmark + "Pagamento confirmado!" (flow pago) ou clock azul + "Cadastro realizado!" (voucher)
- Mensagem de docs em analise em ambos os casos

Builds: Backend tsc OK, Frontend next build OK
