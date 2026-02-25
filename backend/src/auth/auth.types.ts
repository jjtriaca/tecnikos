import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;       // userId or partnerId
  email: string;
  role: UserRole | 'TECNICO';
  companyId: string;
  technicianId?: string; // backwards compat — same as partnerId
  partnerId?: string;    // present when role is TECNICO
}

/** Classe (não interface) para funcionar com emitDecoratorMetadata + isolatedModules */
export class AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole | 'TECNICO';
  companyId: string;
  technicianId?: string;
  partnerId?: string;
}
