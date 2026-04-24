/**
 * Test de régression pour la gestion des buffs à l'expiration dans handleEndTurn.
 * Cible Bug #2 (VIT_MAX): l'ancien code ne révertait PAS stats.vit quand le buff expirait.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CombatActionType,
  CombatState,
  SpellEffectKind,
  TerrainType,
} from '@game/shared-types';
import { TurnService } from './turn.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { SpellsService } from '../spells/spells.service';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { PerfStatsService } from '../../shared/perf/perf-stats.service';
import { RuntimePerfService } from '../../shared/perf/runtime-perf.service';

jest.mock('@game/game-engine', () => ({
  canMoveTo: jest.fn(),
  canJumpTo: jest.fn(),
  isInRange: jest.fn(),
  hasLineOfSight: jest.fn(),
}));

function makeStats() {
  return {
    vit: 100,
    atk: 10,
    mag: 10,
    def: 5,
    res: 5,
    ini: 20,
    pa: 6,
    pm: 3,
    baseVit: 100,
    baseAtk: 10,
    baseMag: 10,
    baseDef: 5,
    baseRes: 5,
    baseIni: 20,
    basePa: 6,
    basePm: 3,
  };
}

function makeTiles() {
  const tiles: Array<{ x: number; y: number; type: TerrainType }> = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      tiles.push({ x, y, type: TerrainType.GROUND });
    }
  }
  return tiles;
}

function makeState(overrides: Partial<CombatState> = {}): CombatState {
  const p1 = {
    playerId: 'p1',
    username: 'Alice',
    type: 'PLAYER' as const,
    stats: makeStats(),
    position: { x: 0, y: 0 },
    spells: [],
    remainingPa: 6,
    remainingPm: 3,
    currentVit: 100,
    spellCooldowns: {},
    buffs: [],
  };
  const p2 = {
    ...p1,
    playerId: 'p2',
    username: 'Bob',
    position: { x: 5, y: 5 },
  };
  return {
    sessionId: 's1',
    currentTurnPlayerId: 'p1',
    turnNumber: 1,
    players: { p1, p2 },
    map: { width: 10, height: 10, tiles: makeTiles() },
    ...overrides,
  };
}

describe('TurnService - END_TURN buff expiration regressions', () => {
  let service: TurnService;
  let redis: { getJson: jest.Mock; setJson: jest.Mock };

  beforeEach(async () => {
    redis = { getJson: jest.fn(), setJson: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnService,
        { provide: RedisService, useValue: redis },
        { provide: SseService, useValue: { emit: jest.fn() } },
        { provide: SpellsService, useValue: { executeEffect: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: PerfLoggerService,
          useValue: { logEvent: jest.fn(), logDuration: jest.fn(), logMetric: jest.fn() },
        },
        { provide: RuntimePerfService, useValue: { getTotalSseEvents: jest.fn().mockReturnValue(0) } },
        { provide: PerfStatsService, useValue: { recordGameMetric: jest.fn() } },
      ],
    }).compile();
    service = module.get(TurnService);
  });

  afterEach(() => jest.clearAllMocks());

  /**
   * BUG #2 REGRESSION: Quand un buff VIT_MAX expire, stats.vit doit revenir à sa valeur initiale.
   * Avant le fix: stats.vit restait +buffValue indéfiniment après expiration.
   */
  it('VIT_MAX: stats.vit revient à baseline après expiration du buff', async () => {
    const state = makeState();
    // On simule qu'un buff VIT_MAX a déjà été appliqué par SpellsService
    // (stats.vit: 120, buff remainingTurns=1, buffValue=20)
    state.players.p1.stats.vit = 120;
    state.players.p1.currentVit = 120;
    state.players.p1.buffs = [{ type: 'VIT_MAX', value: 20, remainingTurns: 1 }];

    redis.getJson.mockResolvedValue(state);
    redis.setJson.mockImplementation(async (_k, v: CombatState) => {
      // Vérifier l'état persisté
      expect(v.players.p1.stats.vit).toBe(100); // REVERTÉ
      expect(v.players.p1.buffs).toHaveLength(0); // buff expiré
    });

    await service.playAction('s1', 'p1', { type: CombatActionType.END_TURN });

    expect(redis.setJson).toHaveBeenCalled();
  });

  it('VIT_MAX: currentVit est plafonné à la nouvelle stats.vit après expiration', async () => {
    const state = makeState();
    state.players.p1.stats.vit = 120;
    state.players.p1.currentVit = 120; // Joueur plein, sera capé à 100 après revert
    state.players.p1.buffs = [{ type: 'VIT_MAX', value: 20, remainingTurns: 1 }];

    redis.getJson.mockResolvedValue(state);
    redis.setJson.mockImplementation(async (_k, v: CombatState) => {
      expect(v.players.p1.currentVit).toBeLessThanOrEqual(v.players.p1.stats.vit);
    });

    await service.playAction('s1', 'p1', { type: CombatActionType.END_TURN });
  });

  it('VIT_MAX: si le buff n\'a pas expiré, stats.vit reste boosté', async () => {
    const state = makeState();
    state.players.p1.stats.vit = 120;
    state.players.p1.currentVit = 120;
    state.players.p1.buffs = [{ type: 'VIT_MAX', value: 20, remainingTurns: 3 }];

    redis.getJson.mockResolvedValue(state);
    redis.setJson.mockImplementation(async (_k, v: CombatState) => {
      expect(v.players.p1.stats.vit).toBe(120);
      expect(v.players.p1.buffs[0].remainingTurns).toBe(2);
    });

    await service.playAction('s1', 'p1', { type: CombatActionType.END_TURN });
  });

  it('PM buff: remainingPm au prochain tour utilise le buff via stats.pm + pmBonus', async () => {
    const state = makeState();
    // p2 (prochain joueur) a un buff PM actif
    state.players.p2.buffs = [{ type: 'PM', value: 2, remainingTurns: 3 }];

    redis.getJson.mockResolvedValue(state);
    redis.setJson.mockImplementation(async (_k, v: CombatState) => {
      // p2 commence son tour avec pm = stats.pm(3) + buffValue(2) = 5
      expect(v.players.p2.remainingPm).toBe(5);
      expect(v.currentTurnPlayerId).toBe('p2');
    });

    await service.playAction('s1', 'p1', { type: CombatActionType.END_TURN });
  });

  it('Cooldowns décrémentés au début du prochain tour', async () => {
    const state = makeState();
    state.players.p2.spellCooldowns = { 'spell-1': 3, 'spell-2': 0 };

    redis.getJson.mockResolvedValue(state);
    redis.setJson.mockImplementation(async (_k, v: CombatState) => {
      expect(v.players.p2.spellCooldowns['spell-1']).toBe(2);
      expect(v.players.p2.spellCooldowns['spell-2']).toBe(0); // pas en dessous de 0
    });

    await service.playAction('s1', 'p1', { type: CombatActionType.END_TURN });
  });
});
