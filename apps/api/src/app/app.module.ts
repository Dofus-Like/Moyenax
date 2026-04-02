import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { PerfModule } from '../shared/perf/perf.module';
import { RequestContextMiddleware } from '../shared/perf/request-context.middleware';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { RedisModule } from '../shared/redis/redis.module';
import { SecurityModule } from '../shared/security/security.module';
import { AppThrottlerGuard } from '../shared/security/app-throttler.guard';
import { validateEnv } from '../shared/security/env.validation';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';
import { WorldModule } from '../world/world.module';
import { EconomyModule } from '../economy/economy.module';
import { CombatModule } from '../combat/combat.module';
import { GameSessionModule } from '../game-session/game-session.module';
import { HealthModule } from '../health/health.module';
import { SseModule } from '../shared/sse/sse.module';

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
