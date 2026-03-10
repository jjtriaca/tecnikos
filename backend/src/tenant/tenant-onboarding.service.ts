import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConnectionService } from './tenant-connection.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Handles tenant onboarding after activation:
 * - Creates Company in tenant schema
 * - Creates admin User with temporary password
 * - Sends welcome email with credentials
 */
@Injectable()
export class TenantOnboardingService {
  private readonly logger = new Logger(TenantOnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConn: TenantConnectionService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Full onboarding: create Company + User + send welcome email.
   * Idempotent — skips if Company already exists in tenant schema.
   */
  async onboard(tenantId: string): Promise<{ password?: string; skipped?: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) {
      this.logger.warn(`Tenant ${tenantId} not found — skipping onboarding`);
      return { skipped: true };
    }

    const client = this.tenantConn.getClient(tenant.schemaName);

    // Check if Company already exists (idempotent)
    const existingCompany = await client.company.findFirst();
    if (existingCompany) {
      this.logger.log(`Tenant ${tenant.slug} already has a Company — skipping onboarding`);
      return { skipped: true };
    }

    // Generate temporary password
    const tempPassword = this.generatePassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create Company in tenant schema
    const company = await client.company.create({
      data: {
        name: tenant.name,
        cnpj: tenant.cnpj || undefined,
        email: tenant.responsibleEmail || undefined,
        phone: tenant.responsiblePhone || undefined,
        ownerName: tenant.responsibleName || undefined,
        ownerEmail: tenant.responsibleEmail || undefined,
        ownerPhone: tenant.responsiblePhone || undefined,
        status: 'ATIVA',
      },
    });

    // Initialize CodeCounter for USER entity
    await client.codeCounter.create({
      data: {
        companyId: company.id,
        entity: 'USER',
        prefix: 'USR',
        nextNumber: 2, // First user gets USR-00001
      },
    });

    // Create admin User in tenant schema
    const user = await client.user.create({
      data: {
        companyId: company.id,
        code: 'USR-00001',
        name: tenant.responsibleName || 'Administrador',
        email: (tenant.responsibleEmail || '').toLowerCase().trim(),
        passwordHash,
        roles: ['ADMIN'],
      },
    });

    this.logger.log(
      `Onboarded tenant "${tenant.slug}" — Company: ${company.id}, User: ${user.id} (${user.email})`,
    );

    // Send welcome email (async, don't block activation)
    const loginUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';

    this.sendWelcomeEmail(
      tenant.responsibleEmail || '',
      tenant.responsibleName || 'Administrador',
      tenant.name,
      tenant.slug,
      tempPassword,
      loginUrl,
      tenant.plan?.name || 'Padrão',
    ).catch((err) => {
      this.logger.error(`Failed to send welcome email: ${err.message}`);
    });

    return { password: tempPassword };
  }

  /**
   * Generate a readable temporary password (12 chars).
   */
  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars[bytes[i] % chars.length];
    }
    return password;
  }

  /**
   * Send welcome email with login credentials.
   */
  private async sendWelcomeEmail(
    toEmail: string,
    name: string,
    companyName: string,
    slug: string,
    password: string,
    baseUrl: string,
    planName: string,
  ) {
    if (!toEmail) return;

    const loginLink = `${baseUrl}/login`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Tecnikos</h1>
          <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">Gestao de Servicos Tecnicos</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Bem-vindo ao Tecnikos!</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Ola, <strong>${name}</strong>! Sua empresa <strong>${companyName}</strong> foi ativada com sucesso no plano <strong>${planName}</strong>.
          </p>

          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 0 0 20px;">
            <h3 style="color: #0c4a6e; margin: 0 0 12px; font-size: 15px;">Seus dados de acesso:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #64748b; padding: 4px 0; font-size: 13px; width: 80px;">Email:</td>
                <td style="color: #0f172a; padding: 4px 0; font-size: 13px; font-weight: 600;">${toEmail}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0; font-size: 13px;">Senha:</td>
                <td style="color: #0f172a; padding: 4px 0; font-size: 13px; font-family: monospace; font-weight: 600; letter-spacing: 1px;">${password}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${loginLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Acessar o Sistema
            </a>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 20px 0 0;">
            <p style="color: #92400e; margin: 0; font-size: 12px;">
              <strong>Importante:</strong> Altere sua senha no primeiro acesso em Configuracoes &gt; Minha Conta.
            </p>
          </div>
        </div>

        <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">
            Tecnikos &copy; ${new Date().getFullYear()} — tecnikos.com.br
          </p>
        </div>
      </div>
    `;

    await this.emailService.sendSystemEmail(
      toEmail,
      `Bem-vindo ao Tecnikos — ${companyName}`,
      html,
    );
  }
}
