import { PartialType } from '@nestjs/swagger';
import { CreatePoolBudgetDto } from './create-pool-budget.dto';

export class UpdatePoolBudgetDto extends PartialType(CreatePoolBudgetDto) {}
