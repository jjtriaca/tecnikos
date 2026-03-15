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

---

## 2026-03-13 — Sessao 113: Asaas Checkout + Add-on + Upgrade + Desativar Notificacoes

### Pedidos do Juliano:
1. "essa pagina nao poderia ser um Pop up do asaas ja com os metodos deles, sistema deles de finalizar?" — usar Asaas Checkout hosted para TODOS os cenarios de pagamento
2. "Sim pode fazer, inclusive o caminho do add on e upgrade" — add-on e upgrade tambem via checkout
3. "Veja a possibilidade de o sistema Asaas nao mande menssagem para o cliente nem email" — desativar notificacoes do Asaas

### Decisoes:
- Asaas Checkout (POST /v3/checkouts) substitui TODOS os formularios de pagamento custom
- Um popup Asaas para tudo: signup, add-on, upgrade, regularizacao de inadimplencia
- billingTypes: ["PIX", "BOLETO", "CREDIT_CARD"] — Asaas mostra todas as opcoes
- notificationDisabled: true no customer — Asaas nao envia email/SMS ao cliente
- Banner de inadimplencia abre invoice URL do Asaas direto

### Implementacao:

**Backend (asaas.provider.ts):**
- `customer` field opcional no createCheckout (evita criar customer duplicado)
- `notificationDisabled: true` no createCustomer (desativa notificacoes Asaas)
- Metodo createCheckout() completo com URL do checkout
- Metodo listPayments() com filtros

**Backend (asaas.service.ts):**
- `createSignupCheckout(tenantId, billingCycle, promoCode?)` — cria subscription local + checkout RECURRENT
- `createAddOnCheckout(tenantId, addOnId)` — cria AddOnPurchase + checkout DETACHED
- `createUpgradeCheckout(tenantId, newPlanId)` — cancela subscription antiga + cria nova + checkout RECURRENT
- `handleSubscriptionWebhook()` trata SUBSCRIPTION_CREATED para linkar asaasSubscriptionId
- `confirmAddOnByCustomer()` fallback para pagamentos de add-on via checkout
- `getBillingStatus()` inclui overduePaymentUrl (busca invoiceUrl do pagamento atrasado)

**Backend (Controllers):**
- `POST /subscribe` simplificado: body `{tenantId, billingCycle, promoCode?}` → retorna `{checkoutUrl}`
- `POST /purchase-addon` atualizado para checkout
- `POST /auth/upgrade-plan` novo endpoint autenticado

**Frontend (signup/page.tsx):**
- Removidos: estados billingType, cardForm, paymentInfo, pixCopied, boletoCopied
- Step 4 antes: form PIX/boleto/cartao → agora: resumo do plano + botao "Pagar" → abre checkout Asaas em nova aba
- Pendente: mostra spinner + "Reabrir pagina de pagamento"
- Polling mantido: detecta pagamento confirmado → step 5

**Frontend (BillingBanner.tsx):**
- Interface atualizada com overduePaymentUrl
- BLOCKED: botao "Pagar agora" abre invoiceUrl do Asaas (fallback /settings/billing)
- PAST_DUE: botao "Regularizar" abre invoiceUrl do Asaas

**Frontend (settings/billing/page.tsx):**
- Secao "Seu Plano" mostra nome + preco + info promo
- Secao "Fazer Upgrade" lista planos superiores com botao "Fazer Upgrade" → checkout
- Secao "Pacotes Extras de OS" usa checkout em vez de pagamento direto
- Success messages de redirect (addon=success, upgrade=success)

Builds: Backend tsc OK, Frontend next build OK
Deploy v1.02.53

## 2026-03-13 — Sessao 114: Fix billingTypes API + Remover cards metodo de pagamento

### Problema:
- Asaas Checkout API (`POST /checkouts`) com `chargeTypes: ["RECURRENT"]` so aceita `billingTypes: ["CREDIT_CARD"]`
- Enviar `["PIX", "BOLETO", "CREDIT_CARD"]` retornava erro "O campo billingTypes e invalido"
- Cards PIX/Boleto/Cartao no Step 4 do signup confundiam o usuario (pareciam selecionaveis)

### Solucao:
- **createSignupCheckout()**: substituido Checkout API por Subscription API (`billingType: "UNDEFINED"`) + retorna `invoiceUrl` do primeiro pagamento. A pagina de invoice do Asaas mostra PIX/Boleto/Cartao nativamente.
- **createUpgradeCheckout()**: mesma mudanca — Subscription API + invoiceUrl em vez de Checkout API
- **createAddOnCheckout()**: manteve Checkout API com `chargeTypes: ["DETACHED"]` (funciona com multiplos billingTypes)
- **Frontend Step 4**: removidos cards informativos PIX/Boleto/Cartao (tanto no form quanto no estado pendente)

### Deploy: v1.02.54, v1.02.55

---

## 2026-03-13 — Sessao 115: Restricoes por Verificacao de Documentos (v1.02.56)

### Pedidos do Juliano:
1. "Parece que o host nao esta funcionando" — sls.tecnikos.com.br inacessivel
2. "o cliente recebe o email para acessar o host. porem nao consegue fazer lancamentos de OS, orcamentos, lancamentos financeiros tbm nao, o restante fica operacional"
3. "A IA deve dar boas vindas e avisar que o sistema esta com restricao de alguns campos enquanto os documentos sao analisados"
4. "pode comecar as configuracoes do sistema enquanto isso, primeiro o upload do certificado digital, depois smtp, WhatsApp"
5. "essas metricas e para todos os novos clientes, nao somente para a sls obras"

### Diagnostico do Host:
- DNS: sls.tecnikos.com.br retorna NXDOMAIN — nao existe registro wildcard
- SSL: certificado so cobre tecnikos.com.br (sem wildcard)
- Nginx: server_name so tinha tecnikos.com.br
- DNS esta no Cloudflare (proxy ativo) → SSL automatico se wildcard DNS existir
- Tenant SLS: status ACTIVE, schema tenant_sls existe, onboarding feito

### Correcoes:

**Nginx (nginx.conf):**
- HTTP block: `server_name tecnikos.com.br www.tecnikos.com.br *.tecnikos.com.br`
- HTTPS block: `server_name tecnikos.com.br *.tecnikos.com.br`
- HTTP redirect preserva $host (subdominio vai para HTTPS do subdominio)
- PENDENTE: Juliano precisa adicionar registro DNS wildcard `*.tecnikos.com.br` no Cloudflare

**Backend (auth.controller.ts):**
- `/auth/me` agora retorna `verificationStatus` (PENDING/APPROVED/REJECTED/null)
- Query da VerificationSession mais recente do tenant

**Backend (VerificationGuard):**
- Novo guard global: `guards/verification.guard.ts`
- Registrado como APP_GUARD em app.module.ts (ordem: Throttle → JWT → Roles → Verification)
- Verifica se VerificationSession.reviewStatus === 'APPROVED' antes de permitir acesso
- Master tenant (isMaster=true) e rotas sem tenantId: sempre permitidos
- Decorator `@RequireVerification()` em: `require-verification.decorator.ts`

**Backend — Endpoints protegidos por @RequireVerification():**
- `POST /service-orders` (criar OS)
- `POST /finance/entries` (criar lancamento financeiro)
- `POST /quotes` (criar orcamento)

