import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private versionFilePath = path.join(process.cwd(), '..', 'version.json');

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
  health() {
    const v = this.loadVersion();
    return {
      status: 'ok',
      version: v.version,
      codename: v.codename,
      releasedAt: v.releasedAt,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
