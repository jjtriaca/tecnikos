---
name: trava_categoria_por_direcao
description: DRE agrupa pelo TIPO DA CATEGORIA (nao do lancamento) — recebimento com categoria de custo conta como custo e distorce o resultado. Trava central assertAccountDirection + componente CategorySelect (v1.13.98).
metadata:
  type: reference
---

# Trava de categoria por direcao (v1.13.98) + gotcha da DRE

## Gotcha que originou (incidente 24/06)
A **DRE** (`financial-report.service.generateDre`) soma os lancamentos PAID do periodo e agrupa pelo **TIPO DO PLANO DE CONTAS** (REVENUE/COST/EXPENSE), **NAO pelo tipo do lancamento** (RECEIVABLE/PAYABLE). Logo, um **RECEBIMENTO marcado com categoria de CUSTO** (ex: "2100 Mao de Obra Tecnica") entra como **custo** — distorcao DUPLA (some da receita, vira custo). Caso real: FIN-00550 (R$71.280, 2a parcela piscina) → Resultado de junho aparecia −R$94k/−229%; corrigida a categoria → +R$48.414/+43%.
- Auditoria de trocadas: `WHERE (type='RECEIVABLE' AND fa.type IN ('COST','EXPENSE')) OR (type='PAYABLE' AND fa.type='REVENUE')`.
- DRE e **base caixa** (filtra por `paidAt` no periodo). Resultado de 1 mes distorce quando obra grande e paga num mes e a receita entra em outro — usar periodo maior (filtro Mes/Trim/Sem/Ano/Tudo nos KPIs, v1.13.98) suaviza.

## Trava (a regra, central)
**Recebimento (RECEIVABLE) so aceita categoria REVENUE; pagamento (PAYABLE) so COST/EXPENSE.**
- Backend (a parte que protege): `FinancialAccountService.assertAccountDirection(companyId, financialAccountId, entryType, {isRefundEntry})`. Chamada em TODO ponto que grava `financialAccountId`: `createEntry`, `updateEntry` e `nfse-entrada` (import NF, inline). **Libera:** sem categoria e estorno/devolucao (`isRefundEntry`). "Descontos Concedidos" (1300) e REVENUE → ok num recebimento.
- Endpoint: `GET /finance/accounts/postable?direction=RECEIVABLE|PAYABLE` (REVENUE / COST+EXPENSE).
- **Ao gravar categoria num fluxo novo: chamar `assertAccountDirection`.**

## Componente central de UI
`frontend/src/components/finance/CategorySelect.tsx` — `<CategorySelect direction value onChange />`. Fetch por direcao (cache de modulo) + agrupado + aparencia unica. **Muda nele, muda em todas.** Ja usado em A Receber/A Pagar (criar/editar/receber/pagar). 🔜 migrar OS (Early/ApprovalConfirmModal), baixa de cartao, wizards NF (nfe/page, nfe/entrada), conciliacao pro mesmo componente (hoje filtrados por `?direction=` mas com select proprio). NAO recriar dropdown de categoria proprio — usar o `CategorySelect`.

Relacionado: [[feedback_backend_enforcement]] (validar sempre no backend).
