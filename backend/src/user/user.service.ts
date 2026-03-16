import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { AuditService } from '../common/audit/audit.service';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
    private readonly audit: AuditService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        roles: true,
        chatIAEnabled: true,
        invitedAt: true,
        passwordSetAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCompanyName(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    return company?.name || 'Empresa';
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        chatIAEnabled: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  private validateRoles(roles: UserRole[]) {
    if (!roles || roles.length === 0) {
      throw new BadRequestException('Pelo menos um papel é obrigatório');
    }
    if (roles.includes(UserRole.LEITURA) && roles.length > 1) {
      throw new BadRequestException('Somente Leitura é exclusivo e não pode ser combinado com outros papéis');
    }
  }

  async create(
    data: {
      companyId: string;
      name: string;
      email: string;
      password?: string; // Optional — if not provided, user is invited via email
      roles: UserRole[];
      chatIAEnabled?: boolean;
    },
    actor?: AuthenticatedUser,
  ) {
    this.validateRoles(data.roles);

    // ── Enforce maxUsers limit ──
    const [activeCount, company] = await Promise.all([
      this.prisma.user.count({ where: { companyId: data.companyId, deletedAt: null } }),
      this.prisma.company.findUnique({ where: { id: data.companyId }, select: { maxUsers: true } }),
    ]);
    const maxUsers = company?.maxUsers || 0;
    if (maxUsers > 0 && activeCount >= maxUsers) {
      throw new ForbiddenException(
        `Limite de ${maxUsers} usuário(s) atingido. Faça upgrade do plano ou adquira usuários adicionais.`,
      );
    }

    // Check unique email
    const existing = await this.prisma.user.findFirst({
      where: { email: data.email, deletedAt: null },
    });
    if (existing) throw new ConflictException('Email já cadastrado');

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const code = await this.codeGenerator.generateCode(data.companyId, 'USER');

    const created = await this.prisma.user.create({
      data: {
        companyId: data.companyId,
        code,
        name: data.name,
        email: data.email.toLowerCase().trim(),
        passwordHash,
        roles: data.roles,
        chatIAEnabled: data.chatIAEnabled ?? false,
        invitedAt: !data.password ? new Date() : null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        roles: true,
        chatIAEnabled: true,
        createdAt: true,
        invitedAt: true,
        passwordSetAt: true,
      },
    });

    this.audit.log({
      companyId: data.companyId,
      entityType: 'USER',
      entityId: created.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: actor?.id,
      actorName: actor?.email,
      after: { name: created.name, email: created.email, roles: created.roles },
    });

    return created;
  }

  async update(
    id: string,
    companyId: string,
    data: { name?: string; email?: string; roles?: UserRole[]; password?: string; chatIAEnabled?: boolean },
    actor?: AuthenticatedUser,
  ) {
    const existing = await this.findOne(id, companyId);

    if (data.roles) {
      this.validateRoles(data.roles);
    }

    const updateData: any = {};
    const beforeFields: Record<string, any> = {};
    const afterFields: Record<string, any> = {};

    if (data.name && data.name !== existing.name) {
      beforeFields.name = existing.name;
      afterFields.name = data.name;
      updateData.name = data.name;
    }
    if (data.email && data.email !== existing.email) {
      beforeFields.email = existing.email;
      afterFields.email = data.email;
      updateData.email = data.email;
    }
    if (data.roles && JSON.stringify(data.roles.sort()) !== JSON.stringify([...existing.roles].sort())) {
      beforeFields.roles = existing.roles;
      afterFields.roles = data.roles;
      updateData.roles = data.roles;
    }
    if (data.chatIAEnabled !== undefined && data.chatIAEnabled !== (existing as any).chatIAEnabled) {
      beforeFields.chatIAEnabled = (existing as any).chatIAEnabled;
      afterFields.chatIAEnabled = data.chatIAEnabled;
      updateData.chatIAEnabled = data.chatIAEnabled;
    }
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      // Never include password hash in audit
      afterFields.password = '***alterada***';
    }

    const result = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        chatIAEnabled: true,
        updatedAt: true,
      },
    });

    if (Object.keys(afterFields).length > 0) {
      this.audit.log({
        companyId,
        entityType: 'USER',
        entityId: id,
        action: 'UPDATED',
        actorType: 'USER',
        actorId: actor?.id,
        actorName: actor?.email,
        before: Object.keys(beforeFields).length > 0 ? beforeFields : undefined,
        after: afterFields,
      });
    }

    return result;
  }

  async remove(id: string, companyId: string, actor?: AuthenticatedUser) {
    const existing = await this.findOne(id, companyId);
    const result = await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deactivationCount: { increment: 1 },
        lastDeactivatedAt: new Date(),
      },
    });

    this.audit.log({
      companyId,
      entityType: 'USER',
      entityId: id,
      action: 'DELETED',
      actorType: 'USER',
      actorId: actor?.id,
      actorName: actor?.email,
    });

    return result;
  }
}
