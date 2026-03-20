// Bot module for combat AI
import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { TurnModule } from '../turn/turn.module';
import { RedisModule } from '../../shared/redis/redis.module';

@Module({
  imports: [TurnModule, RedisModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
