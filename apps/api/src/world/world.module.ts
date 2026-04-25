import { Module } from '@nestjs/common';

import { FarmingModule } from './farming/farming.module';
import { WorldMapModule } from './map/map.module';
import { ResourcesModule } from './resources/resources.module';

@Module({
  imports: [ResourcesModule, WorldMapModule, FarmingModule],
  exports: [ResourcesModule, WorldMapModule, FarmingModule],
})
export class WorldModule {}
