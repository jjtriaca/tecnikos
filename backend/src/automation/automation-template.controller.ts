import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { AutomationTemplateService } from './automation-template.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

/* ── DTOs ───────────────────────────────────────────────── */

class CreateFromRuleDto {
  @IsString()
  @IsNotEmpty()
  ruleId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  category: string;
}

class ApplyTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;
}

/* ── Controller ─────────────────────────────────────────── */

@Controller('automation-templates')
export class AutomationTemplateController {
  constructor(private readonly service: AutomationTemplateService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('from-rule')
  createFromRule(@Body() dto: CreateFromRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createFromRule(dto.ruleId, user.companyId, {
      name: dto.name,
      description: dto.description,
      category: dto.category,
    });
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/apply')
  applyTemplate(
    @Param('id') id: string,
    @Body() dto: ApplyTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.applyTemplate(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId);
  }
}
