import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { JwtPayload, AuthenticatedUser } from './auth.types';
import {
  DEFAULT_REFRESH_TTL_SECONDS,
  REMEMBER_ME_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  REFRESH_COOKIE_NAME,
} from './auth.constants';

@Injectable()
export class AuthService {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    this.refreshTtlSeconds =
      Number(process.env.JWT_REFRESH_TTL) || DEFAULT_REFRESH_TTL_SECONDS;
  }

  /* ------------------------------------------------------------------ */
  /*  LOGIN                                                              */
  /* ------------------------------------------------------------------ */
  async login(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string,
    rememberMe?: boolean,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Credenciais inválidas');

    const ttl = rememberMe ? REMEMBER_ME_TTL_SECONDS : SESSION_TTL_SECONDS;
    const accessToken = this.issueAccessToken(user);
    const { refreshToken, session } = await this.createSession(
      user.id,
      ip,
      userAgent,
      ttl,
    );

    return {
      accessToken,
      refreshToken,
      refreshTtlSeconds: ttl,
      rememberMe: !!rememberMe,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        companyId: user.companyId,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /*  REFRESH (rotation)                                                 */
  /* ------------------------------------------------------------------ */
  async refresh(oldRefreshToken: string, ip?: string, userAgent?: string) {
    if (!oldRefreshToken) throw new UnauthorizedException('Token ausente');

    // find active session that matches the hash
    const sessions = await this.prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    let matchedSession: (typeof sessions)[number] | null = null;
    for (const s of sessions) {
      if (await bcrypt.compare(oldRefreshToken, s.refreshTokenHash)) {
        matchedSession = s;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    if (matchedSession.user.deletedAt) {
      throw new ForbiddenException('Usuário desativado');
    }

    // Revoke old session
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair
    const accessToken = this.issueAccessToken(matchedSession.user);
    const { refreshToken } = await this.createSession(
      matchedSession.userId,
      ip,
      userAgent,
    );

    return {
      accessToken,
      refreshToken,
      refreshTtlSeconds: this.refreshTtlSeconds,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  LOGOUT                                                             */
  /* ------------------------------------------------------------------ */
  async logout(refreshToken: string) {
    if (!refreshToken) return;

    const sessions = await this.prisma.session.findMany({
      where: { revokedAt: null },
    });

    for (const s of sessions) {
      if (await bcrypt.compare(refreshToken, s.refreshTokenHash)) {
        await this.prisma.session.update({
          where: { id: s.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  ME                                                                 */
  /* ------------------------------------------------------------------ */
  async me(user: AuthenticatedUser) {
    const full = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        companyId: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!full) throw new UnauthorizedException('Usuário não encontrado');
    return full;
  }

  /* ------------------------------------------------------------------ */
  /*  HELPERS                                                            */
  /* ------------------------------------------------------------------ */
  private issueAccessToken(user: {
    id: string;
    email: string;
    roles: any[];
    companyId: string;
  }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      companyId: user.companyId,
    };
    return this.jwt.sign(payload);
  }

  private async createSession(
    userId: string,
    ip?: string,
    userAgent?: string,
    ttlSeconds?: number,
  ) {
    const ttl = ttlSeconds || this.refreshTtlSeconds;
    const refreshToken = randomUUID();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
        ip: ip ?? null,
        userAgent: userAgent ? userAgent.substring(0, 512) : null,
      },
    });

    return { refreshToken, session };
  }

  /** Cookie options for the refresh token */
  refreshCookieOptions(rememberMe?: boolean) {
    const opts: Record<string, any> = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    if (rememberMe) {
      opts.maxAge = REMEMBER_ME_TTL_SECONDS * 1000;
    } else {
      // Sem maxAge = cookie de sessao (expira ao fechar o browser)
      opts.maxAge = SESSION_TTL_SECONDS * 1000;
    }
    return opts;
  }

  /** Cookie options to clear the refresh token */
  clearCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
