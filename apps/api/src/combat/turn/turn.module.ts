import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '../../shared/redis/redis.module';
import { SecurityModule } from '../../shared/security/security.module';
import { SseModule } from '../../shared/sse/sse.module';
import { SpellsModule } from '../spells/spells.module';
import { CombatWatchdogService } from './combat-watchdog.service';
import { TurnController } from './turn.controller';
import { TurnDebugController } from './turn.debug.controller';
import { TurnService } from './turn.service';

const debugControllers = process.env.ENABLE_DEBUG_ROUTES === 'true' ? [TurnDebugController] : [];

@Module({
  imports: [
    RedisModule,
    SseModule,
    SpellsModule,
    SecurityModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  controllers: [TurnController, ...debugControllers],
  providers: [TurnService, CombatWatchdogService],
  exports: [TurnService],
})
export class TurnModule {}
