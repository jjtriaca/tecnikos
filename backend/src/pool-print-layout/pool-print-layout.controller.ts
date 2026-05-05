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
import { PoolPrintLayoutService } from './pool-print-layout.service';
import {
  CreatePoolPrintLayoutDto,
  UpdatePoolPrintLayoutDto,
} from './dto/layout.dto';
import {
  CreatePoolPrintPageDto,
  UpdatePoolPrintPageDto,
  ReorderPagesDto,
} from './dto/page.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Pool Print Layouts')
@Controller('pool-print-layouts')
export class PoolPrintLayoutController {
  constructor(private readonly service: PoolPrintLayoutService) {}

  @ApiOperation({ summary: 'Cria layout de impressão' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body() body: CreatePoolPrintLayoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Lista layouts do tenant' })
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination);
  }

  @ApiOperation({ summary: 'Detalhe do layout (com páginas)' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.companyId);
  }

  @ApiOperation({ summary: 'Atualiza layout' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePoolPrintLayoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @ApiOperation({ summary: 'Remove layout (falha se em uso por orçamentos)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId, user);
  }

  // ============== PAGES (page builder) ==============

  @ApiOperation({ summary: 'Adiciona página ao layout (FIXED ou DYNAMIC)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/pages')
  addPage(
    @Param('id') layoutId: string,
    @Body() body: CreatePoolPrintPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addPage(layoutId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Atualiza página' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put('pages/:pageId')
  updatePage(
    @Param('pageId') pageId: string,
    @Body() body: UpdatePoolPrintPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updatePage(pageId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Remove página' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete('pages/:pageId')
  removePage(
    @Param('pageId') pageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removePage(pageId, user.companyId, user);
  }

  @ApiOperation({
    summary: 'Reordena páginas (drag & drop)',
    description:
      'Recebe array de pageIds na ordem desejada. Atualiza o campo `order` de cada página.',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/reorder-pages')
  reorderPages(
    @Param('id') layoutId: string,
    @Body() body: ReorderPagesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reorderPages(layoutId, body, user.companyId, user);
  }
}
