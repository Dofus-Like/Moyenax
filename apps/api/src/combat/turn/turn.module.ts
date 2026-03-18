import { Module } from '@nestjs/common';
import { TurnService } from './turn.service';
import { TurnController } from './turn.controller';
import { RedisModule } from '../../shared/redis/redis.module';
import { SseModule } from '../../shared/sse/sse.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [RedisModule, SseModule, EventEmitterModule.forRoot()],
  controllers: [TurnController],
  providers: [TurnService],
  exports: [TurnService],
})
export class TurnModule {}
