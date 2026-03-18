import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { SseModule } from '../../shared/sse/sse.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { PlayerModule } from '../../player/player.module';
import { MapModule } from '../map/map.module';

@Module({
  imports: [PrismaModule, RedisModule, SseModule, PlayerModule, MapModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
