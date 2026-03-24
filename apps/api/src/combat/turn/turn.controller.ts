import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { CombatAction } from '@game/shared-types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TurnService } from './turn.service';

@Controller('combat/action')
@UseGuards(JwtAuthGuard)
export class TurnController {
  constructor(private readonly turnService: TurnService) {}

  @Throttle({ default: { limit: 600, ttl: seconds(60) } })
  @Post(':sessionId')
  async playAction(
    @Param('sessionId') sessionId: string,
    @Body() action: CombatAction,
    @Request() req: { user: { id: string } },
  ) {
    return this.turnService.playAction(sessionId, req.user.id, action);
  }
}
