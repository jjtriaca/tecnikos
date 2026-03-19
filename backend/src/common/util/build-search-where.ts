/**
 * Build Prisma WHERE clause for multi-word search.
 *
 * Splits the search string into words and creates an AND condition
 * where EACH word must match at least one of the specified fields.
 *
 * Example: "jul tri" searching on [name, document] produces:
 *   AND: [
 *     { OR: [{ name: contains "jul" }, { document: contains "jul" }] },
 *     { OR: [{ name: contains "tri" }, { document: contains "tri" }] },
 *   ]
 *
 * This allows "jul tri" to match "Juliano José Triaca" even though
 * the words are not adjacent.
 *
 * @param search - Raw search string from user input
 * @param fields - Array of field configs: { field: string, mode?: 'insensitive' | 'default' }
 * @returns Prisma AND/OR clause to merge into where, or undefined if no search
 */
export function buildSearchWhere(
  search: string | undefined,
  fields: Array<{ field: string; mode?: 'insensitive' | 'default' }>,
): any | undefined {
  if (!search?.trim()) return undefined;

  const words = search.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;

  // Single word: simple OR across all fields (same as before but normalized)
  if (words.length === 1) {
    return {
      OR: fields.map((f) => ({
        [f.field]: {
          contains: words[0],
          ...(f.mode === 'insensitive' ? { mode: 'insensitive' } : {}),
        },
      })),
    };
  }

  // Multiple words: AND of ORs — each word must match at least one field
  return {
    AND: words.map((word) => ({
      OR: fields.map((f) => ({
        [f.field]: {
          contains: word,
          ...(f.mode === 'insensitive' ? { mode: 'insensitive' } : {}),
        },
      })),
    })),
  };
}
