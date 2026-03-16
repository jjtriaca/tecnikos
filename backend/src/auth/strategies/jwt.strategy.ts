import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!, // validado no AuthModule (getJwtSecret)
    });
  }

  async validate(payload: any): Promise<AuthenticatedUser> {
    // If JWT contains sessionId, verify it's still active (not revoked)
    // This enables immediate session invalidation when user logs in on another device
    if (payload.sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
        select: { revokedAt: true, expiresAt: true },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Sessão encerrada. Faça login novamente.');
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      // Handle both old (role) and new (roles) JWT format during rollout
      roles: payload.roles || (payload.role && payload.role !== 'TECNICO' ? [payload.role] : []),
      isTecnico: payload.isTecnico || payload.role === 'TECNICO',
      companyId: payload.companyId,
      technicianId: payload.technicianId,
      partnerId: payload.partnerId,
      sessionId: payload.sessionId,
    };
  }
}
