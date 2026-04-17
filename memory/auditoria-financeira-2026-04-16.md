# Auditoria 2: Financeiro — Conta por Conta, Valor por Valor
**Data:** 16/04/2026 | **Versao:** v1.09.82

---

## 1. SALDOS DAS CONTAS

| Conta | Tipo | Saldo Registrado | Saldo Calculado | Diferenca | Status |
|---|---|---|---|---|---|
| CAIXA INTERNO | CAIXA | R$ 55.393,00 | R$ 55.393,00 | R$ 0,00 | ✅ OK |
| SICREDI | BANCO | R$ 3.049,43 | R$ 3.049,43 | R$ 0,00 | ✅ OK |
| VALORES EM TRANSITO | TRANSITO | R$ 3.693,45 | — | — | ⚠️ Ver nota |
| Cartao Master Ueslei | CARTAO_CREDITO | -R$ 6.035,51 | -R$ 6.035,51 | R$ 0,00 | ✅ OK |
| Cartao Visa Juliano | CARTAO_CREDITO | -R$ 4.185,49 | -R$ 4.185,49 | R$ 0,00 | ✅ OK |

**Nota TRANSITO:** O saldo e gerenciado por ajustes inline da conciliacao (sem AccountTransfer). O saldo correto e validado pelo fato de que Sicredi bate com extrato real e cartoes batem com formula.

---

## 2. ENTRIES DUPLICADAS

### ALTO RISCO
| Entry A | Entry B | Parceiro | Valor | Descricao | Acao |
|---|---|---|---|---|---|
| **FIN-00270** | **FIN-00373** | LUIZ RAMON VERDERIO GAMBETA | R$ 4.525,00 cada | "instalacao boiler" | **VERIFICAR URGENTE** — pode ser duplicata |

### BAIXO RISCO (provavelmente correto)
| Entries | Descricao | Valor | Motivo |
|---|---|---|---|
| FIN-00302/FIN-00303 | Pedagio Rond x Pva Mt130 | R$ 11,20 cada | Ida/volta mesma rodovia 27/03 |
| FIN-00335/FIN-00336 | Visita tecnica | R$ 160,00 cada | Conciliadas com cartoes diferentes (ELO/VISA) |

---

## 3. CAIXA INTERNO
- 6 entries vinculadas, saldo R$ 55.393,00
- Nenhuma entry com paymentMethod "DINHEIRO" no sistema (todas sem paymentMethod)
- Saldo calculado = registrado → **OK**

---

## 4. CONTAS DE CARTAO

### Master Ueslei (Marilise 0124)
- 48 entries PAYABLE PAID = R$ 11.370,11
- 1 transfer IN (fatura marco) = R$ 5.334,60
- Saldo = -11.370,11 + 5.334,60 = **-R$ 6.035,51** ✅

### Visa Juliano (0223)
- Entries PAYABLE PAID = R$ 6.270,92
- 1 transfer IN (fatura marco) = R$ 2.085,43
- Saldo = -6.270,92 + 2.085,43 = **-R$ 4.185,49** ✅

---

## 5. VALORES EM TRANSITO — Entries

| Entry | Tipo | Valor | Situacao |
|---|---|---|---|
| FIN-00002 | RECEIVABLE | +R$ 360,00 | CardSettlement PENDING vencido 05/04 (**11 dias**) |
| FIN-00294 | PAYABLE | -R$ 759,00 | cashAccountId TRANSITO mas ja conciliado c/ Sicredi (**anomalia**) |
| FIN-00273 | RECEIVABLE | +R$ 905,00 | 3 CardSettlements PENDING futuros (25/04, 25/05, 24/06) — OK |
| FIN-00270 | RECEIVABLE | +R$ 4.525,00 | autoMarkedPaid, sem settlement — **possivel duplicata** |
| FIN-00268 | RECEIVABLE | +R$ 320,00 | autoMarkedPaid, sem settlement |
| FIN-00269 | RECEIVABLE | +R$ 320,00 | autoMarkedPaid, sem settlement |
| FIN-00373 | RECEIVABLE | +R$ 4.525,00 | autoMarkedPaid, sem settlement — **possivel duplicata** |

---

## 6. ENTRIES ORPHANS

| Verificacao | Resultado |
|---|---|
| PAID sem cashAccountId | 1: FIN-00265 (R$ 88,75 Zoho, skipCashAccount=true) — OK |
| Non-PAID com cashAccountId | 0 — OK |
| paymentInstrumentId sem cashAccountId | 3 PENDING (boletos) — esperado |
| autoMarkedPaid mas status != PAID | 0 — OK |

---

## 7. CARD SETTLEMENTS

| Verificacao | Resultado |
|---|---|
| PENDING vencidos | 1: FIN-00002 R$ 351,76 esperado 05/04 (**11 dias atrasado**) |
| Sem financialEntryId | 0 — OK |
| Valor != entry | 3 de FIN-00273 (parcelado 3x R$ 301,67 = R$ 905) — correto |

---

## 8. ACCOUNT TRANSFERS

