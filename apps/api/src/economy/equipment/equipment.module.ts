import { Module } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';

import { PlayerModule } from '../../player/player.module';
import { CombatModule } from '../../combat/combat.module';
import { GameSessionModule } from '../../game-session/game-session.module';

@Module({
  imports: [PrismaModule, PlayerModule, CombatModule, GameSessionModule],
  providers: [EquipmentService],
  controllers: [EquipmentController],
  exports: [EquipmentService],
})
export class EquipmentModule {}
