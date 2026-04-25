import { Controller, Get, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlayerStatsService } from './player-stats.service';

@Controller('player')
@UseGuards(JwtAuthGuard)
export class PlayerController {
  constructor(private playerStatsService: PlayerStatsService) {}

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.playerStatsService.getEffectiveStats(req.user.id);
  }
}
