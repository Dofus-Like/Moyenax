import { Module } from '@nestjs/common';

import { GameSessionModule } from '../../game-session/game-session.module';
import { SpendableGoldModule } from '../shared/spendable-gold.module';

import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [GameSessionModule, SpendableGoldModule],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
