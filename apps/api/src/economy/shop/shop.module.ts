import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { GameSessionModule } from '../../game-session/game-session.module';
import { SpendableGoldModule } from '../shared/spendable-gold.module';

@Module({
  imports: [GameSessionModule, SpendableGoldModule],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
