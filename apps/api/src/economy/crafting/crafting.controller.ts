import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { CraftingService } from './crafting.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('crafting')
@UseGuards(JwtAuthGuard)
export class CraftingController {
  constructor(private readonly craftingService: CraftingService) {}

  @Get('recipes')
  async getRecipes() {
    return this.craftingService.getRecipes();
  }

  @Post('craft')
  async craft(
    @Body('itemId') itemId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.craftingService.craft(req.user.id, itemId);
  }
}
