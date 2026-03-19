import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildSearchWhere } from '../common/util/build-search-where';

const DEFAULT_SPECIALIZATIONS = [
  'Elétrica',
  'Hidráulica',
  'HVAC/Ar Condicionado',
  'Pintura',
  'Alvenaria',
  'Serralheria',
  'Marcenaria',
  'Instalação',
  'Manutenção Preventiva',
  'Redes/TI',
];

@Injectable()
export class SpecializationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, pagination?: PaginationDto): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 100;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (pagination?.search) {
      const searchClause = buildSearchWhere(pagination.search, [
        { field: 'name', mode: 'insensitive' },
      ]);
      if (searchClause) Object.assign(where, searchClause);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.specialization.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.specialization.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  create(companyId: string, name: string, description?: string) {
    return this.prisma.specialization.create({
      data: {
        companyId,
        name: name.trim(),
        description,
        isDefault: false,
      },
    });
  }

  async remove(id: string, companyId: string) {
    const specialization = await this.prisma.specialization.findFirst({
      where: { id },
    });

    if (!specialization || specialization.companyId !== companyId) {
      throw new NotFoundException('Especialização não encontrada');
    }

    if (specialization.isDefault) {
      throw new BadRequestException(
        'Não é possível remover uma especialização padrão',
      );
    }

    return this.prisma.specialization.delete({ where: { id } });
  }

  seedDefaults(companyId: string) {
    return this.prisma.specialization.createMany({
      data: DEFAULT_SPECIALIZATIONS.map((name) => ({
        companyId,
        name,
        isDefault: true,
      })),
      skipDuplicates: true,
    });
  }
}