**Frontend (AuthContext.tsx):**
- Novo tipo: `VerificationStatus = "PENDING" | "APPROVED" | "REJECTED"`
- `AuthUser.verificationStatus` populado de `/auth/me`
- Helper: `isVerificationPending(user)` — true se docs nao aprovados
- `refreshVerification()` agora tambem refaz /auth/me para atualizar verificationStatus
- Fetch de verificationInfo baseado em verificationStatus (nao mais tenantStatus)

**Frontend (AuthLayout.tsx):**
- `pendingVerification = isVerificationPending(user)` substitui `isTenantPending` baseado em tenantStatus
- Sidebar recebe restricao baseada em verificationStatus (funciona mesmo com tenant ACTIVE)

**Frontend (VerificationBanner.tsx):**
- Agora mostra baseado em `user.verificationStatus` (nao mais tenantStatus)
- PENDING: "Documentos em analise — voce pode configurar o sistema enquanto aguarda a aprovacao"
- REJECTED: banner vermelho com motivo + botao reenviar
- APPROVED: banner verde "Documentos aprovados!" + botao recarregar

**Backend (tenant-onboarding.service.ts) — Welcome Email:**
- Assunto: "Bem-vindo ao Tecnikos" (era "Pagamento confirmado")
- Titulo: "Bem-vindo ao Tecnikos!"
- Corpo: avisa sobre restricoes (OS, orcamentos, financeiro temporariamente limitados)
- Nova secao verde: "Enquanto isso, voce pode configurar:" com 5 itens
  1. Certificado Digital (Configuracoes)
  2. Email SMTP (Configuracoes > Email)
  3. WhatsApp (Configuracoes > WhatsApp)
  4. Usuarios da equipe
  5. Workflow e automacoes

### Build: Backend tsc OK, Frontend next build OK
### Deploy: v1.02.56

### DNS + SSL Wildcard — CONCLUIDO
- Juliano adicionou registro DNS wildcard `*.tecnikos.com.br` no Cloudflare (tipo A, proxied)
- DNS propagado: sls.tecnikos.com.br resolve para Cloudflare IPs
- SSL: Cloudflare Origin Certificate (wildcard *.tecnikos.com.br + tecnikos.com.br, valido ate 2041)
- Certificado instalado em /opt/tecnikos/app/nginx/ssl/ (fullchain.pem + privkey.pem)
- Nginx container restartado para pegar nova config (docker compose restart nginx)
- Teste OK: sls.tecnikos.com.br/login → HTTP 200, /api/health → v1.02.56

---

## 2026-03-13 — Sessao 116: Limpeza SLS + Teste Compra do Zero

### Limpeza completa para teste fresh:
- Asaas: Subscription `sub_f330i47frr8tubpx` cancelada (DELETE)
- Asaas: Customer `cus_000165863289` deletado (DELETE)
- Banco: VerificationSession deletada
- Banco: Subscription deletada
- Banco: Schema `tenant_sls` dropado (CASCADE, 74 objetos)
- Banco: Tenant SLS deletado
- Promocao PIONEIRO-PISCINAS: currentUses resetado para 0
- Verificacao: 0 registros restantes, schema nao existe, promo limpa

### Correcoes pos-teste (v1.02.57)

**Step 5 Signup:**
- Removido bloco "Seu endereco: sls.tecnikos.com.br" — acesso so via email de boas-vindas

**Chat IA Welcome Message (bug):**
- Auto-open nao chamava loadWelcome() → chat abria vazio
- Fix: ChatIAContext.tsx auto-open agora chama loadWelcome()
- Backend: welcome message checa verificationStatus (VerificationSession) em vez de tenantStatus
- Funciona para tenant ACTIVE com docs pendentes

**CAPTCHA Turnstile (nao configurado):**
- Env vars TURNSTILE nao existiam na producao → captcha nunca aparecia
- Criado widget Turnstile no Cloudflare: "Tecnikos Login" com hostname tecnikos.com.br
- Keys adicionadas ao .env.production e container recriado
- Captcha agora funciona: cada subdomain tem localStorage proprio = captcha a cada 7 dias

### Deploy: v1.02.57

---

## 2026-03-13 — Sessao 117: Isolamento de Dados Multi-Tenant (CRITICO) (v1.02.58)

### Problema reportado pelo Juliano:
- "Quando acessei vi que ja trouxe dados pre registrados da sls obras"
- Dashboard em sls.tecnikos.com.br mostrava 2 OS, R$720 receita — dados antigos do public schema
- Causa raiz: TODOS os 46+ services usam `this.prisma` que aponta para public schema
- Apenas chat-ia.service.ts usava TenantConnectionService corretamente

### Diagnostico:
- tenant_sls schema: 0 ServiceOrder, 0 Partner, 0 FinancialEntry (correto — recem criado)
- public schema: 5 ServiceOrder, 2801 Partner, 11 FinancialEntry (dados antigos SLS pre-multitenant)
- Services injetam PrismaService que conecta ao public schema e ignoram req.tenantSchema

### Solucao: AsyncLocalStorage + JavaScript Proxy (ZERO mudancas nos services)

**Criado backend/src/tenant/tenant-context.ts:**
- AsyncLocalStorage para armazenar tenantId + tenantSchema por request
- Helper functions: getTenantSchema(), getTenantId()

**Modificado backend/src/tenant/tenant.middleware.ts:**
- Importa tenantContext
- Wraps `next()` em `tenantContext.run({ tenantId, tenantSchema }, () => next())`
- Contexto propagado automaticamente para todo o pipeline downstream

**Modificado backend/src/prisma/prisma.service.ts:**
- Define PUBLIC_ONLY_MODELS (Tenant, Plan, Subscription, VerificationSession, etc.) — NUNCA redirecionados
- Define TENANT_MODEL_DELEGATES (ServiceOrder, Partner, Company, User, etc.) — redirecionados
- Define REDIRECTED_METHODS ($queryRaw, $executeRaw, $transaction) — redirecionados
- Constructor retorna `new Proxy(this, { get handler })`:
  - Se getTenantSchema() retorna schema E prop eh tenant model → redireciona para tenant PrismaClient
  - Se getTenantSchema() retorna schema E prop eh $queryRaw etc → redireciona
  - Models publicos (Tenant, Plan) → sempre acessam public schema
  - Sem contexto tenant → public schema (startup, webhooks, rotas publicas)
- Metodo `_getTenantClient(schema)`: cria e cacheia PrismaClient por tenant
- `onModuleDestroy()`: desconecta todos os tenant PrismaClients

### Testes realizados:
1. **Script Node.js isolado**: PrismaClients separados para public e tenant_sls confirmam dados isolados ✅
2. **Script simulando Proxy + AsyncLocalStorage**: Proxy redireciona corretamente quando em contexto tenant ✅
3. **HTTP com JWT real via sls.tecnikos.com.br**: `GET /service-orders → {"data":[],"total":0}`, `GET /partners → {"data":[],"total":0}` ✅
4. Models publicos (Tenant, Plan) continuam acessiveis em contexto tenant ✅
5. Fora do contexto → volta a usar public schema ✅

### Deploy: v1.02.58 — Isolamento multi-tenant FUNCIONANDO

---

## 2026-03-13 — Sessao 118: Admin Host + Data Migration (v1.02.59)

### Pedido do Juliano:
- "Vamos fazer o seguinte, um host para o admin tambem"
- "a sls antiga deixa de existir, vai ficar tudo na sls.tecnikos.com.br"
- "o admin fica totalmente isolado nao tem acesso a sls obras de dentro de sua pagina"
- "migre todos os dados da sls antiga pra o host novo, inclusive as conexoes com o whatsapp, smtp, focus"
- "tudo fica funcionando ja no host"
- Ser critico com seguranca!

