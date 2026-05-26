import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
    @Query('usage') usage: 'sale' | 'work' | 'both' | undefined,
    @Query('poolType') poolType: string | undefined,
    @Query('finalidade') finalidade: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, {
      category,
      status,
      brand,
      usage,
      poolType,
      finalidade,
    });
  }

  /* ── List pool types (DISTINCT) — alimenta dropdown da regra ── */

  @Roles(UserRole.ADMIN)
  @Get('pool-types')
  listPoolTypes(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listPoolTypes(user.companyId);
  }

  /* ── v1.12.46: Products do tenant com poolType definido, formato
       enxuto pra alimentar AutoSelectModal do Simulador (mesclado
       com PoolCatalogConfig no frontend). ── */
  @Get('for-pool-simulator')
  listForPoolSimulator(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listForPoolSimulator(user.companyId);
  }

  /* ── CRUD de pool types pra UI de gerenciamento ── */

  @Roles(UserRole.ADMIN)
  @Get('pool-types/manage')
  listPoolTypesManage(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listPoolTypesManage(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Post('pool-types')
  createPoolType(
    @Body() body: { name: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createPoolType(user.companyId, body?.name);
  }

  @Roles(UserRole.ADMIN)
  @Post('pool-types/rename')
  renamePoolType(
    @Body() body: { oldName: string; newName: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.renamePoolType(user.companyId, body?.oldName, body?.newName);
  }

  @Roles(UserRole.ADMIN)
  @Post('pool-types/delete')
  deletePoolType(
    @Body() body: { name: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deletePoolType(user.companyId, body?.name);
  }

  @Roles(UserRole.ADMIN)
  @Post('pool-types/required-fields')
  setTypeRequiredFields(
    @Body() body: { name: string; requiredFields: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setTypeRequiredFields(user.companyId, body?.name, body?.requiredFields ?? []);
  }

  /* ── Upload de imagem do produto ── */

  @Roles(UserRole.ADMIN)
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.uploadImage(id, user.companyId, file);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/image')
  removeImage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeImage(id, user.companyId);
  }

  /* ── List filter options (categories + brands + poolTypes) ── */

  @Roles(UserRole.ADMIN)
  @Get('filter-options')
  listFilterOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listFilterOptions(user.companyId);
  }

  /* ── Sem Produto placeholder (idempotente) ── */

  @Roles(UserRole.ADMIN)
  @Get('sem-produto')
  ensureSemProduto(@CurrentUser() user: AuthenticatedUser) {
    return this.service.ensureSemProduto(user.companyId);
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
