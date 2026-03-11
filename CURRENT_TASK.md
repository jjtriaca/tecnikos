# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 94 — Add-ons + Deploy Security + Dispositivos + QSA (v1.02.13-14)

## Ultima sessao: 94 (11/03/2026)
- Sessao 91: Currency Input Fixes + Add-ons + Sidebar Reorg (v1.02.05-09)
- Sessao 92: Tenant Onboarding + CNPJ Auto-Fill (v1.02.10)
- Sessao 93: PPID Identity Verification + OS Usage Bar (v1.02.11-12)
- Sessao 94: Add-on Purchase + Deploy Security + Device Control + QSA (v1.02.13-14)

## O que foi feito na sessao 94:

### Compra de Pacotes Add-on via Asaas (v1.02.13) — CONCLUIDO
- [x] AddOn + AddOnPurchase models no schema.prisma
- [x] AsaasProvider.createPayment() para pagamentos avulsos
- [x] AsaasService.purchaseAddOn() + confirmAddOnPayment()
- [x] creditOsToTenantCompany() via TenantConnectionService
- [x] Webhook handling para standalone payments
- [x] Admin CRUD de add-ons (tenant.controller.ts)
- [x] GET /public/saas/addons + POST /public/saas/purchase-addon
- [x] Frontend: settings/billing/page.tsx (uso + pacotes)
- [x] Frontend: ctrl-zr8k2x/addons/page.tsx (admin)

### Seguranca de Deploy SaaS (v1.02.13) — CONCLUIDO
- [x] deploy-remote.sh reescrito (7 → 9 passos)
- [x] Backup pre-deploy automatico (pg_dump gzip)
- [x] Migration failure detection + abort
- [x] Health check com 3 retries
- [x] Rollback instructions on failure
- [x] Backup rotation (ultimos 10)

### Controle de Dispositivos (v1.02.13) — CONCLUIDO
- [x] Session model: deviceName + lastActivityAt + index
- [x] parseDeviceName() helper (Chrome no Windows, Safari no Mac, etc.)
- [x] createSession() com deviceName + lastActivityAt
- [x] getActiveSessions(), revokeSession(), revokeAllOtherSessions()
- [x] GET /auth/sessions, DELETE /auth/sessions/:id, POST /auth/sessions/revoke-all
- [x] Frontend: settings/devices/page.tsx (listar, encerrar, encerrar todas)
- [x] Build OK + Deploy v1.02.13

### Validacao QSA Representante Legal (v1.02.14) — CONCLUIDO
- [x] cnpj-lookup retorna array `socios` do QSA (BrasilAPI)
- [x] verify-identity cruza CPF do OCR com CPFs do QSA
- [x] Bloqueia signup se CPF nao consta no quadro societario
- [x] Frontend envia CNPJ e exibe resultado da validacao QSA
- [x] changePlan() propaga limites para Company no schema do tenant
- [x] Build OK + Deploy v1.02.14

## Proximos passos:
1. ~~Onboarding tenant~~ CONCLUIDO v1.02.10
2. ~~CNPJ auto-fill~~ CONCLUIDO v1.02.10
3. ~~Verificacao de identidade PPID~~ CONCLUIDO v1.02.11
4. ~~Barra de uso de OS + alertas~~ CONCLUIDO v1.02.12
5. Configurar SMTP e PPID em producao (.env.production no servidor)
6. ~~Compra de pacotes add-on via Asaas~~ CONCLUIDO v1.02.13
7. ~~Seguranca de deploy SaaS~~ CONCLUIDO v1.02.13
8. ~~Controle de dispositivos~~ CONCLUIDO v1.02.13
9. Chat IA suporte

## Versao atual: v1.02.14

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