### Implementacao:

**Schema Prisma — Tenant.companyId:**
- `companyId String? @unique` no model Tenant (para webhooks resolverem o tenant)
- Migration manual: `20260313200000_tenant_company_id`

**Backend — tenant-context.ts:**
- `runInTenantContext(store, fn)` helper para webhooks/crons executarem em contexto tenant

**Backend — TenantResolverService (NOVO):**
- `tenant-resolver.service.ts`: usa PrismaClient raw (nao Proxy) para resolver tenant
- `runForCompany(companyId, fn)`: encontra tenant por companyId → executa fn em contexto
- `getActiveTenants()`: lista todos os tenants ativos
- `forEachTenant(fn)`: itera todos os tenants com contexto

**Backend — Webhooks corrigidos:**
- WhatsApp: `runForCompany(companyId)` via Tenant.companyId
- Focus NFS-e: itera todos tenants para encontrar emission por ref
- Asaas: OK (so toca PUBLIC_ONLY_MODELS)

**Backend — Cron Sefaz corrigido:**
- `cronFetchAll()` agora usa `forEachTenant()` para buscar configs de cada tenant
- `onModuleInit()` roda `fixHistoricalData()` em todos os tenant schemas

**Backend — Auth /me:**
- Retorna `tenantSlug` (null no admin host, "sls" no SLS host)

**Frontend — Admin Host Detection:**
- `isAdminHost(user)` helper em AuthContext.tsx
- Sidebar: mostra nav SaaS admin quando isAdminHost
- AuthLayout: redirect /dashboard → /ctrl-zr8k2x no admin host

### Migracao de Dados:
- Backup: `/opt/teknikos/backups/pre_migration_20260313_155037.sql.gz`
- Script v3: `scripts/migrate-sls-to-tenant-v3.sql`
- Tecnica: CREATE CAST WITH INOUT AS IMPLICIT para 12 enum types entre schemas
- Migrado: 2801 Partners, 5 OS, 11 FinancialEntry, 263 SefazDocs, todos os configs
- Admin Company criada: "Teknikos Admin" (00000000...0001) em public
- Admin users atualizados: companyId → Admin Company
- Tenant.companyId setado para webhook resolution
- Dados operacionais deletados do public
- Sessoes limpas (re-login necessario)

### Turnstile CAPTCHA:
- Widget "Tecnikos Login" atualizado: 3 hostnames (tecnikos.com.br, sls.tecnikos.com.br, admin.tecnikos.com.br)

### Verificacao pos-deploy:
- Health 200 em tecnikos.com.br, sls.tecnikos.com.br, admin.tecnikos.com.br ✅
- Backend: tenant PrismaClient criado para tenant_sls, Sefaz cron multi-tenant OK ✅
- Login page funcional nos dois hosts (CAPTCHA invisivel) ✅
- Dados isolados: public tem 0 dados operacionais, tenant_sls tem todos ✅
- Sem erros nos logs ✅

### Deploy: v1.02.59 — Admin Host + Data Migration

---

## 2026-03-13 — Sessao 119: No Login on Bare Domain (v1.02.61-63)

### Pedido do Juliano:
- "O botao Entrar na landing page nao deve mais existir"
- "tecnikos.com.br/login nao deve mais existir tambem!"
- "Admin.tecnikos.com.br esta direcionando pra pagina!" (landing page ao inves de login)

### Implementacao:

**Frontend — middleware.ts (reescrito para domain-aware routing):**
- `isBareHost` detection: `tecnikos.com.br`, `www.tecnikos.com.br`, `localhost`
- Dominio raiz: `/login` e `/tech/login` redirecionam para `/` (landing page)
- Subdominios: `/` redireciona para `/dashboard` (se logado) ou `/login` (se nao)
- Login pages em subdominios: pass through normalmente
- Rotas protegidas sem auth no dominio raiz → redireciona para `/` (nao `/login`)
- Matcher regex atualizado: removido exclusao de `/`, adicionado `signup` na exclusao

**Frontend — LandingContent.tsx:**
- Desktop nav: "Entrar" → `/login` substituido por "Cadastre-se" → `/signup` (icone UserPlus)
- Mobile menu: "Entrar" substituido por "Cadastre-se" → `/signup`
- Hero CTA: "Ja sou cliente" → `/login` substituido por "Ver planos" → `#precos`
- Zero referencias a `/login` restantes na landing page

### Bug fix — Subdomain root redirect (v1.02.63):
- Problema: `admin.tecnikos.com.br/` mostrava landing page ao inves de login
- Causa: matcher regex excluia `/` do middleware (raiz nao era processada)
- Fix: removido exclusao de `/` no matcher + logica de subdomain root redirect

### Verificacao:
- `admin.tecnikos.com.br/` → 307 → `/login` ✅
- `sls.teknikos.com.br/` → 307 → `/login` ✅
- `tecnikos.com.br/` → 200 (landing page) ✅
- `tecnikos.com.br/login` → 307 → `/` (landing page) ✅
- `sls.teknikos.com.br/login` → 200 (login page) ✅
- `admin.teknikos.com.br/login` → 200 (login page com CAPTCHA) ✅

### Deploys: v1.02.61, v1.02.62, v1.02.63 — "No Login on Bare Domain"

---

## 2026-03-13 — Sessao 119 (cont): Fix CAPTCHA + Analytics Dedup (v1.02.64-65)

### Fix CAPTCHA Turnstile (v1.02.64):
- **Bug**: Frontend tinha logica de "cache 7 dias" (needsCaptcha + localStorage)
- Widget nao aparecia apos primeira verificacao, mas backend SEMPRE exige token
- Resultado: "Verificacao CAPTCHA necessaria" ao tentar logar
- **Fix**: Removida logica needsCaptcha() e localStorage em ambos os logins (gestor + tecnico)
- Widget Turnstile agora SEMPRE aparece quando CAPTCHA esta habilitado

### Fix Analytics Dedup (v1.02.65):
- **Bug**: signupStarts contava TODOS os eventos signup_step_1 (32 = mesma pessoa visitando multiplas vezes)
- **Bug**: signupComplete contava TODOS os eventos signup_complete (3 = disparos multiplos)
- **Decisao Juliano**: conversao so conta apos conferencia de documentos (processo 100% finalizado)
- **Fix backend (tenant.controller.ts)**:
  - signupStarts → `SignupAttempt.count()` (tentativas unicas de cadastro, nao page visits)
  - signupComplete/Conversoes → `Tenant.count({ status: ACTIVE })` (empresas 100% ativadas)
  - Funnel steps → unique sessionId por evento (groupBy sessionId, nao count bruto)
  - conversionRate e externalConversion baseados em externalSessions (nao pageviews)
- **Resultado real**: 7 signups iniciados, 1 conversao (antes: 32 signups, 3 conversoes)

### Deploys: v1.02.64, v1.02.65

---

## 2026-03-14 — Sessao 120: Workflow Triggers + Conflito + Client Onboarding (v1.02.66-71)

### Trigger-based stages (v1.02.66-67):
- Trigger `partner_tech_created` mostra TechnicianOnboardingSection em vez de etapas de OS
- Header "Etapas do Fluxo" consistente para todos triggers

