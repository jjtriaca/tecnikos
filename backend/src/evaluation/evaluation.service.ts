import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { randomUUID } from 'crypto';

@Injectable()
export class EvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  async createGestorEvaluation(
    serviceOrderId: string,
    partnerId: string,
    companyId: string,
    score: number,
    comment?: string,
  ) {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new BadRequestException('Nota deve ser um inteiro entre 1 e 5');
    }

    const existing = await this.prisma.evaluation.findFirst({
      where: { serviceOrderId, evaluatorType: 'GESTOR' },
    });

    if (existing) {
      throw new BadRequestException(
        'Avaliação do gestor já registrada para esta OS',
      );
    }

    const code = await this.codeGenerator.generateCode(companyId, 'EVALUATION');
    const evaluation = await this.prisma.evaluation.create({
      data: {
        serviceOrderId,
        partnerId,
        companyId,
        code,
        evaluatorType: 'GESTOR',
        score,
        comment,
      },
    });

    // Aprovar a OS (CONCLUIDA → APROVADA)
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { status: true },
    });
    if (so?.status === 'CONCLUIDA') {
      await this.prisma.serviceOrder.update({
        where: { id: serviceOrderId },
        data: { status: 'APROVADA' },
      });
      await this.prisma.serviceOrderEvent.create({
        data: {
          companyId,
          serviceOrderId,
          type: 'STATUS_CHANGE',
          actorType: 'USER',
          payload: { from: 'CONCLUIDA', to: 'APROVADA', reason: 'Avaliação do gestor' },
        },
      });
    }

    await this.updateTechnicianRating(partnerId, companyId);

    return evaluation;
  }

  async generateClientEvaluationToken(
    serviceOrderId: string,
    partnerId: string,
    companyId: string,
  ): Promise<string> {
    const token = randomUUID();

    const code = await this.codeGenerator.generateCode(companyId, 'EVALUATION');
    await this.prisma.evaluation.create({
      data: {
        serviceOrderId,
        partnerId,
        companyId,
        code,
        evaluatorType: 'CLIENTE',
        score: 0,
        token,
      },
    });

    return token;
  }

  async getEvaluationByToken(token: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { token },
      include: {
        serviceOrder: {
          select: { title: true, addressText: true },
        },
        partner: {
          select: { name: true },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Avaliação não encontrada');
    }

    return evaluation;
  }

  async submitClientEvaluation(token: string, score: number, comment?: string) {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new BadRequestException('Nota deve ser um inteiro entre 1 e 5');
    }

    const evaluation = await this.prisma.evaluation.findFirst({
      where: { token },
    });

    if (!evaluation) {
      throw new NotFoundException('Avaliação não encontrada');
    }

    if (evaluation.score > 0) {
      throw new BadRequestException('Avaliação já enviada');
    }

    const updated = await this.prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { score, comment },
    });

    await this.updateTechnicianRating(evaluation.partnerId, evaluation.companyId);

    return updated;
  }

  async getByTechnician(partnerId: string, companyId: string) {
    return this.prisma.evaluation.findMany({
      where: { partnerId, companyId, score: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      include: {
        serviceOrder: {
          select: { title: true },
        },
      },
    });
  }

  private async updateTechnicianRating(
    partnerId: string,
    companyId: string,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { evalGestorWeight: true, evalClientWeight: true, evalMinRating: true },
    });

    if (!company) return;

    const evaluations = await this.prisma.evaluation.findMany({
      where: { partnerId, score: { gt: 0 } },
    });

    const gestorEvals = evaluations.filter((e) => e.evaluatorType === 'GESTOR');
    const clientEvals = evaluations.filter((e) => e.evaluatorType === 'CLIENTE');

    if (evaluations.length === 0) {
      return;
    }

    let weightedAvg: number;

    const gestorAvg =
      gestorEvals.length > 0
        ? gestorEvals.reduce((sum, e) => sum + e.score, 0) / gestorEvals.length
        : 0;

    const clientAvg =
      clientEvals.length > 0
        ? clientEvals.reduce((sum, e) => sum + e.score, 0) / clientEvals.length
        : 0;

    const gestorWeight = company.evalGestorWeight ?? 40;
    const clientWeight = company.evalClientWeight ?? 60;

    if (gestorEvals.length > 0 && clientEvals.length > 0) {
      weightedAvg =
        (gestorAvg * gestorWeight + clientAvg * clientWeight) /
        (gestorWeight + clientWeight);
    } else if (gestorEvals.length > 0) {
      weightedAvg = gestorAvg;
    } else {
      weightedAvg = clientAvg;
    }

    const rating = Math.round(weightedAvg * 10) / 10;

    await this.prisma.partner.update({
      where: { id: partnerId },
      data: { rating },
    });

    const minRating = company.evalMinRating ?? 3.0;

    if (rating < minRating) {
      await this.prisma.partner.update({
        where: { id: partnerId },
        data: { status: 'EM_TREINAMENTO' },
      });
    }
  }
}
