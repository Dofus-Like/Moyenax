import { Module } from '@nestjs/common';
import { TurnService } from './turn.service';
import { RedisModule } from '../../shared/redis/redis.module';
import { SseModule } from '../../shared/sse/sse.module';

@Module({
  imports: [RedisModule, SseModule],
  providers: [TurnService],
  exports: [TurnService],
})
export class TurnModule {}
