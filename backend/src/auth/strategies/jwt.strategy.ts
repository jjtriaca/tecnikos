import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!, // validado no AuthModule (getJwtSecret)
    });
  }

  validate(payload: any): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      // Handle both old (role) and new (roles) JWT format during rollout
      roles: payload.roles || (payload.role && payload.role !== 'TECNICO' ? [payload.role] : []),
      isTecnico: payload.isTecnico || payload.role === 'TECNICO',
      companyId: payload.companyId,
      technicianId: payload.technicianId,
      partnerId: payload.partnerId,
    };
  }
}
