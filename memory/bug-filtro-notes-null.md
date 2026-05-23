# Bug: Filtro Prisma `not:` em campo nullable esconde rows com NULL

## Versão do fix
v1.12.17 (23/05/2026)

## TL;DR
**Em Postgres, `NULL <operador> X` retorna NULL, que no `WHERE` é FALSE.** Prisma compila negações em campos String pra `NOT (col LIKE/=/...)` sem proteger NULL. Resultado: rows com `col IS NULL` ficam **excluídos silenciosamente** do filtro — não aparecem em listas, contagens, joins. Bug sem mensagem de erro.

## Sintoma original
No SLS, modal de Conciliação só mostrava 2 candidates ao invés de 18. FIN-00373 (com NFS-e emitida) e mais 15 lançamentos válidos sumiram. Usuário criou duplicatas (FIN-00592) tentando contornar — corrompendo saldo. 100% causado por `notes=NULL`.

## Causa raiz técnica
`backend/src/finance/finance.service.ts:447` (versão buggy):
```typescript
where.AND = [
  { notes: { not: { contains: '[REBALANCE_AJUSTE]' } } },
  { notes: { not: { contains: '[NO_RECONCILE]' } } },
];
```

Prisma compila pra SQL:
```sql
WHERE NOT (notes LIKE '%[REBALANCE_AJUSTE]%')
  AND NOT (notes LIKE '%[NO_RECONCILE]%')
```

Quando `notes IS NULL`:
- `NULL LIKE '%X%'` → `NULL` (não TRUE/FALSE)
- `NOT NULL` → `NULL`
- `WHERE NULL` → trata como FALSE → row **não passa**

## Fix aplicado
```typescript
where.AND = [
  { OR: [{ notes: null }, { notes: { not: { contains: '[REBALANCE_AJUSTE]' } } }] },
  { OR: [{ notes: null }, { notes: { not: { contains: '[NO_RECONCILE]' } } }] },
];
```

SQL gerado: `(notes IS NULL OR NOT (notes LIKE ...))` — aceita NULL.

---

## Tabela de filtros Prisma — perigosos vs seguros

### ❌ Perigosos em campo String nullable (precisam OR)
| Padrão | Compila pra | NULL passa? |
|---|---|---|
| `{ campo: { not: 'X' } }` | `NOT (campo = 'X')` | ❌ não |
| `{ campo: { not: { contains: 'X' } } }` | `NOT (campo LIKE '%X%')` | ❌ não |
| `{ campo: { not: { startsWith: 'X' } } }` | `NOT (campo LIKE 'X%')` | ❌ não |
| `{ campo: { not: { endsWith: 'X' } } }` | `NOT (campo LIKE '%X')` | ❌ não |
| `{ campo: { not: { in: [...] } } }` | `NOT (campo IN (...))` | ❌ não |
| `{ campo: { not: { gt: X } } }` | `NOT (campo > X)` | ❌ não |
| `{ campo: { not: { gte/lt/lte: X } } }` | idem | ❌ não |

**Padrão correto pra todos os acima:**
```typescript
{ OR: [{ campo: null }, { campo: { not: <expr> } }] }
```

### ✅ Seguros (NULL-safe por design)
| Padrão | Por quê |
|---|---|
| `{ campo: { not: null } }` | É o "is not null" — exclui NULL intencionalmente |
| `{ campo: { not: 'X' } }` em campo NOT NULL | Sem `?` no schema → NULL impossível |
| `{ campo: null }` | Equality com NULL — Prisma traduz pra `IS NULL` |
| Json fields `{ not: Prisma.JsonNull }` | Prisma trata NULL-safe pra JSON: `not JsonNull` retorna só rows com valor JSON ≠ null (exclui DbNull e JsonNull) |
| Json fields `{ not: Prisma.DbNull }` | Retorna rows com SQL valor (inclui JsonNull, exclui DbNull) |
| Json fields `{ not: Prisma.AnyNull }` | Retorna só rows com valor real (exclui DbNull + JsonNull) |
| `{ campo: { gt: 0 } }` (positivo, sem `not`) | Sem negação — `NULL > 0` = NULL = FALSE, row é excluído (esperado) |

