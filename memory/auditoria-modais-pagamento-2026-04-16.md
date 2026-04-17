# Auditoria 1: Modais de Pagamento e Recebimento
**Data:** 16/04/2026 | **Versao:** v1.09.82

---

## MODAIS IDENTIFICADOS (11 total)

### 1. Modal Pagar/Receber (Individual)
**Arquivo:** `frontend/src/app/(dashboard)/finance/page.tsx` (linhas 1830-2184)

**Campos:**
- Data de Pagamento (date, default hoje)
- Meio de Pagamento — Instrumento (dropdown PaymentInstrument, filtra showInPayables/showInReceivables)
- Forma de Pagamento — Manual (dropdown PaymentMethod, se nao selecionou instrumento)
- Cartao/Taxa (CardFeeRate, condicional: cartao + sem instrumento + toggle ON)
- Ultimos 4 digitos cartao cliente (condicional: RECEIVABLE + cartao)
- Dados do Cheque (condicional: RECEIVABLE + CHEQUE — 6 campos)
- Toggle "Lancar financeiro" (default ON, skipCashAccount quando OFF)
- Conta/Caixa (condicional: !cartao && toggle ON, filtra showIn*)
- Plano de Contas (dropdown agrupado por parent)
- Instrumento (condicional: se paymentMethod tem instrumentos)

**Endpoint:** `PATCH /finance/entries/{id}/status`

**Validacoes Frontend:**
- paymentMethod obrigatorio
- Se cartao: selectedCardRateId ou selectedInstrumentId obrigatorio (exceto toggle OFF)
- Se cheque: checkNumber obrigatorio

### 2. Modal Pagar/Receber Todos (Batch)
**Arquivo:** `frontend/src/app/(dashboard)/finance/page.tsx` (linhas 1733-1788)

**Campos:** Data, Forma Pagamento (obrigatorio), Conta/Caixa (opcional)

**Endpoint:** `POST /finance/entries/batch-pay`

### 3. Modal Cancelar
**Campos:** Motivo (min 10 chars)
**Endpoint:** `PATCH /finance/entries/{id}/status` com status=CANCELLED

### 4. Modal Estorno (Reverse)
**Campos:** Motivo (min 10 chars)
**Endpoint:** `PATCH /finance/entries/{id}/status` com status=REVERSED
**Acoes:** Desfaz CardSettlements, reverte saldos, deleta taxas tecnicas

### 5. Modal Gerar Parcelas
**Arquivo:** `frontend/.../components/GenerateInstallmentsModal.tsx`
**Campos:** Qtd (2-60), Data 1a parcela, Intervalo dias, Tipo juros, Taxa, Multa

### 6. Modal Renegociar
**Arquivo:** `frontend/.../components/RenegotiationModal.tsx`
**Campos:** Similar ao gerar parcelas
**Acao:** Cria nova entry + parcelas, marca original como renegociada

### 7. Modal Emissao NFS-e (3 fases: form → processing → send)
### 8. Modal Gerar Boleto
### 9. Modal Detalhe Boleto
### 10. Modal Relatorio Financeiro

### 11. Modais de Reconciliacao (4 tipos)
- Conciliar Linha (match 1:1)
- Conciliar Devolvucao (match refund pair)
- Conciliar Fatura Cartao (match N:1 card invoice)
- Conciliar Transferencia (match transfer)

---

## TOGGLES E CONFIGURACOES

| Toggle/Config | Onde | Efeito |
|---|---|---|
| `payUpdateFinancials` (toggle "Lancar financeiro") | Modal Pagar Individual | skipCashAccount=true quando OFF |
| `createFinancialEntry` (toggle NFe) | Modal Processar NFe | Nao cria entry quando OFF |
| `autoMarkPaid` (PaymentInstrument) | resolveAutoPay | Entry nasce PAID se instrumento tem flag |
| `showInPayables/showInReceivables` (CashAccount) | Dropdown Conta/Caixa | Filtra contas por direcao |
| `showInPayables/showInReceivables` (PaymentInstrument) | Dropdown Instrumento | Filtra instrumentos por direcao |
| `billingClosingDay/billingDueDay` | PaymentInstrument | Calcula cardBillingDate automaticamente |
| `lockAccountOnReceive` (sysConfig) | Modal Pagar RECEIVABLE | Trava dropdown de conta |
| `lockPlanOnReceive` (sysConfig) | Modal Pagar RECEIVABLE | Trava dropdown de plano |

