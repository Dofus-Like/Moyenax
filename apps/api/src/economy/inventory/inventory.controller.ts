import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.inventoryService.findByPlayer(req.user.id);
  }

  @Post('use')
  async use(@Request() req: any, @Body() body: { itemId: string }) {
    return this.inventoryService.useItem(req.user.id, body.itemId);
  }
}
