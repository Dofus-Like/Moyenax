import { randomUUID } from 'node:crypto';

import type { CombatPlayer, CombatState, PlayerStats } from '@game/shared-types';
import { TERRAIN_PROPERTIES, TerrainType } from '@game/shared-types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { EquipmentService } from '../economy/equipment/equipment.service';
import { InventoryService } from '../economy/inventory/inventory.service';
import { SessionService } from '../combat/session/session.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { RedisService } from '../shared/redis/redis.service';
import { SseService } from '../shared/sse/sse.service';

import {
  AddDummyDto,
  GatherTileDto,
  GrantEquipDto,
  NoCooldownDto,
  PaintTileDto,
  SetDummyDto,
  SetPlayerStatsDto,
  UnequipDto,
} from './dto/playground.dto';

/** PV par défaut d'un mannequin-cible ajouté (cible « réaliste », finie). */
const DEFAULT_TARGET_VIT = 1000;

function buildTargetDummy(
  id: string,
  x: number,
  y: number,
  vit: number,
  def: number,
  res: number,
): CombatPlayer {
  const stats: PlayerStats = {
    vit,
    atk: 0,
    mag: 0,
    def,
    res,
    ini: 0,
    pa: 0,
    pm: 0,
    baseVit: vit,
    baseAtk: 0,
    baseMag: 0,
    baseDef: def,
    baseRes: res,
    baseIni: 0,
    basePa: 0,
    basePm: 0,
  };
  return {
    playerId: id,
    username: 'Bot cible',
    type: 'PLAYER',
    stats,
    currentVit: vit,
    position: { x, y },
    spawn: { x, y },
    spells: [],
    remainingPa: 0,
    remainingPm: 0,
    spellCooldowns: {},
    buffs: [],
    skin: 'orc-classic',
  };
}

/**
 * Orchestrateur dev-only (route /playground). Composition-root assumée qui relie
 * Combat + Economy : ce module n'est ni l'un ni l'autre, il ne viole donc pas la
 * règle de découplage Combat↔Economy. Chargé uniquement si SHOW_DEBUG est actif.
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

  async addDummy(humanId: string, sessionId: string, dto: AddDummyDto): Promise<CombatState> {
    const state = await this.session.getStateForParticipant(sessionId, humanId);
    const id = `dummy-${randomUUID()}`;
    state.players[id] = buildTargetDummy(id, dto.x, dto.y, DEFAULT_TARGET_VIT, 0, 0);
    return this.persistAndBroadcast(sessionId, state);
  }

  async setDummy(humanId: string, sessionId: string, dto: SetDummyDto): Promise<CombatState> {
    const state = await this.session.getStateForParticipant(sessionId, humanId);
    const dummy = this.getDummy(state, humanId, dto.dummyId);

    if (dto.def !== undefined) dummy.stats.def = dummy.stats.baseDef = dto.def;
    if (dto.res !== undefined) dummy.stats.res = dummy.stats.baseRes = dto.res;
    if (dto.vit !== undefined) {
      dummy.stats.vit = dummy.stats.baseVit = dto.vit;
      dummy.currentVit = dto.vit;
    }
    return this.persistAndBroadcast(sessionId, state);
  }

  async removeDummy(humanId: string, sessionId: string, dummyId: string): Promise<CombatState> {
    const state = await this.session.getStateForParticipant(sessionId, humanId);
    this.getDummy(state, humanId, dummyId);
    delete state.players[dummyId];
    return this.persistAndBroadcast(sessionId, state);
  }

  async resetDummies(humanId: string, sessionId: string): Promise<CombatState> {
    const state = await this.session.getStateForParticipant(sessionId, humanId);
    for (const player of Object.values(state.players)) {
      if (player.playerId === humanId) continue;
      player.currentVit = player.stats.vit;
      if (player.spawn) player.position = { ...player.spawn };
      player.buffs = [];
      player.spellCooldowns = {};
    }
    return this.persistAndBroadcast(sessionId, state);
  }

  async setPlayerStats(
    humanId: string,
    sessionId: string,
    dto: SetPlayerStatsDto,
  ): Promise<CombatState> {
    const state = await this.session.getStateForParticipant(sessionId, humanId);
    const player = state.players[humanId];
    if (!player) throw new BadRequestException('Joueur introuvable');

    const stats = player.stats;
    if (dto.atk !== undefined) stats.atk = stats.baseAtk = dto.atk;
    if (dto.mag !== undefined) stats.mag = stats.baseMag = dto.mag;
    if (dto.def !== undefined) stats.def = stats.baseDef = dto.def;
    if (dto.res !== undefined) stats.res = stats.baseRes = dto.res;
    if (dto.vit !== undefined) {
      stats.vit = stats.baseVit = dto.vit;
      player.currentVit = dto.vit;
    }
    return this.persistAndBroadcast(sessionId, state);
  }

  async setNoCooldown(
    humanId: string,
    sessionId: string,
    dto: NoCooldownDto,
  ): Promise<CombatState> {
    const state = await this.session.getStateForParticipant(sessionId, humanId);
    state.noCooldown = dto.enabled;
    return this.persistAndBroadcast(sessionId, state);
  }

  private getDummy(state: CombatState, humanId: string, dummyId: string): CombatPlayer {
    const dummy = state.players[dummyId];
    if (!dummy || dummy.playerId === humanId) {
      throw new BadRequestException('Mannequin introuvable');
    }
    return dummy;
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