### Novo trigger "Nova Especializacao" + Conflito (v1.02.68):
- Adicionado trigger `partner_spec_added` em TRIGGER_OPTIONS
- `conflictResolution` em TechnicianOnboardingConfig: send_both | tech_only | spec_only
- TechnicianOnboardingSection: prop `triggerId` para filtrar sub-sections por trigger
- Banner de conflito (amarelo) no trigger partner_tech_created com radio buttons
- Banner info (azul) no trigger partner_spec_added
- isOnboardingTrigger para ambos triggers, presets escondidos

### Variavel {especializacao} em todos os campos (v1.02.69):
- Adicionada em WELCOME_VARIABLES, reply, decline e todas as variable buttons

### Templates default em todos os campos de texto (v1.02.70):
- Todos os campos (contrato, notificacao, boas-vindas, resposta, recusa) pre-preenchidos
- Adicionado variable buttons na mensagem de notificacao (faltava ref + UI)

### Client Onboarding — Trigger "Um cliente e criado" (v1.02.71):
- Novo tipo `ClientOnboardingConfig` em stage-config.ts
- `createDefaultClientOnboarding()` com contrato de termos de servico completo
- Contrato padrao: Termos de Prestacao de Servicos Tecnicos (8 clausulas)
- Templates default: notificacao, boas-vindas, resposta positiva/negativa
- Componente `ClientOnboardingSection.tsx` com UI completa:
  - Secao "Termos" (contrato de servicos) com variable buttons
  - Secao "Mensagem" (boas-vindas) com confirmacao, aceite e recusa
  - Variable buttons em todos os campos de texto
- workflow/page.tsx: `partner_client_created` no isOnboardingTrigger
- compileToV2/decompileFromV2 persistem clientOnboarding
- Presets escondidos, subtitles e resumo adaptados

### Deploys: v1.02.66, v1.02.67, v1.02.68, v1.02.69, v1.02.70, v1.02.71

---

## 2026-03-14 — Sessao 121: Security Hardening + Access Geo (v1.02.72-73)

### Pedido do Juliano:
- Verificar servidor por mineracao/invasao
- Analisar brute force e criar protecoes
- Admin: alertas de acessos estrangeiros 24h + contagem total 24h

### Auditoria de Seguranca:
- Servidor LIMPO: 0% CPU, nenhum processo de mineracao
- fail2ban ativo: 2178 falhas SSH, 413 banidos, 19 ativos
- 777 tentativas SSH em 24h — ja tratadas pelo fail2ban
- Scanners identificados: 89.248.168.239 (.env), 45.79.190.208 (nmap), 185.16.39.146 (bot)
- API login: apenas 22 tentativas em 24h (nao e brute force)

### Hardening nginx:
- Bloqueio .env/.git/.svn/.htaccess + extensoes sensiveis (.sql, .yml, .conf, etc)
- Bloqueio CMS paths (wp-admin, phpmyadmin, adminer, cgi-bin)
- Bloqueio extensoes perigosas (.php, .asp, .aspx, .jsp, .cgi, .pl)
- Bloqueio user-agents scanners (nmap, nikto, sqlmap, dirbuster, etc)
- HTTP 444 (connection drop) + log em blocked.log

### fail2ban — Novas Jails:
- nginx-scanner: 3 retries → ban 24h (scanners de vulnerabilidade)
- nginx-login-bf: 10 retries → ban 1h (brute force de login API)
- Total: 3 jails ativas (sshd + nginx-scanner + nginx-login-bf)

### SSH Hardening:
- PasswordAuthentication no
- PermitRootLogin prohibit-password (somente chave)

### Backend — Endpoint Access-24h com Geolocalizacao:
- GET /admin/tenants/analytics/access-24h
- Consulta SaasEvent ultimas 24h, agrupa por IP externo
- Geo-IP via ip-api.com batch API (pais, cidade, estado, ISP)
- Classifica Brasil vs estrangeiro, retorna foreignAccess[] e brazilAccess[]

### Admin Frontend — Widgets de Seguranca 24h:
- 4 cards: Acessos 24h, IPs Unicos 24h, Brasil (verde), Fora do Brasil (vermelho se detectado)
- Banner vermelho com tabela de IPs estrangeiros (pais, cidade, ISP, eventos, horario)
- Secao colapsavel "Acessos do Brasil" com top 10 IPs brasileiros

### Deploys: v1.02.73

---

## 2026-03-14 — Sessao 121 (cont): Supplier Onboarding + Fix Retorno (v1.02.74)

### Pedido do Juliano:
- "use a mesma logica que fez para quando um cliente e criado, apenas mude as logicas para fornecedor"
- "o botao quando um retorno e criado deve ser 'quando uma OS de retorno e criada'"

### Implementacao:
- Label trigger retorno: "Um retorno e criado" → "Uma OS de retorno e criada"
- SupplierOnboardingConfig + createDefaultSupplierOnboarding() (stage-config.ts)
- DEFAULT_SUPPLIER_CONTRACT: Contrato de Fornecimento (7 clausulas)
- SupplierOnboardingSection.tsx: componente completo tema amber (~620 linhas)
- workflow/page.tsx: import, isOnboardingTrigger, render, resumo para supplier
- compileToV2/decompileFromV2 persistem supplierOnboarding

### Deploy: v1.02.74

---

## 2026-03-14 — Sessao 122: Presets, Drag-Drop, TenantMigrator, Deploy Resilience, OS Urgente (v1.02.79-84)

### Pedidos do Juliano:
- Remover secao "Modelos Prontos" do editor de workflow
- Cards dos fluxos devem ser organizaveis clicando e arrastando
- Melhorias devem ser automaticas em todos os tenants (sem ALTER TABLE manual)
- Cliente nao deve perder dados durante deploy
- Secao de agendamento/atribuicao deve ficar no topo da criacao de OS
- Opcoes: por fluxo de atendimento, por agenda e URGENTE
- Criar gatilho "Quando uma OS Urgente e criada"
- Ao cadastrar OS de retorno, perguntar se e urgente

### Implementacoes:
- v1.02.79: Remocao Modelos Prontos
- v1.02.80: Drag-and-drop reorder de fluxos (sortOrder + HTML5 DnD)
- v1.02.81: TenantMigratorService auto-sync schemas no startup
- v1.02.82: Deploy Resilience (DeployGuard, API retry, signup persistence)
- v1.02.84: OS Urgente + Reorganizacao Form
  - isUrgent Boolean no ServiceOrder
  - Trigger os_urgent_created (🚨 Uma OS urgente e criada)
  - TechAssignmentSection: modos BY_AGENDA e URGENT
  - Form: "Tipo de Atendimento" movido para o topo (apos Cliente)
  - Retorno: checkbox "Retorno urgente / emergencial"
  - Backend: dispatch return_created + urgent_created adicionais

### Bug Report do Juliano:
- Ao alterar o gatilho ("Quando") de um fluxo e salvar, ao reabrir ele voltava ao valor anterior
- Enviou 5 screenshots mostrando o problema

### Fix: Trigger nao persistia (v1.02.85)
- Causa: compileToV2() tinha 2 caminhos de retorno (early return para workflows sem etapas vs normal return)
- O early return (usado por todos os triggers de onboarding) NAO incluia o trigger no JSON
- Fix: adicionado `result.trigger = { entity, event, triggerId }` no early return path
- Deploy v1.02.85

### Deploy: v1.02.85

---

