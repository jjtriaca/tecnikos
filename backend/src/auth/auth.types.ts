import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;       // userId or partnerId
  email: string;
  roles: UserRole[];
  isTecnico?: boolean;
  companyId: string;
  technicianId?: string; // backwards compat — same as partnerId
  partnerId?: string;    // present when isTecnico is true
}

/** Classe (não interface) para funcionar com emitDecoratorMetadata + isolatedModules */
export class AuthenticatedUser {
  id: string;
  email: string;
  roles: UserRole[];
  isTecnico?: boolean;
  companyId: string;
  technicianId?: string;
  partnerId?: string;
}
