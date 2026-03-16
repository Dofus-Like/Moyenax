import { Module } from '@nestjs/common';
import { InventoryModule } from './inventory/inventory.module';
import { ItemsModule } from './items/items.module';
import { ShopModule } from './shop/shop.module';
import { CraftingModule } from './crafting/crafting.module';

@Module({
  imports: [InventoryModule, ItemsModule, ShopModule, CraftingModule],
  exports: [InventoryModule, ItemsModule, ShopModule, CraftingModule],
})
export class EconomyModule {}
