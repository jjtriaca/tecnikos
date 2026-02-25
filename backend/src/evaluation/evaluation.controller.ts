import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { CreateGestorEvaluationDto, SubmitClientEvaluationDto } from './dto/create-evaluation.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

@Controller('evaluations')
export class EvaluationController {
  constructor(
    private readonly service: EvaluationService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('gestor')
  async createGestor(
    @Body() body: CreateGestorEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: body.serviceOrderId, companyId: user.companyId },
      select: { assignedPartnerId: true },
    });

    if (!so || !so.assignedPartnerId) {
      throw new NotFoundException(
        'OS não encontrada ou sem técnico atribuído',
      );
    }

    return this.service.createGestorEvaluation(
      body.serviceOrderId,
      so.assignedPartnerId,
      user.companyId,
      body.score,
      body.comment,
    );
  }

  @Get('partner/:id')
  getByTechnician(
    @Param('id') partnerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getByTechnician(partnerId, user.companyId);
  }

  @Public()
  @Get('public/:token')
  getByToken(@Param('token') token: string) {
    return this.service.getEvaluationByToken(token);
  }

  @Public()
  @Post('public/:token')
  submitClient(
    @Param('token') token: string,
    @Body() body: SubmitClientEvaluationDto,
  ) {
    return this.service.submitClientEvaluation(token, body.score, body.comment);
  }
}
