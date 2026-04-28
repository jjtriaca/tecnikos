import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
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
    private readonly emailService: EmailService,
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

    // User created via invite but hasn't set password yet
    if (!user.passwordHash) {
      throw new UnauthorizedException('Voce ainda nao definiu sua senha. Verifique seu email para o link de convite.');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Credenciais inválidas');

    const ttl = SESSION_TTL_SECONDS;
    // Create session FIRST so we can embed sessionId in the JWT
    // v1.10.18: revokeOthers=true so login forca politica "sessao unica" — outras
    // abas/dispositivos ficam logout. Silent refresh usa false (so rotaciona).
    const { refreshToken, session } = await this.createSession(
      user.id,
      ip,
      userAgent,
      ttl,
      true,
    );
    const accessToken = this.issueAccessToken(user, session.id);

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

    // Load user separately (session may belong to a technician, not a User)
    const user = await this.prisma.user.findUnique({
      where: { id: matchedSession.userId },
    });

    if (!user) {
      // This session belongs to a technician, not a dashboard user
      throw new UnauthorizedException('Sessão inválida');
    }

    if (user.deletedAt) {
      throw new ForbiddenException('Usuário desativado');
    }

    // Revoke old session
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair (preserve original device name)
    // Create session FIRST so we can embed sessionId in the JWT
    // v1.10.18: revokeOthers=false — silent refresh nao revoga outras sessoes
    // (so rotaciona token da sessao corrente). Politica de sessao unica
    // permanece em vigor apenas no login inicial.
    const { refreshToken, session: newSession } = await this.createSession(
      matchedSession.userId,
      ip,
      userAgent || matchedSession.userAgent || undefined,
      undefined,
      false,
    );
    const accessToken = this.issueAccessToken(user, newSession.id);

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
        chatIAEnabled: true,
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
  /*  FORGOT / RESET PASSWORD                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Request password reset — sends email with reset link.
   * Always returns success (don't reveal if email exists).
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
      include: { company: { select: { name: true } } },
    });

    if (!user) {
      // Don't reveal if email exists - just return silently
      this.logger.log(`Password reset requested for unknown email: ${email}`);
      return;
    }

    // Generate secure token (64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      },
    });

    // Send email
    const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';
    const resetLink = `${baseUrl}/reset-password/${token}`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Tecnikos</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Redefinir senha</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Ola, <strong>${user.name}</strong>! Recebemos uma solicitacao para redefinir sua senha.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Redefinir minha senha
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0;">
            Este link expira em 1 hora. Se voce nao solicitou esta alteracao, ignore este email.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">Tecnikos — tecnikos.com.br</p>
        </div>
      </div>
    `;

    this.emailService.sendSystemEmail(
      user.email,
      'Redefinir senha — Tecnikos',
      html,
    ).catch((err) => {
      this.logger.error(`Failed to send password reset email: ${err.message}`);
    });

    this.logger.log(`Password reset token generated for ${user.email}`);
  }

  /**
   * Validate a password reset token (used by frontend to show form).
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });
    return { valid: !!user, email: user?.email };
  }

  /**
   * Reset password using a valid token.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate strong password
    const pwError = this.validateStrongPassword(newPassword);
    if (pwError) throw new BadRequestException(pwError);

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Link de redefinicao invalido ou expirado');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        passwordSetAt: new Date(),
      },
    });

    // Revoke all existing sessions (force re-login with new password)
    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Password reset completed for ${user.email}`);
  }

  /**
   * Send invite email to a new user with set-password link.
   */
  async sendInviteEmail(userId: string, companyName: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
        invitedAt: new Date(),
      },
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';
    const setPasswordLink = `${baseUrl}/reset-password/${token}`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Tecnikos</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Voce foi convidado!</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Ola, <strong>${user.name}</strong>! Voce foi adicionado a equipe da empresa <strong>${companyName}</strong> no Tecnikos.
          </p>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Clique no botao abaixo para definir sua senha e acessar o sistema.
          </p>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #64748b; padding: 4px 0; font-size: 13px; width: 80px;">Email:</td>
                <td style="color: #0f172a; padding: 4px 0; font-size: 13px; font-weight: 600;">${user.email}</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${setPasswordLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Definir minha senha
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0;">
            Este link expira em 7 dias.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">Tecnikos — tecnikos.com.br</p>
        </div>
      </div>
    `;

    this.emailService.sendSystemEmail(
      user.email,
      `Convite — ${companyName} no Tecnikos`,
      html,
    ).catch((err) => {
      this.logger.error(`Failed to send invite email: ${err.message}`);
    });
  }

  /**
   * Resend invite email for a user who hasn't set their password yet.
   */
  async resendInvite(userId: string, companyName: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.passwordSetAt) {
      throw new BadRequestException('Usuario ja definiu uma senha');
    }
    await this.sendInviteEmail(userId, companyName);
  }

  /** Validate strong password */
  private validateStrongPassword(password: string): string | null {
    if (!password || password.length < 8) return 'A senha deve ter no minimo 8 caracteres';
    if (!/[A-Z]/.test(password)) return 'A senha deve conter pelo menos uma letra maiuscula';
    if (!/[a-z]/.test(password)) return 'A senha deve conter pelo menos uma letra minuscula';
    if (!/\d/.test(password)) return 'A senha deve conter pelo menos um numero';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return 'A senha deve conter pelo menos um caractere especial';
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  HELPERS                                                            */
  /* ------------------------------------------------------------------ */
  private issueAccessToken(user: {
    id: string;
    email: string;
    roles: any[];
    companyId: string;
  }, sessionId?: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      companyId: user.companyId,
      ...(sessionId ? { sessionId } : {}),
    };
    return this.jwt.sign(payload);
  }

  private async createSession(
    userId: string,
    ip?: string,
    userAgent?: string,
    ttlSeconds?: number,
    revokeOthers: boolean = true,
  ) {
    const ttl = ttlSeconds || this.refreshTtlSeconds;
    const refreshToken = randomUUID();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // v1.10.18: revokeOthers=true (login) revoga sessoes anteriores — politica
    // "1 dispositivo por user". revokeOthers=false (refresh) NAO revoga — silent
    // refresh deve apenas rotacionar o token da sessao corrente, sem derrubar
    // outras abas/dispositivos do mesmo user. Bug anterior: a cada refresh
    // (15min), todas as sessoes paralelas eram revogadas → "voce foi desconectado".
    if (revokeOthers) {
      const revokedCount = await this.prisma.session.updateMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (revokedCount.count > 0) {
        this.logger.debug(`Revoked ${revokedCount.count} previous session(s) for user ${userId} (single-session policy)`);
      }
    }

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
