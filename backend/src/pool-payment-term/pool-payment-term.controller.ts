import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PoolPaymentTermService } from './pool-payment-term.service';
import {
  CreatePoolPaymentTermDto,
  UpdatePoolPaymentTermDto,
} from './dto/pool-payment-term.dto';

@ApiTags('Pool Payment Terms')
@Controller('pool-payment-terms')
export class PoolPaymentTermController {
  constructor(private readonly service: PoolPaymentTermService) {}

  @ApiOperation({ summary: 'Lista formas de pagamento (auto-popula com defaults)' })
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.companyId);
  }

  @ApiOperation({ summary: 'Busca por ID' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.companyId);
  }

  @ApiOperation({ summary: 'Cria forma de pagamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(@Body() dto: CreatePoolPaymentTermDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.companyId, dto);
  }

  @ApiOperation({ summary: 'Atualiza forma de pagamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePoolPaymentTermDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, dto);
  }

  @ApiOperation({ summary: 'Soft delete' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId);
  }
}
