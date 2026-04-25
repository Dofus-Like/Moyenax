import { SeedId } from '@game/shared-types';
import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { GatherResourceDto } from './dto/gather-resource.dto';
import { FarmingService } from './farming.service';

@Controller('farming')
@UseGuards(JwtAuthGuard)
export class FarmingController {
  constructor(private readonly farmingService: FarmingService) {}

  @Get('state')
  async getState(@Request() req: { user: { id: string } }, @Query('seed') seed?: string) {
    return this.farmingService.getOrCreateInstance(req.user.id, seed as SeedId);
  }

  @Post('gather')
  async gather(@Request() req: { user: { id: string } }, @Body() body: GatherResourceDto) {
    return this.farmingService.gatherResource(
      req.user.id,
      body.targetX,
      body.targetY,
      body.playerX,
      body.playerY,
    );
  }

  @Post('end-farming-phase')
  async endFarmingPhase(@Request() req: { user: { id: string } }) {
    return this.farmingService.endFarmingPhase(req.user.id);
  }

  @Post('debug-refill')
  async debugRefillPips(@Request() req: { user: { id: string } }) {
    return this.farmingService.debugRefillPips(req.user.id);
  }

  @Post('next-round')
  async nextRound(@Request() req: { user: { id: string } }) {
    return this.farmingService.nextRound(req.user.id);
  }
}
