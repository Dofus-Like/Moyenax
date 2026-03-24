import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { CombatAction } from '@game/shared-types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TurnService } from './turn.service';

@Controller('combat/action')
@UseGuards(JwtAuthGuard)
export class TurnDebugController {
  constructor(private readonly turnService: TurnService) {}

  @Post(':sessionId/force')
  async forceAction(
    @Param('sessionId') sessionId: string,
    @Body() body: { asPlayerId: string; action: CombatAction },
  ) {
    return this.turnService.forcePlayAction(sessionId, body.asPlayerId, body.action);
  }
}
