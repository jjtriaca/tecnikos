import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(UserRole | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    if (!user) throw new ForbiddenException('Usuário não autenticado');

    // TECNICO check (partner login, not a UserRole enum value)
    if (requiredRoles.includes('TECNICO') && user.isTecnico) {
      return true;
    }

    // Check if ANY of the user's roles matches ANY required role
    const hasRole = user.roles?.some(r => requiredRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException('Permissão insuficiente');
    }
    return true;
  }
}
