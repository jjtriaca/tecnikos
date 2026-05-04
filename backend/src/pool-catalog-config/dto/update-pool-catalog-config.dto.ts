import { PartialType } from '@nestjs/swagger';
import { CreatePoolCatalogConfigDto } from './create-pool-catalog-config.dto';

export class UpdatePoolCatalogConfigDto extends PartialType(CreatePoolCatalogConfigDto) {}
