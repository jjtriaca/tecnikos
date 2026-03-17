import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SuggestionService } from './suggestion.service';
import { CreateSuggestionDto, UpdateSuggestionStatusDto } from './dto/create-suggestion.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('Suggestions')
@Controller('suggestions')
export class SuggestionController {
  constructor(private readonly service: SuggestionService) {}

  @Post()
  create(
    @Body() dto: CreateSuggestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user.id, user.companyId);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user.companyId, status);
  }

  @Roles(UserRole.ADMIN)
  @Get('global')
  findAllGlobal(@Query('status') status?: string) {
    return this.service.findAllGlobal(status);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSuggestionStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
