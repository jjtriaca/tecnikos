-- =================================================================
-- PARCELAS REMANESCENTES CARTÃO SICREDI - FATURA ATÉ 25/03/2026
-- Todas como PAID, debitando na conta virtual do cartão
-- =================================================================
SET search_path TO tenant_sls;
BEGIN;

-- IDs constantes
-- companyId: 00000000-0000-0000-0000-000000000002
-- Master Ueslei: instrumentId=01b83cdf-f3d1-4262-8ab8-ed2e664f86e7, cashAccountId=264ea7bc-3ea7-40e2-965f-042d1915e222
-- Visa Juliano:  instrumentId=e4794fc5-d454-45ae-b38b-1a820d46cbbc, cashAccountId=429fd17f-6f32-4e0e-a396-a853735c1c3b
-- Partner CONSUMIDOR: f817e0fb-3ce6-490d-b36e-7052e14649c4
-- Partner AGROFIX: 69075beb-af81-459b-ab1e-d4d568751cfa
-- Partner FABIANO FERRAMENTAS: 5839872c-0a36-4ebe-87cc-b9ea5344ac7e
-- Partner AUTO ELETRICA CSA: ce0d2229-aaf6-4664-bb9a-2895c7dc24d9
-- Partner TODIMO: 372893af-c70f-41b0-a8f8-a3744e0a1b13
-- Partner POXOREU TINTAS: de100583-b5a0-4982-8ffd-fb1dde220107
-- FinancialAccount 2200: 847f95e7-17e9-4f65-8c60-f92a8ff352fd
-- FinancialAccount 2300: 03604a38-0fe0-4702-8a77-42315892620c

-- ============================================================
-- 1. AUTO ELETRICA - Master Ueslei - R$ 152,16 x 6 - Compra 13/02/2026
--    Parcelas 2/6 a 6/6 (5 parcelas) - Plano 2300
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00374', 'PAYABLE', 'Auto Eletrica - Parc 2/6 (compra 13/02/2026)', 15216, 15216, '2026-04-08', 'PAID', '2026-04-08', 'ce0d2229-aaf6-4664-bb9a-2895c7dc24d9', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00375', 'PAYABLE', 'Auto Eletrica - Parc 3/6 (compra 13/02/2026)', 15216, 15216, '2026-05-08', 'PAID', '2026-05-08', 'ce0d2229-aaf6-4664-bb9a-2895c7dc24d9', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00376', 'PAYABLE', 'Auto Eletrica - Parc 4/6 (compra 13/02/2026)', 15216, 15216, '2026-06-08', 'PAID', '2026-06-08', 'ce0d2229-aaf6-4664-bb9a-2895c7dc24d9', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00377', 'PAYABLE', 'Auto Eletrica - Parc 5/6 (compra 13/02/2026)', 15216, 15216, '2026-07-08', 'PAID', '2026-07-08', 'ce0d2229-aaf6-4664-bb9a-2895c7dc24d9', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00378', 'PAYABLE', 'Auto Eletrica - Parc 6/6 (compra 13/02/2026)', 15216, 15216, '2026-08-08', 'PAID', '2026-08-08', 'ce0d2229-aaf6-4664-bb9a-2895c7dc24d9', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW());

-- ============================================================
-- 2. MERCADOLIVRE MERCAD - Master Ueslei - R$ 500,50 x 4 - Compra 10/02/2026
--    Parcelas 2/4 a 4/4 (3 parcelas) - Plano 2200
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00379', 'PAYABLE', 'Mercado Livre - Parc 2/4 (compra 10/02/2026)', 50050, 50050, '2026-04-08', 'PAID', '2026-04-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00380', 'PAYABLE', 'Mercado Livre - Parc 3/4 (compra 10/02/2026)', 50050, 50050, '2026-05-08', 'PAID', '2026-05-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00381', 'PAYABLE', 'Mercado Livre - Parc 4/4 (compra 10/02/2026)', 50050, 50050, '2026-06-08', 'PAID', '2026-06-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW());

-- ============================================================
-- 3. CRM PNEUS (grande) - Master Ueslei - R$ 1.040,40 x 6 - Compra 19/01/2026
--    Parcelas 3/6 a 6/6 (4 parcelas) - Plano 2300
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00382', 'PAYABLE', 'CRM Pneus - Parc 3/6 (compra 19/01/2026)', 104040, 104040, '2026-04-08', 'PAID', '2026-04-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00383', 'PAYABLE', 'CRM Pneus - Parc 4/6 (compra 19/01/2026)', 104040, 104040, '2026-05-08', 'PAID', '2026-05-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00384', 'PAYABLE', 'CRM Pneus - Parc 5/6 (compra 19/01/2026)', 104040, 104040, '2026-06-08', 'PAID', '2026-06-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00385', 'PAYABLE', 'CRM Pneus - Parc 6/6 (compra 19/01/2026)', 104040, 104040, '2026-07-08', 'PAID', '2026-07-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW());

