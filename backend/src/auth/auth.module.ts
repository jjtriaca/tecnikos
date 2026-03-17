import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TechAuthController } from './tech-auth.controller';
import { TechAuthService } from './tech-auth.service';
import { OtpService } from './otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailModule } from '../email/email.module';
import { TenantModule } from '../tenant/tenant.module';
import { NotificationModule } from '../notification/notification.module';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      '⛔ JWT_SECRET não configurado ou muito curto (mínimo 32 caracteres). ' +
      'Defina no .env: JWT_SECRET=<string aleatória de 32+ chars>',
    );
  }
  return secret;
}

@Module({
  imports: [
    EmailModule,
    NotificationModule,
    forwardRef(() => TenantModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: {
        expiresIn: Number(process.env.JWT_ACCESS_TTL_SECONDS) || 900,
      },
    }),
  ],
  controllers: [AuthController, TechAuthController],
  providers: [AuthService, TechAuthService, OtpService, JwtStrategy],
  exports: [AuthService, TechAuthService, OtpService, JwtModule],
})
export class AuthModule {}
