import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TechAuthController } from './tech-auth.controller';
import { TechAuthService } from './tech-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
      signOptions: {
        expiresIn: Number(process.env.JWT_ACCESS_TTL_SECONDS) || 900,
      },
    }),
  ],
  controllers: [AuthController, TechAuthController],
  providers: [AuthService, TechAuthService, JwtStrategy],
  exports: [AuthService, TechAuthService, JwtModule],
})
export class AuthModule {}