---

## FLUXOS DE CRIACAO DE ENTRY (Backend)

| # | Origem | Arquivo | Usa resolveAutoPay | Preenche cardBillingDate | Atualiza saldo |
|---|---|---|---|---|---|
| 1 | createEntry (API) | finance.service.ts:222 | SIM | SIM | SIM (via balanceDelta) |
| 2 | changeEntryStatus → PAID | finance.service.ts:590 | NAO (manual) | SIM (calcula inline) | SIM (inline) |
| 3 | batchPay | finance.service.ts:540 | NAO (chama changeEntryStatus) | SIM (via changeEntryStatus) | SIM |
| 4 | NFe process | nfe.service.ts:744 | SIM | SIM | SIM |
| 5 | NFS-e entrada process | nfse-entrada.service.ts:721 | SIM | SIM | SIM |
| 6 | OS approve/finalize | service-order.service.ts | NAO (hardcoded PAID/PENDING) | NAO | NAO |
| 7 | Renegotiate | finance.service.ts:829 | NAO | NAO | NAO |
| 8 | matchLine (reconciliacao) | reconciliation.service.ts:597 | NAO | NAO | SIM (direto) |
| 9 | matchAsCardInvoice | reconciliation.service.ts:1110 | NAO | NAO | SIM (AccountTransfer) |
| 10 | matchAsRefund | reconciliation.service.ts:900 | NAO | NAO | NAO (tecnico) |
| 11 | CardSettlement.settle | card-settlement.service.ts | NAO | NAO | SIM |

---

## INCONSISTENCIAS ENCONTRADAS

### CRITICAS (afetam dados financeiros)

| # | Descricao | Risco | Onde |
|---|---|---|---|
| IC-01 | **Batch Pay ignora toggle skipCashAccount** | Saldo atualizado mesmo quando nao devia | finance.service.ts batchPay |
| IC-02 | **Batch Pay nao filtra contas por showInPayables/showInReceivables** | User pode pagar em conta desabilitada | finance/page.tsx batch modal |
| IC-03 | **balanceDelta aplicado FORA de transaction** | Se create falha apos delta, saldo fica errado | finance.service.ts:295 |
| IC-04 | **Validacao cheque so no frontend** | Backend aceita cheque sem banco/agencia | ChangeEntryStatusDto |

### MODERADAS (inconsistencia de UX)

| # | Descricao | Onde |
|---|---|---|
| IM-01 | Renegotiacao zera paymentMethod e paymentInstrumentId | finance.service.ts renegotiate |
| IM-02 | Cancelar registra motivo em `cancelledReason`, estorno em `notes` | Padrao diferente |
| IM-03 | lockAccountOnReceive e lockPlanOnReceive so funcionam no modal individual, nao no batch | Bypass via batch |
| IM-04 | NFe entrada tem toggle "Lancar financeiro", NFS-e entrada NAO tem modal de processamento equivalente | Assimetria |

### MENORES (cosmeticas)

| # | Descricao |
|---|---|
| Im-01 | Dropdown de contas no batch nao mostra tipo (Banco/Caixa/Transito) |
| Im-02 | Modal individual tem warning "saldo nao sera atualizado", batch nao tem |
| Im-03 | Preview de taxa de cartao so aparece quando CardFeeRate selecionado, nao quando instrumento selecionado |

---

## PADROES VISUAIS — COMPARATIVO

### Dropdowns de Meio de Pagamento
| Local | Filtra showIn* | Mostra badge autoMarkPaid | Mostra last4 |
|---|---|---|---|
| Modal Individual (instrumento-first) | SIM | SIM (⚡) | SIM |
| Modal Individual (PM manual) | NAO | NAO | NAO |
| Batch Pay | NAO | NAO | NAO |
| NFe Entrada | Parcial (so payables) | NAO | NAO |

### Modais de Importacao
| Aspecto | NFe (upload XML) | NFS-e Entrada (upload XML) |
|---|---|---|
| Botao | "Importar XML" | "Importar XML" |
| Processamento | Modal com decisoes (fornecedor, financeiro, itens) | Auto-processado sem modal |
| Toggle financeiro | SIM | NAO |
| Parcelas | SIM (detecta duplicatas do XML) | NAO |

**Recomendacao:** Unificar fluxo de processamento NFS-e entrada com modal similar ao NFe.
