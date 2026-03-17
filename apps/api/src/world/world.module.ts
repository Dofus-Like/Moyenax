import { Module } from '@nestjs/common';
import { ResourcesModule } from './resources/resources.module';
import { WorldMapModule } from './map/map.module';

@Module({
  imports: [ResourcesModule, WorldMapModule],
  exports: [ResourcesModule, WorldMapModule],
})
export class WorldModule {}
