import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../email/email.service';
import { randomUUID } from 'crypto';

export interface SendContractOptions {
  companyId: string;
  partnerId: string;
  serviceOrderId?: string;
  specializationId?: string;
  trigger?: string;
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
      specializationId,
      trigger,
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
        specializationId: specializationId || null,
        trigger: trigger || null,
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
        forceTemplate: true, // Business-initiated — must use template
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

  /* ── Send Welcome Message (CLT) ───────────────────── */

  async sendWelcomeMessage(opts: {
    companyId: string;
    partnerId: string;
    channel: 'WHATSAPP' | 'EMAIL';
    message: string;
    waitForReply: boolean;
    confirmVia?: 'WHATSAPP' | 'LINK';
  }) {
    const partner = await this.prisma.partner.findFirst({
      where: { id: opts.partnerId, companyId: opts.companyId, deletedAt: null },
    });
    if (!partner) throw new NotFoundException('Parceiro não encontrado');

    const company = await this.prisma.company.findUnique({ where: { id: opts.companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    // Resolve template variables
    const today = new Date().toLocaleDateString('pt-BR');
    const companyDisplay = company.tradeName || company.name;
    const resolvedMessage = opts.message
      .replace(/\{nome\}/gi, partner.name)
      .replace(/\{empresa\}/gi, companyDisplay)
      .replace(/\{razao_social\}/gi, company.name)
      .replace(/\{data\}/gi, today)
      .replace(/\{documento\}/gi, partner.document || '')
      .replace(/\{email\}/gi, partner.email || '')
      .replace(/\{telefone\}/gi, partner.phone || '')
      .replace(/\{cnpj_empresa\}/gi, company.cnpj || '')
      .replace(/\{endereco_empresa\}/gi, [company.addressStreet, company.addressNumber, company.neighborhood, company.city, company.state].filter(Boolean).join(', '));

    // Generate token (used for link confirmation, or just as ID)
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 36500); // ~100 years (welcome doesn't expire)

    const confirmVia = opts.confirmVia || 'WHATSAPP';
    const shouldBlock = opts.waitForReply;

    // Create TechnicianContract record with type WELCOME
    const contract = await this.prisma.technicianContract.create({
      data: {
        companyId: opts.companyId,
        partnerId: opts.partnerId,
        contractType: 'WELCOME',
        token,
        contractName: 'Mensagem de Boas-Vindas (CLT)',
        contractContent: resolvedMessage,
        status: shouldBlock ? 'PENDING' : 'ACCEPTED',
        blockUntilAccepted: shouldBlock,
        requireSignature: false,
        requireAcceptance: shouldBlock,
        sentVia: opts.channel,
        expiresAt,
        acceptedAt: shouldBlock ? null : new Date(),
      },
    });

    // Block partner if waiting for reply
    if (shouldBlock && partner.status === 'ATIVO') {
      await this.prisma.partner.update({
        where: { id: opts.partnerId },
        data: { status: 'PENDENTE_CONTRATO' },
      });
    }

    // Build message to send
    let finalMessage = resolvedMessage;

    // If confirmation via link, append contract URL
    if (shouldBlock && confirmVia === 'LINK') {
      const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';
      const contractUrl = `${baseUrl}/contract/${token}`;
      finalMessage += `\n\nPara confirmar, acesse: ${contractUrl}`;
    }

    // Send notification
    if (opts.channel === 'WHATSAPP' && partner.phone && this.notifications) {
      await this.notifications.send({
        companyId: opts.companyId,
        channel: 'WHATSAPP',
        recipientPhone: partner.phone,
        message: finalMessage,
        type: 'WELCOME_SENT',
        forceTemplate: true, // Business-initiated — must use template (text is silently dropped outside 24h window)
      });
    } else if (opts.channel === 'EMAIL' && partner.email && this.email) {
      try {
        await this.email.sendEmail(
          opts.companyId,
          partner.email,
          `Bem-vindo(a) à equipe ${companyDisplay}!`,
          this.buildWelcomeEmailHtml(partner.name, companyDisplay, shouldBlock && confirmVia === 'LINK' ? `${process.env.FRONTEND_URL || 'https://tecnikos.com.br'}/contract/${token}` : undefined),
        );
      } catch (err) {
        this.logger.error(`Failed to send welcome email: ${err.message}`);
      }
      await this.prisma.notification.create({
        data: {
          companyId: opts.companyId,
          channel: 'EMAIL',
          recipientEmail: partner.email,
          message: finalMessage,
          type: 'WELCOME_SENT',
          status: 'SENT',
          sentAt: new Date(),
        },
      }).catch(() => {});
    } else {
      this.logger.warn(`📄 [WELCOME] No channel available for ${partner.name}`);
      await this.prisma.notification.create({
        data: {
          companyId: opts.companyId,
          channel: 'MOCK',
          recipientPhone: partner.phone,
          recipientEmail: partner.email,
          message: `[SEM CANAL] ${finalMessage}`,
          type: 'WELCOME_SENT',
          status: 'FAILED',
          sentAt: new Date(),
        },
      }).catch(() => {});
    }

    this.logger.log(`👋 Welcome message sent to ${partner.name} via ${opts.channel} (waitForReply: ${shouldBlock}, confirmVia: ${confirmVia})`);
    return contract;
  }

  private buildWelcomeEmailHtml(name: string, company: string, confirmUrl?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a5f;">Bem-vindo(a) à equipe ${company}!</h2>
        <p>Olá <strong>${name}</strong>,</p>
        <p>Você foi cadastrado(a) como técnico(a) em nosso sistema de gestão de serviços.</p>
        ${confirmUrl ? `
          <p>Para confirmar sua participação, clique no botão abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Confirmar Participação
            </a>
          </div>
        ` : ''}
        <p>Em breve você receberá suas primeiras ordens de serviço pela plataforma Tecnikos.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">Tecnikos — Gestão de Serviços Técnicos</p>
      </div>
    `;
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
      include: { partner: true },
    });

    if (!contract) throw new NotFoundException('Contrato não encontrado');
    if (contract.status === 'ACCEPTED') throw new BadRequestException('Contrato já aceito, não pode ser cancelado');

    // Cancel the contract
    const updated = await this.prisma.technicianContract.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: reason || null,
      },
    });

    // If contract was linked to a specialization, remove the PartnerSpecialization
    if (contract.specializationId) {
      await this.prisma.partnerSpecialization.deleteMany({
        where: {
          partnerId: contract.partnerId,
          specializationId: contract.specializationId,
        },
      }).catch(() => {});
      this.logger.log(`🔧 Removed specialization ${contract.specializationId} from partner ${contract.partnerId} due to contract cancellation`);
    }

    // If blockUntilAccepted, check if partner should be reactivated
    if (contract.blockUntilAccepted && contract.partner.status === 'PENDENTE_CONTRATO') {
      const stillPending = await this.prisma.technicianContract.count({
        where: {
          partnerId: contract.partnerId,
          companyId,
          blockUntilAccepted: true,
          status: { in: ['PENDING', 'VIEWED'] },
          id: { not: id },
        },
      });

      if (stillPending === 0) {
        await this.prisma.partner.update({
          where: { id: contract.partnerId },
          data: { status: 'ATIVO' },
        });
        this.logger.log(`✅ Partner ${contract.partner.name} reactivated after contract cancellation (no more pending contracts)`);
      }
    }

    return updated;
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
