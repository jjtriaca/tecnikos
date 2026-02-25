import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(
    data: {
      companyId: string;
      name: string;
      email: string;
      password: string;
      role: UserRole;
    },
    actor?: AuthenticatedUser,
  ) {
    // Check unique email
    const existing = await this.prisma.user.findFirst({
      where: { email: data.email, deletedAt: null },
    });
    if (existing) throw new ConflictException('Email já cadastrado');

    const passwordHash = await bcrypt.hash(data.password, 10);

    const created = await this.prisma.user.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
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
      after: { name: created.name, email: created.email, role: created.role },
    });

    return created;
  }

  async update(
    id: string,
    companyId: string,
    data: { name?: string; email?: string; role?: UserRole; password?: string },
    actor?: AuthenticatedUser,
  ) {
    const existing = await this.findOne(id, companyId);

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
    if (data.role && data.role !== existing.role) {
      beforeFields.role = existing.role;
      afterFields.role = data.role;
      updateData.role = data.role;
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
        role: true,
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
    await this.findOne(id, companyId);
    const result = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
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
