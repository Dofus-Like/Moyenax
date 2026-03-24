import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '../../shared/redis/redis.module';
import { SseModule } from '../../shared/sse/sse.module';
import { TurnController } from './turn.controller';
import { TurnDebugController } from './turn.debug.controller';
import { TurnService } from './turn.service';

const debugControllers =
  process.env.ENABLE_DEBUG_ROUTES === 'true' ? [TurnDebugController] : [];

@Module({
  imports: [RedisModule, SseModule, EventEmitterModule.forRoot()],
  controllers: [TurnController, ...debugControllers],
  providers: [TurnService],
  exports: [TurnService],
})
export class TurnModule {}
