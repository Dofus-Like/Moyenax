import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TurnService } from './turn.service';
import { CombatActionDto } from './dto/combat-action.dto';

@Controller('combat/action')
@UseGuards(JwtAuthGuard)
export class TurnController {
  constructor(private readonly turnService: TurnService) {}

  @Throttle({ default: { limit: 600, ttl: seconds(60) } })
  @Post(':sessionId')
  async playAction(
    @Param('sessionId') sessionId: string,
    @Body() action: CombatActionDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.turnService.playAction(sessionId, req.user.id, action);
  }
}
