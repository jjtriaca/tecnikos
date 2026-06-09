# Conciliação de Fatura de Cartão — Splitter + Crédito/Ajuste (v1.13.34 → v1.13.43)

Mecanismos financeiros da **conciliação de fatura de cartão** (modal "Conciliar fatura de cartao",
`ReconciliationTab.tsx` + `reconciliation.service.matchAsCardInvoice`). LER antes de mexer.

## Contexto do problema
NFe de cartão importadas entram com **valor CHEIO** e (no SLS) **PAGAS**. Na conciliação de fatura
elas apareciam com o total, não por ciclo → candidatas erradas. Faturas também têm diferenças de
**centavo** (ex: POSTO lançado 480,05, cobrado 480,00). Dois mecanismos resolvem isso.

## 1. Splitter — dividir lançamento PAGO de cartão em parcelas (v1.13.34)
- Endpoint `POST /finance/entries/:id/split-card { count, dryRun? }` → `InstallmentService.splitPaidCardEntry`.
- Cria **N filhas PAGAS** (1 por ciclo de fatura: `cardBillingDate` = ciclo da mãe + i meses), preserva
  cartão/instrumento; mãe vira **SPLIT** (sai dos relatórios). UI: ação "Dividir em parcelas (cartão)"
  no menu do lançamento (gate: status PAID && cardBillingDate) + `SplitCardModal` com **dryRun** (prévia).
- **SALDO-NEUTRO (exato):** reverte o delta do pai (PAYABLE: +netCents, espelha o estorno de
  `finance.service` ~L1141) + aplica cada filha (−valor, convenção auto-pay `payment-instrument` L146)
  = ZERO líquido, MESMA conta/data `paidAt`. **TRAVA DURA:** `saldoNetCents ≠ 0` → aborta sem gravar.
  Recusa se já conciliado / tem CardSettlement / não-cartão / não-pago. (SLS card payables = 0
  settlements → caminho de delta simples, seguro.)
- `generateInstallments` (parcelar PENDENTE) também passou a setar `cardBillingDate` por ciclo.

## 2. Crédito / Ajuste bidirecional na conciliação (v1.13.43) — RESOLVE diferença de centavo
- No "Novo lançamento" do modal: seletor **Tipo** = **Despesa (+ soma)** | **Crédito-Receita (− subtrai)**.
- **Usuário SEMPRE digita valor POSITIVO** — o sinal é tratado por dentro. (Exigência do Juliano:
  "ninguém vai se tocar de lançar negativo" — UX intuitiva é obrigatória.)
- **Crédito = RECEITA** (`type: 'RECEIVABLE'`) na conta **receita-ajuste** → aparece no **DRE como receita (+)**
  e **SUBTRAI** na conciliação. Despesa = PAYABLE normal (soma). Plano de Contas no modal é AGRUPADO
  (`renderAccountOptions`, grupo>subgrupo).

### CONVENÇÃO-CHAVE `signedAmount` (NÃO QUEBRAR)
Em `matchAsCardInvoice` E no front (`selectedTotal`):
```
signedAmount(e) = (e.type === 'RECEIVABLE' ? -1 : 1) * (e.netCents || e.grossCents || 0)
```
- RECEIVABLE entra **negativo** → subtrai da soma da fatura E, no loop de saldo (`decrement: amount`),
  `decrement(negativo)` = **credita** o cartão (reduz a dívida). PAYABLE = positivo (soma/debita).
- Query de candidatas (`getCardInvoiceCandidates`) passou a trazer `type: { in: ['PAYABLE','RECEIVABLE'] }`
  + `type: true` no `select` (front precisa do `type`). `CardInvoiceEntry` (front) += `type`.
- Badge verde **"credito"** nas linhas RECEIVABLE (sinaliza que subtrai).

### SALDO traçado (confirma que fecha em ZERO)
Fatura `lineAbs` · compras ΣV (PAYABLE) · crédito C (RECEIVABLE):
- Soma: ΣV − C = `lineAbs` → bate (trava de ±1 centavo do motor mantida).
- Cartão: compras debitam (−ΣV), liquidação credita (+(ΣV−C)), crédito credita (+C) → **líquido 0**.
- Banco: −`lineAbs`. **Vale o crédito entrar PAGO (auto-pay) OU PENDENTE** — nos dois o líquido é 0.

## ⚠️ REGRA — não quebrar
Na conciliação de fatura de cartão, **RECEIVABLE = crédito que SUBTRAI**. Qualquer mexida em
`entriesTotal` (backend) / `selectedTotal` (front) / loop de saldo do `matchAsCardInvoice` DEVE manter
o `signedAmount`. Inverter o sinal vira "crédito = débito" e quebra o saldo do cartão.

## 3. Documentação do PARCELAMENTO na tela de detalhe (v1.13.35)
`finance/entries/[id]`: split (parcela) E renegociação compartilham `parentEntryId` (renegotiate seta
em L1361). Discriminador: **mãe `status==='SPLIT'` = PARCELA**; `renegotiatedTo` = renegociação real.
Filha de split → badge "Parcela X/N" + seção "Parcelamento" (total/parcela/valor/ciclo). Pai SPLIT →
"Parcelamento — dividido em N" (tabela). `childEntries` select += `cardBillingDate`/`paidAt`.

## Arquivos
- Backend: `reconciliation.service.ts` (`matchAsCardInvoice` ~L1291, candidatas ~L1175), `installment.service.ts` (`splitPaidCardEntry`), `finance.service.ts` (detalhe, childEntries select).
- Front: `ReconciliationTab.tsx` (modal, `selectedTotal`, `CardInvoiceEntry`, mini-modal Tipo), `finance/entries/[id]/page.tsx` (parcelamento).
