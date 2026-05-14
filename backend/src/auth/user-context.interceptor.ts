import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { userContext, CreationSource } from './user-context';

/**
 * Tracking universal (v1.10.87+) — captura usuario logado da request e
 * roda o restante do handler em userContext, pra helpers withCreate/withUpdate
 * preencherem createdByUserId/createdByName/createdVia automaticamente.
 *
 * Usa Interceptor (nao Middleware) porque NestJS lifecycle eh:
 *   Middleware → Guards (JwtAuthGuard popula req.user) → Interceptors → Handler
 * Middleware nao tem req.user ainda. Interceptor ja tem.
 *
 * Aplicado globalmente no AppModule via APP_INTERCEPTOR.
 *
 * Em rotas sem JWT (publicas, webhooks, signup), req.user e undefined — entra
 * no contexto com userId=null e via='API_PUBLIC' por default. Services
 * especializados podem reescrever esse contexto com runAsSystem se quiserem
 * outra origem (ex: webhook do Asaas chama runAsSystem({ via: 'WEBHOOK_ASAAS' }, ...)).
 *
 * Header opcional 'X-Creation-Via': permite o frontend especificar a origem
 * (ex: 'CHAT_IA' quando wizard cria registro em vez do usuario direto).
 */
@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req?.user as
      | { id?: string; name?: string; email?: string }
      | undefined;

    const viaHeader = req?.headers?.['x-creation-via'];
    const via: CreationSource =
      (typeof viaHeader === 'string' && isValidVia(viaHeader)
        ? (viaHeader as CreationSource)
        : null) || (user?.id ? 'MANUAL' : 'API_PUBLIC');

    const userName = user?.name || user?.email || (user?.id ? user.id : 'Anonimo');

    return new Observable((subscriber) => {
      userContext.run(
        { userId: user?.id || null, userName, via },
        () => {
          next.handle().subscribe({
            next: (val) => subscriber.next(val),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        },
      );
    });
  }
}

const VALID_VIAS = new Set([
  'MANUAL',
  'IMPORT_CSV',
  'IMPORT_OFX',
  'IMPORT_NFE_XML',
  'WEBHOOK_FOCUS',
  'WEBHOOK_ASAAS',
  'WEBHOOK_SICREDI',
  'WEBHOOK_META',
  'CRON',
  'CHAT_IA',
  'API_PUBLIC',
  'SYSTEM_SEED',
  'MIGRATION_BACKFILL',
]);

function isValidVia(v: string): boolean {
  return VALID_VIAS.has(v);
}
