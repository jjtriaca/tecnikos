import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateObraDto, UpdateObraDto } from './dto/obra.dto';

@Injectable()
export class ObraService {
  private readonly logger = new Logger(ObraService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByPartner(companyId: string, partnerId: string, activeOnly = true) {
    const where: any = { companyId, partnerId };
    if (activeOnly) where.active = true;
    return this.prisma.obra.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const obra = await this.prisma.obra.findFirst({ where: { id, companyId } });
    if (!obra) throw new NotFoundException('Obra nao encontrada');
    return obra;
  }

  async create(companyId: string, dto: CreateObraDto) {
    // Verify partner belongs to company
    const partner = await this.prisma.partner.findFirst({
      where: { id: dto.partnerId, companyId, deletedAt: null },
    });
    if (!partner) throw new BadRequestException('Parceiro nao encontrado');

    return this.prisma.obra.create({
      data: {
        companyId,
        partnerId: dto.partnerId,
        name: dto.name,
        cno: dto.cno,
        addressStreet: dto.addressStreet,
        addressNumber: dto.addressNumber,
        addressComp: dto.addressComp,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state.toUpperCase(),
        cep: dto.cep,
        ibgeCode: dto.ibgeCode,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateObraDto) {
    const obra = await this.prisma.obra.findFirst({ where: { id, companyId } });
    if (!obra) throw new NotFoundException('Obra nao encontrada');

    return this.prisma.obra.update({
      where: { id },
      data: {
        ...dto,
        state: dto.state?.toUpperCase(),
      },
    });
  }

  async toggleActive(companyId: string, id: string) {
    const obra = await this.prisma.obra.findFirst({ where: { id, companyId } });
    if (!obra) throw new NotFoundException('Obra nao encontrada');

    return this.prisma.obra.update({
      where: { id },
      data: { active: !obra.active },
    });
  }
}
