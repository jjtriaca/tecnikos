import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConnectionService } from '../tenant/tenant-connection.service';

export interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
  optional: boolean;
  href: string;       // Settings page to configure
  description: string; // Short explanation
}

export interface OnboardingStatus {
  allDone: boolean;
  requiredDone: boolean;
  items: OnboardingItem[];
  completedCount: number;
  totalRequired: number;
}

@Injectable()
export class ChatIAOnboardingService {
  private readonly logger = new Logger(ChatIAOnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConnection: TenantConnectionService,
  ) {}

  async getStatus(companyId: string, tenantSchema?: string): Promise<OnboardingStatus> {
    // Use tenant prisma if available, otherwise public
    const db: any = tenantSchema
      ? this.tenantConnection.getClient(tenantSchema)
      : this.prisma;

    const [company, emailConfig, whatsappConfig, workflowCount, userCount, technicianCount, paymentMethodCount, automationCount, nfseConfig, serviceCodeCount] =
      await Promise.all([
        db.company.findFirst({ select: { phone: true, cep: true, logoUrl: true, cnpj: true, name: true, fiscalEnabled: true } }),
        db.emailConfig.findFirst({ select: { isConnected: true } }).catch(() => null),
        db.whatsAppConfig.findFirst({ select: { isConnected: true } }).catch(() => null),
        db.workflowTemplate.count({ where: { deletedAt: null } }).catch(() => 0),
        db.user.count({ where: { deletedAt: null } }).catch(() => 0),
        db.partner.count({ where: { deletedAt: null, partnerTypes: { has: 'TECNICO' } } }).catch(() => 0),
        db.paymentMethod.count().catch(() => 0),
        db.automationRule.count({ where: { isActive: true } }).catch(() => 0),
        db.nfseConfig.findFirst({ select: { focusNfeToken: true, focusNfeTokenHomolog: true, codigoMunicipio: true, aliquotaIss: true, inscricaoMunicipal: true } }).catch(() => null),
        db.nfseServiceCode.count({ where: { active: true } }).catch(() => 0),
      ]);

    const items: OnboardingItem[] = [
      {
        key: 'companyProfile',
        label: 'Perfil da Empresa',
        done: !!(company?.phone && company?.cep),
        optional: false,
        href: '/settings',
        description: 'Completar dados da empresa: telefone, endereço e logomarca',
      },
      {
        key: 'emailSmtp',
        label: 'Configuração de Email',
        done: emailConfig?.isConnected ?? false,
        optional: false,
        href: '/settings/email',
        description: 'Configurar servidor SMTP para envio de emails (notificações, NFS-e)',
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp Business',
        done: whatsappConfig?.isConnected ?? false,
        optional: false,
        href: '/settings/whatsapp',
        description: 'Conectar WhatsApp Business API para notificações e atendimento',
      },
      {
        key: 'workflow',
        label: 'Fluxo de Atendimento',
        done: workflowCount > 0,
        optional: false,
        href: '/workflow',
        description: 'Criar pelo menos um template de fluxo de atendimento (etapas da OS)',
      },
      {
        key: 'users',
        label: 'Usuários e Permissões',
        done: userCount > 1,
        optional: false,
        href: '/users',
        description: 'Criar usuários adicionais e atribuir permissões (Despacho, Financeiro)',
      },
      {
        key: 'technicians',
        label: 'Cadastro de Técnicos',
        done: technicianCount > 0,
        optional: false,
        href: '/partners?tab=technicians',
        description: 'Cadastrar pelo menos um técnico com especialização definida',
      },
      {
        key: 'fiscal',
        label: 'Módulo Fiscal / NFS-e',
        done: company?.fiscalEnabled
          ? !!(nfseConfig?.focusNfeToken || nfseConfig?.focusNfeTokenHomolog) && !!nfseConfig?.codigoMunicipio && serviceCodeCount > 0
          : false,
        optional: !company?.fiscalEnabled,
        href: '/settings/fiscal',
        description: company?.fiscalEnabled
          ? `Configurar NFS-e: ${!nfseConfig?.focusNfeToken && !nfseConfig?.focusNfeTokenHomolog ? 'Token Focus NFe, ' : ''}${!nfseConfig?.codigoMunicipio ? 'Código IBGE, ' : ''}${serviceCodeCount === 0 ? 'Serviços habilitados, ' : ''}${!nfseConfig?.aliquotaIss ? 'Alíquota ISS' : 'OK'}`.replace(/, $/, '')
          : 'Habilitar emissão de NFS-e (requer conta Focus NFe)',
      },
      {
        key: 'paymentMethods',
        label: 'Formas de Pagamento',
        done: paymentMethodCount > 0,
        optional: true,
        href: '/finance',
        description: 'Cadastrar formas de recebimento (PIX, cartão, boleto)',
      },
      {
        key: 'automation',
        label: 'Regras de Automação',
        done: automationCount > 0,
        optional: true,
        href: '/automation',
        description: 'Criar regras automáticas (ex: auto-assign técnico, notificar cliente)',
      },
    ];

    const requiredItems = items.filter((i) => !i.optional);
    const requiredDone = requiredItems.every((i) => i.done);
    const allDone = items.every((i) => i.done || i.optional);
    const completedCount = items.filter((i) => i.done).length;

    return {
      allDone,
      requiredDone,
      items,
      completedCount,
      totalRequired: requiredItems.length,
    };
  }
}
