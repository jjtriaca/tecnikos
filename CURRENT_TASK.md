# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 118 — Admin Host + Data Migration (CONCLUIDO)

## Ultima sessao: 118 (13/03/2026)
- Sessao 116: Limpeza SLS + Teste compra + Fix Step 5/Chat IA/CAPTCHA + Deploy v1.02.57
- Sessao 117: Isolamento de dados multi-tenant via AsyncLocalStorage + Proxy (v1.02.58)
- Sessao 118: Admin Host isolado + Migracao de dados completa (v1.02.59)

## O que foi feito na sessao 118:
- [x] Adicionado `companyId` ao model Tenant (migration manual)
- [x] Criado TenantResolverService para webhooks/crons resolverem tenant
- [x] Criado `runInTenantContext()` helper
- [x] Corrigido WhatsApp webhook (usa Tenant.companyId)
- [x] Corrigido Focus NFS-e webhook (itera tenants)
- [x] Corrigido Sefaz cron (forEachTenant)
- [x] Frontend: isAdminHost() detection + sidebar admin + redirect
- [x] Backend: /auth/me retorna tenantSlug
- [x] Deploy v1.02.59
- [x] Prisma migration aplicada em producao
- [x] Migracao de dados v3 executada (2801 partners, 5 OS, 11 fin entries, 263 sefaz docs, todos configs)
- [x] Admin Company "Teknikos Admin" criada em public
- [x] Admin users atualizados para admin company
- [x] Tenant.companyId setado para SLS
- [x] Turnstile CAPTCHA atualizado: 3 hostnames
- [x] Verificacao completa: health, login, dados, logs — tudo OK

## Arquitetura Multi-Tenant Atual:
- **admin.tecnikos.com.br**: sem tenant context → public schema → SaaS admin dashboard
- **sls.tecnikos.com.br**: tenant_sls context → dados isolados da SLS Obras
- **Webhooks**: TenantResolverService resolve tenant por companyId ou iteracao
- **Crons**: forEachTenant() itera todos os schemas ativos
- **Proxy PrismaService**: AsyncLocalStorage + JavaScript Proxy (zero mudancas nos services)

## Estado do Banco:
- **public.User**: 2 admins (jjtriaca, maritriaca) → Admin Company (00000000...0001)
- **tenant_sls.User**: 2 admins → SLS Company (00000000...0002)
- **public**: 0 dados operacionais (so SaaS: Tenant, Plan, Subscription, etc.)
- **tenant_sls**: TODOS os dados operacionais (2801 partners, 5 OS, etc.)
- **Backup**: `/opt/tecnikos/backups/pre_migration_20260313_155037.sql.gz`

## Proximos passos possiveis:
1. Implementar Asaas Checkout (plano em `.claude/plans/tidy-honking-diffie.md`)
2. Teste end-to-end: login SLS + dashboard com dados + criar OS + financeiro
3. Teste admin: login admin.tecnikos.com.br + dashboard SaaS
4. Verificar Sefaz auto-fetch funcionando no tenant context
5. Verificar WhatsApp webhook routing

## Versao atual: v1.02.59 (em producao)

## Se reconectar no MEIO de uma tarefa:
- Verifique o TODO list no Claude (se existir)
- Leia o CHAT_LOG.md para contexto
- Continue exatamente do ponto onde parou
- NAO pergunte ao Juliano — ele autorizou execucao irrestrita

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- Pode sempre continuar depois do deploy sem perguntar
