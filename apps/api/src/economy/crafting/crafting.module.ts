import { Module } from '@nestjs/common';

import { GameSessionModule } from '../../game-session/game-session.module';
import { SpendableGoldModule } from '../shared/spendable-gold.module';

import { CraftingController } from './crafting.controller';
import { CraftingService } from './crafting.service';

@Module({
  imports: [GameSessionModule, SpendableGoldModule],
  controllers: [CraftingController],
  providers: [CraftingService],
  exports: [CraftingService],
})
export class CraftingModule {}
