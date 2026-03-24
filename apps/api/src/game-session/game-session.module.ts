import { Module } from '@nestjs/common';
import { SessionModule } from '../combat/session/session.module';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { RedisModule } from '../shared/redis/redis.module';
import { SecurityModule } from '../shared/security/security.module';
import { SseModule } from '../shared/sse/sse.module';
import { GameSessionController } from './game-session.controller';
import { GameSessionService } from './game-session.service';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [PrismaModule, RedisModule, SecurityModule, SseModule, SessionModule],
  controllers: [GameSessionController],
  providers: [GameSessionService, MatchmakingService],
  exports: [GameSessionService],
})
export class GameSessionModule {}
