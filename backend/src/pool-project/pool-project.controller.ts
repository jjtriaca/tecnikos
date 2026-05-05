import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PoolProjectService } from './pool-project.service';
import { CreatePoolProjectDto } from './dto/create-pool-project.dto';
import { UpdatePoolProjectDto } from './dto/update-pool-project.dto';
import { QueryPoolProjectDto } from './dto/query-pool-project.dto';
import { CreatePoolStageDto, UpdatePoolStageDto } from './dto/stage.dto';
import {
  CreatePoolProjectEntryDto,
  UpdatePoolProjectEntryDto,
} from './dto/entry.dto';
import { CreatePoolProjectPhotoDto } from './dto/photo.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Pool Projects (Obras)')
@Controller('pool-projects')
export class PoolProjectController {
  constructor(private readonly service: PoolProjectService) {}

  @ApiOperation({ summary: 'Cria obra a partir de orçamento aprovado' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(@Body() body: CreatePoolProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Lista obras' })
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query() filters: QueryPoolProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, filters);
  }

  @ApiOperation({ summary: 'Detalhe da obra (com etapas, lançamentos, fotos)' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.companyId);
  }

  @ApiOperation({ summary: 'Atualiza obra (status, datas, progresso)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePoolProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @ApiOperation({ summary: 'Soft delete da obra' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId, user);
  }

  // ============== STAGES ==============

  @ApiOperation({ summary: 'Adiciona etapa na obra' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/stages')
  addStage(
    @Param('id') projectId: string,
    @Body() body: CreatePoolStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addStage(projectId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Atualiza etapa' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put('stages/:stageId')
  updateStage(
    @Param('stageId') stageId: string,
    @Body() body: UpdatePoolStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateStage(stageId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Remove etapa' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete('stages/:stageId')
  removeStage(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeStage(stageId, user.companyId, user);
  }

  // ============== ENTRIES (Livro Caixa) ==============

  @ApiOperation({
    summary: 'Adiciona lançamento (livro caixa da obra)',
    description:
      'Se reflectsInFinance=true, gera um FinancialEntry PAYABLE no Financeiro geral do tenant',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/entries')
  addEntry(
    @Param('id') projectId: string,
    @Body() body: CreatePoolProjectEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addEntry(projectId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Atualiza lançamento (sincroniza FinancialEntry se vinculada)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put('entries/:entryId')
  updateEntry(
    @Param('entryId') entryId: string,
    @Body() body: UpdatePoolProjectEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateEntry(entryId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Remove lançamento (cancela FinancialEntry vinculada)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete('entries/:entryId')
  removeEntry(
    @Param('entryId') entryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeEntry(entryId, user.companyId, user);
  }

  // ============== PHOTOS ==============

  @ApiOperation({ summary: 'Adiciona foto na obra' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/photos')
  addPhoto(
    @Param('id') projectId: string,
    @Body() body: CreatePoolProjectPhotoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addPhoto(projectId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Remove foto' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete('photos/:photoId')
  removePhoto(
    @Param('photoId') photoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removePhoto(photoId, user.companyId, user);
  }
}