-- ============================================================
-- 4. CRM PNEUS (item 2) - Master Ueslei - R$ 66,26 x 6 - Compra 19/01/2026
--    Parcelas 3/6 a 6/6 (4 parcelas) - Plano 2300
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00386', 'PAYABLE', 'CRM Pneus (item 2) - Parc 3/6 (compra 19/01/2026)', 6626, 6626, '2026-04-08', 'PAID', '2026-04-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00387', 'PAYABLE', 'CRM Pneus (item 2) - Parc 4/6 (compra 19/01/2026)', 6626, 6626, '2026-05-08', 'PAID', '2026-05-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00388', 'PAYABLE', 'CRM Pneus (item 2) - Parc 5/6 (compra 19/01/2026)', 6626, 6626, '2026-06-08', 'PAID', '2026-06-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00389', 'PAYABLE', 'CRM Pneus (item 2) - Parc 6/6 (compra 19/01/2026)', 6626, 6626, '2026-07-08', 'PAID', '2026-07-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW());

-- ============================================================
-- 5. FABIANO FERRAMENTAS - Master Ueslei - R$ 149,83 x 6 - Compra 09/01/2026
--    Parcelas 3/6 a 6/6 (4 parcelas) - Plano 2200
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00390', 'PAYABLE', 'Fabiano Ferramentas - Parc 3/6 (compra 09/01/2026)', 14983, 14983, '2026-04-08', 'PAID', '2026-04-08', '5839872c-0a36-4ebe-87cc-b9ea5344ac7e', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00391', 'PAYABLE', 'Fabiano Ferramentas - Parc 4/6 (compra 09/01/2026)', 14983, 14983, '2026-05-08', 'PAID', '2026-05-08', '5839872c-0a36-4ebe-87cc-b9ea5344ac7e', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00392', 'PAYABLE', 'Fabiano Ferramentas - Parc 5/6 (compra 09/01/2026)', 14983, 14983, '2026-06-08', 'PAID', '2026-06-08', '5839872c-0a36-4ebe-87cc-b9ea5344ac7e', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00393', 'PAYABLE', 'Fabiano Ferramentas - Parc 6/6 (compra 09/01/2026)', 14983, 14983, '2026-07-08', 'PAID', '2026-07-08', '5839872c-0a36-4ebe-87cc-b9ea5344ac7e', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW());

-- ============================================================
-- 6. AGROFIX BRASIL - Master Ueslei - R$ 150,00 x 3 - Compra 09/01/2026
--    Parcela 3/3 (1 parcela - ÚLTIMA) - Plano 2200
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00394', 'PAYABLE', 'Agrofix Brasil - Parc 3/3 (compra 09/01/2026)', 15000, 15000, '2026-04-08', 'PAID', '2026-04-08', '69075beb-af81-459b-ab1e-d4d568751cfa', '264ea7bc-3ea7-40e2-965f-042d1915e222', '01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW());

-- ============================================================
-- 7. EC MERCADOLIVRE - Visa Juliano - R$ 39,28 x 6 - Compra 10/02/2026
--    Parcelas 2/6 a 6/6 (5 parcelas) - Plano 2200
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00395', 'PAYABLE', 'EC Mercado Livre - Parc 2/6 (compra 10/02/2026)', 3928, 3928, '2026-04-08', 'PAID', '2026-04-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00396', 'PAYABLE', 'EC Mercado Livre - Parc 3/6 (compra 10/02/2026)', 3928, 3928, '2026-05-08', 'PAID', '2026-05-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00397', 'PAYABLE', 'EC Mercado Livre - Parc 4/6 (compra 10/02/2026)', 3928, 3928, '2026-06-08', 'PAID', '2026-06-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00398', 'PAYABLE', 'EC Mercado Livre - Parc 5/6 (compra 10/02/2026)', 3928, 3928, '2026-07-08', 'PAID', '2026-07-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00399', 'PAYABLE', 'EC Mercado Livre - Parc 6/6 (compra 10/02/2026)', 3928, 3928, '2026-08-08', 'PAID', '2026-08-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW());