## 2026-03-14 — Sessao 122+: Correcoes Arquiteturais de Workflow (v1.02.86)

### Pedido do Juliano (sessao anterior):
- "Seja critico! vamos refinar ao máximo!" com 4 pontos:
  1. Remover "Fluxo Padrao" (isDefault) — nao tem logica, todos podem ser usados
  2. Corrigir triggers — trigger selector era puramente visual
  3. Remover DELAY e SLA — stubs que so faziam console.log
  4. Reordenar campos — logica linear de cima pra baixo

### Implementacoes:

**1. Remocao isDefault (backend + frontend)**
- workflow-engine.service.ts: substituiu attachDefaultWorkflow() por findWorkflowByTrigger()
- service-order.service.ts: assign() e create() usam trigger-based matching
- workflow.service.ts: removido isDefault de findAll select e update logic
- partner.service.ts: orderBy por sortOrder+createdAt em vez de isDefault
- whatsapp.service.ts: idem
- workflow/page.tsx: removido da types, UI (badge/checkbox), save/duplicate payloads
- TechAssignmentSection.tsx: removido isDefault de WorkflowSummary e badge

**2. Trigger-based workflow selection**
- Novo metodo findWorkflowByTrigger(companyId, triggerIds) no workflow-engine
- Busca workflows ativos, match por steps.trigger.triggerId
- Prioridade: urgent > return > normal (os_urgent_created > os_return_created > os_created)
- Auto-attach no create() e fallback no assign()

**3. Remocao DELAY e SLA**
- Backend: removidos case handlers DELAY, SLA, RESCHEDULE do workflow-engine
- Frontend types: removido sla e delay do StageConfig.timeControl
- Frontend UI: removidos toggles SLA e DELAY do StageSection.tsx
- Compilador: removida geracao de blocos DELAY/SLA do compileToV2()
- Decompilador: silently skip SLA/DELAY blocks de workflows existentes
- Presets: removido timeControl.sla dos 3 presets (Instalacao, Manutencao, Urgente)
- Label: "Pausas descontam do SLA" → "Pausas descontam do tempo"

**4. Reordenacao de campos**
- scheduleConfig movido para posicao 1 na secao ABERTA (antes de techSelection)

**5. Ghost triggers removidos**
- quote_request_created e quote_created removidos do TRIGGER_OPTIONS

### Build: backend ✅ frontend ✅
### Deploy: v1.02.86

---

### Pedido do Juliano: Auditoria Completa dos Fluxos de Atendimento
- "Seja critico! Quero fazer um plano de cada fluxo, campo a campo, vendo gatilhos fantasmas, combinacoes perigosas, campos que nao fazem sentido, logica linear de cima para baixo"
- Objetivo: documentar tudo para treinar a IA embarcada do cliente

### Auditoria Realizada — docs/wizard/AUDITORIA-WORKFLOW.md
Descobertas principais:

**Gatilhos Fantasmas:**
- quote_request_created e quote_created — frontend existe, backend NUNCA despacha
- partner_client_created — frontend tem ClientOnboardingSection, backend NAO tem dispatch
- partner_supplier_created — frontend tem SupplierOnboardingSection, backend NAO tem dispatch
- Triggers de tecnico funcionam mas ignoram o trigger ID (buscam QUALQUER workflow com onboarding)

**Blocos STUB (so fazem log):**
- DELAY — usuario configura, backend so loga
- SLA — usuario configura, backend so loga

**Blocos NAO processados por ninguem:**
- TECH_REVIEW_SCREEN, SCHEDULE_CONFIG, EXECUTION_TIMER, GESTOR_APPROVAL, MATERIALS

**Blocos processados pela public-offer (nao pelo workflow-engine):**
- PROXIMITY_TRIGGER ✅, PAUSE_SYSTEM ✅, PHOTO_REQUIREMENTS ✅

**Problema arquitetural critico:**
- O campo "Quando" (trigger) nos workflows de OS e PURAMENTE VISUAL
- attachDefaultWorkflow() busca por isDefault:true — ignora o trigger ID
- Se o usuario cria 3 workflows com triggers diferentes, so o "padrao" e usado

**Ordem dos campos:**
- scheduleConfig deveria ser primeiro na ABERTA (antes de techSelection)
- Campos de A_CAMINHO incluem Step/Photo/Form que nao fazem sentido no trajeto
- techSelection e scheduleConfig podem ambos estar ativos (conflito)

---

## 2026-03-14 — Sessao 123: Notificacoes WhatsApp no Workflow (v1.02.93-99)

### Pedidos do Juliano:
1. Explicacoes/hints claros nos toggles do workflow
2. Notificacoes de conflito entre opcoes ativadas
3. Botao confirmar na modal de selecao de tecnicos
4. Notificacao WhatsApp ao criar OS (nao disparava)

### Implementacoes:

**Hints e explicacoes (StageSection.tsx):**
- Reescrito TECH_ACTION_LABELS, AUTO_ACTION_LABELS, TIME_CONTROL_LABELS
- Cada hint explica QUANDO/O QUE/QUEM da funcionalidade

**ConflictWarning (StageSection.tsx):**
- Componente amarelo (amber-50, border-amber-300)
- 5 cenarios de conflito: techSelection+agenda, techReview+agenda, messageDispatch+agenda, notifyTecnico(ATRIBUIDA)+scheduleNotify, photo+pause

**SearchLookupModal — Botao confirmar:**
- Props: showConfirmButton, selectedCount, onConfirm
- MultiLookupField passa props automaticamente

**Notificacoes WhatsApp — FIX COMPLETO:**

Problema: BY_AGENDA cria OS como ATRIBUIDA, mas workflow so tem STATUS:ABERTA. executeStageNotifications nao encontrava bloco.

Solucao:
1. `executeStageNotifications()` (workflow-engine.service.ts): fallback STATUS:ABERTA quando nao acha STATUS:ATRIBUIDA
2. `technicianId` tornado opcional em executeSystemBlock()
3. `service-order.service.ts`: chama executeStageNotifications no create() e updateStatus()
4. Canal normalizado: `(channel || 'WHATSAPP').toUpperCase()` no notification.service.ts
5. `forceTemplate: true` em TODAS as notificacoes WORKFLOW_AUTO (texto e descartado silenciosamente fora da janela 24h)
6. `sendTestMessage()` mudado para usar template `teste_conexao` (texto fora de 24h era aceito pela Meta mas nao entregue)

**Meta API — Erro 131047 (Re-engagement):**
- Meta aceita texto via API (HTTP 200) mas descarta silenciosamente fora da janela de 24h
- Webhook retorna erro 131047 "more than 24 hours since customer last replied"
- Solucao: sempre usar templates para business-initiated messages

**Meta API — Erro 132018 (Template parameters):**
- Template `notificacao_tecnikos` rejeitado em um deploy, funcionou no seguinte
- Fallback para `teste_conexao` (sem parametros) funcionou como contingencia

**FRONTEND_URL atualizado:**
- Mudado de `https://tecnikos.com.br` para `https://sls.tecnikos.com.br`
- Link da OS nas notificacoes agora vai para o host correto

**Multiplos tecnicos:**
- Ja suportado: directedTechnicianIds + findMany + loop individual de envio
- Cada tecnico recebe sua propria notificacao WhatsApp

### Deploys: v1.02.93, v1.02.95, v1.02.97, v1.02.99
### Status: FUNCIONANDO — mensagem da OS chegou no WhatsApp com template correto

