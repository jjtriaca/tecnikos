import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { BankProviderFactory } from './providers/bank-provider.factory';
import { SaveBoletoConfigDto } from './dto/save-boleto-config.dto';
import { BoletoProviderCredentials } from './providers/boleto-provider.interface';

const MASKED = '••••••••';
const ENCRYPTED_FIELDS = ['clientId', 'clientSecret', 'apiKey', 'certificateBase64', 'certificatePassword', 'webhookSecret'];

@Injectable()
export class BoletoConfigService {
  private readonly logger = new Logger(BoletoConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly bankFactory: BankProviderFactory,
  ) {}

  /** Retorna config com campos sensiveis mascarados */
  async getConfig(companyId: string) {
    const config = await this.prisma.boletoConfig.findUnique({
      where: { companyId },
      include: { cashAccount: { select: { id: true, name: true, bankCode: true, bankName: true } } },
    });
    if (!config) return null;
    return this.maskConfig(config);
  }

  /** Salva config com encriptacao de campos sensiveis */
  async saveConfig(companyId: string, dto: SaveBoletoConfigDto) {
    // Verificar se o banco e suportado
    const provider = this.bankFactory.getProvider(dto.bankCode);
    if (!provider) {
      throw new BadRequestException(`Banco ${dto.bankCode} (${dto.bankName}) ainda nao e suportado`);
    }

    const data: any = { ...dto };

    // Encriptar campos sensiveis (preservar valor existente se mascarado)
    for (const field of ENCRYPTED_FIELDS) {
      if (data[field] && data[field] !== MASKED) {
        data[field] = this.encryption.encrypt(data[field]);
      } else {
        delete data[field];
      }
    }

    const config = await this.prisma.boletoConfig.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });

    return this.maskConfig(config);
  }

  /** Testar conexao com banco usando credenciais salvas */
  async testConnection(companyId: string) {
    const config = await this.prisma.boletoConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Configuracao de boleto nao encontrada');

    const provider = this.bankFactory.getProvider(config.bankCode);
    if (!provider) throw new BadRequestException(`Provider para banco ${config.bankCode} nao encontrado`);

    try {
      const credentials = this.getDecryptedCredentials(config);
      return await provider.testConnection(credentials);
    } catch (error) {
      this.logger.error('testConnection failed', error);
      return { valid: false, message: 'Erro ao decriptar credenciais. Re-salve a configuracao.' };
    }
  }

  /** Retorna credenciais descriptografadas (uso interno) */
  getDecryptedCredentials(config: any): BoletoProviderCredentials {
    return {
      clientId: config.clientId ? this.encryption.decrypt(config.clientId) : undefined,
      clientSecret: config.clientSecret ? this.encryption.decrypt(config.clientSecret) : undefined,
      apiKey: config.apiKey ? this.encryption.decrypt(config.apiKey) : undefined,
      certificateBase64: config.certificateBase64 ? this.encryption.decrypt(config.certificateBase64) : undefined,
      certificatePassword: config.certificatePassword ? this.encryption.decrypt(config.certificatePassword) : undefined,
      bankSpecificConfig: config.bankSpecificConfig as Record<string, any> || undefined,
      environment: config.environment as 'SANDBOX' | 'PRODUCTION',
      convenio: config.convenio || undefined,
      carteira: config.carteira || undefined,
    };
  }

  /** Buscar config raw (com campos encriptados) — uso interno */
  async getRawConfig(companyId: string) {
    return this.prisma.boletoConfig.findUnique({ where: { companyId } });
  }

  /** Incrementa atomicamente o nossoNumero e retorna o valor */
  async getNextNossoNumero(companyId: string): Promise<string> {
    const config = await this.prisma.boletoConfig.update({
      where: { companyId },
      data: { nextNossoNumero: { increment: 1 } },
    });
    // Retorna o valor ANTES do incremento (o que acabou de ser "consumido")
    const num = config.nextNossoNumero - 1;
    return String(num).padStart(10, '0');
  }

  /** Auto-detectar banco das CashAccounts existentes */
  async detectBankFromAccounts(companyId: string) {
    const accounts = await this.prisma.cashAccount.findMany({
      where: {
        companyId,
        type: 'BANCO',
        isActive: true,
        deletedAt: null,
        bankCode: { not: null },
      },
      select: { id: true, name: true, bankCode: true, bankName: true },
    });

    const supportedBanks = this.bankFactory.getSupportedBanks();
    const supportedCodes = new Set(supportedBanks.map(b => b.code));

    return accounts.map(account => ({
      ...account,
      supported: supportedCodes.has(account.bankCode || ''),
    }));
  }

  private maskConfig(config: any) {
    const masked = { ...config };
    for (const field of ENCRYPTED_FIELDS) {
      if (masked[field]) {
        masked[field] = MASKED;
      }
    }
    return masked;
  }
}