-- ============================================================
-- 8. PNEUSTORE CPX - Visa Juliano - R$ 118,48 x 12 - Compra 09/02/2026
--    Parcelas 2/12 a 12/12 (11 parcelas) - Plano 2300
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00400', 'PAYABLE', 'Pneustore CPX - Parc 2/12 (compra 09/02/2026)', 11848, 11848, '2026-04-08', 'PAID', '2026-04-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00401', 'PAYABLE', 'Pneustore CPX - Parc 3/12 (compra 09/02/2026)', 11848, 11848, '2026-05-08', 'PAID', '2026-05-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00402', 'PAYABLE', 'Pneustore CPX - Parc 4/12 (compra 09/02/2026)', 11848, 11848, '2026-06-08', 'PAID', '2026-06-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00403', 'PAYABLE', 'Pneustore CPX - Parc 5/12 (compra 09/02/2026)', 11848, 11848, '2026-07-08', 'PAID', '2026-07-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00404', 'PAYABLE', 'Pneustore CPX - Parc 6/12 (compra 09/02/2026)', 11848, 11848, '2026-08-08', 'PAID', '2026-08-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00405', 'PAYABLE', 'Pneustore CPX - Parc 7/12 (compra 09/02/2026)', 11848, 11848, '2026-09-08', 'PAID', '2026-09-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00406', 'PAYABLE', 'Pneustore CPX - Parc 8/12 (compra 09/02/2026)', 11848, 11848, '2026-10-08', 'PAID', '2026-10-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00407', 'PAYABLE', 'Pneustore CPX - Parc 9/12 (compra 09/02/2026)', 11848, 11848, '2026-11-08', 'PAID', '2026-11-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00408', 'PAYABLE', 'Pneustore CPX - Parc 10/12 (compra 09/02/2026)', 11848, 11848, '2026-12-08', 'PAID', '2026-12-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00409', 'PAYABLE', 'Pneustore CPX - Parc 11/12 (compra 09/02/2026)', 11848, 11848, '2027-01-08', 'PAID', '2027-01-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00410', 'PAYABLE', 'Pneustore CPX - Parc 12/12 (compra 09/02/2026)', 11848, 11848, '2027-02-08', 'PAID', '2027-02-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW());

-- ============================================================
-- 9. PNEU FREE COM - Visa Juliano - R$ 123,19 x 12 - Compra 09/02/2026
--    Parcelas 2/12 a 12/12 (11 parcelas) - Plano 2300
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00411', 'PAYABLE', 'Pneu Free Com - Parc 2/12 (compra 09/02/2026)', 12319, 12319, '2026-04-08', 'PAID', '2026-04-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00412', 'PAYABLE', 'Pneu Free Com - Parc 3/12 (compra 09/02/2026)', 12319, 12319, '2026-05-08', 'PAID', '2026-05-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00413', 'PAYABLE', 'Pneu Free Com - Parc 4/12 (compra 09/02/2026)', 12319, 12319, '2026-06-08', 'PAID', '2026-06-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00414', 'PAYABLE', 'Pneu Free Com - Parc 5/12 (compra 09/02/2026)', 12319, 12319, '2026-07-08', 'PAID', '2026-07-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00415', 'PAYABLE', 'Pneu Free Com - Parc 6/12 (compra 09/02/2026)', 12319, 12319, '2026-08-08', 'PAID', '2026-08-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00416', 'PAYABLE', 'Pneu Free Com - Parc 7/12 (compra 09/02/2026)', 12319, 12319, '2026-09-08', 'PAID', '2026-09-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00417', 'PAYABLE', 'Pneu Free Com - Parc 8/12 (compra 09/02/2026)', 12319, 12319, '2026-10-08', 'PAID', '2026-10-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00418', 'PAYABLE', 'Pneu Free Com - Parc 9/12 (compra 09/02/2026)', 12319, 12319, '2026-11-08', 'PAID', '2026-11-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00419', 'PAYABLE', 'Pneu Free Com - Parc 10/12 (compra 09/02/2026)', 12319, 12319, '2026-12-08', 'PAID', '2026-12-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00420', 'PAYABLE', 'Pneu Free Com - Parc 11/12 (compra 09/02/2026)', 12319, 12319, '2027-01-08', 'PAID', '2027-01-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00421', 'PAYABLE', 'Pneu Free Com - Parc 12/12 (compra 09/02/2026)', 12319, 12319, '2027-02-08', 'PAID', '2027-02-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '03604a38-0fe0-4702-8a77-42315892620c', NOW(), NOW());

-- ============================================================
-- 10. TODIMO PRIMAVERA - Visa Juliano - R$ 69,99 x 3 - Compra 23/01/2026
--     Parcelas 2/3 a 3/3 (2 parcelas) - Plano 2200
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00422', 'PAYABLE', 'Todimo Primavera - Parc 2/3 (compra 23/01/2026)', 6999, 6999, '2026-04-08', 'PAID', '2026-04-08', '372893af-c70f-41b0-a8f8-a3744e0a1b13', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00423', 'PAYABLE', 'Todimo Primavera - Parc 3/3 (compra 23/01/2026)', 6999, 6999, '2026-05-08', 'PAID', '2026-05-08', '372893af-c70f-41b0-a8f8-a3744e0a1b13', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW());

