import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { QuoteService } from './quote.service';
import { QuotePdfService } from './quote-pdf.service';

@ApiTags('Quote Public')
@Public()
@Controller('q')
export class QuotePublicController {
  constructor(
    private readonly service: QuoteService,
    private readonly pdfService: QuotePdfService,
  ) {}

  @Get(':token')
  getPublicView(@Param('token') token: string) {
    return this.service.findByPublicToken(token);
  }

  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post(':token/approve')
  approve(
    @Param('token') token: string,
    @Body('name') name: string,
  ) {
    if (!name || !name.trim()) {
      throw new Error('Nome do aprovador é obrigatório');
    }
    return this.service.approvePublic(token, name.trim());
  }

  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post(':token/reject')
  reject(
    @Param('token') token: string,
    @Body('reason') reason: string | undefined,
  ) {
    return this.service.rejectPublic(token, reason);
  }

  @Get(':token/pdf')
  async downloadPdf(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    // Validate token first
    const quote = await this.service.findByPublicToken(token);
    const buffer = await this.pdfService.generatePdf(
      (quote as any).id,
      (quote as any).companyId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="orcamento-${(quote as any).code || 'download'}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
