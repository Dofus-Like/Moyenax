import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerStatsService } from './player-stats.service';

@Module({
  providers: [PlayerService, PlayerStatsService],
  exports: [PlayerService, PlayerStatsService],
})
export class PlayerModule {}
