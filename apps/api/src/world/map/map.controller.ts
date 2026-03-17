import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MapGeneratorService } from './map-generator.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('map')
export class MapController {
  constructor(private readonly mapGenerator: MapGeneratorService) {}

  @Get()
  async getMap() {
    return this.mapGenerator.getOrCreateMap();
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset')
  async resetMap() {
    return this.mapGenerator.resetMap();
  }
}
