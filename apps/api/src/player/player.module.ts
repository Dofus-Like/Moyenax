import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerStatsService } from './player-stats.service';
import { StatsCalculatorService } from './stats-calculator.service';
import { PlayerController } from './player.controller';
import { PrismaModule } from '../shared/prisma/prisma.module';


@Module({
  imports: [PrismaModule],
  providers: [PlayerService, PlayerStatsService, StatsCalculatorService],
  controllers: [PlayerController],
  exports: [PlayerService, PlayerStatsService, StatsCalculatorService],
})
export class PlayerModule {}
