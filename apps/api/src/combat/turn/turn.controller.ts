import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TurnService } from './turn.service';
import type { CombatAction } from '@game/shared-types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('combat/action')
@UseGuards(JwtAuthGuard)
export class TurnController {
  constructor(private readonly turnService: TurnService) {}

  @Post(':sessionId')
  async playAction(
    @Param('sessionId') sessionId: string,
    @Body() action: CombatAction,
    @Request() req: { user: { id: string } },
  ) {
    return this.turnService.playAction(sessionId, req.user.id, action);
  }

  @Post(':sessionId/force')
  async forceAction(
    @Param('sessionId') sessionId: string,
    @Body() body: { asPlayerId: string; action: CombatAction },
  ) {
    return this.turnService.forcePlayAction(sessionId, body.asPlayerId, body.action);
  }
}
