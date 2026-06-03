import { Module } from '@nestjs/common';

import { CombatModule } from '../combat/combat.module';
import { EconomyModule } from '../economy/economy.module';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { RedisModule } from '../shared/redis/redis.module';
import { SseModule } from '../shared/sse/sse.module';

import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';

/**
 * Module dev-only (banc de test /playground). Importé dans AppModule uniquement
 * quand ENABLE_DEBUG_ROUTES=true. Orchestre Combat + Economy via leurs services
 * exportés (SessionService, EquipmentService, InventoryService).
 */
@Module({
  imports: [CombatModule, EconomyModule, PrismaModule, RedisModule, SseModule],
  controllers: [PlaygroundController],
  providers: [PlaygroundService],
})
export class PlaygroundModule {}
