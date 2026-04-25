import { SeedId, ALL_SEED_IDS } from '@game/shared-types';
import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { MapGeneratorService } from './map-generator.service';

@Controller('map')
export class MapController {
  constructor(private readonly mapGenerator: MapGeneratorService) {}

  @Get()
  async getMap() {
    return this.mapGenerator.getOrCreateMap();
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset')
  async resetMap(@Query('seed') seed?: string) {
    const seedId = seed && ALL_SEED_IDS.includes(seed as SeedId) ? (seed as SeedId) : undefined;
    return this.mapGenerator.resetMap(seedId);
  }
}
