import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { JwtPayload, AuthenticatedUser } from './auth.types';
import {
  DEFAULT_REFRESH_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  REFRESH_COOKIE_NAME,
} from './auth.constants';

@Injectable()
export class AuthService {
  private readonly refreshTtlSeconds: number;
  private readonly logger = new Logger(AuthService.name);
  private readonly turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    this.refreshTtlSeconds =
      Number(process.env.JWT_REFRESH_TTL) || DEFAULT_REFRESH_TTL_SECONDS;
  }

  /** Validate Turnstile CAPTCHA token. Skips if TURNSTILE_SECRET_KEY not configured. */
  async validateCaptcha(token?: string, ip?: string): Promise<void> {
    if (!this.turnstileSecret) return; // CAPTCHA not configured — skip

    if (!token) {
      throw new BadRequestException('Verificação CAPTCHA necessária');
    }

    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.turnstileSecret,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        this.logger.warn(`CAPTCHA validation failed: ${JSON.stringify(data['error-codes'])}`);
        throw new BadRequestException('Verificação CAPTCHA falhou. Tente novamente.');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('CAPTCHA validation error', err);
      // On network error, allow login (fail open) to not block users
    }
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

    const ttl = SESSION_TTL_SECONDS;
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

    // Issue new pair (preserve original device name)
    const accessToken = this.issueAccessToken(matchedSession.user);
    const { refreshToken } = await this.createSession(
      matchedSession.userId,
      ip,
      userAgent || matchedSession.userAgent || undefined,
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
  /*  SESSION MANAGEMENT (device control)                                */
  /* ------------------------------------------------------------------ */

  /** List active (non-revoked, non-expired) sessions for user */
  async getActiveSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        lastActivityAt: true,
      },
      orderBy: { lastActivityAt: { sort: 'desc', nulls: 'last' } },
    });
    return sessions;
  }

  /** Revoke a specific session (only if it belongs to the user) */
  async revokeSession(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
    });
    if (!session) return { ok: false, message: 'Sessão não encontrada' };
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /** Revoke all sessions except the current one */
  async revokeAllOtherSessions(userId: string, currentRefreshToken: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    let currentSessionId: string | null = null;
    for (const s of sessions) {
      if (await bcrypt.compare(currentRefreshToken, s.refreshTokenHash)) {
        currentSessionId = s.id;
        break;
      }
    }
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return { ok: true, revoked: sessions.length - (currentSessionId ? 1 : 0) };
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
        deviceName: this.parseDeviceName(userAgent),
        lastActivityAt: new Date(),
      },
    });

    return { refreshToken, session };
  }

  /** Parse user-agent into a human-readable device name */
  private parseDeviceName(ua?: string): string {
    if (!ua) return 'Dispositivo desconhecido';

    let browser = 'Navegador';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
    else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

    let os = '';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'Mac';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return os ? `${browser} no ${os}` : browser;
  }

  /** Cookie options for the refresh token — session cookie (no maxAge, expires on browser close) */
  refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      // Sem maxAge = cookie de sessao (expira ao fechar o browser)
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
