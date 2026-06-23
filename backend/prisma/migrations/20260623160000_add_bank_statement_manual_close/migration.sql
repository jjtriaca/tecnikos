-- v1.13.89 — Fechamento MANUAL do mes na conciliacao. Substitui a trava automatica "por conferencia
-- batendo" (v1.12.16), que travava indevidamente o mes corrente que o usuario concilia no dia a dia
-- (OFX diario: saldo declarado pelo extrato + tudo conciliado = batia = travava). Agora a trava so
-- vale quando o usuario FECHA o mes de proposito (closedAt preenchido). NULLABLE (sem default) —
-- todos os meses nascem ABERTOS. O TenantMigratorService propaga o ADD COLUMN nos schemas tenant_*.

ALTER TABLE "BankStatement"
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedByName" TEXT;
