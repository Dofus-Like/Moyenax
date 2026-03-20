import { Module } from '@nestjs/common';
import { GameSessionService } from './game-session.service';
import { GameSessionController } from './game-session.controller';
import { MatchmakingService } from './matchmaking.service';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { RedisModule } from '../shared/redis/redis.module';
import { SseModule } from '../shared/sse/sse.module';
import { SessionModule } from '../combat/session/session.module';

@Module({
  imports: [PrismaModule, RedisModule, SseModule, SessionModule],
  controllers: [GameSessionController],
  providers: [GameSessionService, MatchmakingService],
  exports: [GameSessionService],
})
export class GameSessionModule {}
