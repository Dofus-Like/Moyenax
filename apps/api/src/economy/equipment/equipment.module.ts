import { Module } from '@nestjs/common';


import { CombatModule } from '../../combat/combat.module';
import { GameSessionModule } from '../../game-session/game-session.module';
import { PlayerModule } from '../../player/player.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';

import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [PrismaModule, PlayerModule, CombatModule, GameSessionModule],
  providers: [EquipmentService],
  controllers: [EquipmentController],
  exports: [EquipmentService],
})
export class EquipmentModule {}
