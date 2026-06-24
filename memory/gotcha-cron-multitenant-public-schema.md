---
name: gotcha-cron-multitenant-public-schema
description: Cron/job SEM contexto de request roda no schema `public` (vazio) — precisa iterar os tenants com tenantResolver.forEachTenant, senao NAO toca dados de tenant.
metadata:
  type: reference
---

# Cron multi-tenant: sem contexto -> schema `public` (vazio)

**Regra:** todo `@Cron`/job que mexe em dados de TENANT precisa **iterar os tenants** e rodar a query DENTRO do schema de cada um. Sem contexto de request, o Proxy do `PrismaService` cai no schema **`public`** (vazio pra dados de tenant) e a query atualiza **ZERO** linhas — falha SILENCIOSA.

## Padrao correto (REGRA #9)
Injetar `TenantResolverService` (exportado por `TenantModule`) e usar:
```
await this.tenantResolver.forEachTenant(async (_tenantId, tenantSlug) => {
  await this.prisma.<model>.updateMany({ where: {...}, data: {...} }); // agora no schema do tenant
});
```
`forEachTenant` = `getActiveTenants()` (status notIn CANCELLED/BLOCKED) + `runInTenantContext({tenantId, tenantSchema}, fn)`. Para 1 company especifica: `runForCompany(companyId, fn)`. Endpoint manual (request TEM contexto) pode usar `this.prisma` direto (cai no tenant certo).

## Casos confirmados
- **nfse-emission `pollProcessingEmissions`** (`@Cron('*/2 * * * *')`) — ja usa o padrao (comentario explica o bug). Referencia canonica.
- **quote `expireQuotes`** (`@Cron('0 0 * * *')`) — **BUG ate v1.13.94**: rodava `this.prisma.quote.updateMany` direto -> schema public -> **13 orcamentos ENVIADO ja vencidos do SLS nunca viraram EXPIRADO** (card "Expirado" sempre 0). Prova: `tenant_sls ENVIADO vencidos=13, EXPIRADO=0, public.Quote=0`. **Fix v1.13.95**: `forEachTenant` + endpoint manual `POST /quotes/expire-now` (`expireNowForCompany`). Backfill dos 13 via SQL pos-deploy (status-only, seguro).

## Como auditar um cron novo
1. O cron toca model de tenant? (esta no `TENANT_MODEL_DELEGATES`?)
2. Se sim, ele usa `forEachTenant`/`runForCompany`? Se chama `this.prisma.<model>` direto no corpo do cron -> BUG.
3. Testar: rodar a query equivalente em `public.<Model>` (deve estar vazia) vs `tenant_*.<Model>`.

Relacionado: gotcha do `TENANT_MODEL_DELEGATES` (CLAUDE.md "Migrations Prisma em Multi-Tenant").
