# Bug: Filtro `notes NOT contains` excluía entries com `notes=NULL`

## Versão do fix
v1.12.17 (23/05/2026)

## Sintoma
No modal de Conciliação, lançamentos válidos (RECEIVABLE/PAYABLE corretos, com cashAccountId compatível) **NÃO apareciam** na lista de candidates — mesmo existindo no banco e passando todos os outros filtros.

Caso real (SLS, fatura cartão Visa Crédito R$ 4.409,61 de 18/05/2026):
- A query SQL pura retornava 5 PAID + 13 PENDING = 18 candidates
- A UI só mostrava 2 (FIN-00473 e FIN-00474)
- FIN-00373 (R$ 4.525,00 com NFS-e emitida), FIN-00592, FIN-00463 sumiam
- Diferença: os que apareciam tinham `notes` preenchido, os que sumiam tinham `notes=NULL`

Resultado: usuário tentou contornar criando o duplicado FIN-00592, o que poluiu o saldo.

## Causa raiz
`backend/src/finance/finance.service.ts:findEntries` filtrava com:
```typescript
where.AND = [
  { notes: { not: { contains: '[REBALANCE_AJUSTE]' } } },
  { notes: { not: { contains: '[NO_RECONCILE]' } } },
];
```

O Prisma compila isso pra SQL como `NOT (notes LIKE '%[REBALANCE_AJUSTE]%')`.

Em Postgres com SQL ANSI:
- Se `notes IS NULL`, então `NULL LIKE '%...%'` retorna `NULL` (não TRUE/FALSE).
- `NOT NULL` continua sendo `NULL`.
- No `WHERE`, `NULL` é tratado como FALSE — a linha **NÃO PASSA** no filtro.

Resultado: qualquer entry com `notes=NULL` ficava silenciosamente excluído de toda lista de candidates da conciliação, mesmo que obviamente NÃO contivesse a tag `[REBALANCE_AJUSTE]` ou `[NO_RECONCILE]`.

## Fix
Aceitar NULL explicitamente:
```typescript
where.AND = [
  { OR: [{ notes: null }, { notes: { not: { contains: '[REBALANCE_AJUSTE]' } } }] },
  { OR: [{ notes: null }, { notes: { not: { contains: '[NO_RECONCILE]' } } }] },
];
```

Em SQL vira `(notes IS NULL OR NOT (notes LIKE ...))` — aceita NULL.

## Impacto antes do fix
Bug afetava TODO tenant — qualquer entry sem `notes` preenchido sumia da conciliação. Como criar lançamento via UI **não exige** notes, a maioria dos lançamentos novos ficava invisível.

No SLS especificamente: 16 entries A Receber afetadas (5 PAID + 13 PENDING) — todas com notes=null.

## Limpeza pós-fix
- FIN-00592 (duplicata criada pelo user tentando contornar) soft-deletado via UPDATE direto:
  - `deletedAt = NOW()`
  - Notes anotando o motivo
  - TRANSITO decrementado em R$ 4.525,00 (reverte o increment do PAID original)

## Como evitar regressão
- **Toda vez que escrever filtro com `not:` (negação) em campo nullable** em Prisma, lembrar que NULL é tratado como NÃO passa.
- Padrão: `{ OR: [{ campo: null }, { campo: { not: { contains: 'x' } } }] }` ou `{ NOT: { campo: { contains: 'x' } } }` SEMPRE acompanhado de tratamento explícito de NULL.
- Pra negações de igualdade simples (`not equals`), Prisma já trata NULL como passa por design.
- Pra `not contains`, `not startsWith`, `not endsWith`, `not gt/lt`, **sempre** validar com SQL puro o que está sendo gerado.

## Detecção
- Foi diagnosticado comparando query SQL pura (5 candidates) vs query Prisma rodada via script de debug (2 candidates) — diferença óbvia apontou pro filtro.
- Validation script em `/tmp/test-prisma3.js` (no servidor) ajuda a reproduzir queries Prisma manualmente.
