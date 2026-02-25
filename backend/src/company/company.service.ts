import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

const ALLOWED_FIELDS: (keyof UpdateCompanyDto)[] = [
  'name', 'tradeName', 'cnpj', 'ie', 'im',
  'phone', 'email',
  'cep', 'addressStreet', 'addressNumber', 'addressComp',
  'neighborhood', 'city', 'state',
  'ownerName', 'ownerCpf', 'ownerPhone', 'ownerEmail',
  'commissionBps',
  'evalGestorWeight', 'evalClientWeight', 'evalMinRating',
];

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async update(id: string, body: UpdateCompanyDto, callerCompanyId: string) {
    if (id !== callerCompanyId) {
      throw new ForbiddenException('Acesso negado a outra empresa');
    }

    const data: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        data[key] = body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }

    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  remove(id: string, callerCompanyId: string) {
    if (id !== callerCompanyId) {
      throw new ForbiddenException('Acesso negado a outra empresa');
    }
    return this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
