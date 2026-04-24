import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerSpellProjectionService } from './player-spell-projection.service';
import { PlayerStatsService } from './player-stats.service';
import { StatsCalculatorService } from './stats-calculator.service';
import { SpellResolverService } from './spell-resolver.service';
import { PlayerController } from './player.controller';
import { PrismaModule } from '../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    PlayerService,
    PlayerStatsService,
    StatsCalculatorService,
    PlayerSpellProjectionService,
    SpellResolverService,
  ],
  controllers: [PlayerController],
  exports: [
    PlayerService,
    PlayerStatsService,
    StatsCalculatorService,
    PlayerSpellProjectionService,
    SpellResolverService,
  ],
})
export class PlayerModule {}