---

## 2026-03-14 — Sessao 104: WhatsApp Notificacao OS + Link Publico Tecnico (v1.03.02 a v1.03.09)

### WhatsApp Notificacao OS Criada
- Template `notificacao_tecnikos` (APPROVED) usado como fallback
- Template `aviso_os` (PENDING aprovacao Meta) criado via API
- Sanitizacao de newlines em parametros de template Meta (erro 132018)
- FRONTEND_URL atualizado para `sls.tecnikos.com.br` em producao
- Fallback chain: aviso_os → notificacao_tecnikos → teste_conexao

### Link Publico do Tecnico (`/p/[token]`)
- `includeLink: true` no workflow NOTIFY agora gera link publico via `PublicOfferService.createOffer()`
- Link adicionado na mensagem WhatsApp: `| Acesse: https://sls.tecnikos.com.br/p/{uuid}`
- Fix Next.js 15: `params` e Promise, usar `use(params)`
- OTP removido — aceite direto pelo token (UUID v4 + expiracao = seguranca suficiente)
- AccessKey (HMAC do token) salvo no localStorage do celular para proteger link pos-aceite
- Outros dispositivos recebem "Esta oferta ja foi aceita por outro tecnico"
- Backend: `acceptDirect()`, `resolveAssignedTech()` helper, phone removido de todos endpoints

### Pendente (aguardando instrucoes do Juliano)
- **linkConfig do fluxo**: O frontend precisa ler `acceptOS` e `gpsNavigation` do workflow para mostrar/esconder botoes
- Atualmente o botao GPS aparece sempre (errado) — deve respeitar a config do fluxo
- Juliano pediu para parar e aguardar novas instrucoes

### Versoes: v1.03.02 → v1.03.09

---

## 2026-03-14 — Sessao 106: Link Publico Multi-Pagina + enRoute (v1.03.11)

### Redesign linkConfig — Fluxo Multi-Pagina
- linkConfig expandido: novos campos `enRoute` (boolean) e `agendaMarginHours` (number)
- Fluxo com acceptOS ON: offer → accept → post-accept (GPS + enRoute) → tracking
- Fluxo com acceptOS OFF: offer com GPS/enRoute direto → tracking
- Device locking no primeiro clique de acao (accept, GPS ou enRoute)

### Backend
- `extractLinkConfig()` atualizado: retorna `enRoute`, `agendaMarginHours` alem de `acceptOS`, `gpsNavigation`, `validityHours`
- `getPublicView()` retorna linkConfig completo com novos campos
- Novo endpoint `POST /p/:token/en-route` + `markEnRoute()` — registra `enRouteAt` no ServiceOrder
- Migration: campo `enRouteAt DateTime?` no model ServiceOrder
- Prisma client regenerado

### Frontend /p/[token]
- Novo step `post-accept`: pagina 2 com botoes enRoute + GPS
- Quando acceptOS OFF: botoes enRoute + GPS aparecem direto na pagina de oferta
- Secao "done" simplificada (GPS removido, agora esta no post-accept)
- useEffect de tracking config ajustado para step `post-accept`

### Frontend stage-config.ts (sessao anterior)
- Tipos e defaults atualizados com `enRoute` e `agendaMarginHours`
- Serialization/deserialization atualizados

### Frontend StageSection.tsx (sessao anterior)
- UI reestruturada: Pagina 1 (oferta + layout + acceptOS), Pagina 2 (pos-aceite), Pagina sem aceite, Pagina tracking

---

## 2026-03-14 — Sessao 107: Fix GPS + Link Invalidation (v1.03.13-14)

### Fix GPS startTracking (v1.03.13)
- Backend `startTracking()` usava defaults quando nao tem PROXIMITY_TRIGGER (antes lancava BadRequestException)
- GPS funciona pelo linkConfig mesmo sem bloco PROXIMITY_TRIGGER no workflow

### Link Publico Invalidado (v1.03.14)
- OS excluida ou cancelada invalida o link publico
- 6 endpoints protegidos: getOfferByToken, resolveAssignedTech, markEnRoute, submitPosition, getTrackingConfig, findOsByToken
- Verificam `deletedAt` + status `CANCELADA`
- Mensagem: "Esta ordem de serviço não está mais disponível."

### Deploy v1.03.14 — OK

### Discussao: Remover etapas OFERTADA e ATRIBUIDA?
- Juliano encontrou problema: com Regime de Agenda, OS pula ABERTA → ATRIBUIDA, mas configs estao na ABERTA
- Proposta de remover OFERTADA e ATRIBUIDA
- Claude recomendou manter (etapas tem funcao real, impacto massivo em dezenas de arquivos)
- **Decisao: manter etapas, mas ESCONDER OFERTADA e ATRIBUIDA quando Regime de Agenda ativo**
- Remover numeracao das etapas (nome + icone suficiente)

### Limpeza do Workflow — Decisoes campo a campo
- Arquivo completo: `WORKFLOW_CLEANUP_DECISIONS.md`
- **Globais**: remover Webhook de tudo, mover Pergunta pro link, aviso custo WhatsApp em toda notificacao
- **ABERTA**: esconder Alerta, remover Aguardar evento
- **OFERTADA**: remover NotifyTecnico, FinancialEntry, Aguardar evento. Esconder Alerta
- **ATRIBUIDA**: remover NotifyTecnico, FinancialEntry, Alerta, Aguardar evento. Acoes tecnico: so Foto/Nota/Checklist
- **A_CAMINHO**: remover TUDO exceto Rastreamento por proximidade
- **EM_EXECUCAO**: manter todas acoes tecnico, notifyGestor, notifyCliente, cronometro, pausas. Remover notifyTecnico, financialEntry, alerta, aguardar
- **CONCLUIDA**: manter notifyGestor, notifyCliente, financialEntry, aprovacao gestor. Acoes tecnico: so Foto/Nota
- **APROVADA**: manter financialEntry. Remover TUDO mais
- **CANCELADA**: nao visivel na UI, nao faz parte da limpeza
- Todas decisoes documentadas e aprovadas em WORKFLOW_CLEANUP_DECISIONS.md

### Sessao 107 (cont): Hints + Conflitos + WhatsApp Warning
- [x] Hints descritivos reescritos em TECH_ACTION_LABELS, AUTO_ACTION_LABELS, TIME_CONTROL_LABELS
- [x] Numeracao das etapas removida (era "index+2. label", agora so "label")
- [x] Hint contextual no notifyGestor da OFERTADA: "Util quando outro operador despacha..."
- [x] Hint contextual no notifyCliente da ATRIBUIDA: aviso de duplicidade com onAccept do link
- [x] Conflito cross-stage: notifyCliente ATRIBUIDA vs onAccept.notifyCliente do link (ABERTA)
- [x] Componente WhatsAppCostWarning criado — aparece quando canal=whatsapp
- [x] WhatsAppCostWarning aplicado em: notifyGestor, notifyTecnico, notifyCliente genericos, messageDispatch.toTechnicians, onAccept/onGps/onEnRoute (gestor e cliente)
- [x] Build frontend OK sem erros

