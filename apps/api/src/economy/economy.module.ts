import { Module } from '@nestjs/common';
import { InventoryModule } from './inventory/inventory.module';
import { ItemsModule } from './items/items.module';
import { ShopModule } from './shop/shop.module';
import { CraftingModule } from './crafting/crafting.module';
import { EquipmentModule } from './equipment/equipment.module';
import { PlayerModule } from '../player/player.module';
import { CombatModule } from '../combat/combat.module';
import { SpendableGoldModule } from './shared/spendable-gold.module';

import { EconomyListenerService } from './economy-listener.service';

@Module({
  imports: [
    InventoryModule,
    ItemsModule,
    ShopModule,
    CraftingModule,
    EquipmentModule,
    PlayerModule,
    CombatModule,
    SpendableGoldModule,
  ],
  providers: [EconomyListenerService],
  exports: [
    InventoryModule,
    ItemsModule,
    ShopModule,
    CraftingModule,
    EquipmentModule,
    SpendableGoldModule,
  ],
})
export class EconomyModule {}
