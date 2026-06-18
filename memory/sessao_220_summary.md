# Sessão 220 (17-18/06/2026) — Bloqueio de conciliação de receita sem NF + excluir etapa apaga linhas

**Release única: v1.13.68 → v1.13.69.** Prod alinhada o tempo todo (1.13.68 no início). Doc detalhada da feature: [[bloqueio-conciliacao-receita-sem-nf]].

## v1.13.69 — 2 frentes (1 deploy)

### 1) Bloquear conciliação de receita sem NFS-e (CONFIGURÁVEL, opt-in por plano de contas)
- **Pedido:** opção de bloquear conciliar uma receita (RECEIVABLE) sem NFS-e emitida. **Dúvida do Juliano (juros):** receita que não é de serviço não deve travar → resolvido com **opt-in por plano de contas**.
- **REUSA o padrão existente (REGRA #9):** config `NfseConfig.receiveWithoutNfse` (WARN/BLOCK/IGNORE, já em Config→Fiscal) + helper `checkNfseBeforePayment`. NÃO inventei flag nova. Vale igual pra RECEBER e CONCILIAR.
- **Achado-chave da investigação:** a conciliação NUNCA teve checagem de NF (o guard só existia no botão "Receber", e era **frontend-only**). Por isso "não avisava mesmo com a config ligada" (relato do Juliano). E `tryAutoReconciliation` chama `matchLine` → guard no matchLine cobre manual + automática.
- **Opt-in por plano:** campo novo `FinancialAccount.requiresNfse` (migration `20260617120000`, default false). `checkNfseBeforePayment` só exige NF se a conta do lançamento estiver marcada → juros/reembolso/receita financeira LIVRES. Isso mudou TAMBÉM o guard de RECEBER (agora só conta marcada).
- **Enforcement BACKEND** (`reconciliation.service`): `assertNfseForReconcile` em `matchLine` (RECEIVABLE não-estorno) + `matchAsMultiple` (só `expectedType=RECEIVABLE`). BLOCK = BadRequestException. Isenta `isRefundEntry`, `matchAsCardInvoice` (crédito/ajuste), `matchAsTransfer`. DI: `@Inject(forwardRef(() => NfseEmissionService))` (FinanceModule já importava NfseEmissionModule via forwardRef; FinanceService já fazia igual — sem ciclo novo).
- **Frontend:** checkbox "Exige NFS-e" no AccountsTab (só REVENUE); pré-check WARN/BLOCK no `handleMatch` do ReconciliationTab; **fix do catch L1130** (usava só `err?.response?.data?.message` → engolia a msg do backend, bug v1.13.33 de novo → add `|| err?.message`); textos em Config→Fiscal.
- **Multi-tenant:** `requiresNfse` no schema + migration + `prisma.service.ensureFinancialAccountTable` (self-healing public). TenantMigrator é GENÉRICO (lê colunas do public, ADD COLUMN IF NOT EXISTS nos tenants) → propagou sozinho. ✓ verificado: coluna em `public` E `tenant_sls`.

### 2) Excluir etapa apaga as linhas (módulo Piscina)
- **Bug (Juliano, print ORCP-00004):** linhas de etapas excluídas iam pra etapa OUTROS. **Causa:** `handleDeleteSection` MOVIA as linhas pra OUTROS de propósito (`api.put({poolSection:"OUTROS"})`). Excluir LINHA individual já apagava certo (não mexido).
- **Fix:** `handleDeleteSection` agora **apaga permanentemente** (`api.del` por linha; `persistSections` recarrega). Aviso virou "X linha(s) serão EXCLUÍDAS PERMANENTEMENTE — não pode ser desfeita".
- **Garantia confirmada (pergunta do Juliano):** excluir linha/etapa só afeta o orçamento; NUNCA mexe no modelo salvo. Verificado na arquitetura: `PoolBudgetTemplate` é JSON à parte (sections/itemsSnapshot/defaults), só escrito pelo `saveAsTemplate` (botão "Salvar modelo"); `applyTemplate` COPIA pra linhas próprias do orçamento; `removeItem`/`updateSections` são escopados ao budget. Nenhum caminho de escrita no template a partir da exclusão.

## Ativação no SLS (FEITO 18/06)
- `receiveWithoutNfse` = **BLOCK** (já estava). **Receita de Serviços (cód. 1100)** marcada `requiresNfse=true` via SQL na prod. Só ela — Produtos (1200), Juros (7100), Ajuste, Descontos, Entrada Sócios LIVRES.
- **Efeito:** conciliar/receber receita de SERVIÇO sem NFS-e autorizada agora BLOQUEIA.

## Verificação
- Backend tsc + frontend tsc + `next build` EXIT 0 (Prisma client regenerado). Deploy v1.13.69 OK; health público 1.13.69. Migration aplicada; coluna em public+tenant_sls.

## Pendências/follow-ups (não feitos, de propósito)
- Trava do botão "Receber" segue **frontend-only** (não ampliei pro backend — mesma regra/plano, mas sem enforcement server-side).
- Conciliação **só-installment** (`dto.installmentId` sem `entryId`) não passa pelo guard (nicho).
- Se quiserem, marcar **Receita de Produtos (1200)** também, ou abrandar pra **Avisar** — via UI.

## Commits
- `1aded6a` doc pendência · `bd6478d` release v1.13.69 · `ceb2948` doc+memória · `93654c0` ativação SLS · (+ doc desta sessão).
