import { Module } from '@nestjs/common';

import { EconomyModule } from '../../economy/economy.module';
import { SpendableGoldModule } from '../../economy/shared/spendable-gold.module';
import { WorldMapModule } from '../map/map.module';

import { FarmingController } from './farming.controller';
import { FarmingService } from './farming.service';

@Module({
  imports: [WorldMapModule, EconomyModule, SpendableGoldModule],
  controllers: [FarmingController],
  providers: [FarmingService],
  exports: [FarmingService],
})
export class FarmingModule {}
