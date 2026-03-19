import { Module } from '@nestjs/common';
import { InventoryModule } from './inventory/inventory.module';
import { ItemsModule } from './items/items.module';
import { ShopModule } from './shop/shop.module';
import { CraftingModule } from './crafting/crafting.module';
import { EquipmentModule } from './equipment/equipment.module';
import { PlayerModule } from '../player/player.module';
import { CombatModule } from '../combat/combat.module';

@Module({
  imports: [InventoryModule, ItemsModule, ShopModule, CraftingModule, EquipmentModule, PlayerModule, CombatModule],
  exports: [InventoryModule, ItemsModule, ShopModule, CraftingModule, EquipmentModule],
})
export class EconomyModule {}


