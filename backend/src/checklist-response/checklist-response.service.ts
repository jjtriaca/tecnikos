import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitChecklistDto } from './dto/submit-checklist.dto';
import { ChecklistClass, ChecklistMode } from '@prisma/client';

@Injectable()
export class ChecklistResponseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, serviceOrderId: string, dto: SubmitChecklistDto) {
    return this.prisma.checklistResponse.create({
      data: {
        companyId,
        serviceOrderId,
        checklistClass: dto.checklistClass as ChecklistClass,
        stage: dto.stage,
        mode: (dto.mode as ChecklistMode) || ChecklistMode.ITEM_BY_ITEM,
        required: dto.required ?? true,
        items: dto.items as any,
        observation: dto.observation,
        confirmed: dto.confirmed,
        confirmedAt: dto.confirmed ? new Date() : null,
        confirmedBy: null, // Set by caller when technician is known
        technicianName: dto.technicianName,
        geolocation: dto.geolocation as any,
        deviceInfo: dto.deviceInfo as any,
        timeInStage: dto.timeInStage,
        skippedItems: dto.skippedItems as any,
      },
    });
  }

  async findByServiceOrder(companyId: string, serviceOrderId: string) {
    const responses = await this.prisma.checklistResponse.findMany({
      where: { companyId, serviceOrderId },
      orderBy: { createdAt: 'asc' },
    });

    // Group by stage
    const grouped: Record<string, typeof responses> = {};
    for (const r of responses) {
      if (!grouped[r.stage]) grouped[r.stage] = [];
      grouped[r.stage].push(r);
    }

    return { data: responses, byStage: grouped };
  }

  async getAggregatedItems(companyId: string, serviceOrderId: string, checklistClass: string) {
    // Find all services linked to this OS via ServiceOrderItem
    const orderItems = await this.prisma.serviceOrderItem.findMany({
      where: { serviceOrderId },
      select: { serviceId: true },
    });

    if (orderItems.length === 0) return { items: [] };

    const serviceIds = orderItems.map((i) => i.serviceId);

    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, companyId },
      select: { checklists: true },
    });

    // Map checklistClass to the key in Service.checklists JSON
    const classKeyMap: Record<string, string> = {
      TOOLS_PPE: 'toolsPpe',
      MATERIALS: 'materials',
      INITIAL_CHECK: 'initialCheck',
      FINAL_CHECK: 'finalCheck',
    };

    const key = classKeyMap[checklistClass];
    if (!key) return { items: [] }; // CUSTOM class has no service items

    // Combine items from all services, dedup by normalized text
    const seen = new Set<string>();
    const items: string[] = [];

    for (const svc of services) {
      const checklists = svc.checklists as any;
      if (!checklists || !checklists[key]) continue;

      const svcItems = checklists[key] as string[];
      for (const item of svcItems) {
        const normalized = item.trim().toLowerCase();
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          items.push(item.trim());
        }
      }
    }

    return { items, checklistClass };
  }
}
