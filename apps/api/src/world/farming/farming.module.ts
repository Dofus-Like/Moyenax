import { Module } from '@nestjs/common';
import { FarmingController } from './farming.controller';
import { FarmingService } from './farming.service';
import { WorldMapModule } from '../map/map.module';
import { EconomyModule } from '../../economy/economy.module';
import { SpendableGoldModule } from '../../economy/shared/spendable-gold.module';

@Module({
  imports: [WorldMapModule, EconomyModule, SpendableGoldModule],
  controllers: [FarmingController],
  providers: [FarmingService],
  exports: [FarmingService],
})
export class FarmingModule {}
