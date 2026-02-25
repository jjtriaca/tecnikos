import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { TechAuthService } from './tech-auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './auth.types';

const TECH_REFRESH_COOKIE = 'tech_refresh_token';

@ApiTags('Tech Auth')
@Controller('tech-auth')
export class TechAuthController {
  constructor(private readonly techAuth: TechAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } }) // 10 tentativas a cada 15 min por IP
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];

    const result = await this.techAuth.login(body.email, body.password, ip, ua);

    res.cookie(TECH_REFRESH_COOKIE, result.refreshToken, this.techAuth.refreshCookieOptions());

    return {
      accessToken: result.accessToken,
      technician: result.technician,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldToken = req.cookies?.[TECH_REFRESH_COOKIE];
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];

    const result = await this.techAuth.refresh(oldToken, ip, ua);

    res.cookie(TECH_REFRESH_COOKIE, result.refreshToken, this.techAuth.refreshCookieOptions());

    return { accessToken: result.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[TECH_REFRESH_COOKIE];
    await this.techAuth.logout(token);
    res.clearCookie(TECH_REFRESH_COOKIE, this.techAuth.clearCookieOptions());
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.techAuth.me(user);
  }
}
