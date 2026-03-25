import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PartnerService } from './partner.service';
import { SefazConsultaCadastroService } from './sefaz-consulta-cadastro.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { UpdatePartnerStatusDto } from './dto/update-status.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('Partners')
@Controller('partners')
export class PartnerController {
  constructor(
    private readonly service: PartnerService,
    private readonly sefazConsulta: SefazConsultaCadastroService,
  ) {}

  @Get()
  findAll(
    @Query('type') type: string | undefined,
    @Query('status') status: string | undefined,
    @Query('personType') personType: string | undefined,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, { type, status, personType }, pagination);
  }

  @Get('by-specializations')
  findBySpecializations(
    @Query('ids') ids: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const specializationIds = ids ? ids.split(',').filter(Boolean) : [];
    return this.service.findBySpecializations(user.companyId, specializationIds);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get('sefaz-lookup')
  @ApiOperation({ summary: 'Consulta cadastro de contribuinte na SEFAZ (CadConsultaCadastro4)' })
  async sefazLookup(
    @Query('cpf') cpf: string | undefined,
    @Query('cnpj') cnpj: string | undefined,
    @Query('ie') ie: string | undefined,
    @Query('uf') uf: string,
    @Query('partnerId') partnerId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.sefazConsulta.consultaCadastro(user.companyId, uf, { cpf, cnpj, ie });

    // If partnerId provided, update ieStatus and ieLastCheck on the partner record
    if (partnerId && result.ieStatus) {
      await this.service.updateIeStatus(partnerId, user.companyId, result.ieStatus, result.ie).catch(() => {});
    } else if (cpf) {
      // Try to find partner by CPF and update
      await this.service.updateIeStatusByCpf(cpf.replace(/\D/g, ''), user.companyId, result.ieStatus, result.ie).catch(() => {});
    }

    return result;
  }

  @Get('check-duplicate')
  checkDuplicate(
    @Query('document') document: string,
    @Query('excludeId') excludeId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.checkDuplicateDocument(user.companyId, document, excludeId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('import')
  importMany(
    @Body('partners') partners: CreatePartnerDto[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.importMany(user.companyId, partners, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body() body: CreatePartnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(user.companyId, body, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePartnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @Roles(UserRole.ADMIN)
  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdatePartnerStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, user.companyId, body.status, user);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId, user);
  }

  // ========== CONTACTS ==========

  @Get(':partnerId/contacts')
  listContacts(
    @Param('partnerId') partnerId: string,
    @Query('type') type: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listContacts(partnerId, user.companyId, type);
  }

  @Post(':partnerId/contacts')
  createContact(
    @Param('partnerId') partnerId: string,
    @Body() body: { type: string; value: string; label?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createContact(partnerId, user.companyId, body);
  }

  @Put(':partnerId/contacts/:contactId')
  updateContact(
    @Param('partnerId') partnerId: string,
    @Param('contactId') contactId: string,
    @Body() body: { value?: string; label?: string; active?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateContact(partnerId, contactId, user.companyId, body);
  }

  @Delete(':partnerId/contacts/:contactId')
  deleteContact(
    @Param('partnerId') partnerId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteContact(partnerId, contactId, user.companyId);
  }

  @Post(':partnerId/contacts/:contactId/mark-used')
  markContactUsed(
    @Param('partnerId') partnerId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.markContactUsed(partnerId, contactId, user.companyId);
  }
}
