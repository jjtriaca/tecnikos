import { getCurrentUser, CreationSource } from '../../auth/user-context';

/**
 * Tracking universal (v1.10.87+) — helpers que injetam createdBy/updatedBy/createdVia
 * em qualquer Prisma data antes de chamar .create()/.update().
 *
 * Padrao de uso em service:
 *
 *   const entry = await this.prisma.financialEntry.create({
 *     data: withCreate({
 *       companyId,
 *       code,
 *       description: dto.description,
 *       grossCents: dto.grossCents,
 *       // ... outros campos
 *     }),
 *   });
 *
 *   await this.prisma.financialEntry.update({
 *     where: { id },
 *     data: withUpdate({ description: 'novo' }),
 *   });
 *
 * Le do userContext (AsyncLocalStorage) que eh setado pelo UserContextInterceptor
 * no inicio de cada request. Fora de request (ex: tests), retorna data inalterado
 * a nao ser que opts seja passado explicitamente.
 *
 * Crons/webhooks devem chamar runAsSystem({ via: 'CRON' }, ...) antes pra
 * o contexto ser populado com origin apropriado.
 */

export interface TrackingOverrides {
  /** Forca uma origem diferente da capturada do contexto */
  via?: CreationSource;
  /** Forca um user diferente (raro — usado em casos de impersonacao) */
  userId?: string | null;
  /** Forca um nome diferente — pra logs como "Sistema" em criacoes automaticas */
  userName?: string;
}

/**
 * Injeta createdByUserId, createdByName, createdVia em dados de .create().
 * Retorna o data original + os 3 campos. Se contexto nao disponivel, retorna
 * data sem os campos (record fica com null em todos).
 */
export function withCreate<T extends Record<string, any>>(
  data: T,
  overrides?: TrackingOverrides,
): T & { createdByUserId?: string | null; createdByName?: string | null; createdVia?: CreationSource } {
  const ctx = getCurrentUser();

  // Sem contexto e sem override = registro fica anonimo (null em todos os campos).
  // E ok — pode acontecer em testes ou imports antigos. Migration aceita null.
  if (!ctx && !overrides) {
    return data;
  }

  const userId = overrides?.userId !== undefined ? overrides.userId : ctx?.userId ?? null;
  const userName = overrides?.userName || ctx?.userName || null;
  const via = overrides?.via || ctx?.via || null;

  return {
    ...data,
    ...(userId !== null ? { createdByUserId: userId } : {}),
    ...(userName ? { createdByName: userName } : {}),
    ...(via ? { createdVia: via } : {}),
  };
}

/**
 * Injeta updatedByUserId, updatedByName em dados de .update().
 * NAO mexe em createdBy nem deletedBy. NAO toca em campos que voce esta atualizando.
 */
export function withUpdate<T extends Record<string, any>>(
  data: T,
  overrides?: TrackingOverrides,
): T & { updatedByUserId?: string | null; updatedByName?: string | null } {
  const ctx = getCurrentUser();

  if (!ctx && !overrides) {
    return data;
  }

  const userId = overrides?.userId !== undefined ? overrides.userId : ctx?.userId ?? null;
  const userName = overrides?.userName || ctx?.userName || null;

  return {
    ...data,
    ...(userId !== null ? { updatedByUserId: userId } : {}),
    ...(userName ? { updatedByName: userName } : {}),
  };
}

/**
 * Injeta deletedAt, deletedByUserId, deletedByName em dados de .update()
 * pra simular soft delete (registro nao some, fica marcado).
 *
 * Como o sistema ainda nao ativou o filtro automatico de soft delete (Fase 6),
 * esse helper eh OPCIONAL — services podem continuar usando .delete() de verdade
 * por enquanto. Quando Fase 6 chegar, vamos migrar pra usar este helper em todo
 * delete e ativar o filtro global.
 */
export function withDelete<T extends Record<string, any> = Record<string, any>>(
  data: T = {} as T,
  overrides?: TrackingOverrides,
): T & { deletedAt: Date; deletedByUserId?: string | null; deletedByName?: string | null } {
  const ctx = getCurrentUser();
  const userId = overrides?.userId !== undefined ? overrides.userId : ctx?.userId ?? null;
  const userName = overrides?.userName || ctx?.userName || null;

  return {
    ...data,
    deletedAt: new Date(),
    ...(userId !== null ? { deletedByUserId: userId } : {}),
    ...(userName ? { deletedByName: userName } : {}),
  };
}
