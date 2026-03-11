import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class ChatIAGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    if (!user?.companyId) throw new ForbiddenException('Usuário não autenticado');

    // Get tenant to check plan limits
    const tenant = await this.prisma.tenant.findFirst({
      where: { schemaName: { not: 'public' }, status: 'ACTIVE' },
      include: { plan: true },
    });

    // If no tenant/plan found, check company directly
    // For now, allow access — limit check happens in service
    return true;
  }
}
