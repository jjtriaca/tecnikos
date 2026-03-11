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

### Asaas (Pagamentos SaaS) — PENDENTE
- Codigo 100% implementado (Asaas provider, service, webhooks, admin panel)
- Juliano vai criar conta no Asaas manualmente
- Precisa configurar: ASAAS_API_KEY, ASAAS_ENV, ASAAS_WEBHOOK_TOKEN

### Chat IA Streaming SSE (v1.02.23) — CONCLUIDO
- Backend: novo endpoint POST /chat-ia/message-stream com SSE
- Service: streamClaude() com streaming API do Anthropic SDK
- Suporta tool_use loop com streaming (max 6 iteracoes)
- Frontend: fetch + ReadableStream para parsear SSE events
- Eventos: delta (texto), buttons (botoes), thinking (tool exec), done, error
- Bouncing dots somem quando texto comeca a aparecer
- Deploy v1.02.23 OK

---
