import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startedAt = new Date();
  private versionFilePath = path.join(process.cwd(), '..', 'version.json');

  constructor(private readonly prisma: PrismaService) {}

  private loadVersion(): { version: string; codename: string; releasedAt: string } {
    try {
      const raw = fs.readFileSync(this.versionFilePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { version: '0.00.00', codename: 'unknown', releasedAt: new Date().toISOString() };
    }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Status e versão da aplicação' })
  @ApiOkResponse({ description: 'Aplicação saudável' })
  health() {
    const v = this.loadVersion();
    return {
      status: 'ok',
      version: v.version,
      codename: v.codename,
      releasedAt: v.releasedAt,
      uptime: Math.floor(process.uptime()),
      startedAt: this.startedAt.toISOString(),
      timestamp: new Date().toISOString(),
      node: process.version,
      env: process.env.NODE_ENV || 'development',
    };
  }

  @Public()
  @Get('db')
  @ApiOperation({ summary: 'Verificar conexão com banco de dados' })
  async dbHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      return { status: 'error', database: 'disconnected' };
    }
  }
}
