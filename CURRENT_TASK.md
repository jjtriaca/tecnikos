# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 91 — Currency Input Fixes + Add-ons Landing (v1.02.05)

## Ultima sessao: 91 (10/03/2026)
- Sessao 88: Multi-Tenant Foundation (v1.01.93-94)
- Sessao 89: SaaS Admin Panel + Secret Path (v1.01.95-96)
- Sessao 90: Landing Page + Signup + Vouchers + Pricing Strategy (v1.01.97-v1.02.04)
- Sessao 91: Currency Input Fixes + Add-ons na Landing Page (v1.02.05)

## O que foi feito na sessao 89-90:

### Secret Admin Path (v1.01.96) — CONCLUIDO
- [x] Paginas SaaS admin movidas de /saas/ para /ctrl-zr8k2x/
- [x] NavItem interface: hidden?: boolean
- [x] Sidebar: menu so aparece quando pathname comeca com /ctrl-zr8k2x
- [x] Deploy v1.01.96

### Landing Page Pricing + Signup + Vouchers (v1.01.97) — EM ANDAMENTO
- [x] Backend: TenantPublicController com endpoints publicos (plans, check-slug, validate-code, signup)
- [x] Backend: generate-voucher endpoint (VCH-XXXXXXXX, skipPayment: true)
- [x] Schema: Plan.priceYearlyCents, Plan.features, Promotion.skipPayment
- [x] Self-healing: ALTER TABLE para novos campos
- [x] Landing page: secao de precos com toggle mensal/anual, cards de planos, features
- [x] Signup page: 3 etapas (plano + promo → dados empresa → sucesso)
- [x] Voucher validation: skipPayment pula etapa de pagamento, ativa tenant
- [x] Admin plans page: campos priceYearlyCents e features no form
- [x] Admin promotions page: botao "Gerar Voucher" com modal
- [x] Badge VOUCHER na tabela de promocoes
- [x] Suspense boundary no signup (useSearchParams)
- [x] Build OK
- [x] Deploy v1.01.97 OK

### Arquivos criados (sessao 89-90):
- backend/src/tenant/tenant-public.controller.ts
- frontend/src/app/signup/page.tsx
- frontend/src/app/(dashboard)/ctrl-zr8k2x/page.tsx (movido de /saas/)
- frontend/src/app/(dashboard)/ctrl-zr8k2x/tenants/page.tsx
- frontend/src/app/(dashboard)/ctrl-zr8k2x/plans/page.tsx
- frontend/src/app/(dashboard)/ctrl-zr8k2x/promotions/page.tsx

### Arquivos modificados:
- backend/prisma/schema.prisma (priceYearlyCents, features, skipPayment)
- backend/src/prisma/prisma.service.ts (ALTER TABLE)
- backend/src/tenant/tenant.module.ts (TenantPublicController)
- backend/src/tenant/tenant.controller.ts (generate-voucher)
- backend/src/tenant/dto/create-plan.dto.ts (priceYearlyCents, features)
- backend/src/tenant/dto/create-promotion.dto.ts (skipPayment)
- frontend/src/app/page.tsx (pricing section, billing toggle)
- frontend/src/components/layout/Sidebar.tsx (hidden flag, secret path)

## Proximos passos:
1. ~~Deploy v1.01.97~~ CONCLUIDO
2. ~~Integracao Asaas (pagamento recorrente)~~ CONCLUIDO v1.01.98
3. ~~Pricing strategy + plans + add-ons~~ CONCLUIDO v1.02.04-05
4. Barra de uso de OS + alertas (80%/90%/100%)
5. Compra de pacotes add-on via Asaas
6. Seguranca de deploy SaaS (backup pre-deploy, migrations safe, rollback, RLS, feature flags)
7. Controle de dispositivos
8. Chat IA suporte

## Versao atual: v1.02.08

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
