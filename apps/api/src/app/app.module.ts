import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, seconds } from '@nestjs/throttler';

import { AuthModule } from '../auth/auth.module';
import { CombatModule } from '../combat/combat.module';
import { EconomyModule } from '../economy/economy.module';
import { GameSessionModule } from '../game-session/game-session.module';
import { HealthModule } from '../health/health.module';
import { PlayerModule } from '../player/player.module';
import { PerfModule } from '../shared/perf/perf.module';
import { RequestContextMiddleware } from '../shared/perf/request-context.middleware';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { RedisModule } from '../shared/redis/redis.module';
import { AppThrottlerGuard } from '../shared/security/app-throttler.guard';
import { validateEnv } from '../shared/security/env.validation';
import { SecurityModule } from '../shared/security/security.module';
import { SseModule } from '../shared/sse/sse.module';
import { VersionModule } from '../version/version.module';
import { WorldModule } from '../world/world.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: seconds(60),
        limit: 120,
      },
    ]),
    PerfModule,
    PrismaModule,
    RedisModule,
    SecurityModule,
    SseModule,
    AuthModule,
    PlayerModule,
    WorldModule,
    EconomyModule,
    CombatModule,
    GameSessionModule,
    HealthModule,
    VersionModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
