import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { AppModule } from '../../src/app/app.module';
import { CombatWatchdogService } from '../../src/combat/turn/combat-watchdog.service';
import { AppThrottlerGuard } from '../../src/shared/security/app-throttler.guard';
import { PrismaService } from '../../src/shared/prisma/prisma.service';
import { RedisService } from '../../src/shared/redis/redis.service';

// Désactive le throttler en environnement de test pour éviter les 429 parasites.
class NoopThrottlerGuard {
  canActivate() {
    return true;
  }
}

/**
 * Boot un stack complet API + Postgres + Redis via testcontainers.
 * À utiliser dans les suites d'intégration (jest --config=apps/api/jest.integration.config.cts).
 *
 * Coût : ~15-20s au démarrage par suite. Une seule instance pour tout le module via
 * `beforeAll`/`afterAll`. Ne pas appeler en `beforeEach`.
 */
export interface TestAppContext {
  app: INestApplication;
  pg: StartedPostgreSqlContainer;
  redis: StartedRedisContainer;
  prisma: PrismaService;
  redisService: RedisService;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestAppContext> {
  const pg = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_pass')
    .start();

  const redis = await new RedisContainer('redis:7-alpine').start();

  // Variables d'env nécessaires pour le boot.
  // JWT_SECRET est fixé AVANT l'import d'AppModule pour que ConfigService le lise correctement.
  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'integration-test-secret-at-least-32-chars-long-xxxxxx';

  // Appliquer le schéma Prisma
  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
  execSync(`npx prisma db push --schema=${schemaPath} --accept-data-loss --skip-generate`, {
    env: { ...process.env },
    stdio: 'inherit',
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Désactiver le watchdog scheduling pour éviter des ticks intempestifs pendant les tests
    .overrideProvider(CombatWatchdogService)
    .useFactory({
      factory: () => ({
        scanStuckCombats: async () => undefined,
        doScan: async () => ({ scanned: 0, timedOut: 0 }),
        disable: () => undefined,
        enable: () => undefined,
      }),
    })
    // Désactiver le rate limiter pour éviter les 429 dans les tests.
    // Le throttler est enregistré via APP_GUARD → on override ce token.
    .overrideProvider(APP_GUARD)
    .useClass(NoopThrottlerGuard)
    .overrideGuard(AppThrottlerGuard)
    .useValue(new NoopThrottlerGuard())
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.setGlobalPrefix('api/v1');
  await app.init();

  const prisma = app.get(PrismaService);
  const redisService = app.get(RedisService);

  return {
    app,
    pg,
    redis,
    prisma,
    redisService,
    close: async () => {
      await app.close();
      await pg.stop();
      await redis.stop();
    },
  };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  // Ordre important: relations FK
  const tables = [
    'SessionItem',
    'EquipmentSlot',
    'InventoryItem',
    'PlayerSpell',
    'CombatTurn',
    'CombatSession',
    'GameSession',
    'PlayerStats',
    'Spell',
    'Item',
    'Player',
  ];
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    } catch (err) {
      // certaines tables peuvent ne pas exister si le schéma a changé
    }
  }
}
