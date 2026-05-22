# Bug: Encargo de fatura de cartão órfão quebrava conferência retroativa

## Versão do fix
v1.12.16 (22/05/2026)

## Sintoma
Conferência de saldo dos meses **anteriores** à data de pagamento da fatura passou a divergir após conciliação de fatura de cartão.

Exemplo real (SLS, fatura paga em 08/05/2026, encargo de R$ 32,12):
- Março/2026: banco 1.919,33 / sistema 1.887,21 / diff **-32,12**
- Abril/2026: banco 15.308,27 / sistema 15.276,15 / diff **-32,12**
- Maio/2026 (data ref 20/05, posterior ao pagamento): sem impacto desse bug

A diferença era **idêntica em todos os meses anteriores ao paidAt da fatura**.

## Causa raiz
`ReconciliationService.matchAsCardInvoice` (backend/src/finance/reconciliation.service.ts):
1. Decrementa o saldo do banco em `lineAbs` total (R$ 6.443,60) — linha ~1483.
2. Cria `AccountTransfer` only pra entries com `destAccountId` (resolvido via paymentInstrument do cartão) — linha ~1454/1467.
3. Encargo de fatura (`isInvoiceCharge=true` + `paymentInstrumentId=null` + `cashAccountId=null`) fica **órfão**:
   - Não tem `cashAccountId`
   - Não gera `AccountTransfer` próprio
   - Não aparece no filtro de balance-compare (que filtra `cashAccountId=bankAccountId`)
4. Resultado: o decrement do banco em `lineAbs` inclui os R$ 32,12, mas nenhum movimento "rastreável" cobre esses R$.
5. Para qualquer `D < paidAt do encargo` (mesma data do paidAt da fatura), `movsAfterD` fica menor que o esperado em exatamente o valor do encargo, e `systemBalanceAtD = currentBalance - movsAfterD` fica abaixo do real pelo mesmo valor.

## Solução implementada

### Fix matchAsCardInvoice (reconciliation.service.ts:~1450)
Quando entry é encargo (`e.isInvoiceCharge`) e `destAccountId=null`, setar `entryUpdate.cashAccountId = bankAccountId`. Aí o encargo passa a aparecer no filtro de balance-compare como PAYABLE PAID na conta do banco, e o movsAfterD passa a contar corretamente.

### Fix unmatchLine (reconciliation.service.ts:~1991)
Ao reverter, identificar encargos auto-pagos sem cartão (`autoMarkedPaid && isInvoiceCharge && !paymentInstrumentId`) e limpar `cashAccountId` (volta a null, estado original).

### Correção retroativa
FIN-00577 no tenant_sls — UPDATE setando `cashAccountId='6e8703d3-...'` (Sicredi). Diff zerou em março e abril.

## Trava de mês fechado (preventiva)
Criado `ClosedMonthGuardService` que bloqueia mutações financeiras em meses com:
- `BankStatement.statementBalanceCents` preenchido
- `statementBalanceDate` preenchido
- diff entre banco e sistema = 0 (tolerância 1 centavo)

Aplicado em:
- Reconciliation: matchLine, matchAsCardInvoice, matchAsMultiple, matchAsTransfer, matchAsRefund, unmatchLine
- Finance: createEntry (se PAID + cashAccountId + paidAt), changeEntryStatus (→ PAID, → REVERSED, → CANCELLED de PAID), deleteEntry (se PAID)
- Transfer: create

Pra "reabrir" um mês fechado: usuário edita/remove o saldo do banco em Conciliação > extrato do mês.

## Como evitar regressão
- Sempre que criar ou alterar entry PAID, validar que cashAccountId está setado **se** o entry deve aparecer no saldo dessa conta
- Decrement de `currentBalanceCents` sem AccountTransfer correspondente OU sem entry PAID com cashAccountId é um bug — quebra balance-compare
- Encargos de fatura têm a peculiaridade de não ter cartão — devem ser ancorados na conta do banco que paga a fatura

## Matemática da verificação

Antes do fix (D < paidAt):
```
currentBalance = X - 6443,60
pay._sum = entries PAID com cashAccountId=banco, paidAt > D  (NÃO inclui encargo)
transferOut = 6411,48 (só cartões)
movsAfterD = ... -pay - 6411,48
systemBalanceAtD = X - 6443,60 - (... -pay - 6411,48) = X + pay - 32,12
diff = real - systemBal = -32,12 (sistema 32,12 abaixo do banco) ❌
```

Depois do fix:
```
pay._sum agora inclui encargo: +32,12
transferOut = 6411,48 (mesmo)
movsAfterD = ... -(pay+32,12) - 6411,48
systemBalanceAtD = X - 6443,60 - (... -(pay+32,12) - 6411,48) = X + pay
diff = 0 ✅
```
