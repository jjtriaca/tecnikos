import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, AdjustStockDto } from './dto/update-product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  /* ── List ────────────────────────────────────────────────── */

  @Roles(UserRole.ADMIN)
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query('category') category: string | undefined,
    @Query('status') status: string | undefined,
    @Query('brand') brand: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, {
      category,
      status,
      brand,
    });
  }

  /* ── Detail ─────────────────────────────────────────────── */

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  /* ── Create ─────────────────────────────────────────────── */

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user.companyId);
  }

  /* ── Update ─────────────────────────────────────────────── */

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, dto);
  }

  /* ── Delete (soft) ──────────────────────────────────────── */

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.delete(id, user.companyId);
  }

  /* ── Stock Adjustment ───────────────────────────────────── */

  @Roles(UserRole.ADMIN)
  @Patch(':id/stock')
  adjustStock(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.adjustStock(id, user.companyId, dto.delta, dto.reason);
  }

  /* ── Equivalents ────────────────────────────────────────── */

  @Roles(UserRole.ADMIN)
  @Get(':id/equivalents')
  findEquivalents(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findEquivalents(id, user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/equivalents')
  addEquivalent(
    @Param('id') id: string,
    @Body() data: { supplierId: string; supplierCode: string; supplierDescription?: string; lastPriceCents?: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addEquivalent(id, user.companyId, data);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/equivalents/:eqId')
  removeEquivalent(
    @Param('id') id: string,
    @Param('eqId') eqId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeEquivalent(id, eqId, user.companyId);
  }
}
