import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../email/email.service';
import { randomUUID } from 'crypto';

export interface SendContractOptions {
  companyId: string;
  partnerId: string;
  serviceOrderId?: string;
  contractName: string;
  contractContent: string;
  blockUntilAccepted?: boolean;
  requireSignature?: boolean;
  requireAcceptance?: boolean;
  expirationDays?: number;
  channel?: 'WHATSAPP' | 'EMAIL';
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationService,
    @Optional() private readonly email?: EmailService,
  ) {}

  /* ── Send Contract ─────────────────────────────────── */

  async sendContract(opts: SendContractOptions) {
    const {
      companyId,
      partnerId,
      serviceOrderId,
      contractName,
      contractContent,
      blockUntilAccepted = true,
      requireSignature = false,
      requireAcceptance = true,
      expirationDays = 7,
      channel = 'WHATSAPP',
    } = opts;

    // Validate partner exists and belongs to company
    const partner = await this.prisma.partner.findFirst({
      where: { id: partnerId, companyId, deletedAt: null },
    });
    if (!partner) throw new NotFoundException('Parceiro não encontrado');

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    // Replace template variables in contract content
    const today = new Date().toLocaleDateString('pt-BR');
    const companyDisplay = company.tradeName || company.name;
    const resolvedContent = contractContent
      .replace(/\{nome\}/gi, partner.name)
      .replace(/\{empresa\}/gi, companyDisplay)
      .replace(/\{razao_social\}/gi, company.name)
      .replace(/\{data\}/gi, today)
      .replace(/\{documento\}/gi, partner.document || '')
      .replace(/\{email\}/gi, partner.email || '')
      .replace(/\{telefone\}/gi, partner.phone || '')
      .replace(/\{cnpj_empresa\}/gi, company.cnpj || '')
      .replace(/\{endereco_empresa\}/gi, [company.addressStreet, company.addressNumber, company.neighborhood, company.city, company.state].filter(Boolean).join(', '));

    // Generate token and calculate expiration
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    // Create contract record
    const contract = await this.prisma.technicianContract.create({
      data: {
        companyId,
        partnerId,
        serviceOrderId: serviceOrderId || null,
        token,
        contractName,
        contractContent: resolvedContent,
        blockUntilAccepted,
        requireSignature,
        requireAcceptance,
        sentVia: channel,
        expiresAt,
      },
    });

    // If blockUntilAccepted, set partner status to PENDENTE_CONTRATO
    if (blockUntilAccepted && partner.status === 'ATIVO') {
      await this.prisma.partner.update({
        where: { id: partnerId },
        data: { status: 'PENDENTE_CONTRATO' },
      });
    }

    // Build the public URL
    const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';
    const contractUrl = `${baseUrl}/contract/${token}`;

    // Send notification
    const message = `Olá ${partner.name}, você recebeu um contrato "${contractName}" da empresa ${company.name} para aceite. Acesse: ${contractUrl}`;

    if (channel === 'WHATSAPP' && partner.phone && this.notifications) {
      await this.notifications.send({
        companyId,
        channel: 'WHATSAPP',
        recipientPhone: partner.phone,
        message,
        type: 'CONTRACT_SENT',
      });
    } else if (channel === 'EMAIL' && partner.email && this.email) {
      let emailStatus = 'SENT';
      try {
        const result = await this.email.sendEmail(
          companyId,
          partner.email,
          `Contrato para aceite: ${contractName}`,
          this.buildEmailHtml(partner.name, contractName, contractUrl, company.name),
        );
        emailStatus = result?.success ? 'SENT' : 'FAILED';
      } catch (err) {
        emailStatus = 'FAILED';
        this.logger.error(`Failed to send contract email: ${err.message}`);
      }
      // Log email notification in DB (email path doesn't go through NotificationService)
      await this.prisma.notification.create({
        data: {
          companyId,
          channel: 'EMAIL',
          recipientEmail: partner.email,
          message,
          type: 'CONTRACT_SENT',
          status: emailStatus,
          sentAt: new Date(),
        },
      }).catch(() => {});
    } else {
      // No channel available — log as MOCK so it appears in notifications
      this.logger.warn(`📄 [CONTRACT] No channel available for ${partner.name} (${channel}, phone: ${partner.phone || 'N/A'}, email: ${partner.email || 'N/A'})`);
      await this.prisma.notification.create({
        data: {
          companyId,
          channel: 'MOCK',
          recipientPhone: partner.phone,
          recipientEmail: partner.email,
          message: `[SEM CANAL] ${message}`,
          type: 'CONTRACT_SENT',
          status: 'FAILED',
          sentAt: new Date(),
        },
      }).catch(() => {});
    }

    this.logger.log(`📄 Contract "${contractName}" sent to ${partner.name} via ${channel} — token: ${token}`);
    return contract;
  }

  /* ── Public: Get Contract by Token ─────────────────── */

  async getByToken(token: string) {
    const contract = await this.prisma.technicianContract.findUnique({
      where: { token },
      include: {
        partner: { select: { name: true, email: true } },
        company: { select: { name: true, tradeName: true, logoUrl: true } },
      },
    });

    if (!contract) throw new NotFoundException('Contrato não encontrado');

    // Check expiration
    if (contract.status === 'PENDING' && new Date() > contract.expiresAt) {
      await this.prisma.technicianContract.update({
        where: { id: contract.id },
        data: { status: 'EXPIRED' },
      });
      contract.status = 'EXPIRED';
    }

    return contract;
  }

  /* ── Public: Mark Viewed ────────────────────────────── */

  async markViewed(token: string) {
    const contract = await this.prisma.technicianContract.findUnique({ where: { token } });
    if (!contract) throw new NotFoundException('Contrato não encontrado');

    if (contract.status === 'PENDING' && !contract.viewedAt) {
      await this.prisma.technicianContract.update({
        where: { id: contract.id },
        data: { viewedAt: new Date(), status: 'VIEWED' },
      });
    }
  }

  /* ── Public: Accept Contract ────────────────────────── */

  async acceptContract(token: string, ip?: string, userAgent?: string, signatureData?: string) {
    const contract = await this.prisma.technicianContract.findUnique({
      where: { token },
      include: { partner: true },
    });

    if (!contract) throw new NotFoundException('Contrato não encontrado');

    if (contract.status === 'ACCEPTED') {
      throw new BadRequestException('Contrato já foi aceito');
    }

    if (contract.status === 'CANCELLED') {
      throw new BadRequestException('Contrato foi cancelado');
    }

    if (contract.status === 'EXPIRED' || new Date() > contract.expiresAt) {
      throw new BadRequestException('Contrato expirado');
    }

    // Validate signature if required
    if (contract.requireSignature && !signatureData) {
      throw new BadRequestException('Assinatura digital é obrigatória para este contrato');
    }

    // Accept the contract
    await this.prisma.technicianContract.update({
      where: { id: contract.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedIp: ip || null,
        acceptedUserAgent: userAgent || null,
        signatureData: signatureData || null,
      },
    });

    // If blockUntilAccepted, check if all pending contracts are done → activate partner
    if (contract.blockUntilAccepted) {
      const pendingContracts = await this.prisma.technicianContract.count({
        where: {
          partnerId: contract.partnerId,
          companyId: contract.companyId,
          blockUntilAccepted: true,
          status: { in: ['PENDING', 'VIEWED'] },
          id: { not: contract.id },
        },
      });

      if (pendingContracts === 0 && contract.partner.status === 'PENDENTE_CONTRATO') {
        await this.prisma.partner.update({
          where: { id: contract.partnerId },
          data: { status: 'ATIVO' },
        });
        this.logger.log(`✅ Partner ${contract.partner.name} activated after contract acceptance`);
      }
    }

    // Create notification for the company (internal log)
    await this.prisma.notification.create({
      data: {
        companyId: contract.companyId,
        channel: 'SYSTEM',
        message: `O tecnico ${contract.partner.name} aceitou o contrato "${contract.contractName}"${contract.requireSignature ? ' (com assinatura digital)' : ''}.`,
        type: 'CONTRACT_ACCEPTED',
        status: 'SENT',
        sentAt: new Date(),
      },
    }).catch(() => {});

    this.logger.log(`✅ Contract "${contract.contractName}" accepted by ${contract.partner.name}`);
    return { success: true };
  }

  /* ── Admin: List Contracts by Partner ───────────────── */

  async findByPartner(partnerId: string, companyId: string) {
    return this.prisma.technicianContract.findMany({
      where: { partnerId, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /* ── Admin: Cancel Contract ─────────────────────────── */

  async cancelContract(id: string, companyId: string, reason?: string) {
    const contract = await this.prisma.technicianContract.findFirst({
      where: { id, companyId },
    });

    if (!contract) throw new NotFoundException('Contrato não encontrado');
    if (contract.status === 'ACCEPTED') throw new BadRequestException('Contrato já aceito, não pode ser cancelado');

    return this.prisma.technicianContract.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: reason || null,
      },
    });
  }

  /* ── Email HTML Builder ─────────────────────────────── */

  private buildEmailHtml(partnerName: string, contractName: string, url: string, companyName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e293b, #334155); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #fff; font-size: 20px; margin: 0;">${companyName}</h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0;">Contrato para Aceite</p>
        </div>
        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="font-size: 16px; color: #334155;">Olá <strong>${partnerName}</strong>,</p>
          <p style="font-size: 14px; color: #64748b;">Você recebeu o contrato <strong>"${contractName}"</strong> para revisão e aceite.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${url}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Visualizar e Aceitar Contrato
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">Este link tem prazo de validade. Acesse o quanto antes.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">Enviado via Tecnikos — ${companyName}</p>
        </div>
      </div>
    `;
  }
}
