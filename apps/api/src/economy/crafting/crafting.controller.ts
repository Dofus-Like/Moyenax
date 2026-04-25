import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { CraftingService } from './crafting.service';

@Controller('crafting')
@UseGuards(JwtAuthGuard)
export class CraftingController {
  constructor(private readonly craftingService: CraftingService) {}

  @Get('recipes')
  async getRecipes() {
    return this.craftingService.getRecipes();
  }

  @Post('craft')
  async craft(@Body('itemId') itemId: string, @Request() req: { user: { id: string } }) {
    return this.craftingService.craft(req.user.id, itemId);
  }

  @Post('merge')
  async merge(
    @Body('itemId') itemId: string,
    @Body('currentRank') currentRank: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.craftingService.merge(req.user.id, itemId, currentRank);
  }
}
