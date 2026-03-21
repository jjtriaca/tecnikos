import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { TechAuthService } from './tech-auth.service';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './auth.types';

const TECH_REFRESH_COOKIE = 'tech_refresh_token';

@ApiTags('Tech Auth')
@Controller('tech-auth')
export class TechAuthController {
  constructor(
    private readonly techAuth: TechAuthService,
    private readonly authService: AuthService,
  ) {}

  /* ─── OTP: Solicitar código ──────────────────────────── */
  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar código OTP para login do técnico' })
  @Throttle({ default: { limit: 5, ttl: 600_000 } }) // 5 requests a cada 10 min por IP
  async requestOtp(@Body() body: { phone: string }) {
    return this.techAuth.requestOtp(body.phone);
  }

  /* ─── OTP: Verificar código e logar ─────────────────── */
  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar OTP e criar sessão do técnico' })
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  async loginWithOtp(
    @Body() body: { phone: string; code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];

    const result = await this.techAuth.loginWithOtp(body.phone, body.code, ip, ua);

    res.cookie(TECH_REFRESH_COOKIE, result.refreshToken, this.techAuth.refreshCookieOptions());

    return {
      accessToken: result.accessToken,
      deviceToken: result.deviceToken,
      technician: result.technician,
    };
  }

  /* ─── TOKEN: Login via link (boas-vindas ou OS) ──────── */
  @Public()
  @Post('token/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login via token (link de boas-vindas ou OS)' })
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  async loginWithToken(
    @Param('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];

    const result = await this.techAuth.loginWithToken(token, ip, ua);

    res.cookie(TECH_REFRESH_COOKIE, result.refreshToken, this.techAuth.refreshCookieOptions());

    return {
      accessToken: result.accessToken,
      deviceToken: (result as any).deviceToken,
      technician: result.technician,
      type: result.type,
      serviceOrderId: (result as any).serviceOrderId,
      contractToken: (result as any).contractToken,
    };
  }

  /* ─── LOGIN (legacy email+password) ──────────────────── */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async login(
    @Body() body: { email: string; password: string; captchaToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];

    await this.authService.validateCaptcha(body.captchaToken, ip);

    const result = await this.techAuth.login(body.email, body.password, ip, ua);

    res.cookie(TECH_REFRESH_COOKIE, result.refreshToken, this.techAuth.refreshCookieOptions());

    return {
      accessToken: result.accessToken,
      deviceToken: result.deviceToken,
      technician: result.technician,
    };
  }

  /* ─── DEVICE RECOVER (PWA persistent auth) ─────────── */
  @Public()
  @Post('device-recover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recuperar sessão via device token (PWA)' })
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async deviceRecover(
    @Body() body: { deviceToken: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];

    const result = await this.techAuth.deviceRecover(body.deviceToken, ip, ua);

    res.cookie(TECH_REFRESH_COOKIE, result.refreshToken, this.techAuth.refreshCookieOptions());

    return {
      accessToken: result.accessToken,
      deviceToken: result.deviceToken,
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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[TECH_REFRESH_COOKIE];
    // technicianId comes from JWT, never from request body (prevents revoking others' tokens)
    const techId = user?.partnerId || user?.technicianId;
    await this.techAuth.logout(token, techId);
    res.clearCookie(TECH_REFRESH_COOKIE, this.techAuth.clearCookieOptions());
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.techAuth.me(user);
  }

  /* ─── MY ORDERS (active OS for technician) ─────────── */
  @Get('my-orders')
  @ApiOperation({ summary: 'Listar OS ativas do técnico autenticado' })
  async myOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.techAuth.myOrders(user);
  }
}
