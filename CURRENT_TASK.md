# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 93 — PPID Identity Verification (v1.02.11)

## Ultima sessao: 93 (10/03/2026)
- Sessao 89: SaaS Admin Panel + Secret Path (v1.01.95-96)
- Sessao 90: Landing Page + Signup + Vouchers + Pricing Strategy (v1.01.97-v1.02.04)
- Sessao 91: Currency Input Fixes + Add-ons + Sidebar Reorg (v1.02.05-09)
- Sessao 92: Tenant Onboarding + CNPJ Auto-Fill (v1.02.10)
- Sessao 93: PPID Identity Verification (v1.02.11)

## O que foi feito na sessao 93:

### PPID Identity Verification (v1.02.11) — CONCLUIDO
- [x] PpidService com autenticacao JWT + cache de token
- [x] 4 endpoints: classify, OCR, liveness, face match
- [x] fullVerification() pipeline (classify → OCR → liveness → face match)
- [x] Thresholds: liveness >= 50, similaridade >= 60
- [x] Graceful degradation: se PPID nao configurado, retorna approved=true
- [x] POST /public/saas/verify-identity endpoint
- [x] Signup reescrito com 5 steps: Plano → Empresa → Verificacao → Pagamento → Sucesso
- [x] Step 3: upload documento (RG/CNH) + selfie com preview
- [x] Conversao base64 via FileReader, envio para API
- [x] Exibicao de resultados (aprovado/rejeitado com scores e motivos)
- [x] Build OK + Deploy v1.02.11

### Arquivos criados:
- backend/src/ppid/ppid.service.ts
- backend/src/ppid/ppid.module.ts

### Arquivos modificados:
- backend/src/tenant/tenant.module.ts (PpidModule import)
- backend/src/tenant/tenant-public.controller.ts (verify-identity endpoint)
- frontend/src/app/signup/page.tsx (reescrito com step de verificacao)

## Proximos passos:
1. ~~Onboarding tenant (Company + User + email)~~ CONCLUIDO v1.02.10
2. ~~CNPJ auto-fill via BrasilAPI~~ CONCLUIDO v1.02.10
3. ~~Verificacao de identidade PPID~~ CONCLUIDO v1.02.11
4. Configurar SMTP e PPID em producao (.env.production no servidor)
5. Barra de uso de OS + alertas (80%/90%/100%)
6. Compra de pacotes add-on via Asaas
7. Seguranca de deploy SaaS (backup pre-deploy, migrations safe, rollback, RLS, feature flags)
8. Controle de dispositivos
9. Chat IA suporte

## Versao atual: v1.02.11

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
