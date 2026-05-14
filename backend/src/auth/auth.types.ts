import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;       // userId or partnerId
  email: string;
  name?: string;     // snapshot do nome do User no momento da emissao do token (pra tracking universal createdByName)
  roles: UserRole[];
  isTecnico?: boolean;
  companyId: string;
  technicianId?: string; // backwards compat — same as partnerId
  partnerId?: string;    // present when isTecnico is true
  sessionId?: string;    // for immediate session invalidation
}

/** Classe (não interface) para funcionar com emitDecoratorMetadata + isolatedModules */
export class AuthenticatedUser {
  id: string;
  email: string;
  name?: string;     // disponivel em sessoes novas pos v1.10.87 (tracking universal). Pode ser undefined em tokens antigos.
  roles: UserRole[];
  isTecnico?: boolean;
  companyId: string;
  technicianId?: string;
  partnerId?: string;
  sessionId?: string;
}
