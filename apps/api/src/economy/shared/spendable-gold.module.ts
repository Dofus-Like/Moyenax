import { Module } from '@nestjs/common';

import { GameSessionModule } from '../../game-session/game-session.module';

import { SpendableGoldService } from './spendable-gold.service';

@Module({
  imports: [GameSessionModule],
  providers: [SpendableGoldService],
  exports: [SpendableGoldService],
})
export class SpendableGoldModule {}
