/**
 * Helpers de data com fuso do tenant (atualmente Brasil — BRT/-03:00).
 *
 * Por que existe: bugs recorrentes ao criar/comparar datas financeiras.
 * `new Date(y, m, d)` usa o fuso DO PROCESSO (em prod containers UTC) — datas
 * sem hora viram 00:00 UTC = 21:00 BRT do dia anterior. Resultado: linhas de
 * 31/03 ficam categorizadas como 30/03 BR, bate na conferencia de saldo, etc.
 *
 * REGRA: toda data financeira (paidAt, dueDate, transferDate, statementBalanceDate)
 * deve ser criada via helpers daqui, NUNCA `new Date(y, m, d)` direto.
 *
 * Convencao do projeto (CLAUDE.md): meio-dia BRT (12:00:00 -03:00) pra evitar
 * deslocamento. Em UTC vira 15:00:00 — ainda dentro do mesmo dia BR.
 *
 * Multi-tenant: por enquanto BRT hardcoded; futuramente o offset sai de Tenant.timezone.
 */

export const TENANT_TZ_OFFSET = '-03:00'; // BRT — Brasilia (sem horario de verao desde 2019)
const TENANT_NOON_UTC_HOUR = 15; // 12:00 BRT == 15:00 UTC

/**
 * Cria Date no meio-dia do fuso do tenant. Use pra paidAt/dueDate/transferDate.
 *
 * @example
 *   tenantNoon(2026, 3, 31) // → 2026-03-31 12:00 BRT == 2026-03-31 15:00 UTC
 */
export function tenantNoon(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day, TENANT_NOON_UTC_HOUR, 0, 0));
}

/**
 * Parseia "YYYY-MM-DD" como meio-dia BRT.
 * Aceita tambem "YYYY-MM-DDTHH:mm:ss" (com hora) — preserva hora literal mas
 * ancorada ao fuso do tenant. Retorna null se invalido.
 */
export function parseTenantDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  // YYYY-MM-DD
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return tenantNoon(Number(y), Number(m), Number(d));
  }
  // YYYY-MM-DDTHH:mm[:ss] com ou sem TZ
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(.*)$/.exec(s);
  if (dateTime) {
    const [, y, m, d, hh, mm, ss = '00', rest] = dateTime;
    if (rest && /[zZ]|[+-]\d{2}:?\d{2}/.test(rest)) {
      // Ja tem TZ explicito — respeita
      return new Date(s);
    }
    // Sem TZ: assume tenant
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}${TENANT_TZ_OFFSET}`);
  }
  // Fallback: deixa o Date tentar
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Inicio do dia no fuso tenant: YYYY-MM-DD 00:00 BRT (= 03:00 UTC).
 * Use em filtros `paidAt: { gte: startOfTenantDay(d) }`.
 */
export function startOfTenantDay(date: Date): Date {
  const { year, month, day } = breakInTenantTz(date);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0)); // 00:00 BRT
}

/**
 * Fim do dia no fuso tenant: YYYY-MM-DD 23:59:59.999 BRT (= 02:59:59 UTC do dia seguinte).
 * Use em filtros `paidAt: { lte: endOfTenantDay(d) }`.
 */
export function endOfTenantDay(date: Date): Date {
  const { year, month, day } = breakInTenantTz(date);
  // 23:59:59.999 BRT = 02:59:59.999 UTC do dia +1
  return new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999));
}

/**
 * Extrai ano/mes/dia conforme o fuso do tenant (BRT). Use pra particionar
 * dados em "mes brasileiro" sem depender do fuso do servidor.
 *
 * Ex: 2026-04-01 02:00 UTC = 2026-03-31 23:00 BRT → retorna {year:2026, month:3, day:31}
 */
export function breakInTenantTz(date: Date): { year: number; month: number; day: number } {
  // Truque: shift forcado em ms pelo offset do tenant, depois lê componentes UTC.
  // -03:00 = -3h = -10_800_000 ms. Aplicar offset positivo significa "adiantar" — pra
  // achar o componente local: localTime = utcTime + offset; mas offset eh -3h, entao
  // efetivamente subtrai 3h (queremos achar a hora BRT a partir do timestamp UTC).
  const tenantTime = new Date(date.getTime() - 3 * 3600_000);
  return {
    year: tenantTime.getUTCFullYear(),
    month: tenantTime.getUTCMonth() + 1,
    day: tenantTime.getUTCDate(),
  };
}

/**
 * Formata Date como "YYYY-MM-DD" no fuso do tenant.
 */
export function formatTenantDate(date: Date): string {
  const { year, month, day } = breakInTenantTz(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
