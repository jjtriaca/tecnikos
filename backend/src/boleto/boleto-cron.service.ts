import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BoletoCronService {
  private readonly logger = new Logger(BoletoCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Diariamente as 7AM: marcar boletos registrados vencidos como OVERDUE */
  @Cron('0 7 * * *')
  async markOverdue() {
    try {
      const now = new Date();
      const result = await this.prisma.boleto.updateMany({
        where: {
          status: 'REGISTERED',
          dueDate: { lt: now },
        },
        data: { status: 'OVERDUE' },
      });

      if (result.count > 0) {
        this.logger.log(`Marked ${result.count} boletos as OVERDUE`);
      }
    } catch (error) {
      this.logger.error('markOverdue failed', error);
    }
  }
}
