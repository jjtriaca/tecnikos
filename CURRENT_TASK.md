# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 92 — Tenant Onboarding + CNPJ Auto-Fill (v1.02.10)

## Ultima sessao: 92 (10/03/2026)
- Sessao 88: Multi-Tenant Foundation (v1.01.93-94)
- Sessao 89: SaaS Admin Panel + Secret Path (v1.01.95-96)
- Sessao 90: Landing Page + Signup + Vouchers + Pricing Strategy (v1.01.97-v1.02.04)
- Sessao 91: Currency Input Fixes + Add-ons + Sidebar Reorg (v1.02.05-09)
- Sessao 92: Tenant Onboarding + CNPJ Auto-Fill (v1.02.10)

## O que foi feito na sessao 92:

### Tenant Onboarding (v1.02.10) — CONCLUIDO
- [x] System-level email service (sendSystemEmail) com env vars SYSTEM_SMTP_*
- [x] TenantOnboardingService: cria Company + admin User no schema do tenant
- [x] Senha temporaria gerada com crypto.randomBytes (12 chars)
- [x] Email de boas-vindas HTML com credenciais + botao de acesso
- [x] Onboarding chamado em: signup com voucher + webhook de pagamento Asaas
- [x] Idempotente: verifica se Company ja existe antes de criar
- [x] CNPJ auto-fill via BrasilAPI no signup form
- [x] Botao "Consultar" ao lado do campo CNPJ
- [x] Auto-preenche nome da empresa
- [x] Build OK (backend + frontend)

### Arquivos criados:
- backend/src/tenant/tenant-onboarding.service.ts

### Arquivos modificados:
- backend/src/email/email.service.ts (sendSystemEmail)
- backend/src/tenant/tenant.module.ts (EmailModule, TenantOnboardingService)
- backend/src/tenant/tenant-public.controller.ts (cnpj-lookup, onboarding)
- backend/src/tenant/asaas.service.ts (onboarding on payment)
- backend/.env (system SMTP vars)
- .env.production.example (system SMTP vars)
- frontend/src/app/signup/page.tsx (CNPJ auto-fill, email feedback)

## Proximos passos:
1. ~~Onboarding tenant (Company + User + email)~~ CONCLUIDO v1.02.10
2. ~~CNPJ auto-fill via BrasilAPI~~ CONCLUIDO v1.02.10
3. Configurar SMTP de producao (SYSTEM_SMTP_* no .env.production do servidor)
4. Upload de documento do responsavel (RG/CNH) no signup
5. Barra de uso de OS + alertas (80%/90%/100%)
6. Compra de pacotes add-on via Asaas
7. Seguranca de deploy SaaS (backup pre-deploy, migrations safe, rollback, RLS, feature flags)
8. Controle de dispositivos
9. Chat IA suporte

## Versao atual: v1.02.10

## IDs importantes WhatsApp Meta:
- WABA ID: 1421505052856896 (SLS Sol e Lazer Solucoes) — REATIVADA
- Business ID: 2115296342089072
- Phone Number ID: 996592133539837
- App ID: 950743907617295
- System User ID: 122102184027217286

## Se reconectar no MEIO de uma tarefa:
- Verifique o TODO list no Claude (se existir)
- Leia memory/multitenant-progress.md para estado detalhado
- Leia o ultimo bloco do CHAT_LOG.md para contexto
- Continue exatamente do ponto onde parou
- NAO pergunte ao Juliano — ele autorizou execucao irrestrita

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- Pode sempre continuar depois do deploy sem perguntar
