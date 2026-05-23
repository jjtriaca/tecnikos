/**
 * Helpers null-safe pra filtros Prisma em campos String nullable.
 *
 * MOTIVO (incidente v1.12.17 — ver memory/bug-filtro-notes-null.md):
 * Em Postgres, `NULL <op> X` retorna NULL, que no WHERE é tratado como FALSE.
 * Prisma compila negações em campos String pra `NOT (col LIKE/=/...)` SEM proteger
 * NULL. Resultado: rows com `col IS NULL` ficam silenciosamente excluídos do filtro.
 *
 * Estes helpers geram o padrão correto `{ OR: [{ campo: null }, { not: ... }] }`
 * com nome curto e intenção clara — pra que use-los seja mais natural que escrever
 * o padrão buggy.
 *
 * IMPORTANTE: usar apenas em campos String nullable (com `?` no schema). Pra campo
 * NOT NULL, o filtro `{ not: ... }` direto é seguro e mais idiomático.
 *
 * @example
 *   // ANTES (buggy — esconde rows com notes=NULL):
 *   where.AND = [{ notes: { not: { contains: '[REBALANCE_AJUSTE]' } } }];
 *
 *   // DEPOIS (null-safe):
 *   where.AND = [notNullableContains('notes', '[REBALANCE_AJUSTE]')];
 *   // ou inline:
 *   where.AND = [{ OR: [{ notes: null }, { notes: { not: { contains: '[REBALANCE_AJUSTE]' } } }] }];
 */

type StringNegation =
  | string
  | { contains: string; mode?: 'default' | 'insensitive' }
  | { startsWith: string; mode?: 'default' | 'insensitive' }
  | { endsWith: string; mode?: 'default' | 'insensitive' }
  | { in: string[] }
  | { equals: string; mode?: 'default' | 'insensitive' };

/**
 * Filtro genérico null-safe: "campo é NULL OU não satisfaz a expressão".
 *
 * Use em campo String nullable quando quiser EXCLUIR rows que CONTÉM/IGUALAM/etc
 * o valor, mas MANTER rows com campo NULL.
 *
 * Retorna um objeto pronto pra colocar em `where.AND` ou `where`.
 */
export function notLikeNullSafe(field: string, negation: StringNegation): Record<string, unknown> {
  return {
    OR: [
      { [field]: null },
      { [field]: { not: negation } },
    ],
  };
}

/**
 * Atalho específico pra `not contains` (caso mais comum).
 *
 * @example
 *   where.AND = [
 *     notContainsNullSafe('notes', '[REBALANCE_AJUSTE]'),
 *     notContainsNullSafe('notes', '[NO_RECONCILE]'),
 *   ];
 */
export function notContainsNullSafe(field: string, value: string, opts?: { mode?: 'default' | 'insensitive' }): Record<string, unknown> {
  return {
    OR: [
      { [field]: null },
      { [field]: { not: { contains: value, ...(opts?.mode ? { mode: opts.mode } : {}) } } },
    ],
  };
}

/**
 * Atalho específico pra `not equals` (string ou número).
 */
export function notEqualsNullSafe<T>(field: string, value: T): Record<string, unknown> {
  return {
    OR: [
      { [field]: null },
      { [field]: { not: value } },
    ],
  };
}

/**
 * Atalho específico pra `not in [...]`.
 */
export function notInNullSafe<T>(field: string, values: T[]): Record<string, unknown> {
  return {
    OR: [
      { [field]: null },
      { [field]: { notIn: values } },
    ],
  };
}
