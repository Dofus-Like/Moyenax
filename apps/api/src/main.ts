import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { performance } from 'node:perf_hooks';
import { AppModule } from './app/app.module';
import { PerfLoggerService } from './shared/perf/perf-logger.service';
import { RuntimePerfService } from './shared/perf/runtime-perf.service';

async function bootstrap() {
  const bootstrapStartedAt = performance.now();
  const app = await NestFactory.create(AppModule);
  const perfLogger = app.get(PerfLoggerService);
  const configService = app.get(ConfigService);
  const runtimePerf = app.get(RuntimePerfService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(helmet());

  perfLogger.logDuration(
    'bootstrap',
    'nest_factory.create',
    performance.now() - bootstrapStartedAt,
    {
      stage: 'create',
    },
  );

  app.setGlobalPrefix('api/v1');

  const allowedOrigins = (configService.get<string>('FRONTEND_URL', 'http://localhost:5173') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Server-Timing', 'x-request-id'],
  });

  const swaggerEnabled = configService.get<string>('ENABLE_SWAGGER', 'false') === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Moyenax API')
      .setDescription('API pour le jeu de strategie au tour par tour')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const swaggerStartedAt = performance.now();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    perfLogger.logDuration('bootstrap', 'swagger.setup', performance.now() - swaggerStartedAt, {
      stage: 'swagger',
    });
  }

  const port = configService.get<number>('PORT', 3000);
  const listenStartedAt = performance.now();
  await app.listen(port);
  perfLogger.logDuration('bootstrap', 'app.listen', performance.now() - listenStartedAt, {
    stage: 'listen',
    port,
  });

  const memoryUsage = process.memoryUsage();
  perfLogger.logEvent(
    'bootstrap',
    'api.ready',
    {
      api_bootstrap_ms: Number((performance.now() - bootstrapStartedAt).toFixed(2)),
      api_dev_ready_ms: Number((performance.now() - bootstrapStartedAt).toFixed(2)),
      runtime_mode: process.env.PERF_RUNTIME_MODE ?? process.env.NODE_ENV ?? 'development',
      port,
      rss_mb_at_ready: Number((memoryUsage.rss / (1024 * 1024)).toFixed(2)),
      heap_mb_at_ready: Number((memoryUsage.heapUsed / (1024 * 1024)).toFixed(2)),
      ...runtimePerf.getStartupSnapshot(),
    },
    { force: true },
  );
  console.log(`API running on http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`Swagger docs on http://localhost:${port}/api/docs`);
  }
}

bootstrap();
