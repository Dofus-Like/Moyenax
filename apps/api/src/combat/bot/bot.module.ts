// Bot module for combat AI
import { Module } from '@nestjs/common';

import { RedisModule } from '../../shared/redis/redis.module';
import { TurnModule } from '../turn/turn.module';

import { BotService } from './bot.service';

@Module({
  imports: [TurnModule, RedisModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
