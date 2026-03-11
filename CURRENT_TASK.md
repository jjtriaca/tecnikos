# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 93 — PPID + OS Usage Bar (v1.02.11-12)

## Ultima sessao: 93 (10/03/2026)
- Sessao 90: Landing Page + Signup + Vouchers + Pricing Strategy (v1.01.97-v1.02.04)
- Sessao 91: Currency Input Fixes + Add-ons + Sidebar Reorg (v1.02.05-09)
- Sessao 92: Tenant Onboarding + CNPJ Auto-Fill (v1.02.10)
- Sessao 93: PPID Identity Verification + OS Usage Bar (v1.02.11-12)

## O que foi feito na sessao 93:

### PPID Identity Verification (v1.02.11) — CONCLUIDO
- [x] PpidService com autenticacao JWT + cache de token
- [x] 4 endpoints: classify, OCR, liveness, face match
- [x] fullVerification() pipeline (classify → OCR → liveness → face match)
- [x] POST /public/saas/verify-identity endpoint
- [x] Signup reescrito com 5 steps: Plano → Empresa → Verificacao → Pagamento → Sucesso

### OS Usage Bar + Alertas (v1.02.12) — CONCLUIDO
- [x] Company model: maxOsPerMonth + maxUsers fields (migration)
- [x] GET /service-orders/usage endpoint (contagem mensal + limites)
- [x] UsageBar component na sidebar (barra de progresso com cores)
- [x] Alert banner no dashboard (80%/90%/100%)
- [x] Onboarding copia limites do Tenant para Company
- [x] Build OK + Deploy v1.02.12

## Proximos passos:
1. ~~Onboarding tenant~~ CONCLUIDO v1.02.10
2. ~~CNPJ auto-fill~~ CONCLUIDO v1.02.10
3. ~~Verificacao de identidade PPID~~ CONCLUIDO v1.02.11
4. ~~Barra de uso de OS + alertas~~ CONCLUIDO v1.02.12
5. Configurar SMTP e PPID em producao (.env.production no servidor)
6. Compra de pacotes add-on via Asaas
7. Seguranca de deploy SaaS (backup pre-deploy, migrations safe, rollback, RLS, feature flags)
8. Controle de dispositivos
9. Chat IA suporte

## Versao atual: v1.02.12

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
