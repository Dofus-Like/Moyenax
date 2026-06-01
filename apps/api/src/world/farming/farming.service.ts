import {
  FarmingState,
  SeedId,
  TERRAIN_PROPERTIES,
  TerrainType,
  GAME_EVENTS,
  EquipmentSlotType,
} from '@game/shared-types';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { ShopService } from '../../economy/shop/shop.service';
import { EquipmentService } from '../../economy/equipment/equipment.service';
import { InventoryService } from '../../economy/inventory/inventory.service';
import { SpendableGoldService } from '../../economy/shared/spendable-gold.service';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { MapGeneratorService } from '../map/map-generator.service';

@Injectable()
export class FarmingService {
  constructor(
    private readonly redis: RedisService,
    private readonly mapGenerator: MapGeneratorService,
    private readonly inventory: InventoryService,
    private readonly spendableGold: SpendableGoldService,
    private readonly shop: ShopService,
    private readonly equipment: EquipmentService,
    private readonly perfLogger: PerfLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async getOrCreateInstance(playerId: string, seedId?: SeedId): Promise<FarmingState> {
    const key = `farming:${playerId}`;
    let state = await this.redis.getJson<FarmingState>(key);

    if (!state) {
      const session = await (this.prisma as any).gameSession.findFirst({
        where: {
          OR: [
            { player1Id: playerId, status: 'ACTIVE' },
            { player2Id: playerId, status: 'ACTIVE' },
          ],
        },
      });

      const effectiveSeedId = (session?.mapSeedId as SeedId) || seedId || 'FORGE';
      const effectiveMapSeed = session?.mapSeed ?? Math.floor(Math.random() * 1000000);

      const map = await this.mapGenerator.getOrCreateMap(effectiveSeedId, effectiveMapSeed);

      const gridCells: { x: number; y: number; terrain: TerrainType }[] = [];
      for (const [y, row] of map.grid.entries()) {
        for (const [x, terrain] of row.entries()) {
          gridCells.push({ x, y, terrain });
        }
      }

      state = {
        playerId,
        seedId: map.seedId,
        map: gridCells,
        pips: 4,
        round: 1,
        spendableGold: 0,
      };

      await this.redis.setJson(key, state, 86400); // 24h
    }

    return this.withSpendableGold(playerId, state);
  }

  async gatherResource(
    playerId: string,
    x: number,
    y: number,
    playerX: number,
    playerY: number,
  ): Promise<FarmingState> {
    const key = `farming:${playerId}`;
    const state = await this.redis.getJson<FarmingState>(key);

    if (!state) throw new BadRequestException('Aucune session de farming active');
    if (state.pips <= 0)
      throw new BadRequestException('Plus de points de récolte (pips) disponibles');

    const node = state.map.find((t) => t.x === x && t.y === y);
    if (!node) throw new BadRequestException('Case introuvable');

    const props = TERRAIN_PROPERTIES[node.terrain as TerrainType];
    if (!props?.harvestable || !props.resourceName)
      throw new BadRequestException('Ressource non récoltable');

    const dist = Math.abs(playerX - x) + Math.abs(playerY - y);
    if (dist > 1) throw new BadRequestException('Trop loin pour récolter');

    if (node.terrain === TerrainType.GOLD) {
      const { session } = await this.spendableGold.getContext(playerId);
      await this.spendableGold.credit(playerId, 1, session);
    } else {
      await this.inventory.addResourceByName(playerId, props.resourceName);
    }

    state.pips -= 1;
    await this.redis.setJson(key, state, 86400);

    return this.withSpendableGold(playerId, state);
  }

  async endFarmingPhase(playerId: string): Promise<FarmingState> {
    const key = `farming:${playerId}`;
    const state = await this.redis.getJson<FarmingState>(key);

    if (!state) throw new BadRequestException('Aucune session de farming active');

    // Set pips to 0 to close farming for this round
    state.pips = 0;
    await this.redis.setJson(key, state, 86400);

    return this.withSpendableGold(playerId, state);
  }

  async debugRefillPips(playerId: string): Promise<FarmingState> {
    const key = `farming:${playerId}`;
    const state = await this.redis.getJson<FarmingState>(key);

    if (!state) throw new BadRequestException('Aucune session de farming active');

    state.pips = 4;
    await this.redis.setJson(key, state, 86400);

    return this.withSpendableGold(playerId, state);
  }

  async grantStartingRing(playerId: string, itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.type !== 'ACCESSORY') {
      throw new NotFoundException('Anneau introuvable');
    }

    const raw = await this.prisma.gameSession.findFirst({
      where: {
        OR: [
          { player1Id: playerId, status: 'ACTIVE' },
          { player2Id: playerId, status: 'ACTIVE' },
        ],
      },
      select: { id: true, player1Id: true, player2Id: true, player1Po: true, player2Po: true },
    });

    if (!raw) {
      throw new BadRequestException('Aucune session active');
    }

    await this.spendableGold.credit(playerId, 500, raw);

    const bought = await this.shop.buy(playerId, itemId, 1);

    const invId = (bought as any).id;
    await this.equipment.equip(playerId, invId, EquipmentSlotType.ACCESSORY);

    const state = await this.redis.getJson<FarmingState>(`farming:${playerId}`);
    if (!state) throw new BadRequestException('Aucune session de farming active');

    return this.withSpendableGold(playerId, state);
  }

  async nextRound(playerId: string): Promise<FarmingState> {
    const key = `farming:${playerId}`;
    const state = await this.redis.getJson<FarmingState>(key);

    if (!state) throw new BadRequestException('Aucune session de farming active');

    state.round += 1;
    state.pips = 4;
    await this.redis.setJson(key, state, 86400);

    return this.withSpendableGold(playerId, state);
  }

  @OnEvent(GAME_EVENTS.COMBAT_ENDED)
  async handleCombatEnded(payload: { winnerId: string; loserId: string; sessionId: string }) {
    this.perfLogger.logEvent('world', 'farming.combat_ended', {
      session_id: payload.sessionId,
      winner_id: payload.winnerId,
      loser_id: payload.loserId,
    });

    const bot = await this.prisma.player.findUnique({ where: { username: 'Bot' } });

    for (const playerId of [payload.winnerId, payload.loserId]) {
      if (!playerId || playerId === bot?.id) continue;
      const key = `farming:${playerId}`;
      const state = await this.redis.getJson<FarmingState>(key);
      if (state) {
        state.round += 1;
        state.pips = 4;
        await this.redis.setJson(key, state, 86400);
      }
    }
  }

  private async withSpendableGold(playerId: string, state: FarmingState): Promise<FarmingState> {
    const spendableGold = await this.spendableGold.getBalance(playerId);
    return {
      ...state,
      spendableGold,
    };
  }
}
