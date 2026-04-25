import { Module } from '@nestjs/common';

import { PrismaModule } from '../shared/prisma/prisma.module';

import { PlayerSpellProjectionService } from './player-spell-projection.service';
import { PlayerStatsService } from './player-stats.service';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { SpellResolverService } from './spell-resolver.service';
import { StatsCalculatorService } from './stats-calculator.service';


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
