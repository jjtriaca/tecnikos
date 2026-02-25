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
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Credenciais inválidas');

    const accessToken = this.issueAccessToken(user);
    const { refreshToken, session } = await this.createSession(
      user.id,
      ip,
      userAgent,
    );

    return {
      accessToken,
      refreshToken,
      refreshTtlSeconds: this.refreshTtlSeconds,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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
        role: true,
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
    role: string;
    companyId: string;
  }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as any,
      companyId: user.companyId,
    };
    return this.jwt.sign(payload);
  }

  private async createSession(
    userId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const refreshToken = randomUUID();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(
      Date.now() + this.refreshTtlSeconds * 1000,
    );

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
  refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: this.refreshTtlSeconds * 1000,
    };
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
