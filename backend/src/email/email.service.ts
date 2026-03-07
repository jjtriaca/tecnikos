import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // ── Config Management ────────────────────────────────────

  /**
   * Get email config for a company (without decrypting password).
   */
  async getConfig(companyId: string) {
    const config = await this.prisma.emailConfig.findUnique({
      where: { companyId },
    });

    if (!config) {
      return {
        isConnected: false,
        connectedAt: null,
        smtpHost: null,
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: null,
        fromName: null,
        fromEmail: null,
        hasPassword: false,
      };
    }

    return {
      isConnected: config.isConnected,
      connectedAt: config.connectedAt,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpUser: config.smtpUser,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      hasPassword: !!config.smtpPass,
    };
  }

  /**
   * Save or update SMTP configuration.
   * Encrypts password with AES-256-GCM.
   */
  async saveConfig(
    companyId: string,
    data: {
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      smtpUser: string;
      smtpPass?: string;
      fromName: string;
      fromEmail: string;
    },
  ) {
    const existing = await this.prisma.emailConfig.findUnique({
      where: { companyId },
    });

    // If no password provided and no existing, error
    if (!data.smtpPass && !existing?.smtpPass) {
      throw new BadRequestException('Senha SMTP obrigatoria');
    }

    const encryptedPass = data.smtpPass
      ? this.encryption.encrypt(data.smtpPass)
      : existing!.smtpPass;

    const config = await this.prisma.emailConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure,
        smtpUser: data.smtpUser,
        smtpPass: encryptedPass,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        isConnected: true,
        connectedAt: new Date(),
      },
      update: {
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure,
        smtpUser: data.smtpUser,
        smtpPass: encryptedPass,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        isConnected: true,
        connectedAt: new Date(),
      },
    });

    this.logger.log(`Email config saved for company ${companyId} — ${data.smtpHost}:${data.smtpPort}`);

    return {
      isConnected: config.isConnected,
      connectedAt: config.connectedAt,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpUser: config.smtpUser,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      hasPassword: true,
    };
  }

  /**
   * Disconnect email — clear password and mark as disconnected.
   */
  async disconnect(companyId: string) {
    const existing = await this.prisma.emailConfig.findUnique({
      where: { companyId },
    });

    if (!existing) return;

    await this.prisma.emailConfig.update({
      where: { companyId },
      data: {
        smtpPass: '',
        isConnected: false,
      },
    });

    this.logger.log(`Email disconnected for company ${companyId}`);
  }

  // ── Connection Testing ───────────────────────────────────

  /**
   * Test SMTP connection without saving — creates a transporter and calls verify().
   */
  async testConnection(
    smtpHost: string,
    smtpPort: number,
    smtpSecure: boolean,
    smtpUser: string,
    smtpPass: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      });

      await transporter.verify();
      transporter.close();

      this.logger.log(`SMTP test OK: ${smtpUser}@${smtpHost}:${smtpPort}`);
      return { success: true };
    } catch (err: any) {
      this.logger.warn(`SMTP test failed: ${err.message}`);
      return {
        success: false,
        error: err.message || 'Falha na conexao SMTP',
      };
    }
  }

  // ── Sending ──────────────────────────────────────────────

  /**
   * Send a test email using saved config.
   */
  async sendTestEmail(
    companyId: string,
    toEmail: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = await this.createTransporter(companyId);
      const config = await this.prisma.emailConfig.findUnique({
        where: { companyId },
      });

      if (!config) throw new Error('Configuracao de email nao encontrada');

      const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚡ Tecnikos</h1>
            <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">Gestao de Servicos Tecnicos</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 18px;">✅ Email configurado com sucesso!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Este e um email de teste enviado pelo sistema Tecnikos para confirmar que as configuracoes do servidor SMTP estao funcionando corretamente.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #64748b; margin: 0; font-size: 13px;">
                <strong>Servidor:</strong> ${config.smtpHost}:${config.smtpPort}<br>
                <strong>Remetente:</strong> ${config.fromName} &lt;${config.fromEmail}&gt;<br>
                <strong>Enviado em:</strong> ${now}
              </p>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; text-align: center;">
              Este email foi gerado automaticamente. Nao e necessario responder.
            </p>
          </div>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
              Tecnikos &copy; ${new Date().getFullYear()} — tecnikos.com.br
            </p>
          </div>
        </div>
      `;

      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: toEmail,
        subject: 'Teste de Email - Tecnikos',
        html,
      });

      transporter.close();

      this.logger.log(`Test email sent to ${toEmail} — messageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      this.logger.error(`Failed to send test email: ${err.message}`);
      return {
        success: false,
        error: err.message || 'Erro ao enviar email de teste',
      };
    }
  }

  /**
   * Generic email send method — for use by other services (notifications, NFS-e, etc.)
   */
  async sendEmail(
    companyId: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = await this.createTransporter(companyId);
      const config = await this.prisma.emailConfig.findUnique({
        where: { companyId },
      });

      if (!config) throw new Error('Configuracao de email nao encontrada');

      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject,
        html,
      });

      transporter.close();

      this.logger.log(`Email sent to ${to} — subject: "${subject}" — id: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      this.logger.error(`Email send failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check if email is configured and connected for a company.
   */
  async isConnected(companyId: string): Promise<boolean> {
    const config = await this.prisma.emailConfig.findUnique({
      where: { companyId },
      select: { isConnected: true },
    });
    return config?.isConnected ?? false;
  }

  // ── Private ──────────────────────────────────────────────

  /**
   * Create a nodemailer transporter using saved (encrypted) config.
   */
  private async createTransporter(companyId: string) {
    const config = await this.prisma.emailConfig.findUnique({
      where: { companyId },
    });

    if (!config || !config.isConnected || !config.smtpPass) {
      throw new Error('Email nao configurado ou desconectado');
    }

    const password = this.encryption.decrypt(config.smtpPass);

    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: password,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
    });
  }
}
