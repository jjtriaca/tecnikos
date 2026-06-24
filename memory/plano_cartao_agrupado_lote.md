---
name: plano_cartao_agrupado_lote
description: PLANO (proposto, sessao 224) — agrupar 1 passada de cartao (e qualquer lote) como 1 unidade conciliavel. Estudo do fluxo CardSettlement + plano em 3 camadas.
metadata:
  type: project
---

# Cartao agrupado / Conciliacao por lote (GLOBAL) — proposto sessao 224 (24/06)

**Decisao Juliano:** fazer GLOBAL por lote (nao so cartao). O problema nao e "cartao", e "1 transacao real que o sistema quebrou em N lancamentos" — vale pra cartao, PIX, dinheiro, transferencia, cheque e forma nova de tenant. Elo universal ja existe: `batchPaymentId` (todo lote leva o mesmo, qualquer forma).

## Estudo do fluxo atual (CONFIRMADO no codigo)
- **Pagar RECEIVABLE por cartao** (`finance.service.changeEntryStatus` PAID, branch `isCardPayment && RECEIVABLE`, ~L1212): cria **1 CardSettlement PENDING** por lancamento (`card-settlement.service.createFromEntry`). gross=netCents, fee, expectedNet, expectedDate=paidAt+receivingDays. **NAO mexe saldo** no pagamento (dinheiro "em transito" = os PENDING). Se `cardFeeRateId`, usa brand/fee/days/installmentCount da CardFeeRate.
- **batchPay** (`finance.service.batchPay` L934): loop chama changeEntryStatus PAID por entry, DEPOIS grava `entry.batchPaymentId=BATCH_xxx` (L989). N cartao numa passada = N settlements. **`batchPaymentId` fica no LANCAMENTO, NAO no CardSettlement** (gap a preencher).
- **Baixa de Cartao** (front `CardSettlementTab.tsx` + `card-settlement.service.settle`/`settleBatch`): operador seleciona PENDING e baixa. `settle` (single) move saldo origem(transito)->destino(banco) via **AccountTransfer** + cria fee expense (PAYABLE PAID, conta 5200, so DRE). `settleBatch` marca SETTLED + incrementa banco pela SOMA mas **NAO cria AccountTransfer nem decrementa origem** (inconsistente com settle — corrigir no agrupamento).
- **Conciliacao** (`reconciliation.service`): metodos matchLine, matchAsRefund, matchAsCardInvoice, **matchAsMultiple** (1 linha <-> N entries, confere soma; aceita mistura RECEIVABLE+PAYABLE p/ taxa cartao, v1.10.07), matchAsTransfer, matchAsCheckReturn. **Nao ha matchAsCardSettlement.** Furo no matchAsMultiple: entry ja PAID na MESMA conta do banco da linha cai fora dos 2 branches mas `bankDelta` credita mesmo assim -> **conta dobrada** (caso PIX lote pago direto no banco).
- `CardSettlement` esta em `TENANT_MODEL_DELEGATES` (prisma.service L40) + self-healing `ensureCardSettlementTable`. Migration de coluna nova propaga pelos tenants (padrao cheque v1.13.85).

## Precedente a seguir (REGRA #9): feature CHEQUE (sessao 223)
`getCheckWallet` AGRUPA por cheque fisico (checkNumber+checkBank) -> 1 linha (entryIds[]+soma); entry FICA na conta; saldo move so por AccountTransfer; tudo-ou-nada. Replicar IDENTICO trocando a chave fisica por `batchPaymentId`.

