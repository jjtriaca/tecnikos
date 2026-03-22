import {
  Controller, Post, Get, Delete, Param, Query,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Upload')
@Controller('service-orders/:orderId/attachments')
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: string,
    @Query('stepOrder') stepOrder: string | undefined,
    @Query('blockId') blockId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!type) throw new BadRequestException('Tipo obrigatório (ANTES, DEPOIS, WORKFLOW_STEP, OUTRO)');

    const uploadedBy = user.technicianId || user.id;
    return this.service.upload(
      orderId,
      user.companyId,
      uploadedBy,
      file,
      type,
      stepOrder ? parseInt(stepOrder, 10) : undefined,
      blockId,
    );
  }

  @Get()
  findByOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findByOrder(orderId, user.companyId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId);
  }
}
