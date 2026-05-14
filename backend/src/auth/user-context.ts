import { AsyncLocalStorage } from 'async_hooks';

/**
 * Tracking universal — contexto do usuario por request (v1.10.87+)
 *
 * Permite que services e helpers leiam quem fez a operacao atual
 * sem precisar passar AuthenticatedUser explicitamente em toda funcao.
 *
 * Usado pelos helpers withCreate/withUpdate em prisma/tracking.helpers.ts
 * pra preencher createdByUserId/createdByName/createdVia automaticamente
 * em qualquer lancamento do sistema.
 *
 * Setup:
 * - UserContextMiddleware (auth/user-context.middleware.ts) le req.user e
 *   roda o restante da request em userContext.run(...). Aplicado globalmente
 *   no AppModule.
 * - Crons e webhooks: chamar runAsSystem({ via: 'CRON', ... }) explicitamente
 *   no entry point pra que .create() ainda registre origem do registro.
 */

export type CreationSource =
  | 'MANUAL'
  | 'IMPORT_CSV'
  | 'IMPORT_OFX'
  | 'IMPORT_NFE_XML'
  | 'WEBHOOK_FOCUS'
  | 'WEBHOOK_ASAAS'
  | 'WEBHOOK_SICREDI'
  | 'WEBHOOK_META'
  | 'CRON'
  | 'CHAT_IA'
  | 'API_PUBLIC'
  | 'SYSTEM_SEED'
  | 'MIGRATION_BACKFILL';

interface UserStore {
  userId: string | null;
  userName: string;
  via: CreationSource;
}

export const userContext = new AsyncLocalStorage<UserStore>();

/** Le o usuario atual do contexto. Retorna undefined fora de request. */
export function getCurrentUser(): UserStore | undefined {
  return userContext.getStore();
}

/**
 * Roda uma funcao com contexto de sistema (crons, webhooks, seeds).
 * userId fica null e userName eh um label legivel pra UI ("Sistema", "Webhook Asaas", etc.)
 */
export async function runAsSystem<T>(
  opts: { via: CreationSource; userName?: string },
  fn: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    userContext.run(
      { userId: null, userName: opts.userName || labelForVia(opts.via), via: opts.via },
      () => fn().then(resolve).catch(reject),
    );
  });
}

function labelForVia(via: CreationSource): string {
  switch (via) {
    case 'CRON': return 'Sistema (cron)';
    case 'WEBHOOK_FOCUS': return 'Webhook Focus NFe';
    case 'WEBHOOK_ASAAS': return 'Webhook Asaas';
    case 'WEBHOOK_SICREDI': return 'Webhook Sicredi';
    case 'WEBHOOK_META': return 'Webhook WhatsApp';
    case 'CHAT_IA': return 'Assistente IA';
    case 'API_PUBLIC': return 'API publica';
    case 'SYSTEM_SEED': return 'Sistema (seed)';
    case 'MIGRATION_BACKFILL': return 'Sistema (backfill)';
    case 'IMPORT_CSV': return 'Importacao CSV';
    case 'IMPORT_OFX': return 'Importacao OFX';
    case 'IMPORT_NFE_XML': return 'Importacao NFe';
    default: return 'Sistema';
  }
}
