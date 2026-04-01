import { Module } from '@nestjs/common';
import { CraftingService } from './crafting.service';
import { CraftingController } from './crafting.controller';
import { GameSessionModule } from '../../game-session/game-session.module';
import { SpendableGoldModule } from '../shared/spendable-gold.module';

@Module({
  imports: [GameSessionModule, SpendableGoldModule],
  controllers: [CraftingController],
  providers: [CraftingService],
  exports: [CraftingService],
})
export class CraftingModule {}
