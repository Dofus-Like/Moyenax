/**
 * Tests de régression ciblant des bugs spécifiques identifiés dans SpellsService.
 * Chaque describe documente le bug + le comportement attendu.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  CombatState,
  CombatPlayer,
  SpellEffectKind,
  SpellFamily,
  SpellType,
  SpellVisualType,
  TerrainType,
} from '@game/shared-types';
import { SpellsService } from './spells.service';
import { PerfStatsService } from '../../shared/perf/perf-stats.service';

function makeStats(overrides: Record<string, number> = {}) {
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
    ...overrides,
  };
}

function makePlayer(id: string, x: number, y: number, overrides: Partial<CombatPlayer> = {}): CombatPlayer {
  const stats = overrides.stats ?? makeStats();
  return {
    playerId: id,
    username: id,
    type: 'PLAYER',
    stats,
    position: { x, y },
    spells: [],
    remainingPa: stats.pa,
    remainingPm: stats.pm,
    currentVit: stats.vit,
    spellCooldowns: {},
    buffs: [],
    ...overrides,
  };
}

function makeEmptyTiles(w = 10, h = 10) {
  const tiles: Array<{ x: number; y: number; type: TerrainType }> = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      tiles.push({ x, y, type: TerrainType.GROUND });
    }
  }
  return tiles;
}

function makeState(players: CombatPlayer[]): CombatState {
  return {
    sessionId: 'bug-session',
    currentTurnPlayerId: players[0].playerId,
    turnNumber: 1,
    players: Object.fromEntries(players.map((p) => [p.playerId, p])),
    map: { width: 10, height: 10, tiles: makeEmptyTiles() },
  };
}

function makeSpell(kind: SpellEffectKind, effectConfig: Record<string, unknown> | null = null) {
  return {
    id: 's',
    code: 'S',
    name: 'Spell',
    description: null,
    paCost: 3,
    minRange: 0,
    maxRange: 5,
    damage: { min: 0, max: 0 },
    cooldown: 0,
    type: SpellType.BUFF,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.COMMON,
    iconPath: null,
    sortOrder: 0,
    requiresLineOfSight: false,
    requiresLinearTargeting: false,
    effectKind: kind,
    effectConfig,
  };
}

describe('SpellsService - Bug regressions', () => {
  let service: SpellsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpellsService,
        { provide: PerfStatsService, useValue: { recordGameMetric: jest.fn() } },
      ],
    }).compile();
    service = module.get(SpellsService);
  });

  /**
   * BUG #2: VIT buff mutation permanente
   * - applyVitBuff fait `caster.stats.vit += buffValue` directement sur les stats du combat player
   * - Quand le buff expire, `stats.vit` n'est JAMAIS décrémenté
   * - Effet: stats.vit accumule sans limite, puis reste > baseVit indéfiniment
   */
  describe('BUG #2: VIT_MAX buff ne doit pas muter stats.vit de façon permanente', () => {
    it('chaque cast de BUFF_VIT_MAX ajoute une entrée de buff trackable', () => {
      const caster = makePlayer('p1', 0, 0);
      const spell = makeSpell(SpellEffectKind.BUFF_VIT_MAX, { buffValue: 20, buffDuration: 3 });

      service.executeEffect(makeState([caster]), spell, caster, caster.position);

      expect(caster.buffs).toHaveLength(1);
      expect(caster.buffs[0]).toMatchObject({ type: 'VIT_MAX', value: 20, remainingTurns: 3 });
    });

    it('[SCENARIO BUG] applyVitBuff mute stats.vit ET currentVit (comportement actuel)', () => {
      const caster = makePlayer('p1', 0, 0);
      const baseVit = caster.stats.vit;
      const spell = makeSpell(SpellEffectKind.BUFF_VIT_MAX, { buffValue: 50 });

      service.executeEffect(makeState([caster]), spell, caster, caster.position);
      expect(caster.stats.vit).toBe(baseVit + 50);
      expect(caster.currentVit).toBe(baseVit + 50);
    });

    it('[REGRESSION] spam du sort ne peut PAS faire dépasser stats.vit baseVit + max(buff)', () => {
      // Ce test documente un comportement souhaité (cap sur cumulation)
      // Actuellement: chaque cast ajoute +20, sans cap → exploit possible
      // Après fix: les buffs du même type devraient se remplacer ou cap
      const caster = makePlayer('p1', 0, 0);
      const spell = makeSpell(SpellEffectKind.BUFF_VIT_MAX, { buffValue: 20, buffDuration: 5 });

      service.executeEffect(makeState([caster]), spell, caster, caster.position);
      service.executeEffect(makeState([caster]), spell, caster, caster.position);
      service.executeEffect(makeState([caster]), spell, caster, caster.position);

      // Le fix: refresh la durée au lieu de cumuler les valeurs
      expect(caster.buffs.filter((b) => b.type === 'VIT_MAX')).toHaveLength(1);
      expect(caster.stats.vit).toBe(120); // 100 baseline + 20 (pas +60)
    });
  });

  /**
   * BUG #3: Summon ID collision via Date.now()
   * - summonId = `summon-menhir-${Date.now()}`
   * - Deux sorts SUMMON lancés dans la même milliseconde → même ID → collision
   * - Le second summon écrase silencieusement le premier dans state.players
   */
  describe('BUG #3: SUMMON_MENHIR ne doit pas avoir d\'ID collision', () => {
    const originalDateNow = Date.now;

    afterEach(() => {
      Date.now = originalDateNow;
    });

    it('[SCENARIO BUG] deux summons dans la même ms → même ID (écrasement silencieux)', () => {
      Date.now = () => 1000000; // Force timestamp fixe
      const caster = makePlayer('p1', 0, 0);
      const state = makeState([caster]);
      const spell = makeSpell(SpellEffectKind.SUMMON_MENHIR, { stats: { vit: 50 } });

      service.executeEffect(state, spell, caster, { x: 2, y: 2 });
      service.executeEffect(state, spell, caster, { x: 3, y: 3 });

      // Après fix: les deux summons existent, pas d'écrasement
      const summonIds = Object.keys(state.players).filter((id) => id.startsWith('summon-menhir-'));
      expect(summonIds).toHaveLength(2);
    });

    it('génère des IDs distincts même avec plusieurs summons consécutifs', () => {
      const caster = makePlayer('p1', 0, 0);
      const state = makeState([caster]);
      const spell = makeSpell(SpellEffectKind.SUMMON_MENHIR);

      const positions = [{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }];
      positions.forEach((pos) => service.executeEffect(state, spell, caster, pos));

      const summonIds = Object.keys(state.players).filter((id) => id.startsWith('summon-menhir-'));
      expect(new Set(summonIds).size).toBe(positions.length);
    });
  });

  /**
   * BUG #4: BUFF_PM stacking sans cap
   * - applyPmBuff push dans buffs[] + remainingPm += buffValue (si applyImmediately)
   * - Spam du sort en même tour → remainingPm explose (et stats.pa reste intact,
   *   donc réalistement limité par PA cost, mais à vérifier)
   */
  describe('BUG #4: BUFF_PM stacking doit être capé', () => {
    it('[SCENARIO BUG] spam BUFF_PM ajoute autant de buffs que de casts (pas de dédup)', () => {
      const caster = makePlayer('p1', 0, 0, { stats: makeStats({ pm: 3, pa: 999 }), remainingPa: 999, remainingPm: 3 });
      const spell = makeSpell(SpellEffectKind.BUFF_PM, { buffValue: 2, buffDuration: 3 });

      for (let i = 0; i < 10; i++) {
        service.executeEffect(makeState([caster]), spell, caster, caster.position);
      }

      // Après fix: 1 seul buff PM, durée refresh
      expect(caster.buffs.filter((b) => b.type === 'PM')).toHaveLength(1);
      // Et remainingPm ne doit pas avoir été +20 (10 casts * 2)
      // Avant fix: 3 + 10*2 = 23 PM
      // Après fix: 3 + 2 = 5 PM (ou le cap défini)
      expect(caster.remainingPm).toBeLessThanOrEqual(10);
    });
  });

  /**
   * Autre bug: TELEPORT sur case actuelle
   * Si la cible du téléport est la case du caster, devrait être rejeté ou no-op
   */
  describe('Edge case TELEPORT: téléport sur sa propre case', () => {
    it('téléport sur case actuelle throw ou no-op (pas d\'altération du state)', () => {
      const caster = makePlayer('p1', 3, 3);
      const state = makeState([caster]);
      const spell = makeSpell(SpellEffectKind.TELEPORT);

      expect(() => service.executeEffect(state, spell, caster, { x: 3, y: 3 })).toThrow(
        /occupée/i,
      );
    });
  });

  /**
   * Edge cases DAMAGE
   */
  describe('DAMAGE: edge cases', () => {
    it('tir sur case vide n\'émet aucun event', () => {
      const caster = makePlayer('p1', 0, 0);
      const state = makeState([caster]);
      const spell = { ...makeSpell(SpellEffectKind.DAMAGE_PHYSICAL), damage: { min: 10, max: 10 } };

      const r = service.executeEffect(state, spell, caster, { x: 9, y: 9 });
      expect(r.events).toEqual([]);
    });

    it('SUMMON tué (currentVit=0) est supprimé du state', () => {
      const caster = makePlayer('p1', 0, 0);
      const summon = makePlayer('summon-1', 5, 5, {
        type: 'SUMMON',
        currentVit: 5,
        stats: makeStats({ vit: 50 }),
      });
      const state = makeState([caster, summon]);
      const spell = { ...makeSpell(SpellEffectKind.DAMAGE_PHYSICAL), damage: { min: 100, max: 100 } };

      service.executeEffect(state, spell, caster, { x: 5, y: 5 });
      expect(state.players['summon-1']).toBeUndefined();
    });

    it('PLAYER tué (currentVit=0) reste dans le state (pour checkVictory)', () => {
      const caster = makePlayer('p1', 0, 0);
      const target = makePlayer('p2', 5, 5);
      const state = makeState([caster, target]);
      const spell = { ...makeSpell(SpellEffectKind.DAMAGE_PHYSICAL), damage: { min: 9999, max: 9999 } };

      service.executeEffect(state, spell, caster, { x: 5, y: 5 });
      expect(state.players['p2']).toBeDefined();
      expect(state.players['p2'].currentVit).toBe(0);
    });
  });

  /**
   * HEAL: cap à stats.vit (pas de dépassement du max VIT)
   */
  describe('HEAL: cap à stats.vit', () => {
    it('HEAL ne dépasse pas stats.vit (pas d\'overheal)', () => {
      const caster = makePlayer('p1', 0, 0);
      const target = makePlayer('p2', 1, 0, { currentVit: 50, stats: makeStats({ vit: 100 }) });
      const state = makeState([caster, target]);
      const spell = { ...makeSpell(SpellEffectKind.HEAL), damage: { min: 9999, max: 9999 } };

      service.executeEffect(state, spell, caster, { x: 1, y: 0 });
      expect(target.currentVit).toBe(100);
    });
  });
});