## Plano em 3 camadas
- **CAMADA 1 (fundacao, invisivel):** carimbar `batchPaymentId` no CardSettlement (migration coluna nullable + propaga; em batchPay dar updateMany nos settlements do lote). Gancho das camadas 2/3. Zero mudanca de comportamento.
- **CAMADA 2 (cartao, caso urgente):** Baixa de Cartao agrupa PENDING por `batchPaymentId` (1 linha=lote de N, bruto/taxa/liquido somados, previsto). Baixa o lote todo (reusa settleBatch) -> 1 credito liquido no banco + **1 AccountTransfer rastreavel** (consertar settleBatch). Rastreio dos N por baixo (cada settlement 1:1 com seu lancamento).
- **CAMADA 3 (global p/ qualquer forma):** na conciliacao, "esta linha e deposito em lote" -> escolhe batchPaymentId -> expande N lancamentos -> usa matchAsMultiple. PIX/dinheiro/transferencia de graca. Fechar o furo "ja pago na mesma conta = nao dobrar". Forma nova herda; se "cai depois com taxa", entra na camada 2 por marcacao no cadastro (como `requiresBrand`).

## CAMINHO CANONICO confirmado (decide o saldo)
- A conciliacao de deposito de cartao hoje (`ReconciliationTab` "Conciliar" modal) detecta linha de cartao (keywords), auto-detecta bandeira/taxa e acha o **MELHOR candidato UNICO** cuja taxa implicita `(gross-bankAmount)/gross` bate com a configurada → match 1-linha-1-lancamento + taxa. **Numa passada de N contas, NENHUM lancamento sozinho bate com o liquido somado → descasa → forca match-multiple manual (N + taxa).** ESSE e o ponto da dor.
- **Credito do banco = no match-multiple** (`matchAsMultiple`): credita banco em `lineAbs` (liquido) UMA vez (`bankDelta`); lancamentos de cartao ja PAID sem cashAccountId caem fora dos 2 branches de saldo (so linka) → sem dupla contagem; cancela CardSettlements PENDING **so quando `sumOpposite>0`** (tem taxa). Caminho EXISTENTE e testado p/ saldo.
- **Baixa de Cartao `settle()` e caminho SECUNDARIO** (credita conta direto; usar quando NAO concilia via extrato). Risco latente HOJE: settle + conciliar a mesma linha = banco creditado 2x (existente, nao introduzido por nos).
- **IMPLICACAO FORTE:** o fix central (conciliar o LOTE) = no modal de conciliacao, escolher o lote (`batchPaymentId`, **ja existe no lancamento**) → auto-seleciona os N + auto-soma a taxa → chama `matchAsMultiple`. **NAO precisa de migration** e herda a seguranca de saldo do match-multiple. Generaliza p/ PIX/etc (sem taxa → so N lancamentos). Migration de `CardSettlement.batchPaymentId` so e necessaria pra AGRUPAR a tela Baixa de Cartao (camada 2, secundaria).
- Melhoria a embutir: cancelar PENDING settlements dos lancamentos casados SEMPRE (nao so com taxa) — senao cartao SEM taxa (debito) deixa settlement orfao.

## Decisoes TRAVADAS (Juliano, sessao 224)
1. Taxa do lote: SOMAR por lancamento (cada um ja tem taxa exata) e exibir a soma — NAO recalcular sobre o total.
2. Baixa do lote = tudo-ou-nada (a passada e atomica; baixa inteira). NAO impede receber parcial das contas (momento de MONTAR a passada e livre: cliente paga 2 de 3 contas = passada de 2).
3. **TUDO num deploy so** (Juliano escolheu, vs faseado) — redobrar simulacao de saldo.
4. **Receber PARCIAL de uma conta (pagar R$185 de R$200, resto fica em aberto): NAO existe hoje** (sistema recebe contas INTEIRAS; `payInstallment` sobrescreve valor sem deixar resto; parcelas dividem IGUAL; renegociacao troca o total). Decisao: **frente SEPARADA depois do cartao** — o agrupamento por lote NAO depende disso e nao conflita.

## Regras financeiras (REGRA ABSOLUTA)
Simular cada cenario com SQL antes de aplicar; conferir balance-compare de TODOS os meses; AccountTransfer rastreavel sempre; nada de UPDATE direto em saldo; reverter na hora se quebrar.

Relacionado: [[sessao_223_summary]] (cheque, mesmo padrao), [[conciliacao-preserve-transit]].
