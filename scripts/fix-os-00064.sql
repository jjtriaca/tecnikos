-- Ajuste manual OS-00064 — sessao 178-fix
-- Contexto: Iago usou finalize() ao inves de approveAndFinalize(), OS ficou CONCLUIDA sem tecnico atribuido.
-- Ueslei finalizou fisicamente em 17/04 09:06 mas nunca aceitou pelo sistema.
-- Ueslei nao tem comissao nessa OS.

BEGIN;
SET search_path = tenant_sls;

-- 1) Atualizar OS
UPDATE "ServiceOrder" SET
  "assignedPartnerId" = '86d06a8a-23f5-46d3-9d98-0f00067223f1',
  status              = 'APROVADA',
  "acceptedAt"        = '2026-04-17 08:11:00',
  "startedAt"         = '2026-04-17 08:41:00',
  "completedAt"       = '2026-04-17 09:06:00',
  "updatedAt"         = NOW()
WHERE id = '06b8d6bd-5511-44c4-9d82-7eecdd3edc18'
  AND "companyId" = '00000000-0000-0000-0000-000000000002';

-- 2) Criar Evaluation GESTOR (5 estrelas)
INSERT INTO "Evaluation" (id, "serviceOrderId", "partnerId", "companyId", "evaluatorType", score, comment, code, "createdAt")
VALUES (
  gen_random_uuid()::text,
  '06b8d6bd-5511-44c4-9d82-7eecdd3edc18',
  '86d06a8a-23f5-46d3-9d98-0f00067223f1',
  '00000000-0000-0000-0000-000000000002',
  'GESTOR',
  5,
  NULL,
  'AVA-00034',
  NOW()
);

-- 3) Incrementar counter EVALUATION
UPDATE "CodeCounter"
SET "nextNumber" = "nextNumber" + 1
WHERE entity = 'EVALUATION'
  AND "companyId" = '00000000-0000-0000-0000-000000000002';

-- 4) Registrar ServiceOrderEvent
INSERT INTO "ServiceOrderEvent" (id, "companyId", "serviceOrderId", type, "actorType", "actorId", payload, "createdAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  '06b8d6bd-5511-44c4-9d82-7eecdd3edc18',
  'STATUS_CHANGE',
  'USER',
  'aec54bc6-c87c-47a6-b0ac-7bacb0a4a163',
  '{"from":"CONCLUIDA","to":"APROVADA","reason":"Aprovacao retroativa via ajuste manual SQL","score":5,"note":"Ueslei finalizou fisicamente 17/04 09:06, Iago usou finalize() ao inves de approveAndFinalize(), ajustado via SQL"}'::jsonb,
  NOW()
);

-- 5) AuditLog
INSERT INTO "AuditLog" (id, "companyId", "entityType", "entityId", action, "actorType", "actorId", "actorName", before, after, "createdAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  'SERVICE_ORDER',
  '06b8d6bd-5511-44c4-9d82-7eecdd3edc18',
  'APPROVED_AND_FINALIZED_MANUAL',
  'USER',
  'aec54bc6-c87c-47a6-b0ac-7bacb0a4a163',
  'Juliano Triaca',
  '{"status":"CONCLUIDA","assignedPartnerId":null,"acceptedAt":null,"startedAt":null,"completedAt":"2026-04-20T15:22:55.667Z"}'::jsonb,
  '{"status":"APROVADA","assignedPartnerId":"86d06a8a-23f5-46d3-9d98-0f00067223f1","acceptedAt":"2026-04-17T08:11:00","startedAt":"2026-04-17T08:41:00","completedAt":"2026-04-17T09:06:00","evaluation":{"score":5,"code":"AVA-00034"}}'::jsonb,
  NOW()
);

-- 6) Validacao — mostra estado final antes de commitar
SELECT id, code, status, "assignedPartnerId", "acceptedAt", "startedAt", "completedAt"
FROM "ServiceOrder"
WHERE id = '06b8d6bd-5511-44c4-9d82-7eecdd3edc18';

SELECT code, "evaluatorType", score, "partnerId"
FROM "Evaluation"
WHERE "serviceOrderId" = '06b8d6bd-5511-44c4-9d82-7eecdd3edc18';

SELECT type, "actorId", payload
FROM "ServiceOrderEvent"
WHERE "serviceOrderId" = '06b8d6bd-5511-44c4-9d82-7eecdd3edc18';

COMMIT;
