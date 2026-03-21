import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService, normalizePhone } from './otp.service';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'crypto';
import { JwtPayload } from './auth.types';
import {
  TECH_REFRESH_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  DEVICE_TOKEN_TTL_SECONDS,
} from './auth.constants';

@Injectable()
export class TechAuthService {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otpService: OtpService,
  ) {
    this.refreshTtlSeconds = TECH_REFRESH_TTL_SECONDS; // 90 days — PWA needs long-lived sessions
  }

  /* ─── LOGIN (legacy email+password — kept for backward compat) ── */
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
    const deviceToken = await this.issueDeviceToken(tech.id, tech.companyId, userAgent);

    return {
      accessToken,
      refreshToken,
      refreshTtlSeconds: ttl,
      deviceToken,
      technician: {
        id: tech.id,
        name: tech.name,
        email: tech.email,
        phone: tech.phone,
        companyId: tech.companyId,
      },
    };
  }

  /* ─── OTP: REQUEST CODE ─────────────────────────────── */
  async requestOtp(phone: string) {
    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) throw new BadRequestException('Telefone inválido');

    const tech = await this.prisma.partner.findFirst({
      where: {
        phone: phoneNorm,
        deletedAt: null,
        partnerTypes: { has: 'TECNICO' },
      },
      select: { id: true, companyId: true, status: true },
    });

    if (!tech) throw new NotFoundException('Técnico não encontrado com esse telefone');
    if (tech.status !== 'ATIVO') throw new ForbiddenException('Técnico desativado');

    return this.otpService.sendOtp({
      companyId: tech.companyId,
      partnerId: tech.id,
      phone: phoneNorm,
      serviceOrderId: null,
    });
  }

  /* ─── OTP: VERIFY + LOGIN ──────────────────────────── */
  async loginWithOtp(phone: string, code: string, ip?: string, userAgent?: string) {
    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) throw new BadRequestException('Telefone inválido');

    const tech = await this.prisma.partner.findFirst({
      where: {
        phone: phoneNorm,
        deletedAt: null,
        partnerTypes: { has: 'TECNICO' },
      },
    });

    if (!tech) throw new NotFoundException('Técnico não encontrado');
    if (tech.status !== 'ATIVO') throw new ForbiddenException('Técnico desativado');

    // Verify OTP (throws on failure)
    await this.otpService.verifyCode({
      companyId: tech.companyId,
      partnerId: tech.id,
      code,
      serviceOrderId: null,
    });

    const ttl = SESSION_TTL_SECONDS;
    const accessToken = this.issueAccessToken(tech);
    const { refreshToken } = await this.createSession(tech.id, ip, userAgent, ttl);
    const deviceToken = await this.issueDeviceToken(tech.id, tech.companyId, userAgent);

    return {
      accessToken,
      refreshToken,
      refreshTtlSeconds: ttl,
      deviceToken,
      technician: {
        id: tech.id,
        name: tech.name,
        email: tech.email,
        phone: tech.phone,
        companyId: tech.companyId,
      },
    };
  }

  /* ─── TOKEN AUTH (link de OS ou boas-vindas) ────────── */
  async loginWithToken(token: string, ip?: string, userAgent?: string) {
    // Try welcome token first (TechnicianContract) — works for any non-cancelled status
    const contract = await this.prisma.technicianContract.findFirst({
      where: {
        token,
        contractType: 'WELCOME',
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
      include: { partner: true },
    });

    if (contract) {
      const tech = contract.partner;
      if (!tech || tech.deletedAt) {
        throw new ForbiddenException('Técnico não encontrado');
      }
      if (!['ATIVO', 'PENDENTE_CONTRATO'].includes(tech.status || '')) {
        throw new ForbiddenException('Técnico desativado');
      }
      if (!tech.partnerTypes?.includes('TECNICO')) {
        throw new BadRequestException('Parceiro não é técnico');
      }

      // Check if there's a pending contract that needs acceptance
      const pendingContract = await this.prisma.technicianContract.findFirst({
        where: {
          partnerId: tech.id,
          companyId: tech.companyId,
          status: 'PENDING',
          blockUntilAccepted: true,
        },
        select: { id: true, token: true, contractType: true, requireSignature: true },
      });

      if (pendingContract) {
        // Don't auto-accept — redirect to contract page
        return {
          accessToken: null,
          refreshToken: null,
          refreshTtlSeconds: 0,
          technician: {
            id: tech.id,
            name: tech.name,
            email: tech.email,
            phone: tech.phone,
            companyId: tech.companyId,
          },
          type: 'pending_contract' as const,
          contractToken: pendingContract.token,
        };
      }

      // No pending contract — mark welcome as accepted if not already
      if (contract.status !== 'ACCEPTED') {
        await this.prisma.technicianContract.update({
          where: { id: contract.id },
          data: {
            status: 'ACCEPTED',
            viewedAt: contract.viewedAt || new Date(),
            acceptedAt: new Date(),
          },
        });
      }

      // If tech was PENDENTE_CONTRATO but no blocking contract found, activate
      if (tech.status === 'PENDENTE_CONTRATO') {
        await this.prisma.partner.update({
          where: { id: tech.id },
          data: { status: 'ATIVO' },
        });
      }

      const ttl = SESSION_TTL_SECONDS;
      const accessToken = this.issueAccessToken(tech);
      const { refreshToken } = await this.createSession(tech.id, ip, userAgent, ttl);
      const deviceToken = await this.issueDeviceToken(tech.id, tech.companyId, userAgent);

      return {
        accessToken,
        refreshToken,
        refreshTtlSeconds: ttl,
        deviceToken,
        technician: {
          id: tech.id,
          name: tech.name,
          email: tech.email,
          phone: tech.phone,
          companyId: tech.companyId,
        },
        type: 'welcome' as const,
      };
    }

    // Try OS token (ServiceOrderOffer — valid while OS is active)
    const offer = await this.prisma.serviceOrderOffer.findFirst({
      where: {
        token,
        revokedAt: null,
      },
      include: {
        serviceOrder: {
          select: {
            id: true,
            status: true,
            companyId: true,
            assignedPartnerId: true,
            directedTechnicianIds: true,
          },
        },
      },
    });

    if (offer) {
      const so = offer.serviceOrder;
      // Token is valid until OS reaches a terminal status
      // Exception: PREVIEW tokens always work (for emulator testing)
      const terminalStatuses = ['APROVADA', 'CANCELADA', 'CONCLUIDA', 'RECUSADA'];
      if (terminalStatuses.includes(so.status) && offer.channel !== 'PREVIEW') {
        throw new BadRequestException('Esta ordem de serviço já foi finalizada');
      }

      // Identify technician: assigned first, then directed (tech needs auth BEFORE accepting)
      const directedIds: string[] = (so.directedTechnicianIds as string[]) || [];
      const techId = so.assignedPartnerId || directedIds[0];
      if (!techId) {
        throw new BadRequestException('Nenhum técnico atribuído a esta OS');
      }

      const tech = await this.prisma.partner.findFirst({
        where: { id: techId, deletedAt: null, partnerTypes: { has: 'TECNICO' } },
      });

      if (!tech || tech.status !== 'ATIVO') {
        throw new ForbiddenException('Técnico desativado');
      }

      const ttl = SESSION_TTL_SECONDS;
      const accessToken = this.issueAccessToken(tech);
      const { refreshToken } = await this.createSession(tech.id, ip, userAgent, ttl);
      const deviceToken = await this.issueDeviceToken(tech.id, tech.companyId, userAgent);

      return {
        accessToken,
        refreshToken,
        refreshTtlSeconds: ttl,
        deviceToken,
        technician: {
          id: tech.id,
          name: tech.name,
          email: tech.email,
          phone: tech.phone,
          companyId: tech.companyId,
        },
        type: 'service_order' as const,
        serviceOrderId: so.id,
      };
    }

    throw new NotFoundException('Token inválido ou expirado');
  }

  /* ─── REFRESH ────────────────────────────────────────── */
  async refresh(oldRefreshToken: string, ip?: string, userAgent?: string) {
    if (!oldRefreshToken) throw new UnauthorizedException('Token ausente');

    // Note: We cannot filter by userId here because we don't know the user yet
    // (refresh uses httpOnly cookie, no JWT). But we limit scan to active sessions only.
    // bcrypt is required for refresh tokens (unlike device tokens) because this is the
    // standard session model shared with dashboard users.
    const sessions = await this.prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true, refreshTokenHash: true },
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
  async logout(refreshToken: string, technicianId?: string) {
    if (!refreshToken) return;

    const sessions = await this.prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true, refreshTokenHash: true },
    });

    for (const s of sessions) {
      if (await bcrypt.compare(refreshToken, s.refreshTokenHash)) {
        await this.prisma.session.update({
          where: { id: s.id },
          data: { revokedAt: new Date() },
        });
        // Also revoke device tokens for this technician (full logout = clean slate)
        if (technicianId) {
          await this.prisma.deviceToken.updateMany({
            where: { partnerId: technicianId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
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

  /* ─── DEVICE RECOVER (PWA persistent auth) ──────────── */
  async deviceRecover(deviceToken: string, ip?: string, userAgent?: string) {
    if (!deviceToken) throw new UnauthorizedException('Device token ausente');

    // SHA-256 hash for indexed lookup (UUID has 128-bit entropy — SHA-256 is more than enough)
    const tokenHash = this.sha256(deviceToken);

    const matched = await this.prisma.deviceToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!matched) throw new UnauthorizedException('Device token inválido ou expirado');

    const tech = await this.prisma.partner.findFirst({
      where: { id: matched.partnerId, deletedAt: null, partnerTypes: { has: 'TECNICO' } },
    });

    if (!tech || tech.status !== 'ATIVO') {
      throw new ForbiddenException('Técnico desativado');
    }

    const accessToken = this.issueAccessToken(tech);
    const { refreshToken } = await this.createSession(tech.id, ip, userAgent);
    const newDeviceToken = await this.issueDeviceToken(tech.id, tech.companyId, userAgent);

    return {
      accessToken,
      refreshToken,
      refreshTtlSeconds: this.refreshTtlSeconds,
      deviceToken: newDeviceToken,
      technician: {
        id: tech.id,
        name: tech.name,
        email: tech.email,
        phone: tech.phone,
        companyId: tech.companyId,
      },
    };
  }

  /* ─── MY ORDERS (active OS for technician) ─────────── */
  async myOrders(user: { partnerId?: string; technicianId?: string; id: string; companyId: string }) {
    const techId = user.partnerId || user.technicianId || user.id;

    // Only show OS where tech is ASSIGNED (accepted), not just directed (pending acceptance)
    // Directed OS (OFERTADA) must be accepted via link first, which assigns the tech
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        deletedAt: null,
        companyId: user.companyId, // tenant isolation
        status: { notIn: ['CONCLUIDA', 'APROVADA', 'CANCELADA', 'RECUSADA'] },
        assignedPartnerId: techId,
      },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        addressText: true,
        deadlineAt: true,
        valueCents: true,
        clientPartner: { select: { name: true } },
      },
      orderBy: [{ deadlineAt: 'asc' }],
      take: 50,
    });

    // Sort: A_CAMINHO and EM_EXECUCAO first
    const priorityStatuses = ['A_CAMINHO', 'EM_EXECUCAO'];
    orders.sort((a, b) => {
      const aPriority = priorityStatuses.includes(a.status) ? 0 : 1;
      const bPriority = priorityStatuses.includes(b.status) ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return 0; // keep deadlineAt order from DB
    });

    return { orders };
  }

  /* ─── ISSUE DEVICE TOKEN ────────────────────────────── */
  async issueDeviceToken(partnerId: string, companyId: string, userAgent?: string): Promise<string> {
    const token = randomUUID();
    const tokenHash = this.sha256(token);
    const expiresAt = new Date(Date.now() + DEVICE_TOKEN_TTL_SECONDS * 1000);
    const deviceName = userAgent ? userAgent.substring(0, 128) : null;

    // Transaction: revoke old + create new (prevents race condition)
    await this.prisma.$transaction([
      this.prisma.deviceToken.updateMany({
        where: { partnerId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.deviceToken.create({
        data: { partnerId, companyId, tokenHash, deviceName, expiresAt },
      }),
    ]);

    return token;
  }

  /** Deterministic hash for device tokens (UUID has 128-bit entropy, no need for bcrypt) */
  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /** Cookie persistente — maxAge alinhado com refresh token TTL (PWA precisa sobreviver ao fechar app) */
  refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: this.refreshTtlSeconds * 1000, // ms — matches refresh token TTL (7 days)
    };
  }

  clearCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