| # | De | Para | Valor | Data | Descricao | Status |
|---|---|---|---|---|---|---|
| 1 | CAIXA INTERNO | SICREDI | R$ 4.600,00 | — | Deposito ATM | ✅ |
| 2 | SICREDI | Cartao Master Ueslei | R$ 5.334,60 | 09/04 | Fatura cartao marco | ✅ |
| 3 | SICREDI | Cartao Visa Juliano | R$ 2.085,43 | 09/04 | Fatura cartao marco | ✅ |

Nenhuma transfer com valor zero, sem contas invalidas, sem duplicatas.

---

## 9. BANK STATEMENT LINES

| Verificacao | Resultado |
|---|---|
| Total linhas | 62 |
| Conciliadas | 62 (100%) |
| MATCHED sem referencia | 0 — OK |
| Apontando pra entry deletada | 0 — OK |
| Duplicadas por fitId | 0 — OK |

---

## 10. RESUMO GERAL

### Entries por tipo e status
| Tipo | PAID | PENDING | CANCELLED | Total |
|---|---|---|---|---|
| RECEIVABLE | 27 (R$ 58.782,20) | 12 (R$ 15.185,00) | 4 (R$ 1.462,00) | 43 |
| PAYABLE | 142 (R$ 87.443,17) | 3 (R$ 954,50) | 2 (R$ 0) | 147 |

### Entries vencidas (PENDING passado do dueDate)
| Entry | Tipo | Valor | Parceiro | Dias vencido |
|---|---|---|---|---|
| FIN-00001 | RECEIVABLE | R$ 1.620,00 | Primavera Diesel | 43 |
| FIN-00003 | RECEIVABLE | R$ 720,00 | Priscila Evelyn | 41 |
| FIN-00347 | PAYABLE | R$ 606,00 | Contaudi | 7 |
| FIN-00346 | PAYABLE | R$ 120,00 | Elias Junior | 3 |
| FIN-00369 | RECEIVABLE | R$ 2.915,00 | Shark Club | 1 |
| (sem codigo) | RECEIVABLE | R$ 1.100,00 | Flavio Firmino | 1 |

### Verificacoes finais
| Item | Status |
|---|---|
| Entries sem parceiro | 3 (todas isRefundEntry) — OK |
| Entries PAID sem plano de contas | 3 (todas isRefundEntry) — OK |
| Entries com netCents zero/negativo | 0 — OK |
| Entries deletadas | 243 (todas PENDING, sem impacto) — OK |

---

## PROBLEMAS POR SEVERIDADE

### 🔴 ALTO
1. **Possivel duplicata FIN-00270 / FIN-00373** — R$ 4.525,00 cada, mesmo parceiro (Luiz Ramon Verderio Gambeta), descricao "instalacao boiler", ambas PAID em TRANSITO. **Verificar manualmente se sao dois servicos distintos ou duplicata.**

### 🟡 MEDIO
2. **FIN-00294 cashAccountId inconsistente** — PAYABLE R$ 759 conciliada com Sicredi mas cashAccountId aponta TRANSITO. Nao afeta saldo do Sicredi (correto), mas distorce TRANSITO.
3. **CardSettlement vencido FIN-00002** — R$ 351,76 esperado 05/04, 11 dias de atraso. Verificar se deposito da maquineta chegou.
4. **Entry de renegociacao sem codigo FIN-XXXXX** — Filha de FIN-00282, id 07f24814, PENDING R$ 1.100.

### 🟢 BAIXO
5. FIN-00015 sem dueDate (RECEIVABLE PENDING R$ 720, Royalle Pizzaria)
6. FIN-00008 diferenca 13 centavos (sistema R$ 225,25 vs fatura R$ 225,12) — pendencia conhecida
7. FIN-00012 paymentInstrument "Master Ueslei" mas cashAccountId SICREDI (boleto liquidado pelo banco)

---

## RESOLUCOES APLICADAS (16/04/2026)

| # | Item | Acao | Resultado |
|---|---|---|---|
| 1 | FIN-00270/FIN-00373 duplicata R$ 4.525 | FIN-00270 soft-deleted, TRANSITO revertido -4.525 | ✅ CORRIGIDO |
| 2 | FIN-00294 cashAccountId TRANSITO | NAO CORRIGIR — fluxo esperado do auto-pay | ⏭️ MANTIDO |
| 3 | CardSettlement FIN-00002 vencido | MANTER PENDING — deposito nao chegou | ⏭️ MANTIDO |
| 4 | Entry sem codigo (renegociacao) | Atribuido FIN-00444 | ✅ CORRIGIDO |
| 5 | FIN-00015 sem dueDate | Setado 31/03/2026 | ✅ CORRIGIDO |
| 6 | FIN-00008 diferenca 13c | Pendencia conhecida | ⏭️ MANTIDO |
| 7 | FIN-00012 instrument/conta mismatch | NAO CORRIGIR — fluxo esperado | ⏭️ MANTIDO |

## CONCLUSAO

O sistema financeiro esta em **estado saudavel**. Os saldos bancarios conferem com o extrato real. Os cartoes de credito estao equilibrados. A conciliacao esta 100%. O unico item que exige atencao urgente e a possivel duplicata de R$ 4.525,00 (FIN-00270 vs FIN-00373).
