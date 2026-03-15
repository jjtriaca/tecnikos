import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ChecklistResponseService } from '../checklist-response/checklist-response.service';
import { SubmitChecklistDto } from '../checklist-response/dto/submit-checklist.dto';
import { ServiceOrderStatus } from '@prisma/client';
import {
  randomUUID,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from 'crypto';
import { haversineMeters } from '../common/geo/haversine';

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

function generateOtp6(): string {
  const n = randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

function hashOtp(code: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(code, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyOtp(code: string, stored: string): boolean {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(code, salt, 32);
  const storedBuf = Buffer.from(hash, 'hex');
  if (storedBuf.length !== test.length) return false;
  return timingSafeEqual(storedBuf, test);
}

/** Generate a stateless access key for post-acceptance link access */
function generateAccessKey(token: string): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  return createHmac('sha256', secret).update(`offer-access:${token}`).digest('hex').slice(0, 32);
}

/** Notification config for a single action (gestor + cliente) */
export interface ActionNotifyConfig {
  notifyGestor:  { enabled: boolean; channel: string; message: string };
  notifyCliente: { enabled: boolean; channel: string; message: string };
}

const DEFAULT_ACTION_NOTIFY: ActionNotifyConfig = {
  notifyGestor:  { enabled: false, channel: 'whatsapp', message: '' },
  notifyCliente: { enabled: false, channel: 'sms', message: '' },
};

/** Extract linkConfig (acceptOS, gpsNavigation, enRoute, pageLayout, page2Layout, etc.) from workflow template's NOTIFY block */
function extractLinkConfig(workflowTemplate: any): {
  acceptOS: boolean;
  gpsNavigation: boolean;
  enRoute: boolean;
  validityHours: number;
  agendaMarginHours: number;
  pageLayout: any[];
  page2Layout: any[];
  onAccept:  ActionNotifyConfig;
  onGps:     ActionNotifyConfig;
  onEnRoute: ActionNotifyConfig;
} | null {
  const steps = workflowTemplate?.steps as any;
  if (!steps) return null;
  const blocks = steps?.version === 2 ? steps.blocks : (steps?.blocks || []);
  for (const block of blocks) {
    if (block.type !== 'NOTIFY') continue;
    const recipients = block.config?.recipients;
    if (!Array.isArray(recipients)) continue;
    const techRecipient = recipients.find((r: any) => r.type === 'TECNICO' && r.includeLink);
    if (techRecipient?.linkConfig) {
      const lc = techRecipient.linkConfig;
      return {
        acceptOS: lc.acceptOS ?? true,
        gpsNavigation: lc.gpsNavigation ?? false,
        enRoute: lc.enRoute ?? false,
        validityHours: lc.validityHours || 24,
        agendaMarginHours: lc.agendaMarginHours ?? 24,
        pageLayout: lc.pageLayout || [],
        page2Layout: lc.page2Layout || [],
        onAccept:  { notifyGestor: { ...DEFAULT_ACTION_NOTIFY.notifyGestor, ...lc.onAccept?.notifyGestor }, notifyCliente: { ...DEFAULT_ACTION_NOTIFY.notifyCliente, ...lc.onAccept?.notifyCliente } },
        onGps:     { notifyGestor: { ...DEFAULT_ACTION_NOTIFY.notifyGestor, ...lc.onGps?.notifyGestor }, notifyCliente: { ...DEFAULT_ACTION_NOTIFY.notifyCliente, ...lc.onGps?.notifyCliente } },
        onEnRoute: { notifyGestor: { ...DEFAULT_ACTION_NOTIFY.notifyGestor, ...lc.onEnRoute?.notifyGestor }, notifyCliente: { ...DEFAULT_ACTION_NOTIFY.notifyCliente, ...lc.onEnRoute?.notifyCliente } },
      };
    }
  }
  return null;
}

/**
 * Extract checklist configuration from workflow template blocks.
 * Returns a map of checklistClass → { mode, required, notifyOnSkip } for the current stage.
 */
function extractChecklistConfig(workflowTemplate: any, currentStatus: string): Record<string, { mode: string; required: string; notifyOnSkip: boolean }> | null {
  const steps = workflowTemplate?.steps as any;
  if (!steps) return null;
  const blocks = steps?.version === 2 ? steps.blocks : (steps?.blocks || []);

  const result: Record<string, { mode: string; required: string; notifyOnSkip: boolean }> = {};

  for (const block of blocks) {
    if (block.type !== 'CHECKLIST') continue;
    // Match blocks for the current stage
    if (block.stage && block.stage !== currentStatus) continue;
    const cls = block.config?.checklistClass || block.checklistClass;
    if (!cls) continue;
    result[cls] = {
      mode: block.config?.mode || block.mode || 'ITEM_BY_ITEM',
      required: block.config?.required || block.required || 'REQUIRED',
      notifyOnSkip: block.config?.notifyOnSkip ?? block.notifyOnSkip ?? false,
    };
  }

  return Object.keys(result).length > 0 ? result : null;
}

@Injectable()
export class PublicOfferService {
  private readonly logger = new Logger(PublicOfferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly checklistResponseService: ChecklistResponseService,
  ) {}

  /**
   * Fire action-specific notifications (onAccept, onGps, onEnRoute).
   * Loads OS + related data for variable interpolation and recipient phone numbers.
   */
  private async fireActionNotifications(
    serviceOrderId: string,
    companyId: string,
    actionConfig: ActionNotifyConfig,
    actionType: string,
  ) {
    if (!actionConfig.notifyGestor.enabled && !actionConfig.notifyCliente.enabled) return;

    // Load OS with company, assigned tech, and client for phone/variable data
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        company: true,
        assignedPartner: true,
        clientPartner: true,
      },
    });
    if (!so) return;

    const techName = so.assignedPartner?.name || 'Técnico';
    const vars: Record<string, string> = {
      '{titulo}': so.title || '',
      '{tecnico}': techName,
      '{endereco}': so.addressText || '',
      '{empresa}': so.company?.name || '',
      '{cliente}': so.clientPartner?.name || '',
    };
    const interpolate = (msg: string) => {
      let result = msg;
      for (const [key, val] of Object.entries(vars)) {
        result = result.split(key).join(val);
      }
      return result;
    };

    // Notify gestor
    if (actionConfig.notifyGestor.enabled && actionConfig.notifyGestor.message) {
      const gestorPhone = so.company?.phone || so.company?.ownerPhone;
      if (gestorPhone) {
        this.notifications.send({
          companyId,
          serviceOrderId,
          channel: actionConfig.notifyGestor.channel,
          recipientPhone: gestorPhone,
          message: interpolate(actionConfig.notifyGestor.message),
          type: `LINK_ACTION_${actionType}_GESTOR`,
          forceTemplate: true,
        }).catch(err => this.logger.error(`Action notify gestor error: ${err.message}`));
      }
    }

    // Notify client
    if (actionConfig.notifyCliente.enabled && actionConfig.notifyCliente.message) {
      const clientPhone = so.clientPartner?.phone;
      if (clientPhone) {
        this.notifications.send({
          companyId,
          serviceOrderId,
          channel: actionConfig.notifyCliente.channel,
          recipientPhone: clientPhone,
          message: interpolate(actionConfig.notifyCliente.message),
          type: `LINK_ACTION_${actionType}_CLIENTE`,
          forceTemplate: true,
        }).catch(err => this.logger.error(`Action notify client error: ${err.message}`));
      }
    }
  }

  /**
   * Resolve the assigned technician for a revoked offer (post-acceptance).
   * Uses assignedPartnerId from the service order instead of phone lookup.
   */
  private async resolveAssignedTech(token: string) {
    const offer = await this.prisma.serviceOrderOffer.findFirst({
      where: { token, revokedAt: { not: null } },
      include: { serviceOrder: { include: { workflowTemplate: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!offer) throw new NotFoundException('Oferta não encontrada');
    // Block access if OS was deleted or cancelled
    if (offer.serviceOrder.deletedAt || offer.serviceOrder.status === 'CANCELADA') {
      throw new NotFoundException('Esta ordem de serviço não está mais disponível.');
    }
    if (!offer.serviceOrder.assignedPartnerId) {
      throw new BadRequestException('OS sem técnico atribuído');
    }
    return { offer, technicianId: offer.serviceOrder.assignedPartnerId };
  }

  /** Get technicians eligible for a service order based on workflow specializations */
  async getEligibleTechnicians(serviceOrderId: string, companyId: string) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, companyId, deletedAt: null },
      include: { workflowTemplate: true },
    });
    if (!so) throw new NotFoundException('OS não encontrada');

    const requiredSpecIds = (so.workflowTemplate?.requiredSpecializationIds as string[]) || [];

    const where: any = {
      companyId,
      deletedAt: null,
      status: 'ATIVO',
      partnerTypes: { has: 'TECNICO' },
    };

    if (requiredSpecIds.length > 0) {
      where.AND = requiredSpecIds.map((sid: string) => ({
        specializations: { some: { specializationId: sid } },
      }));
    }

    return this.prisma.partner.findMany({
      where,
      include: {
        specializations: { include: { specialization: true } },
        _count: { select: { serviceOrders: true } },
      },
      orderBy: { rating: 'desc' },
    });
  }

  async createOffer(serviceOrderId: string, companyId: string, hoursValid = 2) {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000);

    return this.prisma.serviceOrderOffer.create({
      data: {
        serviceOrderId,
        companyId,
        channel: 'PUBLIC_LINK',
        token,
        expiresAt,
      },
    });
  }

  async getOfferByToken(token: string, accessKey?: string) {
    // First try: active (non-revoked, non-expired) offer — anyone with the link can see
    let offer = await this.prisma.serviceOrderOffer.findFirst({
      where: {
        token,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        serviceOrder: {
          include: { company: true },
        },
      },
    });

    if (offer) {
      // Check if the service order was deleted or cancelled
      if (offer.serviceOrder.deletedAt || offer.serviceOrder.status === 'CANCELADA') {
        throw new NotFoundException('Esta ordem de serviço não está mais disponível.');
      }
      return offer;
    }

    // Second try: revoked offer (already accepted) — requires accessKey
    offer = await this.prisma.serviceOrderOffer.findFirst({
      where: {
        token,
        revokedAt: { not: null },
      },
      include: {
        serviceOrder: {
          include: { company: true },
        },
      },
    });

    if (!offer) throw new NotFoundException('Oferta inválida ou expirada');

    // Check if the service order was deleted or cancelled
    if (offer.serviceOrder.deletedAt || offer.serviceOrder.status === 'CANCELADA') {
      throw new NotFoundException('Esta ordem de serviço não está mais disponível.');
    }

    // Validate accessKey for revoked offers
    const expectedKey = generateAccessKey(token);
    if (!accessKey || accessKey !== expectedKey) {
      throw new NotFoundException('Esta oferta já foi aceita por outro técnico.');
    }

    return offer;
  }

  async getPublicView(
    token: string,
    baseUrl: string,
    technicianLat?: number,
    technicianLng?: number,
    accessKey?: string,
  ) {
    const offer = await this.getOfferByToken(token, accessKey);

    // Load workflow template for linkConfig + service items for checklists
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: offer.serviceOrderId },
      include: {
        workflowTemplate: true,
        items: { include: { service: { select: { id: true, name: true, checklists: true } } } },
        clientPartner: { select: { name: true } },
      },
    });

    let distanceMeters: number | null = null;

    if (
      typeof technicianLat === 'number' &&
      typeof technicianLng === 'number' &&
      offer.serviceOrder.lat != null &&
      offer.serviceOrder.lng != null
    ) {
      distanceMeters = haversineMeters(
        technicianLat,
        technicianLng,
        offer.serviceOrder.lat,
        offer.serviceOrder.lng,
      );
    }

    const acceptUrl = `${baseUrl.replace(/\/+$/, '')}/p/${offer.token}/accept`;
    const requestOtpUrl = `${baseUrl.replace(
      /\/+$/,
      '',
    )}/p/${offer.token}/request-otp`;

    const isAccepted = offer.revokedAt != null && offer.serviceOrder.acceptedAt != null;

    // Extract linkConfig from workflow
    const linkConfig = extractLinkConfig(so?.workflowTemplate);

    return {
      offer: {
        token: offer.token,
        expiresAt: offer.expiresAt,
        channel: offer.channel,
        accepted: isAccepted,
      },
      company: {
        id: offer.serviceOrder.company.id,
        name: offer.serviceOrder.company.name,
      },
      serviceOrder: {
        id: offer.serviceOrder.id,
        title: offer.serviceOrder.title,
        description: offer.serviceOrder.description,
        addressText: offer.serviceOrder.addressText,
        lat: offer.serviceOrder.lat,
        lng: offer.serviceOrder.lng,
        valueCents: offer.serviceOrder.valueCents,
        deadlineAt: offer.serviceOrder.deadlineAt,
        status: offer.serviceOrder.status,
        city: so?.city || null,
        state: so?.state || null,
        contactPersonName: so?.contactPersonName || null,
        clientPartnerName: so?.clientPartner?.name || null,
        commissionCents: so?.items?.reduce((sum, item) => {
          const bps = item.commissionBps || 0;
          return sum + Math.round((item.unitPriceCents * item.quantity * bps) / 10000);
        }, 0) || 0,
      },
      distance: distanceMeters !== null
        ? {
            meters: Math.round(distanceMeters),
            km: Math.round((distanceMeters / 1000) * 100) / 100,
          }
        : null,
      otp: {
        requestOtpUrl,
        acceptUrl,
      },
      linkConfig: linkConfig || { acceptOS: true, gpsNavigation: false, enRoute: false, validityHours: 24, agendaMarginHours: 24, pageLayout: [], page2Layout: [], onAccept: DEFAULT_ACTION_NOTIFY, onGps: DEFAULT_ACTION_NOTIFY, onEnRoute: DEFAULT_ACTION_NOTIFY },
      // State flags for returning visitors
      enRouteAt: so?.enRouteAt?.toISOString() || null,
      trackingStartedAt: so?.trackingStartedAt?.toISOString() || null,
      // Aggregated checklists from all services in the OS, filtered by pageLayout
      checklists: this.filterChecklistsByLayout(
        this.aggregateServiceChecklists(so?.items || []),
        linkConfig?.pageLayout || [],
      ),
      // Checklist config from workflow template (mode, required, notifyOnSkip per class)
      checklistConfig: extractChecklistConfig(so?.workflowTemplate, offer.serviceOrder.status),
      // Already submitted checklist responses
      checklistResponses: await this.getChecklistResponses(offer.companyId, offer.serviceOrderId),
    };
  }

  async requestOtp(token: string, phone: string) {
    const offer = await this.getOfferByToken(token);

    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) throw new BadRequestException('Telefone inválido');

    const technician = await this.prisma.partner.findFirst({
      where: {
        companyId: offer.companyId,
        phone: phoneNorm,
        deletedAt: null,
        partnerTypes: { has: 'TECNICO' },
      },
      select: { id: true, companyId: true },
    });

    if (!technician) throw new NotFoundException('Técnico não encontrado');

    const code = generateOtp6();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otp = await this.prisma.otpCode.create({
      data: {
        companyId: technician.companyId,
        partnerId: technician.id,
        serviceOrderId: offer.serviceOrderId,
        codeHash: hashOtp(code),
        expiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    // Send OTP via WhatsApp
    try {
      if (this.notifications) {
        await this.notifications.send({
          companyId: technician.companyId,
          channel: 'WHATSAPP',
          message: `Seu código de verificação Tecnikos: ${code}. Válido por 10 minutos.`,
          type: 'OTP',
          recipientPhone: phoneNorm,
          forceTemplate: true,
        });
        this.logger.log(`[OTP] Code sent via WhatsApp to ${phoneNorm}`);
      } else {
        this.logger.warn(`[OTP] NotificationService not available, code=${code}`);
      }
    } catch (err: any) {
      this.logger.warn(`[OTP] Failed to send via WhatsApp: ${err.message}`);
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[OTP-DEV] code=${code} partnerId=${technician.id}`);
    }

    return {
      otpId: otp.id,
      expiresAt: otp.expiresAt,
    };
  }

  /**
   * Accept offer directly — no OTP required.
   * The link token itself is the authentication (UUID v4, expires, single-use).
   */
  async acceptDirect(token: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const offer = await tx.serviceOrderOffer.findFirst({
          where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true, serviceOrderId: true, companyId: true },
        });
        if (!offer) throw new NotFoundException('Oferta inválida ou expirada');

        const so = await tx.serviceOrder.findUnique({
          where: { id: offer.serviceOrderId },
          select: { assignedPartnerId: true, status: true, acceptedAt: true, directedTechnicianIds: true, techAssignmentMode: true },
        });

        const now = new Date();

        // If OS already has technician assigned (BY_AGENDA), just mark accepted
        if (so?.assignedPartnerId && !so.acceptedAt) {
          await tx.serviceOrder.update({
            where: { id: offer.serviceOrderId },
            data: { acceptedAt: now, status: ServiceOrderStatus.ATRIBUIDA },
          });
        } else if (!so?.assignedPartnerId) {
          // DIRECTED mode — assign first directed technician
          const directedIds = so?.directedTechnicianIds || [];
          if (directedIds.length > 0) {
            await tx.serviceOrder.update({
              where: { id: offer.serviceOrderId },
              data: {
                assignedPartnerId: directedIds[0],
                acceptedAt: now,
                status: ServiceOrderStatus.ATRIBUIDA,
              },
            });
          } else {
            throw new BadRequestException('Técnico não atribuído a esta OS');
          }
        }

        // Revoke all offers for this OS
        await tx.serviceOrderOffer.updateMany({
          where: { serviceOrderId: offer.serviceOrderId, revokedAt: null },
          data: { revokedAt: now },
        });

        const serviceOrder = await tx.serviceOrder.findUnique({
          where: { id: offer.serviceOrderId },
          include: { workflowTemplate: true },
        });

        const acceptedOffer = await tx.serviceOrderOffer.findUnique({
          where: { id: offer.id },
        });

        // Check workflow for ARRIVAL_QUESTION block
        let arrivalQuestion: any = null;
        if (serviceOrder?.workflowTemplate) {
          const def = serviceOrder.workflowTemplate.steps as any;
          const blocks = def?.version === 2 ? def.blocks : (def?.blocks || []);
          const arrivalBlock = blocks?.find((b: any) => b.type === 'ARRIVAL_QUESTION');
          if (arrivalBlock) {
            arrivalQuestion = {
              blockId: arrivalBlock.id,
              question: arrivalBlock.config?.question || 'Quanto tempo até você estar a caminho?',
              options: arrivalBlock.config?.options || [],
              onDecline: arrivalBlock.config?.onDecline || 'notify_gestor',
              useAsDynamicTimeout: arrivalBlock.config?.useAsDynamicTimeout ?? false,
              enRouteTimeoutMinutes: (serviceOrder as any).enRouteTimeoutMinutes || null,
            };
          }
        }

        // Extract linkConfig for action notifications
        const linkConfig = serviceOrder?.workflowTemplate ? extractLinkConfig(serviceOrder.workflowTemplate) : null;

        const { workflowTemplate, ...soData } = serviceOrder || {} as any;
        const accessKey = generateAccessKey(token);
        return { serviceOrder: soData, offer: acceptedOffer, arrivalQuestion, accessKey, _notifyConfig: linkConfig?.onAccept, _companyId: offer.companyId, _soId: offer.serviceOrderId };
      },
      { isolationLevel: 'Serializable' },
    );

    // Fire onAccept notifications outside transaction (fire-and-forget)
    if (result._notifyConfig) {
      this.fireActionNotifications(result._soId, result._companyId, result._notifyConfig, 'ACCEPT');
    }
    const { _notifyConfig, _companyId, _soId, ...response } = result;
    return response;
  }

  /**
   * Mark technician as "en route" (a caminho).
   * Generates an accessKey to lock the link to the device.
   */
  async markEnRoute(token: string) {
    // Find the accepted (revoked) offer
    const offer = await this.prisma.serviceOrderOffer.findFirst({
      where: { token, revokedAt: { not: null } },
      include: { serviceOrder: { include: { workflowTemplate: true } } },
    });

    // If no revoked offer, try active offer (acceptOS=false mode — no accept step)
    const activeOffer = offer || await this.prisma.serviceOrderOffer.findFirst({
      where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { serviceOrder: { include: { workflowTemplate: true } } },
    });

    if (!activeOffer) throw new NotFoundException('Oferta não encontrada');

    // Block access if OS was deleted or cancelled
    if (activeOffer.serviceOrder.deletedAt || activeOffer.serviceOrder.status === 'CANCELADA') {
      throw new NotFoundException('Esta ordem de serviço não está mais disponível.');
    }

    // Update en-route timestamp on the service order
    await this.prisma.serviceOrder.update({
      where: { id: activeOffer.serviceOrderId },
      data: { enRouteAt: new Date() },
    });

    // Fire onEnRoute notifications (fire-and-forget)
    const linkConfig = activeOffer.serviceOrder.workflowTemplate
      ? extractLinkConfig(activeOffer.serviceOrder.workflowTemplate)
      : null;
    if (linkConfig?.onEnRoute) {
      this.fireActionNotifications(activeOffer.serviceOrderId, activeOffer.companyId, linkConfig.onEnRoute, 'EN_ROUTE');
    }

    const accessKey = generateAccessKey(token);
    return { success: true, accessKey, enRouteAt: new Date().toISOString() };
  }

  async acceptWithOtp(token: string, phone: string, code: string) {
    const phoneNorm = normalizePhone(phone);
    const codeNorm = String(code || '').replace(/\D/g, '');

    if (!phoneNorm) throw new BadRequestException('Telefone inválido');
    if (codeNorm.length !== 6) throw new BadRequestException('OTP inválido');

    return this.prisma.$transaction(
      async (tx) => {
        const offer = await tx.serviceOrderOffer.findFirst({
          where: {
            token,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            serviceOrderId: true,
            companyId: true,
          },
        });

        if (!offer) throw new NotFoundException('Oferta inválida ou expirada');

        const technician = await tx.partner.findFirst({
          where: {
            companyId: offer.companyId,
            phone: phoneNorm,
            deletedAt: null,
            partnerTypes: { has: 'TECNICO' },
          },
          select: { id: true, companyId: true },
        });

        if (!technician) throw new NotFoundException('Técnico não encontrado');

        const otp = await tx.otpCode.findFirst({
          where: {
            companyId: technician.companyId,
            partnerId: technician.id,
            serviceOrderId: offer.serviceOrderId,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            codeHash: true,
            attempts: true,
          },
        });

        if (!otp) throw new BadRequestException('OTP expirado ou inexistente');
        if (otp.attempts >= 5) throw new BadRequestException('OTP bloqueado');

        const ok = verifyOtp(codeNorm, otp.codeHash);
        if (!ok) {
          await tx.otpCode.update({
            where: { id: otp.id },
            data: { attempts: { increment: 1 } },
          });
          throw new BadRequestException('OTP inválido');
        }

        const now = new Date();

        await tx.otpCode.update({
          where: { id: otp.id },
          data: { consumedAt: now },
        });

        const updated = await tx.serviceOrder.updateMany({
          where: {
            id: offer.serviceOrderId,
            companyId: offer.companyId,
            deletedAt: null,
            status: ServiceOrderStatus.ABERTA,
            assignedPartnerId: null,
            acceptedAt: null,
          },
          data: {
            assignedPartnerId: technician.id,
            acceptedAt: now,
            status: ServiceOrderStatus.ATRIBUIDA,
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException('Ordem já atribuída');
        }

        await tx.serviceOrderOffer.updateMany({
          where: {
            serviceOrderId: offer.serviceOrderId,
            revokedAt: null,
          },
          data: { revokedAt: now },
        });

        const serviceOrder = await tx.serviceOrder.findUnique({
          where: { id: offer.serviceOrderId },
          include: { workflowTemplate: true },
        });

        const acceptedOffer = await tx.serviceOrderOffer.findUnique({
          where: { id: offer.id },
        });

        // Check workflow for ARRIVAL_QUESTION block
        let arrivalQuestion: any = null;
        if (serviceOrder?.workflowTemplate) {
          const def = serviceOrder.workflowTemplate.steps as any;
          const blocks = def?.version === 2 ? def.blocks : (def?.blocks || []);
          const arrivalBlock = blocks?.find((b: any) => b.type === 'ARRIVAL_QUESTION');
          if (arrivalBlock) {
            arrivalQuestion = {
              blockId: arrivalBlock.id,
              question: arrivalBlock.config?.question || 'Quanto tempo até você estar a caminho?',
              options: arrivalBlock.config?.options || [],
              onDecline: arrivalBlock.config?.onDecline || 'notify_gestor',
              useAsDynamicTimeout: arrivalBlock.config?.useAsDynamicTimeout ?? false,
              enRouteTimeoutMinutes: (serviceOrder as any).enRouteTimeoutMinutes || null,
            };
          }
        }

        // Strip workflow template from response (large JSON)
        const { workflowTemplate, ...soData } = serviceOrder || {} as any;

        return { serviceOrder: soData, offer: acceptedOffer, arrivalQuestion };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /** Submit arrival time after accepting an offer */
  async submitArrivalTime(token: string, phone: string | undefined, selectedMinutes: number) {
    if (typeof selectedMinutes !== 'number' || selectedMinutes < 1) {
      throw new BadRequestException('Informe um tempo estimado válido.');
    }

    // Find recently accepted offer by token (revoked after acceptance)
    const offer = await this.prisma.serviceOrderOffer.findFirst({
      where: { token, revokedAt: { not: null } },
      include: { serviceOrder: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!offer) throw new NotFoundException('Oferta não encontrada');

    // Verify OS has an assigned technician
    if (!offer.serviceOrder.assignedPartnerId) {
      throw new BadRequestException('OS sem técnico atribuído');
    }

    // Validate against enRouteTimeout
    const enRouteLimit = (offer.serviceOrder as any).enRouteTimeoutMinutes;
    if (enRouteLimit && selectedMinutes > enRouteLimit) {
      throw new BadRequestException(
        `O tempo informado (${selectedMinutes} min) excede o prazo de ${enRouteLimit} minutos para ir a caminho. ` +
        `Informe um tempo menor ou clique em "Não vou poder atender".`,
      );
    }

    // Save estimatedArrivalMinutes
    await this.prisma.serviceOrder.update({
      where: { id: offer.serviceOrderId },
      data: { estimatedArrivalMinutes: selectedMinutes } as any,
    });

    return { success: true, estimatedArrivalMinutes: selectedMinutes };
  }

  /** Tech declines after acceptance (can't meet deadline) */
  async declineAfterAccept(token: string, _phone?: string) {
    const { offer } = await this.resolveAssignedTech(token);

    // Get onDecline action from workflow
    let onDecline = 'notify_gestor';
    if (offer.serviceOrder.workflowTemplate) {
      const def = offer.serviceOrder.workflowTemplate.steps as any;
      const blocks = def?.version === 2 ? def.blocks : (def?.blocks || []);
      const arrivalBlock = blocks?.find((b: any) => b.type === 'ARRIVAL_QUESTION');
      if (arrivalBlock?.config?.onDecline) {
        onDecline = arrivalBlock.config.onDecline;
      }
    }

    // Execute decline action
    switch (onDecline) {
      case 'return_offered':
        await this.prisma.serviceOrder.update({
          where: { id: offer.serviceOrderId },
          data: { status: ServiceOrderStatus.OFERTADA, assignedPartnerId: null, acceptedAt: null },
        });
        break;
      case 'reassign':
        await this.prisma.serviceOrder.update({
          where: { id: offer.serviceOrderId },
          data: { status: ServiceOrderStatus.ABERTA, assignedPartnerId: null, acceptedAt: null },
        });
        break;
      case 'cancel':
        await this.prisma.serviceOrder.update({
          where: { id: offer.serviceOrderId },
          data: { status: ServiceOrderStatus.CANCELADA },
        });
        break;
      case 'notify_gestor':
      default:
        // Mark decline — notification would be handled by engine/gestor
        break;
    }

    return { success: true, action: onDecline };
  }

  /** Start GPS tracking for a service order */
  async startTracking(token: string, _phone?: string) {
    const { offer, technicianId } = await this.resolveAssignedTech(token);
    const technician = { id: technicianId };

    // Get proximity config from workflow
    let proximityConfig: any = null;
    if (offer.serviceOrder.workflowTemplate) {
      const def = offer.serviceOrder.workflowTemplate.steps as any;
      const blocks = def?.version === 2 ? def.blocks : (def?.blocks || []);
      const proxBlock = blocks?.find((b: any) => b.type === 'PROXIMITY_TRIGGER');
      if (proxBlock?.config) {
        proximityConfig = proxBlock.config;
      }
    }

    // Use defaults if no PROXIMITY_TRIGGER block (gpsNavigation in linkConfig is enough)
    const radius = proximityConfig?.radiusMeters || 200;
    const interval = proximityConfig?.trackingIntervalSeconds || 30;
    const highAccuracy = proximityConfig?.requireHighAccuracy ?? true;
    const keepActive = proximityConfig?.keepActiveUntil || 'radius';

    // Mark tracking started
    await this.prisma.serviceOrder.update({
      where: { id: offer.serviceOrderId },
      data: {
        trackingStartedAt: new Date(),
        proximityRadiusMeters: radius,
      } as any,
    });

    // Fire onGps notifications (fire-and-forget)
    const linkConfig = offer.serviceOrder.workflowTemplate
      ? extractLinkConfig(offer.serviceOrder.workflowTemplate)
      : null;
    if (linkConfig?.onGps) {
      this.fireActionNotifications(offer.serviceOrderId, offer.companyId, linkConfig.onGps, 'GPS');
    }

    return {
      success: true,
      config: {
        radiusMeters: radius,
        trackingIntervalSeconds: interval,
        requireHighAccuracy: highAccuracy,
        keepActiveUntil: keepActive,
        targetLat: offer.serviceOrder.lat,
        targetLng: offer.serviceOrder.lng,
      },
      arrivalButton: proximityConfig?.arrivalButton ?? { enabled: true, updateAddressCoords: true, autoStartExecution: true },
    };
  }

  /** Receive position update from technician and check proximity */
  async submitPosition(
    token: string,
    _phone: string | undefined,
    lat: number,
    lng: number,
    accuracy?: number,
    speed?: number,
    heading?: number,
  ) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new BadRequestException('Coordenadas inválidas');
    }

    const offer = await this.prisma.serviceOrderOffer.findFirst({
      where: { token, revokedAt: { not: null } },
      include: {
        serviceOrder: {
          include: {
            workflowTemplate: true,
            assignedPartner: { select: { id: true, name: true, phone: true, email: true } },
            clientPartner: { select: { id: true, name: true, phone: true, email: true } },
            company: { select: { name: true, phone: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!offer) throw new NotFoundException('Oferta não encontrada');

    // Block access if OS was deleted or cancelled
    if (offer.serviceOrder.deletedAt || offer.serviceOrder.status === 'CANCELADA') {
      throw new NotFoundException('Esta ordem de serviço não está mais disponível.');
    }

    if (!offer.serviceOrder.assignedPartnerId) {
      throw new BadRequestException('OS sem técnico atribuído');
    }
    const technician = { id: offer.serviceOrder.assignedPartnerId };

    const so = offer.serviceOrder;

    // Calculate distance to target
    let distanceToTarget: number | null = null;
    if (so.lat != null && so.lng != null) {
      distanceToTarget = haversineMeters(lat, lng, so.lat, so.lng);
    }

    // Save position log
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "TechnicianLocationLog" ("id", "companyId", "serviceOrderId", "partnerId", "lat", "lng", "accuracy", "speed", "heading", "distanceToTarget")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      offer.companyId,
      so.id,
      technician.id,
      lat,
      lng,
      accuracy ?? null,
      speed ?? null,
      heading ?? null,
      distanceToTarget,
    );

    // Check proximity
    const radiusMeters = (so as any).proximityRadiusMeters || 200;
    const alreadyEntered = (so as any).proximityEnteredAt != null;
    let proximityReached = false;

    if (distanceToTarget !== null && distanceToTarget <= radiusMeters && !alreadyEntered) {
      // FIRST TIME entering radius — trigger events
      await this.prisma.serviceOrder.update({
        where: { id: so.id },
        data: { proximityEnteredAt: new Date() } as any,
      });
      proximityReached = true;

      this.logger.log(
        `📍 PROXIMITY: Tech ${technician.id} entered radius (${Math.round(distanceToTarget)}m <= ${radiusMeters}m) for SO ${so.id}`,
      );

      // Execute onEnterRadius events (fire-and-forget)
      this.executeOnEnterRadius(so, offer.companyId, distanceToTarget).catch((err) =>
        this.logger.error(`onEnterRadius failed for SO ${so.id}: ${(err as Error).message}`),
      );
    }

    return {
      distanceMeters: distanceToTarget !== null ? Math.round(distanceToTarget) : null,
      distanceKm: distanceToTarget !== null ? Math.round((distanceToTarget / 1000) * 100) / 100 : null,
      proximityReached,
      radiusMeters,
    };
  }

  /** Get proximity tracking config for a token (used by frontend to check if tracking is available) */
  async getTrackingConfig(token: string) {
    const offer = await this.prisma.serviceOrderOffer.findFirst({
      where: { token, revokedAt: { not: null } },
      include: { serviceOrder: { include: { workflowTemplate: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!offer) throw new NotFoundException('Oferta não encontrada');
    if (offer.serviceOrder.deletedAt || offer.serviceOrder.status === 'CANCELADA') {
      throw new NotFoundException('Esta ordem de serviço não está mais disponível.');
    }

    let proximityConfig: any = null;
    if (offer.serviceOrder.workflowTemplate) {
      const def = offer.serviceOrder.workflowTemplate.steps as any;
      const blocks = def?.version === 2 ? def.blocks : (def?.blocks || []);
      const proxBlock = blocks?.find((b: any) => b.type === 'PROXIMITY_TRIGGER');
      if (proxBlock?.config) {
        proximityConfig = proxBlock.config;
      }
    }

    return {
      enabled: !!proximityConfig,
      config: proximityConfig
        ? {
            radiusMeters: proximityConfig.radiusMeters || 200,
            trackingIntervalSeconds: proximityConfig.trackingIntervalSeconds || 30,
            requireHighAccuracy: proximityConfig.requireHighAccuracy ?? true,
            keepActiveUntil: proximityConfig.keepActiveUntil || 'radius',
          }
        : null,
      arrivalButton: proximityConfig?.arrivalButton ?? { enabled: true, updateAddressCoords: true, autoStartExecution: true },
      target: {
        lat: offer.serviceOrder.lat,
        lng: offer.serviceOrder.lng,
      },
      trackingStartedAt: (offer.serviceOrder as any).trackingStartedAt || null,
      proximityEnteredAt: (offer.serviceOrder as any).proximityEnteredAt || null,
    };
  }

  /* ── onEnterRadius: execute proximity trigger events ── */

  private async executeOnEnterRadius(
    so: any,
    companyId: string,
    distanceMeters: number,
  ): Promise<void> {
    // Get onEnterRadius config from workflow
    const def = so.workflowTemplate?.steps as any;
    if (!def) return;
    const blocks = def?.version === 2 ? def.blocks : (def?.blocks || []);
    const proxBlock = blocks?.find((b: any) => b.type === 'PROXIMITY_TRIGGER');
    if (!proxBlock?.config?.onEnterRadius) return;

    const onEnter = proxBlock.config.onEnterRadius;
    const distStr = distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km`
      : `${Math.round(distanceMeters)} m`;

    // Build variable map for message substitution
    const vars: Record<string, string> = {
      '{titulo}': so.title || '',
      '{tecnico}': so.assignedPartner?.name || '',
      '{tecnico_telefone}': so.assignedPartner?.phone || '',
      '{cliente}': so.clientPartner?.name || '',
      '{cliente_telefone}': so.clientPartner?.phone || '',
      '{empresa}': so.company?.name || '',
      '{endereco}': so.addressText || '',
      '{distancia_tecnico}': distStr,
      '{status}': so.status || '',
    };

    const replaceVars = (text: string): string => {
      let result = text;
      for (const [key, val] of Object.entries(vars)) {
        result = result.split(key).join(val);
      }
      return result;
    };

    // 1. Notify client
    if (onEnter.notifyCliente?.enabled) {
      const msg = replaceVars(onEnter.notifyCliente.message || `O técnico ${vars['{tecnico}']} está chegando!`);
      await this.notifications.send({
        companyId,
        serviceOrderId: so.id,
        channel: onEnter.notifyCliente.channel || 'WHATSAPP',
        message: msg,
        type: 'PROXIMITY_ENTER',
        recipientPhone: so.clientPartner?.phone || undefined,
        recipientEmail: so.clientPartner?.email || undefined,
      }).catch((err) => this.logger.error(`Notify client failed: ${(err as Error).message}`));
    }

    // 2. Notify gestor
    if (onEnter.notifyGestor?.enabled) {
      const msg = replaceVars(onEnter.notifyGestor.message || `Técnico ${vars['{tecnico}']} chegou na região da OS ${vars['{titulo}']}`);
      await this.notifications.send({
        companyId,
        serviceOrderId: so.id,
        channel: onEnter.notifyGestor.channel || 'WHATSAPP',
        message: msg,
        type: 'PROXIMITY_ENTER',
        recipientPhone: so.company?.phone || undefined,
        recipientEmail: so.company?.email || undefined,
      }).catch((err) => this.logger.error(`Notify gestor failed: ${(err as Error).message}`));
    }

    // 3. Auto-start execution (change status to EM_EXECUCAO)
    if (onEnter.autoStartExecution) {
      const currentStatus = so.status;
      if (['ATRIBUIDA', 'A_CAMINHO'].includes(currentStatus)) {
        await this.prisma.serviceOrder.update({
          where: { id: so.id },
          data: { status: ServiceOrderStatus.EM_EXECUCAO, startedAt: new Date() },
        });
        this.logger.log(`🚀 PROXIMITY: Auto-started execution for SO ${so.id}`);

        // Create event
        await this.prisma.serviceOrderEvent.create({
          data: {
            companyId,
            serviceOrderId: so.id,
            type: 'PROXIMITY_AUTO_START',
            actorType: 'SYSTEM',
            actorId: null,
            payload: { distanceMeters: Math.round(distanceMeters), previousStatus: currentStatus },
          },
        });
      }
    }

    // 4. Dashboard alert
    if (onEnter.alert?.enabled) {
      const alertMsg = replaceVars(onEnter.alert.message || `Técnico ${vars['{tecnico}']} chegou na região`);
      await this.prisma.notification.create({
        data: {
          companyId,
          serviceOrderId: so.id,
          channel: 'MOCK',
          message: `[PROXIMITY] ${alertMsg}`,
          type: 'PROXIMITY_ALERT',
          status: 'SENT',
          sentAt: new Date(),
        },
      }).catch((err) => this.logger.error(`Alert creation failed: ${(err as Error).message}`));
    }
  }

  /* ================================================================ */
  /*  ARRIVAL BUTTON (v1.03.19)                                      */
  /* ================================================================ */

  async markArrived(token: string, phone: string, lat: number, lng: number) {
    const offer = await this.prisma.serviceOrderOffer.findUnique({ where: { token } });
    if (!offer) throw new NotFoundException('Token inválido');
    const so = await this.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: offer.serviceOrderId },
      include: { workflowTemplate: true, assignedPartner: true, clientPartner: true, company: true },
    });
    if (so.deletedAt || so.status === 'CANCELADA') {
      throw new NotFoundException('Esta ordem de serviço não está mais disponível.');
    }

    // Get arrivalButton config from workflow
    const def = so.workflowTemplate?.steps as any;
    const blocks = def?.version === 2 ? def.blocks : (def?.blocks || []);
    const proxBlock = blocks?.find((b: any) => b.type === 'PROXIMITY_TRIGGER');
    const arrivalCfg = proxBlock?.config?.arrivalButton || { enabled: true, updateAddressCoords: true, autoStartExecution: true };

    if (!arrivalCfg.enabled) {
      throw new BadRequestException('Botão "Cheguei" não está habilitado neste fluxo.');
    }

    const now = new Date();

    // 1. Update service order coordinates
    const soUpdateData: any = {
      lat,
      lng,
      arrivedAt: now,
    };

    // 2. Auto-start execution if configured
    if (arrivalCfg.autoStartExecution && ['ATRIBUIDA', 'A_CAMINHO'].includes(so.status)) {
      soUpdateData.status = ServiceOrderStatus.EM_EXECUCAO;
      soUpdateData.startedAt = so.startedAt || now;
    }

    await this.prisma.serviceOrder.update({
      where: { id: so.id },
      data: soUpdateData,
    });

    // 3. Update address coordinates on partner's ServiceAddress (if configured)
    if (arrivalCfg.updateAddressCoords && so.clientPartnerId) {
      try {
        // Find matching ServiceAddress by street+number+city
        const matchingAddress = await this.prisma.serviceAddress.findFirst({
          where: {
            companyId: so.companyId,
            partnerId: so.clientPartnerId,
            addressStreet: so.addressStreet || undefined,
            addressNumber: so.addressNumber || undefined,
            city: so.city || undefined,
            active: true,
          },
        });

        if (matchingAddress) {
          await this.prisma.serviceAddress.update({
            where: { id: matchingAddress.id },
            data: { lat, lng },
          });
          this.logger.log(`📍 ARRIVAL: Updated ServiceAddress ${matchingAddress.id} coords → ${lat}, ${lng}`);
        }
      } catch (err) {
        this.logger.error(`Failed to update ServiceAddress coords: ${(err as Error).message}`);
      }
    }

    // 4. Create event
    await this.prisma.serviceOrderEvent.create({
      data: {
        companyId: so.companyId,
        serviceOrderId: so.id,
        type: 'TECH_ARRIVED',
        actorType: 'TECHNICIAN',
        actorId: so.assignedPartnerId,
        payload: {
          lat,
          lng,
          previousStatus: so.status,
          newStatus: soUpdateData.status || so.status,
          addressUpdated: arrivalCfg.updateAddressCoords,
        },
      },
    });

    // 5. Notifications
    const vars: Record<string, string> = {
      '{titulo}': so.title || '',
      '{tecnico}': so.assignedPartner?.name || '',
      '{cliente}': so.clientPartner?.name || (so as any).contactPersonName || '',
      '{empresa}': so.company?.name || '',
      '{endereco}': so.addressText || '',
    };
    const replaceVars = (text: string): string => {
      let result = text;
      for (const [k, v] of Object.entries(vars)) result = result.split(k).join(v);
      return result;
    };

    if (arrivalCfg.notifyCliente?.enabled) {
      const msg = replaceVars(arrivalCfg.notifyCliente.message || `O técnico ${vars['{tecnico}']} chegou ao local!`);
      this.notifications.send({
        companyId: so.companyId,
        serviceOrderId: so.id,
        channel: arrivalCfg.notifyCliente.channel || 'WHATSAPP',
        message: msg,
        type: 'TECH_ARRIVED',
        recipientPhone: so.clientPartner?.phone || undefined,
        recipientEmail: so.clientPartner?.email || undefined,
      }).catch((err) => this.logger.error(`Notify client on arrival failed: ${(err as Error).message}`));
    }

    if (arrivalCfg.notifyGestor?.enabled) {
      const msg = replaceVars(arrivalCfg.notifyGestor.message || `Técnico ${vars['{tecnico}']} chegou ao local — OS: ${vars['{titulo}']}`);
      this.notifications.send({
        companyId: so.companyId,
        serviceOrderId: so.id,
        channel: arrivalCfg.notifyGestor.channel || 'WHATSAPP',
        message: msg,
        type: 'TECH_ARRIVED',
        recipientPhone: so.company?.phone || undefined,
        recipientEmail: so.company?.email || undefined,
      }).catch((err) => this.logger.error(`Notify gestor on arrival failed: ${(err as Error).message}`));
    }

    this.logger.log(`📍 ARRIVAL: Tech arrived at SO ${so.id} (${lat}, ${lng})`);

    return {
      ok: true,
      autoStarted: !!soUpdateData.status,
      addressCoordsUpdated: arrivalCfg.updateAddressCoords,
    };
  }

  /* ================================================================ */
  /*  PAUSE SYSTEM (v1.00.42)                                        */
  /* ================================================================ */

  /** Find OS by offer token (reusable helper) */
  private async findOsByToken(token: string) {
    const offer = await this.prisma.serviceOrderOffer.findUnique({ where: { token } });
    if (!offer) throw new Error('Token inválido');
    const so = await this.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: offer.serviceOrderId },
      include: { workflowTemplate: true, assignedPartner: true, company: true },
    });
    // Block access if OS was deleted or cancelled
    if (so.deletedAt || so.status === 'CANCELADA') {
      throw new NotFoundException('Esta ordem de serviço não está mais disponível.');
    }
    return so;
  }

  /** Get pause config from workflow template */
  /** Map of pause reason categories to human-readable PT-BR labels */
  private static readonly PAUSE_REASON_LABELS: Record<string, string> = {
    meal_break: 'Intervalo para refeição',
    end_of_day: 'Encerramento do expediente',
    fetch_materials: 'Buscar material/peças',
    weather: 'Condições climáticas',
    waiting_client: 'Aguardando cliente',
    waiting_utilities: 'Aguardando energia/utilidades',
    waiting_access: 'Aguardando liberação de acesso',
    waiting_other_service: 'Aguardando outro serviço',
    personal: 'Motivo pessoal',
    other: 'Outro',
  };

  private getPauseConfig(so: any): any | null {
    const wf = so.workflowTemplate;
    if (!wf?.steps) return null;
    const steps = wf.steps as any;
    if (steps?.version !== 2 || !Array.isArray(steps.blocks)) return null;
    const pauseBlock = steps.blocks.find((b: any) => b.type === 'PAUSE_SYSTEM');
    return pauseBlock?.config || null;
  }

  /** Get photo requirements from PHOTO_REQUIREMENTS block for a specific moment */
  private getPhotoRequirement(so: any, moment: string): { minPhotos: number; required: boolean } | null {
    const wf = so.workflowTemplate;
    if (!wf?.steps) return null;
    const steps = wf.steps as any;
    if (steps?.version !== 2 || !Array.isArray(steps.blocks)) return null;
    const photoBlock = steps.blocks.find((b: any) => b.type === 'PHOTO_REQUIREMENTS');
    if (!photoBlock?.config?.groups) return null;
    const group = photoBlock.config.groups.find((g: any) => g.moment === moment);
    if (!group || !group.required) return null;
    return { minPhotos: group.minPhotos || 1, required: true };
  }

  /** Send rich notifications for pause events (gestor/cliente/técnico with channel + message) */
  private async sendPauseNotifications(
    so: any, notifConfig: any, eventType: string, extraVars: Record<string, string> = {},
  ) {
    if (!notifConfig) return;
    const techName = so.assignedPartner?.name || 'técnico';
    const replaceVars = (msg: string) => {
      let result = msg
        .replace(/\{titulo\}/g, so.title || '')
        .replace(/\{tecnico\}/g, techName)
        .replace(/\{pausas\}/g, String((so.pauseCount || 0) + (eventType === 'EXECUTION_PAUSED' ? 1 : 0)))
        .replace(/\{status\}/g, so.status || '')
        .replace(/\{empresa\}/g, so.company?.name || '');
      // Extra vars (e.g. {tempo_pausado})
      for (const [k, v] of Object.entries(extraVars)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
      return result;
    };

    const recipients = [
      { key: 'gestor',  cfg: notifConfig.gestor },
      { key: 'cliente', cfg: notifConfig.cliente },
      { key: 'tecnico', cfg: notifConfig.tecnico },
    ];

    for (const r of recipients) {
      if (!r.cfg?.enabled) continue;
      const message = r.cfg.message ? replaceVars(r.cfg.message) : `[${eventType}] OS "${so.title}" — ${techName}`;
      this.notifications.send({
        companyId: so.companyId,
        serviceOrderId: so.id,
        channel: r.cfg.channel || 'whatsapp',
        message,
        type: eventType,
      }).catch((err) => this.logger.error(`${eventType} notification (${r.key}) failed: ${(err as Error).message}`));
    }
  }

  async pauseExecution(token: string, phone: string, reasonCategory: string, reason?: string, photos?: string[]) {
    const so = await this.findOsByToken(token);

    if (so.status !== 'EM_EXECUCAO') {
      throw new Error('OS não está em execução');
    }
    if (so.isPaused) {
      throw new Error('OS já está pausada');
    }

    const pauseConfig = this.getPauseConfig(so);

    // Validate max pauses
    if (pauseConfig?.maxPauses > 0 && so.pauseCount >= pauseConfig.maxPauses) {
      throw new Error(`Limite de ${pauseConfig.maxPauses} pausas atingido`);
    }

    // Validate reason category
    if (pauseConfig?.requireReason && !reasonCategory) {
      throw new Error('Motivo da pausa é obrigatório');
    }
    if (reasonCategory === 'other' && !reason) {
      throw new Error('Descreva o motivo da pausa');
    }

    // Validate photos via photoRequirements (on_pause moment)
    const pausePhotoReq = this.getPhotoRequirement(so, 'on_pause');
    if (pausePhotoReq?.required) {
      if (!photos || photos.length < pausePhotoReq.minPhotos) {
        throw new Error(`Envie pelo menos ${pausePhotoReq.minPhotos} foto(s) ao pausar`);
      }
    }
    // Backward compat: old pauseConfig.requirePhotosOnPause
    if (!pausePhotoReq && pauseConfig?.requirePhotosOnPause) {
      const minPhotos = pauseConfig.minPhotosOnPause || 1;
      if (!photos || photos.length < minPhotos) {
        throw new Error(`Envie pelo menos ${minPhotos} foto(s) ao pausar`);
      }
    }

    const now = new Date();
    const partnerId = so.assignedPartnerId;

    // Create pause record + update SO atomically
    const [pause] = await this.prisma.$transaction([
      this.prisma.executionPause.create({
        data: {
          companyId: so.companyId,
          serviceOrderId: so.id,
          partnerId: partnerId || '',
          reasonCategory,
          reason: reason || null,
          pausedAt: now,
          pausePhotos: photos && photos.length > 0 ? photos : undefined,
        },
      }),
      this.prisma.serviceOrder.update({
        where: { id: so.id },
        data: {
          isPaused: true,
          pausedAt: now,
          pauseCount: { increment: 1 },
        },
      }),
    ]);

    // Rich notifications (fire-and-forget)
    const reasonLabel = reasonCategory === 'other'
      ? (reason || 'Outro')
      : (PublicOfferService.PAUSE_REASON_LABELS[reasonCategory] || reasonCategory);
    const notifs = pauseConfig?.notifications?.onPause;
    if (notifs) {
      this.sendPauseNotifications(so, notifs, 'EXECUTION_PAUSED', { motivo_pausa: reasonLabel });
    } else if (pauseConfig?.notifyGestorOnPause) {
      // Backward compat: old boolean format
      this.notifications.send({
        companyId: so.companyId,
        serviceOrderId: so.id,
        message: `[PAUSA] OS "${so.title}" pausada por ${so.assignedPartner?.name || 'técnico'}. Motivo: ${reasonLabel}`,
        type: 'EXECUTION_PAUSED',
      }).catch((err) => this.logger.error(`Pause notification failed: ${(err as Error).message}`));
    }

    return { ok: true, pauseId: pause.id, pausedAt: now.toISOString() };
  }

  async resumeExecution(token: string, phone: string, photos?: string[]) {
    const so = await this.findOsByToken(token);

    if (!so.isPaused) {
      throw new Error('OS não está pausada');
    }

    const pauseConfig = this.getPauseConfig(so);

    // Validate photos via photoRequirements (on_resume moment)
    const resumePhotoReq = this.getPhotoRequirement(so, 'on_resume');
    if (resumePhotoReq?.required) {
      if (!photos || photos.length < resumePhotoReq.minPhotos) {
        throw new Error(`Envie pelo menos ${resumePhotoReq.minPhotos} foto(s) ao retomar`);
      }
    }
    // Backward compat: old pauseConfig.requirePhotosOnResume
    if (!resumePhotoReq && pauseConfig?.requirePhotosOnResume) {
      const minPhotos = pauseConfig.minPhotosOnResume || 1;
      if (!photos || photos.length < minPhotos) {
        throw new Error(`Envie pelo menos ${minPhotos} foto(s) ao retomar`);
      }
    }

    const now = new Date();
    const pausedAt = so.pausedAt || now;
    const durationMs = BigInt(now.getTime() - new Date(pausedAt).getTime());

    // Find the active pause record (last one without resumedAt)
    const activePause = await this.prisma.executionPause.findFirst({
      where: { serviceOrderId: so.id, resumedAt: null },
      orderBy: { pausedAt: 'desc' },
    });

    // Update pause record + update SO atomically
    const txOps: any[] = [];
    if (activePause) {
      txOps.push(
        this.prisma.executionPause.update({
          where: { id: activePause.id },
          data: {
            resumedAt: now,
            durationMs,
            resumePhotos: photos && photos.length > 0 ? photos : undefined,
          },
        }),
      );
    }
    txOps.push(
      this.prisma.serviceOrder.update({
        where: { id: so.id },
        data: {
          isPaused: false,
          pausedAt: null,
          totalPausedMs: { increment: durationMs },
        },
      }),
    );

    await this.prisma.$transaction(txOps);

    // Rich notifications (fire-and-forget)
    const durationMin = Math.round(Number(durationMs) / 60000);
    const tempoPausado = durationMin >= 60
      ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}min` : ''}`
      : `${durationMin} min`;
    const notifs = pauseConfig?.notifications?.onResume;
    if (notifs) {
      this.sendPauseNotifications(so, notifs, 'EXECUTION_RESUMED', { tempo_pausado: tempoPausado });
    } else if (pauseConfig?.notifyGestorOnResume) {
      // Backward compat: old boolean format
      this.notifications.send({
        companyId: so.companyId,
        serviceOrderId: so.id,
        message: `[RETOMADA] OS "${so.title}" retomada por ${so.assignedPartner?.name || 'técnico'}. Duração da pausa: ${durationMin} min`,
        type: 'EXECUTION_RESUMED',
      }).catch((err) => this.logger.error(`Resume notification failed: ${(err as Error).message}`));
    }

    return { ok: true, resumedAt: now.toISOString(), durationMs: Number(durationMs) };
  }

  async getPauseStatus(token: string) {
    const so = await this.findOsByToken(token);
    const pauseConfig = this.getPauseConfig(so);

    // Also get photo requirements for pause/resume
    const pausePhotoReq = this.getPhotoRequirement(so, 'on_pause');
    const resumePhotoReq = this.getPhotoRequirement(so, 'on_resume');

    // Get all pauses for this OS
    let pauses: any[] = [];
    try {
      pauses = await this.prisma.executionPause.findMany({
        where: { serviceOrderId: so.id },
        orderBy: { pausedAt: 'desc' },
      });
    } catch {
      // Table may not exist yet
    }

    return {
      isPaused: so.isPaused || false,
      pausedAt: so.pausedAt?.toISOString() || null,
      pauseCount: so.pauseCount || 0,
      totalPausedMs: Number(so.totalPausedMs || 0),
      pauseConfig: pauseConfig || null,
      photoRequirements: {
        onPause: pausePhotoReq,
        onResume: resumePhotoReq,
      },
      pauses: pauses.map(p => ({
        id: p.id,
        reasonCategory: p.reasonCategory,
        reason: p.reason,
        pausedAt: p.pausedAt.toISOString(),
        resumedAt: p.resumedAt?.toISOString() || null,
        durationMs: p.durationMs ? Number(p.durationMs) : null,
      })),
    };
  }

  /** Aggregate checklist items from all services in the OS, dedup by normalized text */
  private aggregateServiceChecklists(services: any[]) {
    const result: Record<string, string[]> = { toolsPpe: [], materials: [], initialCheck: [], finalCheck: [], custom: [] };
    const seen: Record<string, Set<string>> = { toolsPpe: new Set(), materials: new Set(), initialCheck: new Set(), finalCheck: new Set(), custom: new Set() };

    for (const soi of services) {
      const cl = soi.service?.checklists as any;
      if (!cl || typeof cl !== 'object') continue;
      for (const key of Object.keys(result)) {
        const items = cl[key];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          const norm = String(item).trim().toLowerCase();
          if (norm && !seen[key].has(norm)) {
            seen[key].add(norm);
            result[key].push(String(item).trim());
          }
        }
      }
    }
    return result;
  }

  /** Filter checklists to only include classes enabled in pageLayout */
  private filterChecklistsByLayout(
    checklists: Record<string, string[]>,
    pageLayout: any[],
  ): Record<string, string[]> {
    // If no pageLayout configured, return all checklists (backward compat)
    if (!pageLayout || pageLayout.length === 0) return checklists;

    // Map checklistClass from pageLayout to checklists key
    const classToKey: Record<string, string> = {
      TOOLS_PPE: 'toolsPpe',
      MATERIALS: 'materials',
      INITIAL_CHECK: 'initialCheck',
      FINAL_CHECK: 'finalCheck',
      CUSTOM: 'custom',
    };

    // Find which checklist classes are enabled in pageLayout
    const enabledKeys = new Set<string>();
    for (const block of pageLayout) {
      if (block.type === 'checklist' && block.enabled && block.checklistClass) {
        const key = classToKey[block.checklistClass];
        if (key) enabledKeys.add(key);
      }
    }

    // Filter: only return checklists that are enabled in pageLayout
    const filtered: Record<string, string[]> = {};
    for (const [key, items] of Object.entries(checklists)) {
      filtered[key] = enabledKeys.has(key) ? items : [];
    }
    return filtered;
  }

  /** Get existing checklist responses for this OS */
  private async getChecklistResponses(companyId: string, serviceOrderId: string) {
    const responses = await this.prisma.checklistResponse.findMany({
      where: { companyId, serviceOrderId },
      orderBy: { createdAt: 'asc' },
    });
    return responses.map(r => ({
      id: r.id,
      checklistClass: r.checklistClass,
      stage: r.stage,
      confirmed: r.confirmed,
      items: r.items,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async submitChecklist(token: string, dto: SubmitChecklistDto) {
    // Find the offer (active or revoked/accepted)
    const offer = await this.prisma.serviceOrderOffer.findFirst({
      where: { token },
      include: {
        serviceOrder: { select: { id: true, companyId: true, deletedAt: true, status: true } },
      },
    });

    if (!offer || !offer.serviceOrder) {
      throw new NotFoundException('Link não encontrado');
    }

    const so = offer.serviceOrder;
    if (so.deletedAt || so.status === ServiceOrderStatus.CANCELADA) {
      throw new BadRequestException('Esta ordem de serviço não está mais disponível.');
    }

    const response = await this.checklistResponseService.create(so.companyId, so.id, {
      ...dto,
      technicianName: dto.technicianName || undefined,
    });

    // Phase 7: Notify manager when technician skips recommended checklist items
    if (dto.notifyOnSkip && dto.items?.length > 0) {
      const skipped = dto.items.filter((i) => !i.checked);
      if (skipped.length > 0) {
        const classLabels: Record<string, string> = {
          TOOLS_PPE: 'Ferramentas e EPI',
          MATERIALS: 'Materiais',
          INITIAL_CHECK: 'Verificação Inicial',
          FINAL_CHECK: 'Verificação Final',
          CUSTOM: 'Personalizado',
        };
        const classLabel = classLabels[dto.checklistClass] || dto.checklistClass;
        const pendingItems = skipped.map((i) => i.text).join(', ');
        const message = `⚠ Checklist "${classLabel}" submetido com ${skipped.length} item(ns) pendente(s): ${pendingItems}. Técnico: ${dto.technicianName || 'N/I'}.`;

        this.notifications.send({
          companyId: so.companyId,
          serviceOrderId: so.id,
          channel: 'MOCK',
          message,
          type: 'CHECKLIST_SKIPPED',
        }).catch((err) => this.logger.error(`Checklist skip notification error: ${err.message}`));
      }
    }

    return response;
  }
}
