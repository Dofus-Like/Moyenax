import { Controller, Get, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EquipmentSlotType } from '@game/shared-types';

@Controller('equipment')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(private equipmentService: EquipmentService) {}

  @Get()
  async getEquipment(@Request() req: any) {

    return this.equipmentService.getEquipment(req.user.id);
  }

  @Put(':slot')
  async equip(
    @Request() req: any,

    @Param('slot') slot: EquipmentSlotType,
    @Body('inventoryItemId') inventoryItemId: string
  ) {
    return this.equipmentService.equip(req.user.id, inventoryItemId, slot);
  }

  @Delete(':slot')
  async unequip(@Request() req: any, @Param('slot') slot: EquipmentSlotType) {

    return this.equipmentService.unequip(req.user.id, slot);
  }
}