### Sessao 107 (cont): Workflow Cleanup — v1.03.16
- [x] Removido Webhook de todas as etapas (UI)
- [x] Removido Alerta de todas as etapas (UI)
- [x] Removido Aguardar Evento de todas as etapas (UI)
- [x] Filtrar notificacoes por etapa: notifyTecnico so ATRIBUIDA, sem notificacoes em A_CAMINHO/APROVADA
- [x] Filtrar acoes do tecnico por etapa:
  - GPS: so EM_EXECUCAO
  - Checklist: ATRIBUIDA + EM_EXECUCAO
  - Form: so EM_EXECUCAO
  - Signature: so EM_EXECUCAO
  - Question: so EM_EXECUCAO
  - STEP: so EM_EXECUCAO
  - PHOTO (single): ATRIBUIDA + CONCLUIDA
  - NOTE: todas etapas (correto)
  - MATERIALS: so EM_EXECUCAO (ja estava)
- [x] Lancamento financeiro: ja restrito a CONCLUIDA+APROVADA (correto)
- [x] Esconder OFERTADA+ATRIBUIDA quando scheduleConfig ativo (workflow/page.tsx)
- [x] Info banner "Regime de Agenda ativo" quando etapas ocultas
- [x] Build frontend OK sem erros
- [x] version.json → v1.03.16

### Sessao 107 (cont): Cleanup canais + textos exemplo — v1.03.18
- [x] Removido SMS e Push das opcoes de canal (CHANNEL_OPTIONS) — so WhatsApp e E-mail
- [x] Defaults que usavam 'sms'/'push' trocados para 'whatsapp'
- [x] Fix hint pagina de tracking: "Atribuida" → "A Caminho"
- [x] Pergunta do tecnico movida para DENTRO do linkConfig (antes era seccao solta na ABERTA)
- [x] Removido toggle "Exibir na pagina do link" (agora sempre dentro do link)
- [x] WhatsAppCostWarning adicionado nas notificacoes de proximidade (A_CAMINHO)
- [x] Placeholders de mensagem atualizados com textos exemplo uteis em todos os campos
- [x] Build OK, deploy v1.03.18

### Sessao 107 (cont): Botao "Cheguei no local" — v1.03.19
- [x] Tipo arrivalButton adicionado ao proximityTrigger em stage-config.ts
- [x] UI: toggle "Botao Cheguei" na A_CAMINHO com sub-opcoes (coords, auto-exec, notificacoes)
- [x] Backend: POST /p/:token/arrived — atualiza coords OS + ServiceAddress, auto-start, notificacoes
- [x] Migration: lat/lng no ServiceAddress + arrivedAt no ServiceOrder
- [x] Build OK, deploy v1.03.19

### Sessao 107 (cont): Radio exclusividade + layout Cheguei — v1.03.20-21
- [x] Radio mutuamente exclusivo: "ao entrar no raio" vs "ao clicar Cheguei" vs "manual"
- [x] Frontend conectado: arrivalButton.enabled respeitado na pagina de tracking
- [x] v1.03.20 deploy

### Sessao 108: Radio unificado com paineis expansiveis — v1.03.22
- [x] Reestruturado A_CAMINHO: 3 secoes separadas (eventos raio + radio + botao cheguei) → 1 radio unificado
- [x] Cada opcao do radio expande painel com borda e fundo (border-purple-200 bg-purple-50/40)
- [x] "Ao entrar no raio": notifyCliente, notifyGestor, alerta dashboard
- [x] "Ao clicar Cheguei": updateAddressCoords, notifyCliente, notifyGestor, alerta dashboard
- [x] "Manual": texto informativo
- [x] Toggle separado "Botao Cheguei" removido — arrivalButton.enabled sincronizado com radio
- [x] Secao "Eventos ao entrar no raio" removida — conteudo movido para dentro dos paineis
- [x] Build frontend OK

### Sessao 108 (cont): Paineis ricos + coordsRadius — v1.03.24
- [x] 3 paineis agora identicos em estrutura: notifyCliente + notifyGestor + alerta + updateAddressCoords
- [x] "Ao entrar no raio": updateAddressCoords com campo "gravar quando estiver a X metros" (coordsRadiusMeters)
- [x] "Ao clicar Cheguei": updateAddressCoords (coordenadas exatas, sem campo metros)
- [x] "Manual": painel completo (notificacoes + alerta + updateAddressCoords com metros) — dispara por proximidade sem auto-start
- [x] Tipos: updateAddressCoords + coordsRadiusMeters adicionados a onEnterRadius, alert adicionado a arrivalButton
- [x] Deserializacao com defaults por campo (nao mais objeto inteiro)
- [x] Template "sms" → "whatsapp" corrigido
- [x] Build OK

### Sessao 108 (cont): Textos exemplo + SMS/Push removal + Fix notificacao assign — v1.03.25-28
- [x] TODOS os campos message preenchidos com texto contextual (regra permanente gravada)
- [x] Removido SMS e Push de todos os defaults em stage-config.ts → whatsapp
- [x] Fix: assign() agora chama workflowEngine.executeStageNotifications() para ATRIBUIDA
- [x] SubToggle wraps em <div> para stacking vertical
- [x] Deploys v1.03.25 a v1.03.28

---

## 2026-03-15 — Sessao 109: Simplificacao criacao OS — workflow-centric (v1.03.29)

### Decisao de negocio: workflow matching
- Juliano decidiu: remover "Por agenda" e "Urgente" do form Nova OS
- Esses modos viram workflows normais (ex: "OS URGENTE", "CLT Agenda") selecionaveis via "Por fluxo"
- Dropdown de workflows mostra APENAS fluxos ativos
- "Por especializacao" e "Direcionado" auto-match pro workflow padrao (primeiro ativo com trigger os_created)
- Futuro: config no workflow para "respeitar tecnico direcionado"
- Futuro: gatilhos condicionais ricos no workflow (match por especializacao, modo, etc.)

### Implementacao v1.03.29
- [x] TechAssignmentSection: type TechAssignmentMode reduzido para 3 modos (BY_SPECIALIZATION | DIRECTED | BY_WORKFLOW)
- [x] Removido showExtendedModes, EXTENDED_MODES, URGENT styling
- [x] workflowFetcher: passa activeOnly=true
- [x] page.tsx Nova OS: removido isAgendaMode, effectiveMode, checkbox "Retorno urgente"
- [x] Agenda CLT continua via workflow scheduleConfig (hasAgendaFromWorkflow)
- [x] isUrgent sempre false no form (urgencia definida pelo workflow)
- [x] Backend: GET /workflows aceita ?activeOnly=true — filtra isActive
- [x] Build frontend + backend OK

---

## 2026-03-15 — Sessao 110: Reorganizacao Nova OS + Servicos por Item (v1.03.31)

### Implementacao v1.03.31
- [x] commissionBps adicionado ao cadastro de Servicos (frontend: interface, form, tabela, save)
- [x] ServiceItemsSection: novo componente para items de servico na OS (lookup + tabela)
- [x] Nova OS reescrita com nova ordem: Cliente → Titulo → Endereco (aberto) → Tipo Atendimento → Servicos → Prazo → Agendamento (toggle) → Retorno
- [x] Removidos: Descricao, Valor solto, Comissao solta, Tempo aceitar, Tempo a caminho
- [x] Endereco sempre aberto, reordenado, Contato no Local dentro
- [x] Agendamento como toggle ON/OFF nao colapsavel
- [x] Deploy v1.03.31 OK

### Fixes v1.03.32-33
- [x] Removido preview duplicado de endereco (aparecia no radio E no preview readonly)
- [x] Tipo de Atendimento: autoCollapse=false para nao fechar ao rolar
- [x] Servicos: campo de busca sempre visivel (sem botao intermediario)

