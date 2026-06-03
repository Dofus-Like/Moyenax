import type { CombatState } from '@game/shared-types';
import { TERRAIN_PROPERTIES, TerrainType } from '@game/shared-types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { EquipmentService } from '../economy/equipment/equipment.service';
import { InventoryService } from '../economy/inventory/inventory.service';
import { SessionService } from '../combat/session/session.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { RedisService } from '../shared/redis/redis.service';
import { SseService } from '../shared/sse/sse.service';

import { GatherTileDto, GrantEquipDto, PaintTileDto, UnequipDto } from './dto/playground.dto';

/**
 * Orchestrateur dev-only (route /playground). Composition-root assumée qui relie
 * Combat + Economy : ce module n'est ni l'un ni l'autre, il ne viole donc pas la
 * règle de découplage Combat↔Economy. Chargé uniquement si ENABLE_DEBUG_ROUTES.
 */
@Injectable()
export class PlaygroundService {
  private readonly logger = new Logger(PlaygroundService.name);

  constructor(
    private readonly session: SessionService,
    private readonly equipment: EquipmentService,
    private readonly inventory: InventoryService,
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly prisma: PrismaService,
  ) {}

  async start(humanId: string): Promise<CombatState> {
    this.logger.log(`Démarrage d'un bac à sable playground pour ${humanId}`);
    return this.session.startPlaygroundCombat(humanId);
  }

  async startCombat(humanId: string): Promise<CombatState> {
    this.logger.log(`Passage en mode combat (vs IA) pour ${humanId}`);
    return this.session.startPlaygroundRealCombat(humanId);
  }

  async paintTile(humanId: string, sessionId: string, dto: PaintTileDto): Promise<CombatState> {
    const state = await this.session.getStateForParticipant(sessionId, humanId);
    const tile = state.map.tiles.find((t) => t.x === dto.x && t.y === dto.y);
    if (!tile) throw new BadRequestException('Case introuvable');

    tile.type = dto.terrain;
    return this.persistAndBroadcast(sessionId, state);
  }

  async gatherTile(humanId: string, sessionId: string, dto: GatherTileDto): Promise<CombatState> {
    const state = await this.session.getStateForParticipant(sessionId, humanId);
    const tile = state.map.tiles.find((t) => t.x === dto.x && t.y === dto.y);
    if (!tile) throw new BadRequestException('Case introuvable');

    const props = TERRAIN_PROPERTIES[tile.type];
    if (!props?.harvestable || !props.resourceName) {
      throw new BadRequestException('Ressource non récoltable');
    }

    await this.inventory.addResourceByName(humanId, props.resourceName);
    tile.type = TerrainType.GROUND;
    return this.persistAndBroadcast(sessionId, state);
  }

  async grantAndEquip(
    humanId: string,
    sessionId: string,
    dto: GrantEquipDto,
  ): Promise<CombatState> {
    const item = await this.prisma.item.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException('Objet introuvable');

    const inventoryItem = await this.findOrCreateInventoryItem(humanId, dto.itemId);
    await this.equipment.equip(humanId, inventoryItem.id, dto.slot);
    return this.session.refreshPlaygroundLoadout(sessionId, humanId);
  }

  async unequip(humanId: string, sessionId: string, dto: UnequipDto): Promise<CombatState> {
    await this.equipment.unequip(humanId, dto.slot);
    return this.session.refreshPlaygroundLoadout(sessionId, humanId);
  }

  private async findOrCreateInventoryItem(humanId: string, itemId: string) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { playerId: humanId, itemId, equipmentSlot: { is: null } },
    });
    if (existing) return existing;

    return this.prisma.inventoryItem.create({
      data: { playerId: humanId, itemId, quantity: 1, rank: 1 },
    });
  }

  private async persistAndBroadcast(sessionId: string, state: CombatState): Promise<CombatState> {
    await this.redis.setJson(`combat:${sessionId}`, state, 3600);
    this.sse.emit(sessionId, 'STATE_UPDATED', state);
    return state;
  }
}
