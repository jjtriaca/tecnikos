/**
 * Builds a Prisma-compatible orderBy object from sort params.
 * Returns defaultOrder if sortBy is missing or not in the allowlist.
 */
export function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
  allowedColumns: string[],
  defaultOrder: Record<string, 'asc' | 'desc'>,
): Record<string, 'asc' | 'desc'> {
  if (!sortBy || !allowedColumns.includes(sortBy)) {
    return defaultOrder;
  }
  return { [sortBy]: sortOrder || 'asc' };
}
