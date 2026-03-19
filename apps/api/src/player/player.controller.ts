import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { PlayerStatsService } from './player-stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('player')
@UseGuards(JwtAuthGuard)
export class PlayerController {
  constructor(private playerStatsService: PlayerStatsService) {}

  @Get('stats')
  async getStats(@Request() req: any) {

    return this.playerStatsService.getEffectiveStats(req.user.id);
  }
}