### Decisoes de negocio:
- **Titulo da OS**: MANTER campo titulo. Auto-fill CANCELADO (titulo vem antes dos servicos)
- **Variaveis de template**: adicionar {servicos_nomes} e {servicos_descricoes} em TODOS os templates de mensagem (FUTURO)

### Implementacao v1.03.34
- [x] **defaultQuantity** — Campo `defaultQty` no schema Service, DTOs, backend create, frontend form + tabela, ServiceItemsSection usa como qtd inicial
- [x] **Editar/Duplicar** — Tabela de servicos com 3 acoes: Editar, Duplicar, Excluir (antes so tinha Excluir)
- [x] **Variaveis {servicos_nomes} e {servicos_descricoes}** — NOTIFY_VARS frontend + interpolacao no workflow-engine.service.ts (include items na query)
- [x] **Checklist por servico** — Campo `checklists Json?` no Service, editor visual no formulario (adicionar checklist → items), DTOs, backend create
- [x] ~~Auto-fill titulo~~ — CANCELADO (titulo vem antes dos servicos)
- [x] Deploy v1.03.34 OK

**Decisao checklist (Juliano):** O QUE verificar = definido no servico. QUANDO = configurado no workflow (FUTURO).

### Melhorias a discutir:
1. **Mecanismo para clientes solicitarem melhorias** — A DISCUTIR (verificar se IA embarcada ja tem algo)
2. **Contrato do cliente com a Tecnikos** — A DISCUTIR (correcao de precos)

---

## 2026-03-15 — Sessao 112: Checklists no Workflow — Especificacao Completa

### Decisoes do Juliano:

**5 Classes de checklist fixas:**
1. Ferramentas e EPI (itens do servico)
2. Materiais (itens do servico)
3. Verificacao Inicial (itens do servico)
4. Verificacao Final (itens do servico)
5. Personalizado (itens do workflow)

**Configuracao por classe:** modo (item a item / inteiro) + obrigatoriedade (obrigatorio / recomendado) + notificacao opcional

**Cadastro do Servico:** 4 secoes fixas substituem checklists com nome livre

**Link do tecnico:** canal unico do inicio ao fim, evolui em paginas por etapa

**Por etapa:**
- ABERTA Pag1: +3 checklists ordenaveis, removido Texto livre 2/3, Pergunta movida acima do Aceitar
- ABERTA Pag2: mesmo padrao ordenavel (GPS, a caminho, checklists)
- OFERTADA: sem checklist
- ATRIBUIDA: nova secao "Checklists do Tecnico" antes das acoes automaticas (Ferramentas, Materiais, Personalizado + observacao). Removidos: Notificar tecnico, Foto, Checklist antigo
- A_CAMINHO: sem checklist, mantem como esta
- EM_EXECUCAO: tudo migra pro link ordenavel (verificacao inicial/final, foto, formulario, assinatura, passo a passo, observacao, personalizado). GPS vira acao automatica. Rodape fixo: cronometro + pausar + concluir
- CONCLUIDA: pagina link (verificacao final, foto, assinatura, observacao, personalizado). Aprovacao: obrigatoria ou automatica. Financeiro REMOVIDO daqui
- APROVADA: so financeiro + notificacoes. Link vira somente leitura, expira depois

**Gravacao:** nova tabela ChecklistResponse com dados ricos (geo, dispositivo, tempo, itens marcados/pendentes)
**Visualizacao:** aba Checklists na OS + eventos na timeline

**Override do gestor:** quando checklist e "Recomendado", tecnico pode avancar sem completar. Notificacao ao gestor e opcional com sub-opcoes de canal/mensagem.

**Pausas no link:** rodape fixo com cronometro, botao pausar (com motivo) e concluir. Gravam no mesmo padrao rico.

### Especificacao completa salva em: docs/CHECKLIST_WORKFLOW_SPEC.md

### Implementacao Fases 1-7 — CONCLUIDO

**Phase 1 — Backend Foundation:**
- Schema: enums ChecklistClass (5 valores), ChecklistMode (2 valores), model ChecklistResponse com dados ricos
- Migration: 20260315040000_add_checklist_response
- PrismaService: TENANT_MODEL_DELEGATES + ensureChecklistResponseTable()
- DTOs: Service.checklists migrado de `[{name, items}]` para `{toolsPpe, materials, initialCheck, finalCheck}`
- Modulo ChecklistResponse: service + controller + SubmitChecklistDto
- Endpoints: GET /service-orders/:id/checklists, GET /service-orders/:id/checklists/items/:class
- Endpoint publico: POST /p/:token/checklist
- AppModule: ChecklistResponseModule registrado

**Phase 2 — Cadastro de Servicos (Frontend):**
- 4 cards fixos em grid 2x2 (Ferramentas/EPI, Materiais, Verificacao Inicial, Verificacao Final)
- Itens numerados, add/remove, auto-resize textarea
- EMPTY_FORM atualizado para novo formato objeto

**Phase 3 — Stage Config Types:**
- checklistConfig em StageConfig.techActions (4 classes, cada com enabled/mode/required/notifyOnSkip)
- Compiler: CLS_META map gera blocos CHECKLIST com checklistClass/mode/required/notifyOnSkip
- Decompiler: ENUM_TO_KEY reconhece blocos estruturados e legados
- Labels: 4 novas entries em TECH_ACTION_LABELS

**Phase 4 — Workflow UI (StageSection) — CONCLUIDO v1.03.51:**
- ABERTA Page 1: blocos checklist ordenaveis no pageLayout com inline mode/required config
- ABERTA Page 2: GPS/en-route/checklists como page2Layout ordenavel (substitui toggles hardcoded)
- ABERTA: Pergunta movida para antes do botao Aceitar
- ATRIBUIDA: filtrado para so checklists relevantes (toolsPpe, materials, custom) + observacao
- EM_EXECUCAO: secao renomeada "Pagina do Link", itens ordenaveis + footer info
- CONCLUIDA: secao renomeada "Pagina do Link", filtrado finalCheck/custom + foto/assinatura/observacao
- stage-config.ts: gps_button/enroute_button no LinkPageBlock, page2Layout defaults, compiler/decompiler sync
- Deploy v1.03.51 OK

**Phase 5 — Link Publico:**
- Backend: getPublicView inclui checklists agregados + checklistResponses + checklistConfig
- aggregateServiceChecklists: combina itens de todos servicos, dedup por texto normalizado
- Frontend: 4 cards com itens clicaveis, botao confirmar, badge "Enviado" para classes ja submetidas
- handleChecklistSubmit usa mode/required/notifyOnSkip da checklistConfig

**Phase 6 — Visualizacao na OS:**
- Secao "Checklists" entre Workflow e Fotos na pagina de detalhes
- Agrupado por etapa, cards por classe com itens marcados/pendentes, stats, observacao, geo, pulados
- EVENT_LABELS + icone timeline para CHECKLIST_CONFIRMED e CHECKLIST_SKIPPED

**Phase 7 — Notificacoes:**
- SubmitChecklistDto: campo notifyOnSkip
- submitChecklist: se notifyOnSkip=true e ha itens nao marcados, cria notificacao CHECKLIST_SKIPPED
- Mensagem com classe, itens pendentes, nome do tecnico
- extractChecklistConfig: extrai config de blocos CHECKLIST do workflow template por etapa

**Builds:** Backend OK (sem erros), Frontend OK (compilacao limpa)
