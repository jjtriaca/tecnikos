// C:\Users\Juliano\sistema-terceirizacao\backend\src\main.ts

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  // Aumenta limite do body para suportar importações grandes (ex: 3000+ parceiros)
  app.useBodyParser('json', { limit: '10mb' });

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

  /* ── Swagger / OpenAPI ───────────────────────────────── */
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Sistema de Terceirização — API')
      .setDescription(
        'API REST do Sistema de Terceirização (Field Service Management SaaS). ' +
        'Gestão de ordens de serviço, parceiros, workflow, automações e financeiro.',
      )
      .setVersion(process.env.npm_package_version || '1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addCookieAuth('refresh_token', { type: 'apiKey', in: 'cookie', name: 'refresh_token' })
      .addTag('Auth', 'Autenticação de gestores (login, refresh, logout)')
      .addTag('Tech Auth', 'Autenticação de técnicos (login, refresh)')
      .addTag('Service Orders', 'CRUD de ordens de serviço')
      .addTag('Partners', 'CRUD de parceiros (clientes, fornecedores, técnicos)')
      .addTag('Workflow', 'Templates e motor de workflow')
      .addTag('Automation', 'Regras de automação e templates')
      .addTag('Finance', 'Lançamentos financeiros (a receber, a pagar, repasses)')
      .addTag('Evaluation', 'Avaliações de técnicos (gestor + cliente)')
      .addTag('Users', 'Gestão de usuários do sistema')
      .addTag('Company', 'Configurações da empresa')
      .addTag('Dashboard', 'KPIs e resumos do painel')
      .addTag('Reports', 'Relatórios e exportações')
      .addTag('Health', 'Status e versão da aplicação')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
      },
      customSiteTitle: 'API Docs — Sistema Terceirização',
    });
    logger.log('📚 Swagger disponível em /api/docs');
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Backend rodando em :${port} | CORS: ${frontendUrl} | ENV: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
