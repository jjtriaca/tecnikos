---
name: Conciliacao preserva cashAccountId original (v1.09.94)
description: matchLine agora mantem entry na conta original (VT) e cria AccountTransfer rastreavel para o banco, preservando historico de entrada e saida de cada cartao
type: project
---

# Preservacao de historico no VT ao conciliar (v1.09.94)

## Problema
Ate v1.09.93, o matchLine (tanto cenario PENDING quanto PAID) movia `entry.cashAccountId` pra conta do banco ao conciliar. Resultado:
- Vendas de cartao entravam no VT e nunca "saiam" visualmente
- Saldo do VT acumulava indefinidamente (nao refletia vendas nao-repassadas)
- Nao dava pra ver no extrato do VT o ciclo completo de cada cartao (entrada, repasse, taxa)

## Decisao
A entry NAO e mais movida ao conciliar. Em vez disso:
1. `entry.cashAccountId` permanece na conta original (VT)
2. Cria-se uma `AccountTransfer` VT -> banco com o valor liquido
3. Se ha taxa (gross > liquido), cria-se entry PAYABLE tecnico de taxa na conta origem

## Matematica (RECEIVABLE com gross = liquido + taxa)

**Cenario A (PENDING -> PAID via match):**
- Saldo VT += gross (receita cai na origem)
- AccountTransfer VT -> banco: VT -= liquido, banco += liquido
- Entry taxa PAYABLE em VT: VT -= taxa
- Net VT: +gross - liquido - taxa = 0 (ciclo fecha)
- Net banco: +liquido

**Cenario B (entry ja PAID antes do match):**
- VT ja tinha +gross da criacao original
- AccountTransfer VT -> banco: VT -= liquido, banco += liquido
- Entry taxa PAYABLE em VT: VT -= taxa (auto-detectada se gross > liquido e dto.taxCents ausente)
- Net VT: +gross - liquido - taxa = 0 (ciclo fecha)
- Net banco: +liquido

## Deteccao legado (fluxo sem conta de TRANSITO)
Se o tenant nao tem CashAccount com type='TRANSITO', mantem comportamento antigo:
- entry.cashAccountId = bankAccountId (move pro banco)
- Saldo banco += line.amountCents direto
- Taxa entry PAYABLE no banco (nao no VT)

Isso cobre tenants antigos/simples que nao configuraram VT.

## unmatchLine (v1.09.94)
Deteccao por `AccountTransfer.description` contendo `linha {lineId.slice(0,8)}`:
- Se existe transfer + autoMarkedPaid: fluxo A novo -> reverter transfer + reverter receita VT + deletar taxa + entry volta pra PENDING (preserva cashAccountId)
- Se existe transfer mas nao autoMarkedPaid: fluxo B (novo ou antigo) -> reverter transfer + taxa; se entry esta no banco (antigo), move pra transit
- Se NAO existe transfer mas autoMarkedPaid: fluxo legado puro pre-v1.09.94 -> reverter saldo do banco + deletar taxa + entry volta pra PENDING com cashAccountId=null
- Se entry.cashAccountId == bankAccountId sem transfer: fluxo muito antigo -> transfer implicito via saldo

## Retrocompatibilidade
- Matches feitos antes de v1.09.94 continuam como estao (entry ja foi movida pro banco). Saldo ja reflete essa realidade. Nao foram migrados retroativamente porque:
  - Nao da pra saber qual era o cashAccountId original sem rastrear PaymentInstrument historico
  - Tentativa de migrar quebraria saldos ja consistentes
- Apenas matches novos (apos deploy v1.09.94) usam o fluxo preservador

## Arquivos afetados
- `backend/src/finance/reconciliation.service.ts` - metodos matchLine e unmatchLine
- Mudanca compilou (tsc --noEmit) sem erros

## Por que e boa pratica
1. VT funciona como conta transitoria de verdade — tende a zero, so tem vendas nao-repassadas
2. Cada venda em cartao tem 3 lancamentos rastreaveis no VT: (+) venda, (-) repasse, (-) taxa
3. Auditoria/contabilidade ficam coerentes
4. Relatorio "cartoes a receber" fica viavel (filtrar entries em VT sem AccountTransfer correspondente)
