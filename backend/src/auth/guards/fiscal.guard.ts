import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth.types';

/**
 * Guard that blocks access to fiscal (NFS-e) endpoints
 * when the company has fiscalEnabled = false.
 */
@Injectable()
export class FiscalGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    if (!user?.companyId) throw new ForbiddenException('Usuário não autenticado');

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: { fiscalEnabled: true },
    });

    if (!company?.fiscalEnabled) {
      throw new ForbiddenException('Módulo fiscal não está habilitado para esta empresa');
    }

    return true;
  }
}
