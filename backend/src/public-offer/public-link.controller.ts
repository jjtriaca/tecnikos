import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicOfferService } from './public-offer.service';
import { Public } from '../auth/decorators/public.decorator';
import { SubmitChecklistDto } from '../checklist-response/dto/submit-checklist.dto';

@ApiTags('Public Link')
@Public()
@Controller('p')
export class PublicLinkController {
  constructor(private readonly service: PublicOfferService) {}

  @Get(':token')
  getPublicView(
    @Req() req: any,
    @Param('token') token: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('ak') accessKey?: string,
  ) {
    const proto =
      (req.headers['x-forwarded-proto'] as string) ||
      (req.protocol as string) ||
      'http';
    const host =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers['host'] as string) ||
      'localhost:3000';

    const baseUrl = `${proto}://${host}`;

    const tLat = lat !== undefined ? Number(lat) : undefined;
    const tLng = lng !== undefined ? Number(lng) : undefined;

    return this.service.getPublicView(token, baseUrl, tLat, tLng, accessKey);
  }

  @Post(':token/request-otp')
  @Throttle({ default: { limit: 5, ttl: 600_000 } }) // 5 OTPs a cada 10 min por IP
  requestOtp(@Param('token') token: string, @Body('phone') phone: string) {
    return this.service.requestOtp(token, phone);
  }

  @Post(':token/accept')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  accept(@Param('token') token: string) {
    return this.service.acceptDirect(token);
  }

  @Post(':token/arrival-time')
  submitArrivalTime(
    @Param('token') token: string,
    @Body('phone') phone: string,
    @Body('selectedMinutes') selectedMinutes: number,
  ) {
    return this.service.submitArrivalTime(token, phone, selectedMinutes);
  }

  @Post(':token/decline')
  declineAfterAccept(
    @Param('token') token: string,
    @Body('phone') phone: string,
  ) {
    return this.service.declineAfterAccept(token, phone);
  }

  @Post(':token/en-route')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  enRoute(@Param('token') token: string) {
    return this.service.markEnRoute(token);
  }

  @Post(':token/start-tracking')
  startTracking(
    @Param('token') token: string,
    @Body('phone') phone: string,
  ) {
    return this.service.startTracking(token, phone);
  }

  @Post(':token/position')
  submitPosition(
    @Param('token') token: string,
    @Body('phone') phone: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
    @Body('accuracy') accuracy?: number,
    @Body('speed') speed?: number,
    @Body('heading') heading?: number,
  ) {
    return this.service.submitPosition(token, phone, lat, lng, accuracy, speed, heading);
  }

  @Get(':token/tracking-config')
  getTrackingConfig(@Param('token') token: string) {
    return this.service.getTrackingConfig(token);
  }

  @Post(':token/arrived')
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  markArrived(
    @Param('token') token: string,
    @Body('phone') phone: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    return this.service.markArrived(token, phone, lat, lng);
  }

  @Post(':token/pause')
  pauseExecution(
    @Param('token') token: string,
    @Body('phone') phone: string,
    @Body('reasonCategory') reasonCategory: string,
    @Body('reason') reason?: string,
    @Body('photos') photos?: string[],
  ) {
    return this.service.pauseExecution(token, phone, reasonCategory, reason, photos);
  }

  @Post(':token/resume')
  resumeExecution(
    @Param('token') token: string,
    @Body('phone') phone: string,
    @Body('photos') photos?: string[],
  ) {
    return this.service.resumeExecution(token, phone, photos);
  }

  @Get(':token/pause-status')
  getPauseStatus(@Param('token') token: string) {
    return this.service.getPauseStatus(token);
  }

  @Post(':token/checklist')
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  submitChecklist(
    @Param('token') token: string,
    @Body() dto: SubmitChecklistDto,
  ) {
    return this.service.submitChecklist(token, dto);
  }
}
