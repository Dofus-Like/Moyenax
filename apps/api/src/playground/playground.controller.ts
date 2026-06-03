import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { GatherTileDto, GrantEquipDto, PaintTileDto, UnequipDto } from './dto/playground.dto';
import { PlaygroundService } from './playground.service';

@UseGuards(JwtAuthGuard)
@Controller('playground')
export class PlaygroundController {
  constructor(private readonly playground: PlaygroundService) {}

  @Post('start')
  start(@Request() req: { user: { id: string } }) {
    return this.playground.start(req.user.id);
  }

  @Post('combat')
  startCombat(@Request() req: { user: { id: string } }) {
    return this.playground.startCombat(req.user.id);
  }

  @Post(':sessionId/paint')
  paint(
    @Param('sessionId') sessionId: string,
    @Body() dto: PaintTileDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.paintTile(req.user.id, sessionId, dto);
  }

  @Post(':sessionId/gather')
  gather(
    @Param('sessionId') sessionId: string,
    @Body() dto: GatherTileDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.gatherTile(req.user.id, sessionId, dto);
  }

  @Post(':sessionId/grant-equip')
  grantEquip(
    @Param('sessionId') sessionId: string,
    @Body() dto: GrantEquipDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.grantAndEquip(req.user.id, sessionId, dto);
  }

  @Post(':sessionId/unequip')
  unequip(
    @Param('sessionId') sessionId: string,
    @Body() dto: UnequipDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.unequip(req.user.id, sessionId, dto);
  }
}
