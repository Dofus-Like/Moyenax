import { Module } from '@nestjs/common';
import { ResourcesModule } from './resources/resources.module';
import { WorldMapModule } from './map/map.module';
import { FarmingModule } from './farming/farming.module';

@Module({
  imports: [ResourcesModule, WorldMapModule, FarmingModule],
  exports: [ResourcesModule, WorldMapModule, FarmingModule],
})
export class WorldModule {}
