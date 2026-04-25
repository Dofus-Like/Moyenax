import { Module } from '@nestjs/common';

import { RedisModule } from '../../shared/redis/redis.module';

import { MapGeneratorService } from './map-generator.service';
import { MapController } from './map.controller';

@Module({
  imports: [RedisModule],
  controllers: [MapController],
  providers: [MapGeneratorService],
  exports: [MapGeneratorService],
})
export class WorldMapModule {}
