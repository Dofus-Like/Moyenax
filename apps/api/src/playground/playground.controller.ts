import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  AddDummyDto,
  GatherTileDto,
  GrantEquipDto,
  NoCooldownDto,
  PaintTileDto,
  SetDummyDto,
  SetPlayerStatsDto,
  UnequipDto,
} from './dto/playground.dto';
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

  @Get('spells')
  listSpells() {
    return this.playground.listSpells();
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

  @Post(':sessionId/dummy')
  addDummy(
    @Param('sessionId') sessionId: string,
    @Body() dto: AddDummyDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.addDummy(req.user.id, sessionId, dto);
  }

  @Patch(':sessionId/dummy')
  setDummy(
    @Param('sessionId') sessionId: string,
    @Body() dto: SetDummyDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.setDummy(req.user.id, sessionId, dto);
  }

  @Delete(':sessionId/dummy/:dummyId')
  removeDummy(
    @Param('sessionId') sessionId: string,
    @Param('dummyId') dummyId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.removeDummy(req.user.id, sessionId, dummyId);
  }

  @Post(':sessionId/dummy/reset')
  resetDummies(
    @Param('sessionId') sessionId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.resetDummies(req.user.id, sessionId);
  }

  @Post(':sessionId/player-stats')
  setPlayerStats(
    @Param('sessionId') sessionId: string,
    @Body() dto: SetPlayerStatsDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.setPlayerStats(req.user.id, sessionId, dto);
  }

  @Post(':sessionId/no-cooldown')
  setNoCooldown(
    @Param('sessionId') sessionId: string,
    @Body() dto: NoCooldownDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.playground.setNoCooldown(req.user.id, sessionId, dto);
  }
}
