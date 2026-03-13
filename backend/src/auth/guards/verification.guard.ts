import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const REQUIRE_VERIFICATION_KEY = 'requireVerification';

/**
 * Guard that blocks endpoint access when the tenant's document
 * verification has not yet been approved.
 *
 * Usage: apply @RequireVerification() decorator on controller methods
 * that should only be accessible after admin approves docs.
 *
 * Endpoints for master tenant (no tenantId) are always allowed.
 */
@Injectable()
export class VerificationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireVerification = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If decorator not present, allow
    if (!requireVerification) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    // No tenant context (master/public routes) — allow
    if (!tenantId) return true;

    // Check if tenant is master (master tenant skips verification)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isMaster: true },
    });
    if (tenant?.isMaster) return true;

    // Check latest verification session
    const session = await this.prisma.verificationSession.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { reviewStatus: true },
    });

    if (!session || session.reviewStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Funcionalidade bloqueada enquanto seus documentos estao em analise. ' +
        'Voce sera notificado quando a verificacao for concluida.',
      );
    }

    return true;
  }
}
