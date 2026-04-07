import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoletoConfigService } from './boleto-config.service';
import { BankProviderFactory } from './providers/bank-provider.factory';
import { BoletoRegistrationRequest, BoletoWebhookEvent } from './providers/boleto-provider.interface';
import { CreateBoletoDto, CreateBoletosForEntryDto, CancelBoletoDto } from './dto/create-boleto.dto';

@Injectable()
export class BoletoService {
  private readonly logger = new Logger(BoletoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: BoletoConfigService,
    private readonly bankFactory: BankProviderFactory,
  ) {}

  // ========== CRUD ==========

  async list(companyId: string, params: {
    status?: string;
    partnerId?: string;
    financialEntryId?: string;
    skip?: number;
    take?: number;
  }) {
    const where: any = { companyId };
    if (params.status) where.status = params.status;
    if (params.partnerId) where.partnerId = params.partnerId;
    if (params.financialEntryId) where.financialEntryId = params.financialEntryId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.boleto.findMany({
        where,
        include: {
          partner: { select: { id: true, name: true, document: true } },
          financialEntry: { select: { id: true, code: true, type: true, grossCents: true } },
          installment: { select: { id: true, installmentNumber: true, amountCents: true, dueDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip || 0,
        take: params.take || 20,
      }),
      this.prisma.boleto.count({ where }),
    ]);

    return { items, total };
  }

  async getById(companyId: string, id: string) {
    const boleto = await this.prisma.boleto.findFirst({
      where: { id, companyId },
      include: {
        partner: { select: { id: true, name: true, document: true, documentType: true } },
        financialEntry: { select: { id: true, code: true, type: true, grossCents: true, description: true } },
        installment: { select: { id: true, installmentNumber: true, amountCents: true, dueDate: true, status: true } },
        boletoConfig: { select: { bankCode: true, bankName: true } },
      },
    });
    if (!boleto) throw new NotFoundException('Boleto nao encontrado');
    return boleto;
  }

  async getByEntry(companyId: string, entryId: string) {
    return this.prisma.boleto.findMany({
      where: { companyId, financialEntryId: entryId },
      include: {
        installment: { select: { id: true, installmentNumber: true, amountCents: true, dueDate: true, status: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  // ========== CRIAR BOLETO ==========

  async createBoleto(companyId: string, dto: CreateBoletoDto) {
    const config = await this.configService.getRawConfig(companyId);
    if (!config) throw new BadRequestException('Configure o modulo de boleto antes de emitir');

    // Buscar dados do sacado
    let payerData: { name: string; document: string; documentType: string; address?: string; city?: string; state?: string; cep?: string };

    if (dto.partnerId) {
      const partner = await this.prisma.partner.findFirst({
        where: { id: dto.partnerId, companyId },
      });
      if (!partner) throw new NotFoundException('Parceiro (sacado) nao encontrado');
      payerData = {
        name: partner.name,
        document: partner.document || '',
        documentType: partner.documentType || 'CPF',
        address: [partner.addressStreet, partner.addressNumber].filter(Boolean).join(', '),
        city: partner.city || undefined,
        state: partner.state || undefined,
        cep: partner.cep || undefined,
      };
    } else if (dto.financialEntryId) {
      const entry = await this.prisma.financialEntry.findFirst({
        where: { id: dto.financialEntryId, companyId },
        include: { partner: true },
      });
      if (!entry) throw new NotFoundException('Lancamento financeiro nao encontrado');
      if (!entry.partner) throw new BadRequestException('Lancamento nao tem parceiro vinculado');
      payerData = {
        name: entry.partner.name,
        document: entry.partner.document || '',
        documentType: entry.partner.documentType || 'CPF',
        address: [entry.partner.addressStreet, entry.partner.addressNumber].filter(Boolean).join(', '),
        city: entry.partner.city || undefined,
        state: entry.partner.state || undefined,
        cep: entry.partner.cep || undefined,
      };
      if (!dto.partnerId) dto.partnerId = entry.partnerId || undefined;
    } else {
      throw new BadRequestException('Informe partnerId ou financialEntryId');
    }

    if (!payerData.document) {
      throw new BadRequestException('Sacado nao possui CPF/CNPJ cadastrado');
    }

    // Gerar nossoNumero
    const nossoNumero = await this.configService.getNextNossoNumero(companyId);

    const boleto = await this.prisma.boleto.create({
      data: {
        companyId,
        boletoConfigId: config.id,
        financialEntryId: dto.financialEntryId || null,
        installmentId: dto.installmentId || null,
        partnerId: dto.partnerId || null,
        nossoNumero,
        seuNumero: dto.seuNumero || nossoNumero,
        amountCents: dto.amountCents,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        dueDate: new Date(dto.dueDate),
        payerName: payerData.name,
        payerDocument: payerData.document,
        payerDocumentType: payerData.documentType as string,
        payerAddress: payerData.address,
        payerCity: payerData.city,
        payerState: payerData.state,
        payerCep: payerData.cep,
        // Juros/multa: usa dto ou defaults do config
        interestType: dto.interestType || config.defaultInterestType,
        interestValue: dto.interestValue ?? config.defaultInterestValue,
        penaltyPercent: dto.penaltyPercent ?? config.defaultPenaltyPercent,
        discountType: dto.discountType || config.defaultDiscountType,
        discountValue: dto.discountValue ?? config.defaultDiscountValue,
        discountDeadline: dto.discountDeadline ? new Date(dto.discountDeadline) :
          (config.defaultDiscountDaysBefore ? this.addDays(new Date(dto.dueDate), -config.defaultDiscountDaysBefore) : null),
        instructions1: dto.instructions1 || config.defaultInstructions1,
        instructions2: dto.instructions2 || config.defaultInstructions2,
        instructions3: dto.instructions3 || config.defaultInstructions3,
        status: 'DRAFT',
      },
    });

    // Registrar imediatamente se solicitado
    if (dto.registerImmediately !== false) {
      return this.registerBoleto(companyId, boleto.id);
    }

    return boleto;
  }

  /** Criar boletos para todas as parcelas pendentes de um lancamento */
  async createBoletosForEntry(companyId: string, dto: CreateBoletosForEntryDto) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: dto.financialEntryId, companyId, deletedAt: null },
      include: {
        installments: { where: { status: 'PENDING' }, orderBy: { installmentNumber: 'asc' } },
        partner: true,
      },
    });

    if (!entry) throw new NotFoundException('Lancamento nao encontrado');
    if (entry.type !== 'RECEIVABLE') throw new BadRequestException('Boletos so podem ser gerados para lancamentos a receber');
    if (!entry.partner) throw new BadRequestException('Lancamento nao tem parceiro vinculado');

    const installments = entry.installments;
    if (installments.length === 0) {
      // Sem parcelas, gerar boleto unico do entry
      return [await this.createBoleto(companyId, {
        financialEntryId: entry.id,
        partnerId: entry.partnerId || undefined,
        amountCents: entry.grossCents,
        dueDate: entry.dueDate?.toISOString() || new Date().toISOString(),
        registerImmediately: dto.registerImmediately,
      })];
    }

    // Gerar um boleto para cada parcela pendente
    const boletos: any[] = [];
    for (const installment of installments) {
      // Verificar se ja existe boleto para esta parcela
      const existing = await this.prisma.boleto.findFirst({
        where: {
          companyId,
          installmentId: installment.id,
          status: { notIn: ['CANCELLED', 'REJECTED', 'WRITTEN_OFF'] },
        },
      });
      if (existing) continue;

      const boleto = await this.createBoleto(companyId, {
        financialEntryId: entry.id,
        installmentId: installment.id,
        partnerId: entry.partnerId || undefined,
        amountCents: installment.amountCents,
        dueDate: installment.dueDate.toISOString(),
        registerImmediately: dto.registerImmediately,
      });
      boletos.push(boleto);
    }

    return boletos;
  }

  // ========== REGISTRO NO BANCO ==========

  async registerBoleto(companyId: string, boletoId: string) {
    const boleto = await this.prisma.boleto.findFirst({
      where: { id: boletoId, companyId },
    });
    if (!boleto) throw new NotFoundException('Boleto nao encontrado');
    if (!['DRAFT', 'REJECTED'].includes(boleto.status)) {
      throw new BadRequestException(`Boleto em status ${boleto.status} nao pode ser registrado`);
    }

    const config = await this.configService.getRawConfig(companyId);
    if (!config) throw new BadRequestException('Configuracao de boleto nao encontrada');

    const provider = this.bankFactory.getProvider(config.bankCode);
    if (!provider) throw new BadRequestException(`Provider ${config.bankCode} nao encontrado`);

    // Buscar dados da empresa (cedente)
    const company = await this.prisma.company.findFirst({ where: { id: companyId } });
    if (!company) throw new BadRequestException('Empresa nao encontrada');

    // Marcar como registrando
    await this.prisma.boleto.update({
      where: { id: boletoId },
      data: { status: 'REGISTERING' },
    });

    const credentials = this.configService.getDecryptedCredentials(config);

    const request: BoletoRegistrationRequest = {
      nossoNumero: boleto.nossoNumero,
      seuNumero: boleto.seuNumero || undefined,
      amountCents: boleto.amountCents,
      dueDate: boleto.dueDate,
      issueDate: boleto.issueDate,
      payerName: boleto.payerName,
      payerDocument: boleto.payerDocument,
      payerDocumentType: boleto.payerDocumentType as 'CPF' | 'CNPJ',
      payerAddress: boleto.payerAddress || undefined,
      payerCity: boleto.payerCity || undefined,
      payerState: boleto.payerState || undefined,
      payerCep: boleto.payerCep || undefined,
      beneficiaryName: company.name,
      beneficiaryDocument: company.cnpj || '',
      convenio: config.convenio || undefined,
      carteira: config.carteira || undefined,
      especie: config.especie,
      especieDoc: config.especieDoc,
      interestType: boleto.interestType || undefined,
      interestValue: boleto.interestValue || undefined,
      penaltyPercent: boleto.penaltyPercent || undefined,
      discountType: boleto.discountType || undefined,
      discountValue: boleto.discountValue || undefined,
      discountDeadline: boleto.discountDeadline || undefined,
      instructions: [boleto.instructions1, boleto.instructions2, boleto.instructions3].filter(Boolean) as string[],
    };

    try {
      const result = await provider.register(credentials, request);

      if (result.success) {
        return this.prisma.boleto.update({
          where: { id: boletoId },
          data: {
            status: 'REGISTERED',
            bankProtocol: result.bankProtocol,
            nossoNumero: result.nossoNumero || boleto.nossoNumero,
            linhaDigitavel: result.linhaDigitavel,
            codigoBarras: result.codigoBarras,
            pixCopiaECola: result.pixCopiaECola,
            pdfUrl: result.pdfUrl,
            bankResponse: result.rawResponse || undefined,
            registeredAt: new Date(),
            errorMessage: null,
          },
        });
      } else {
        return this.prisma.boleto.update({
          where: { id: boletoId },
          data: {
            status: 'REJECTED',
            errorMessage: result.errorMessage,
            bankResponse: result.rawResponse || undefined,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Register boleto ${boletoId} failed`, error);
      await this.prisma.boleto.update({
        where: { id: boletoId },
        data: {
          status: 'REJECTED',
          errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
        },
      });
      throw error;
    }
  }

  // ========== CANCELAR ==========

  async cancelBoleto(companyId: string, boletoId: string, dto?: CancelBoletoDto) {
    const boleto = await this.prisma.boleto.findFirst({
      where: { id: boletoId, companyId },
    });
    if (!boleto) throw new NotFoundException('Boleto nao encontrado');

    // Se DRAFT, cancelar localmente sem chamar banco
    if (boleto.status === 'DRAFT') {
      return this.prisma.boleto.update({
        where: { id: boletoId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }

    if (!['REGISTERED', 'OVERDUE'].includes(boleto.status)) {
      throw new BadRequestException(`Boleto em status ${boleto.status} nao pode ser cancelado`);
    }

    const config = await this.configService.getRawConfig(companyId);
    if (!config) throw new BadRequestException('Configuracao de boleto nao encontrada');

    const provider = this.bankFactory.getProvider(config.bankCode);
    if (!provider) throw new BadRequestException(`Provider ${config.bankCode} nao encontrado`);

    const credentials = this.configService.getDecryptedCredentials(config);
    const result = await provider.cancel(credentials, boleto.nossoNumero, boleto.bankProtocol || undefined);

    if (result.success) {
      return this.prisma.boleto.update({
        where: { id: boletoId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }

    throw new BadRequestException(result.errorMessage || 'Falha ao cancelar boleto no banco');
  }

  // ========== CONSULTAR STATUS ==========

  async refreshBoleto(companyId: string, boletoId: string) {
    const boleto = await this.prisma.boleto.findFirst({
      where: { id: boletoId, companyId },
    });
    if (!boleto) throw new NotFoundException('Boleto nao encontrado');
    if (!['REGISTERED', 'OVERDUE', 'REGISTERING'].includes(boleto.status)) {
      return boleto; // Nada a consultar
    }

    const config = await this.configService.getRawConfig(companyId);
    if (!config) return boleto;

    const provider = this.bankFactory.getProvider(config.bankCode);
    if (!provider) return boleto;

    const credentials = this.configService.getDecryptedCredentials(config);
    const result = await provider.query(credentials, boleto.nossoNumero, boleto.bankProtocol || undefined);

    const updateData: any = {};
    if (result.status && result.status !== boleto.status) {
      updateData.status = result.status;
    }
    if (result.paidAmountCents) updateData.paidAmountCents = result.paidAmountCents;
    if (result.paidAt) updateData.paidAt = result.paidAt;

    if (Object.keys(updateData).length > 0) {
      const updated = await this.prisma.boleto.update({
        where: { id: boletoId },
        data: updateData,
      });

      // Se foi pago, reconciliar com financeiro
      if (updateData.status === 'PAID') {
        await this.reconcilePayment(companyId, updated);
      }

      return updated;
    }

    return boleto;
  }

  // ========== PDF ==========

  async downloadPdf(companyId: string, boletoId: string): Promise<Buffer> {
    const boleto = await this.prisma.boleto.findFirst({
      where: { id: boletoId, companyId },
    });
    if (!boleto) throw new NotFoundException('Boleto nao encontrado');
    if (!['REGISTERED', 'OVERDUE'].includes(boleto.status)) {
      throw new BadRequestException('PDF disponivel apenas para boletos registrados');
    }

    const config = await this.configService.getRawConfig(companyId);
    if (!config) throw new BadRequestException('Configuracao de boleto nao encontrada');

    const provider = this.bankFactory.getProvider(config.bankCode);
    if (!provider) throw new BadRequestException(`Provider ${config.bankCode} nao encontrado`);

    const credentials = this.configService.getDecryptedCredentials(config);
    return provider.downloadPdf(credentials, boleto.nossoNumero, boleto.bankProtocol || undefined);
  }

  // ========== WEBHOOK ==========

  async handleWebhook(bankCode: string, payload: any, headers: Record<string, string>) {
    const provider = this.bankFactory.getProvider(bankCode);
    if (!provider) {
      this.logger.warn(`Webhook received for unsupported bank: ${bankCode}`);
      return { received: true };
    }

    const event = provider.parseWebhook(payload, headers);
    if (!event) {
      this.logger.warn(`Could not parse webhook payload for bank ${bankCode}`);
      return { received: true };
    }

    // Encontrar o boleto pelo nossoNumero em todos os tenants
    // (webhook nao tem contexto de tenant)
    const boleto = await this.prisma.boleto.findFirst({
      where: {
        nossoNumero: event.nossoNumero,
        boletoConfig: { bankCode },
      },
    });

    if (!boleto) {
      this.logger.warn(`Boleto not found for nossoNumero ${event.nossoNumero} bank ${bankCode}`);
      return { received: true };
    }

    const updateData: any = {};

    switch (event.eventType) {
      case 'PAID':
        updateData.status = 'PAID';
        updateData.paidAmountCents = event.paidAmountCents;
        updateData.paidAt = event.paidAt || new Date();
        break;
      case 'CANCELLED':
        updateData.status = 'CANCELLED';
        updateData.cancelledAt = new Date();
        break;
      case 'REJECTED':
        updateData.status = 'REJECTED';
        break;
      case 'PROTESTED':
        updateData.status = 'PROTESTED';
        break;
      case 'WRITTEN_OFF':
        updateData.status = 'WRITTEN_OFF';
        break;
    }

    if (Object.keys(updateData).length > 0) {
      const updated = await this.prisma.boleto.update({
        where: { id: boleto.id },
        data: updateData,
      });

      if (event.eventType === 'PAID') {
        await this.reconcilePayment(boleto.companyId, updated);
      }
    }

    return { received: true };
  }

  // ========== RECONCILIACAO ==========

  private async reconcilePayment(companyId: string, boleto: any) {
    try {
      // Atualizar parcela como paga
      if (boleto.installmentId) {
        await this.prisma.financialInstallment.update({
          where: { id: boleto.installmentId },
          data: {
            status: 'PAID',
            paidAt: boleto.paidAt || new Date(),
            paidAmountCents: boleto.paidAmountCents || boleto.amountCents,
          },
        });

        // Verificar se todas as parcelas do entry estao pagas
        if (boleto.financialEntryId) {
          const pendingInstallments = await this.prisma.financialInstallment.count({
            where: {
              financialEntryId: boleto.financialEntryId,
              status: { in: ['PENDING', 'OVERDUE'] },
            },
          });

          if (pendingInstallments === 0) {
            await this.prisma.financialEntry.update({
              where: { id: boleto.financialEntryId },
              data: { status: 'PAID', paidAt: new Date() },
            });
          }
        }
      } else if (boleto.financialEntryId) {
        // Boleto avulso (sem parcela) -> atualizar entry direto
        await this.prisma.financialEntry.update({
          where: { id: boleto.financialEntryId },
          data: {
            status: 'PAID',
            paidAt: boleto.paidAt || new Date(),
          },
        });
      }

      // Creditar na conta bancaria
      const config = await this.prisma.boletoConfig.findUnique({
        where: { companyId },
      });
      if (config?.cashAccountId && boleto.paidAmountCents) {
        await this.prisma.cashAccount.update({
          where: { id: config.cashAccountId },
          data: {
            currentBalanceCents: { increment: boleto.paidAmountCents },
          },
        });
      }

      this.logger.log(`Boleto ${boleto.nossoNumero} reconciled: installment=${boleto.installmentId}, entry=${boleto.financialEntryId}`);
    } catch (error) {
      this.logger.error(`Failed to reconcile boleto ${boleto.id}`, error);
    }
  }

  // ========== HELPERS ==========

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