### Diferença String vs Json fields
**String:** Prisma NÃO trata NULL-safe em negações. Usar OR explícito.
**Json:** Prisma trata NULL-safe via `Prisma.JsonNull/DbNull/AnyNull`. Usar esses tokens corretamente.

---

## Como detectar o bug em outras queries

### Checklist manual
1. **Identificar campo nullable:** abrir `backend/prisma/schema.prisma` e ver se o campo tem `?` (ex: `notes String?`, `paidAt DateTime?`).
2. **Procurar negação:** `grep -rn "campo:.*\{ not:" backend/src` — qualquer `{ not:` aplicado àquele campo.
3. **Excluir falsos positivos:**
   - `{ not: null }` → seguro
   - `{ id: { not: <id> } }` → id é sempre NOT NULL
   - Campo NOT NULL no schema → seguro

### Script de validação (rodar em produção)
Copia `/tmp/test-prisma-null.js` no container backend e roda:

```js
const { PrismaClient } = require('@prisma/client');
const url = process.env.DATABASE_URL.replace(/\?schema=[^&]+/, '?schema=tenant_sls');
const p = new PrismaClient({ datasources: { db: { url } } });
(async () => {
  // Compara: filtro Prisma vs query SQL com IS NULL OR
  const prismaCount = await p.financialEntry.count({
    where: { notes: { not: { contains: '[REBALANCE_AJUSTE]' } } },
  });
  const sqlCount = await p.$queryRawUnsafe(`
    SELECT COUNT(*) FROM tenant_sls."FinancialEntry"
    WHERE notes IS NULL OR notes NOT LIKE '%[REBALANCE_AJUSTE]%'
  `);
  console.log('Prisma:', prismaCount, 'SQL NULL-safe:', sqlCount);
  // Se diferem, é o bug.
  await p.$disconnect();
})();
```

Rodar via:
```bash
docker cp /tmp/test-prisma-null.js tecnikos_backend:/app/
docker exec -w /app tecnikos_backend node test-prisma-null.js
```

### Auditoria sistemática (rodar antes de release maior)
```bash
grep -rn "not:" backend/src --include="*.ts" | grep -v "not: null" | grep -v "// "
```
Filtrar manualmente: pra cada match, conferir se o campo é nullable no schema.

---

## Outras armadilhas SQL similares (não eram esse bug, mas atenção)

### NOT IN com subquery que retorna NULL
```sql
WHERE id NOT IN (SELECT matched_id FROM ... )
```
Se a subquery retorna QUALQUER NULL, o resultado vira NULL pra todas as linhas → exclui TUDO. Mitigar com `WHERE matched_id IS NOT NULL` na subquery (o código já faz isso em `excludeMatched`, mas vale validar).

### UNION vs UNION ALL com NULL
UNION dedup considera NULLs iguais entre si (não como SQL `=`). UNION ALL não. Em filtros agregados, escolher consciente.

### COALESCE em comparações
Pra evitar a armadilha, usar `WHERE COALESCE(campo, '') NOT LIKE '%X%'`. Em Prisma, não há equivalente direto — usar `$queryRaw` se a query for crítica e o OR explícito ficar verboso.

---

## Estado pós-fix (validado)
- ✅ `finance.service.ts:447` corrigido pra OR-explicit
- ✅ Auditoria do codebase (`backend/src`) confirmou: nenhum outro filtro com mesma classe de bug
- ✅ Regra adicionada em `CLAUDE.md` (seção "Filtros Prisma `not:` em Campos Nullable")
- ✅ FIN-00592 (duplicata criada pelo user durante o bug) soft-deletado + saldo TRANSITO ajustado

## Como evitar regressão
1. **CLAUDE.md** tem regra explícita — toda sessão Claude lê isso no início.
2. **Memory MEMORY.md** linka este documento.
3. **Code review checklist:** ao revisar PR que mexa em filtro Prisma com `not:`, conferir nullability do campo.
4. **Antes de release maior:** rodar auditoria `grep -rn "not:" backend/src` e validar manualmente.
