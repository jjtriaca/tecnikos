# Bloqueio de conciliação de receita sem NFS-e (v1.13.69, 17/06/2026)

## Intenção
Impedir que uma RECEITA (RECEIVABLE) seja **conciliada/recebida sem NFS-e autorizada** — força emitir a nota antes. Configurável. **Caso juros:** receita que não é de serviço (juros, reembolso, receita financeira) NÃO deve travar → resolvido com **opt-in por plano de contas**.

## Decisões (NÃO violar)
- **REUSA o padrão existente, não inventa flag nova (REGRA #9):** a configuração é a MESMA `NfseConfig.receiveWithoutNfse` (`WARN` | `BLOCK` | `IGNORE`, default WARN, em Configurações → Fiscal). Vale igual pra **RECEBER** e pra **CONCILIAR**.
- **Opt-in por plano de contas:** só receita cujo `FinancialAccount.requiresNfse = true` é que avisa/bloqueia. Conta não marcada (ou lançamento sem plano) = livre. Default `false` → **nada trava até o operador marcar** os planos de serviço.
- A trava na **conciliação** é enforçada no **BACKEND** (cobre conciliação automática). A trava no botão **"Receber"** segue só no frontend (como já era antes — não foi ampliado).

## Mecânica
- **Fonte de verdade:** `nfse-emission.service.checkNfseBeforePayment(companyId, entryId)` → `{ requiresNfse, behavior, nfseStatus }`. Só RECEIVABLE; herda NF do lançamento-pai em renegociação; `IGNORE` se o tenant não tem `NfseConfig`. **v1.13.69 adicionou o gate por conta:** se `financialAccount.requiresNfse !== true` → `requiresNfse=false` (não exige). "NF emitida" = `nfseStatus === 'AUTHORIZED'` (set no webhook PAYMENT, nfse-emission L1240).
- **Conciliação (`reconciliation.service`):** `assertNfseForReconcile(companyId, entryId)` chama o helper acima e lança `BadRequestException` quando `requiresNfse && behavior === 'BLOCK'`. Chamado em:
  - `matchLine` — `if (dto.entryId && entryBefore.type === 'RECEIVABLE' && !isRefundEntry)`. Cobre conciliação manual única **E** automática (`tryAutoReconciliation` chama matchLine; o try/catch dela só pula a linha no BLOCK).
  - `matchAsMultiple` — só quando `expectedType === 'RECEIVABLE'` (linha de crédito = receita entrando), por cada entry RECEIVABLE não-estorno. No cenário misto com linha de débito (PAYABLE) os RECEIVABLE são ajustes/créditos → NÃO travam.
  - **Isentos (não tocados):** `matchAsCardInvoice` (crédito/ajuste de fatura), `matchAsRefund`, `matchAsTransfer`, e qualquer `isRefundEntry`.
  - DI: `@Inject(forwardRef(() => NfseEmissionService))` (FinanceModule já importa `forwardRef(NfseEmissionModule)`; FinanceService já fazia igual).
- **Frontend:**
  - `AccountsTab` (Plano de Contas): checkbox **"Exige NFS-e"** (só tipo REVENUE) → grava `requiresNfse` (DTO Create/Update + service).
  - `ReconciliationTab.handleMatch`: pré-check antes de `/match` quando `line.amountCents >= 0` → `GET /nfse-emission/check-payment/:id` → BLOCK trava+toast, WARN `confirm()`. **Fix junto:** o catch do handleMatch usava só `err?.response?.data?.message` (engolia a msg do backend — bug v1.13.33) → agora cai pra `err?.message`.
  - `settings/fiscal`: rótulo "Recebimento / conciliação sem NFS-e emitida" + ajuda explicando opt-in por plano + 3 níveis.

## Schema / multi-tenant
- `FinancialAccount.requiresNfse Boolean @default(false)`. Migration `20260617120000_financial_account_requires_nfse` (ADD COLUMN IF NOT EXISTS). Também no `prisma.service.ensureFinancialAccountTable` (CREATE + ALTER, self-healing do public). **TenantMigrator é genérico** (lê colunas do public e faz ADD COLUMN IF NOT EXISTS nos tenants) → propaga sozinho. ✓ Verificado em prod: coluna em `public` E `tenant_sls`.

## Ativação no SLS (FEITO 18/06/2026)
- `receiveWithoutNfse` = **BLOCK** (já estava).
- **Receita de Serviços (cód. 1100) marcada `requiresNfse=true`** via SQL na prod (tenant_sls). Só ela — Produtos (1200), Juros (7100), Ajuste (1301), Descontos (1300), Entrada Sócios (1400) ficam LIVRES.
- Efeito: conciliar/receber receita de SERVIÇO sem NFS-e autorizada agora **BLOQUEIA**. Pra incluir outro plano (ex: Receita de Produtos) ou abrandar pra Avisar → UI (Finanças → Plano de Contas / Configurações → Fiscal).

## Gaps conhecidos
- Conciliação só-installment (`dto.installmentId` sem `entryId`) não passa pelo guard (nicho).
- Trava do botão "Receber" continua frontend-only (mesma regra/plano, mas sem enforcement backend).
