import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { JwtPayload } from './auth.types';
import {
  DEFAULT_REFRESH_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from './auth.constants';

@Injectable()
export class TechAuthService {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    this.refreshTtlSeconds =
      Number(process.env.JWT_REFRESH_TTL) || DEFAULT_REFRESH_TTL_SECONDS;
  }

  /* ─── LOGIN ──────────────────────────────────────────── */
  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const tech = await this.prisma.partner.findFirst({
      where: { email, deletedAt: null, partnerTypes: { has: 'TECNICO' } },
    });

    if (!tech || !tech.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (tech.status !== 'ATIVO') {
      throw new ForbiddenException('Técnico desativado');
    }

    const ok = await bcrypt.compare(password, tech.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const ttl = SESSION_TTL_SECONDS;
    const accessToken = this.issueAccessToken(tech);
    const { refreshToken } = await this.createSession(tech.id, ip, userAgent, ttl);

    return {
      accessToken,
      refreshToken,
      refreshTtlSeconds: ttl,
      technician: {
        id: tech.id,
        name: tech.name,
        email: tech.email,
        phone: tech.phone,
        companyId: tech.companyId,
      },
    };
  }

  /* ─── REFRESH ────────────────────────────────────────── */
  async refresh(oldRefreshToken: string, ip?: string, userAgent?: string) {
    if (!oldRefreshToken) throw new UnauthorizedException('Token ausente');

    const sessions = await this.prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: false },
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

    // Technician session uses userId = technicianId
    const tech = await this.prisma.partner.findFirst({
      where: { id: matchedSession.userId, deletedAt: null, partnerTypes: { has: 'TECNICO' } },
    });

    if (!tech || tech.status !== 'ATIVO') {
      throw new ForbiddenException('Técnico desativado');
    }

    // Revoke old session
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = this.issueAccessToken(tech);
    const { refreshToken } = await this.createSession(tech.id, ip, userAgent);

    return {
      accessToken,
      refreshToken,
      refreshTtlSeconds: this.refreshTtlSeconds,
    };
  }

  /* ─── LOGOUT ─────────────────────────────────────────── */
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

  /* ─── ME ─────────────────────────────────────────────── */
  async me(user: { id: string; technicianId?: string; partnerId?: string; companyId: string }) {
    const techId = user.partnerId || user.technicianId || user.id;
    const tech = await this.prisma.partner.findFirst({
      where: { id: techId, deletedAt: null, partnerTypes: { has: 'TECNICO' } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        rating: true,
        companyId: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!tech) throw new UnauthorizedException('Técnico não encontrado');
    return tech;
  }

  /* ─── HELPERS ────────────────────────────────────────── */
  private issueAccessToken(tech: {
    id: string;
    email: string | null;
    companyId: string;
  }): string {
    const payload: JwtPayload = {
      sub: tech.id,
      email: tech.email || '',
      roles: [],
      isTecnico: true,
      companyId: tech.companyId,
      technicianId: tech.id,
      partnerId: tech.id,
    };
    return this.jwt.sign(payload);
  }

  private async createSession(technicianId: string, ip?: string, userAgent?: string, ttlSeconds?: number) {
    const ttl = ttlSeconds || this.refreshTtlSeconds;
    const refreshToken = randomUUID();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Enforce max 5 active sessions per technician — revoke oldest if over limit
    const MAX_SESSIONS = 5;
    const activeSessions = await this.prisma.session.findMany({
      where: { userId: technicianId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (activeSessions.length >= MAX_SESSIONS) {
      const toRevoke = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
      await this.prisma.session.updateMany({
        where: { id: { in: toRevoke.map(s => s.id) } },
        data: { revokedAt: new Date() },
      });
    }

    await this.prisma.session.create({
      data: {
        userId: technicianId, // Reusing session table (userId stores technicianId for tech sessions)
        refreshTokenHash,
        expiresAt,
        ip: ip ?? null,
        userAgent: userAgent ? userAgent.substring(0, 512) : null,
      },
    });

    return { refreshToken };
  }

  /** Cookie de sessao (sem maxAge = expira ao fechar browser) */
  refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/tech-auth',
    };
  }

  clearCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/tech-auth',
    };
  }
}
