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

### PPID — AINDA PENDENTE
- API continua retornando 404 em todos endpoints
- Site ppid.com.br esta online, mas api.ppid.com.br nao

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
