import { Module } from '@nestjs/common';
import { MapGeneratorService } from './map-generator.service';
import { MapController } from './map.controller';
import { RedisModule } from '../../shared/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [MapController],
  providers: [MapGeneratorService],
  exports: [MapGeneratorService],
})
export class WorldMapModule {}
