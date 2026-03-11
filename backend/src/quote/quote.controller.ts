import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { QuoteService } from './quote.service';
import { QuotePdfService } from './quote-pdf.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

@ApiTags('Quotes')
@Controller('quotes')
export class QuoteController {
  constructor(
    private readonly service: QuoteService,
    private readonly pdfService: QuotePdfService,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body() body: CreateQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(body, user.companyId, user);
  }

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query('status') status: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('serviceOrderId') serviceOrderId: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, {
      status,
      clientId,
      serviceOrderId,
      dateFrom,
      dateTo,
    });
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.service.stats(user.companyId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/send')
  send(
    @Param('id') id: string,
    @Body() body: SendQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.send(id, user.companyId, body, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(id, user.companyId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reject(id, user.companyId, user, reason);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(id, user.companyId, user, reason);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.duplicate(id, user.companyId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/create-os')
  createOs(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createOsFromQuote(id, user.companyId, user);
  }

  @Get(':id/pdf')
  async getPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.pdfService.generatePdf(id, user.companyId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="orcamento-${id.slice(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ---- Attachments (partner PDFs) ----

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const dir = `${UPLOAD_DIR}/${(req as any).user?.companyId}/quotes`;
          require('fs').mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  async addAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('label') label: string | undefined,
    @Body('supplierName') supplierName: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new Error('Arquivo não fornecido');
    }
    return this.service.addAttachment(id, user.companyId, {
      fileName: file.originalname,
      filePath: file.path.replace(/\\/g, '/'),
      fileSize: file.size,
      mimeType: file.mimetype,
      label,
      supplierName,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeAttachment(attachmentId, user.companyId);
  }
}
