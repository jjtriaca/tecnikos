// C:\Users\Juliano\sistema-terceirizacao\backend\src\main.ts

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  /* ── Validação de env vars obrigatórias ────────────────── */
  const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      throw new Error(`⛔ Variável de ambiente obrigatória não definida: ${key}`);
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /* ── Security headers (Helmet) ────────────────────────── */
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false, // necessário para servir uploads
  }));

  app.use(cookieParser());

  // Serve uploaded files statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  /* ── CORS ──────────────────────────────────────────────── */
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Backend rodando em :${port} | CORS: ${frontendUrl} | ENV: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
