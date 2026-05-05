import { PartialType } from '@nestjs/swagger';
import { CreatePoolBudgetTemplateDto } from './create-pool-budget-template.dto';

export class UpdatePoolBudgetTemplateDto extends PartialType(CreatePoolBudgetTemplateDto) {}