-- ============================================================
-- 11. POXOREU TINTAS - Visa Juliano - R$ 417,50 x 4 - Compra 12/12/2025
--     Parcela 4/4 (1 parcela - ÚLTIMA) - Plano 2200
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00424', 'PAYABLE', 'Poxoreu Tintas - Parc 4/4 (compra 12/12/2025)', 41750, 41750, '2026-04-08', 'PAID', '2026-04-08', 'de100583-b5a0-4982-8ffd-fb1dde220107', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW());

-- ============================================================
-- 12. MP HOBBYPRATACOMERC - Visa Juliano - R$ 166,50 x 12 - Compra 10/09/2025
--     Parcelas 7/12 a 12/12 (6 parcelas) - Plano 2200
-- ============================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, description, "netCents", "grossCents", "dueDate", status, "paidAt", "partnerId", "cashAccountId", "paymentInstrumentId", "paymentMethod", "autoMarkedPaid", "financialAccountId", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00425', 'PAYABLE', 'MP HobbyPrataComerc - Parc 7/12 (compra 10/09/2025)', 16650, 16650, '2026-04-08', 'PAID', '2026-04-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00426', 'PAYABLE', 'MP HobbyPrataComerc - Parc 8/12 (compra 10/09/2025)', 16650, 16650, '2026-05-08', 'PAID', '2026-05-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00427', 'PAYABLE', 'MP HobbyPrataComerc - Parc 9/12 (compra 10/09/2025)', 16650, 16650, '2026-06-08', 'PAID', '2026-06-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00428', 'PAYABLE', 'MP HobbyPrataComerc - Parc 10/12 (compra 10/09/2025)', 16650, 16650, '2026-07-08', 'PAID', '2026-07-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00429', 'PAYABLE', 'MP HobbyPrataComerc - Parc 11/12 (compra 10/09/2025)', 16650, 16650, '2026-08-08', 'PAID', '2026-08-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FIN-00430', 'PAYABLE', 'MP HobbyPrataComerc - Parc 12/12 (compra 10/09/2025)', 16650, 16650, '2026-09-08', 'PAID', '2026-09-08', 'f817e0fb-3ce6-490d-b36e-7052e14649c4', '429fd17f-6f32-4e0e-a396-a853735c1c3b', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc', 'CARTAO_CREDITO', true, '847f95e7-17e9-4f65-8c60-f92a8ff352fd', NOW(), NOW());

-- ============================================================
-- ATUALIZAR SALDOS DAS CONTAS DOS CARTOES
-- Cada entry PAID debita o cashAccount (saldo = saldo - netCents)
-- ============================================================

-- Somar tudo do Master Ueslei (compras 1-6)
-- 1. Auto Eletrica: 5 x 15216 = 76080
-- 2. Mercado Livre: 3 x 50050 = 150150
-- 3. CRM Pneus grande: 4 x 104040 = 416160
-- 4. CRM Pneus item2: 4 x 6626 = 26504
-- 5. Fabiano Ferramentas: 4 x 14983 = 59932
-- 6. Agrofix Brasil: 1 x 15000 = 15000
-- Total Master Ueslei: 743826 cents (R$ 7.438,26)
UPDATE "CashAccount"
SET "currentBalanceCents" = "currentBalanceCents" - 743826
WHERE id = '264ea7bc-3ea7-40e2-965f-042d1915e222';

-- Somar tudo do Visa Juliano (compras 7-12)
-- 7. EC Mercado Livre: 5 x 3928 = 19640
-- 8. Pneustore: 11 x 11848 = 130328
-- 9. Pneu Free: 11 x 12319 = 135509
-- 10. Todimo: 2 x 6999 = 13998
-- 11. Poxoreu Tintas: 1 x 41750 = 41750
-- 12. MP Hobby: 6 x 16650 = 99900
-- Total Visa Juliano: 441125 cents (R$ 4.411,25)
UPDATE "CashAccount"
SET "currentBalanceCents" = "currentBalanceCents" - 441125
WHERE id = '429fd17f-6f32-4e0e-a396-a853735c1c3b';

-- Atualizar o CodeCounter pra FIN continuar do 431
UPDATE "CodeCounter"
SET "nextNumber" = 431
WHERE prefix = 'FIN';

-- Verificacao
SELECT 'Master Ueslei' as cartao, "currentBalanceCents"/100.0 as saldo FROM "CashAccount" WHERE id = '264ea7bc-3ea7-40e2-965f-042d1915e222'
UNION ALL
SELECT 'Visa Juliano', "currentBalanceCents"/100.0 FROM "CashAccount" WHERE id = '429fd17f-6f32-4e0e-a396-a853735c1c3b';

COMMIT;
