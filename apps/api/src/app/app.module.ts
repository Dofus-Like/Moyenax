import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { RedisModule } from '../shared/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';
import { WorldModule } from '../world/world.module';
import { EconomyModule } from '../economy/economy.module';
import { CombatModule } from '../combat/combat.module';
import { GameSessionModule } from '../game-session/game-session.module';
import { SseModule } from '../shared/sse/sse.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    SseModule,
    AuthModule,
    PlayerModule,
    WorldModule,
    EconomyModule,
    CombatModule,
    GameSessionModule,
  ],
})
export class AppModule {}
