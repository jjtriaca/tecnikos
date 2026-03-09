import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceAddressDto, UpdateServiceAddressDto } from './dto/service-address.dto';

@Injectable()
export class ServiceAddressService {
  private readonly logger = new Logger(ServiceAddressService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByPartner(companyId: string, partnerId: string, activeOnly = true) {
    const where: any = { companyId, partnerId };
    if (activeOnly) where.active = true;
    return this.prisma.serviceAddress.findMany({
      where,
      orderBy: { label: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const addr = await this.prisma.serviceAddress.findFirst({ where: { id, companyId } });
    if (!addr) throw new NotFoundException('Endereco de atendimento nao encontrado');
    return addr;
  }

  async create(companyId: string, dto: CreateServiceAddressDto) {
    // Verify partner belongs to company
    const partner = await this.prisma.partner.findFirst({
      where: { id: dto.partnerId, companyId, deletedAt: null },
    });
    if (!partner) throw new BadRequestException('Parceiro nao encontrado');

    return this.prisma.serviceAddress.create({
      data: {
        companyId,
        partnerId: dto.partnerId,
        label: dto.label,
        cep: dto.cep,
        addressStreet: dto.addressStreet,
        addressNumber: dto.addressNumber,
        addressComp: dto.addressComp,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state.toUpperCase(),
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateServiceAddressDto) {
    const addr = await this.prisma.serviceAddress.findFirst({ where: { id, companyId } });
    if (!addr) throw new NotFoundException('Endereco de atendimento nao encontrado');

    return this.prisma.serviceAddress.update({
      where: { id },
      data: {
        ...dto,
        state: dto.state?.toUpperCase(),
      },
    });
  }

  async toggleActive(companyId: string, id: string) {
    const addr = await this.prisma.serviceAddress.findFirst({ where: { id, companyId } });
    if (!addr) throw new NotFoundException('Endereco de atendimento nao encontrado');

    return this.prisma.serviceAddress.update({
      where: { id },
      data: { active: !addr.active },
    });
  }
}
