import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AsaasService } from '../tenant/asaas.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './auth.types';
import { REFRESH_COOKIE_NAME } from './auth.constants';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly asaasService: AsaasService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } }) // 10 tentativas a cada 15 min por IP
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];

    // Validate CAPTCHA if token provided (required when configured)
    await this.authService.validateCaptcha(dto.captchaToken, ip);

    const result = await this.authService.login(dto.email, dto.password, ip, ua);

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      this.authService.refreshCookieOptions(),
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30 refreshes por minuto
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];

    const result = await this.authService.refresh(oldToken, ip, ua);

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      this.authService.refreshCookieOptions(),
    );

    return { accessToken: result.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE_NAME, this.authService.clearCookieOptions());
    return { ok: true };
  }

  /** Public: returns CAPTCHA site key if configured */
  @Public()
  @Get('captcha-config')
  captchaConfig() {
    const siteKey = process.env.TURNSTILE_SITE_KEY || null;
    return { enabled: !!siteKey, siteKey };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } }) // 5 requests per 15 min
  async forgotPassword(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email é obrigatório');
    await this.authService.forgotPassword(email);
    return { ok: true, message: 'Se o email estiver cadastrado, um link de redefinição será enviado.' };
  }

  @Public()
  @Get('reset-password/:token')
  async validateResetToken(@Param('token') token: string) {
    return this.authService.validateResetToken(token);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.token || !body.password) {
      throw new BadRequestException('Token e senha são obrigatórios');
    }
    await this.authService.resetPassword(body.token, body.password);
    return { ok: true, message: 'Senha redefinida com sucesso!' };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const data = await this.authService.me(user);
    const tenantId = (req as any).tenantId;

    // Get verification status from latest VerificationSession
    let verificationStatus: string | null = null;
    if (tenantId) {
      const session = await this.prisma.verificationSession.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { reviewStatus: true },
      });
      verificationStatus = session?.reviewStatus || null;
    }

    return {
      ...data,
      tenantStatus: (req as any).tenantStatus || null,
      verificationStatus, // PENDING | APPROVED | REJECTED | null
    };
  }

  @Get('billing-status')
  async billingStatus(@Req() req: Request) {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return { hasSubscription: false };
    return this.asaasService.getBillingStatus(tenantId);
  }

  @Post('upgrade-plan')
  @HttpCode(HttpStatus.OK)
  async upgradePlan(
    @Req() req: Request,
    @Body() body: { newPlanId: string },
  ) {
    const tenantId = (req as any).tenantId;
    if (!tenantId) throw new BadRequestException('Não autenticado ou sem tenant');
    if (!body.newPlanId) throw new BadRequestException('newPlanId é obrigatório');

    const result = await this.asaasService.createUpgradeCheckout(tenantId, body.newPlanId);
    return {
      success: true,
      checkoutUrl: result.checkoutUrl,
      message: 'Checkout de upgrade criado!',
    };
  }

  /* ── Device / Session management ────────────────────────── */

  @Get('sessions')
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getActiveSessions(user.id);
  }

  @Delete('sessions/:id')
  async revokeSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.revokeSession(sessionId, user.id);
  }

  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAllOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const currentRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || '';
    return this.authService.revokeAllOtherSessions(user.id, currentRefreshToken);
  }
}
