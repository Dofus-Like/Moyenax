import { Module } from '@nestjs/common';
import { FarmingController } from './farming.controller';
import { FarmingService } from './farming.service';
import { WorldMapModule } from '../map/map.module';
import { EconomyModule } from '../../economy/economy.module';

@Module({
  imports: [WorldMapModule, EconomyModule],
  controllers: [FarmingController],
  providers: [FarmingService],
  exports: [FarmingService],
})
export class FarmingModule {}
