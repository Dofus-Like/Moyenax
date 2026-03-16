import { Controller, Get, Put, Param, UseGuards, Request } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async findAll(@Request() req: { user: { id: string } }) {
    return this.inventoryService.findByPlayer(req.user.id);
  }

  @Put('equip/:itemId')
  async equip(@Param('itemId') itemId: string, @Request() req: { user: { id: string } }) {
    return this.inventoryService.equip(req.user.id, itemId);
  }

  @Put('unequip/:itemId')
  async unequip(@Param('itemId') itemId: string, @Request() req: { user: { id: string } }) {
    return this.inventoryService.unequip(req.user.id, itemId);
  }
}
