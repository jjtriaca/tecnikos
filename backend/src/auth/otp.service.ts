import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { randomInt, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/* ─── Helpers ──────────────────────────────────────────── */

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

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.length >= 12 && digits.startsWith('55')) return digits;
  if (digits.length >= 10 && !digits.startsWith('55')) return `55${digits}`;
  return digits;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Send OTP code to a technician via WhatsApp.
   * serviceOrderId is optional (null for login OTP).
   */
  async sendOtp(opts: {
    companyId: string;
    partnerId: string;
    phone: string;
    serviceOrderId?: string | null;
  }) {
    const { companyId, partnerId, phone, serviceOrderId } = opts;

    const code = generateOtp6();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const otp = await this.prisma.otpCode.create({
      data: {
        companyId,
        partnerId,
        serviceOrderId: serviceOrderId || 'LOGIN',
        codeHash: hashOtp(code),
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    // Send via WhatsApp
    try {
      await this.notifications.send({
        companyId,
        channel: 'WHATSAPP',
        message: `Seu código de verificação Tecnikos: ${code}. Válido por 10 minutos.`,
        type: 'OTP',
        recipientPhone: phone,
        forceTemplate: true,
      });
      this.logger.log(`[OTP] Code sent via WhatsApp to ${phone}`);
    } catch (err: any) {
      this.logger.warn(`[OTP] Failed to send via WhatsApp: ${err.message}`);
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[OTP-DEV] code=${code} partnerId=${partnerId}`);
    }

    return { otpId: otp.id, expiresAt: otp.expiresAt };
  }

  /**
   * Verify an OTP code. Returns true if valid, throws on failure.
   */
  async verifyCode(opts: {
    companyId: string;
    partnerId: string;
    code: string;
    serviceOrderId?: string | null;
  }): Promise<boolean> {
    const { companyId, partnerId, code, serviceOrderId } = opts;

    const codeNorm = String(code || '').replace(/\D/g, '');
    if (codeNorm.length !== 6) throw new BadRequestException('Código inválido');

    const otp = await this.prisma.otpCode.findFirst({
      where: {
        companyId,
        partnerId,
        serviceOrderId: serviceOrderId || 'LOGIN',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, attempts: true },
    });

    if (!otp) throw new BadRequestException('Código expirado ou inexistente');
    if (otp.attempts >= MAX_ATTEMPTS) throw new BadRequestException('Código bloqueado por excesso de tentativas');

    const ok = verifyOtp(codeNorm, otp.codeHash);
    if (!ok) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código inválido');
    }

    // Consume the OTP
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    return true;
  }
}
