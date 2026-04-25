import {
  SpellEffectKind,
  SpellFamily,
  SpellType,
  SpellVisualType,
  TerrainType,
  type CombatPlayer,
  type CombatState,
  type SpellDefinition,
} from '@game/shared-types';
import { BadRequestException } from '@nestjs/common';

import { SpellsService } from './spells.service';

function createSpell(overrides: Partial<SpellDefinition>): SpellDefinition {
  return {
    id: 'spell-claque',
    code: 'spell-claque',
    name: 'Claque',
    description: 'Une gifle.',
    paCost: 2,
    minRange: 1,
    maxRange: 1,
    damage: { min: 8, max: 12 },
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PHYSICAL,
    family: SpellFamily.COMMON,
    iconPath: '/assets/pack/spells/epee.png',
    sortOrder: 99,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
    effectConfig: {},
    ...overrides,
  };
}

function createPlayer(playerId: string, position: { x: number; y: number }): CombatPlayer {
  return {
    playerId,
    username: playerId,
    type: 'PLAYER',
    stats: {
      vit: 100,
      atk: 20,
      mag: 5,
      def: 5,
      res: 5,
      ini: 10,
      pa: 6,
      pm: 3,
      baseVit: 100,
      baseAtk: 20,
      baseMag: 5,
      baseDef: 5,
      baseRes: 5,
      baseIni: 10,
      basePa: 6,
      basePm: 3,
    },
    position,
    spells: [],
    remainingPa: 6,
    remainingPm: 3,
    currentVit: 100,
    spellCooldowns: {},
    buffs: [],
    skin: 'soldier-classic',
  };
}

function createState(): CombatState {
  return {
    sessionId: 'combat-1',
    currentTurnPlayerId: 'player-1',
    turnNumber: 1,
    players: {
      'player-1': createPlayer('player-1', { x: 1, y: 1 }),
      'player-2': createPlayer('player-2', { x: 2, y: 1 }),
    },
    map: {
      width: 5,
      height: 5,
      tiles: Array.from({ length: 25 }, (_, index) => ({
        x: index % 5,
        y: Math.floor(index / 5),
        type: TerrainType.GROUND,
      })),
    },
  };
}

describe('SpellsService', () => {
  let service: SpellsService;

  beforeEach(() => {
    const perfStats = { recordGameMetric: jest.fn() } as never;
    service = new SpellsService(perfStats);
  });

  it('applies physical damage to the target on the tile', () => {
    const state = createState();
    const caster = state.players['player-1'];

    const result = service.executeEffect(state, createSpell({}), caster, { x: 2, y: 1 });

    expect(state.players['player-2'].currentVit).toBeLessThan(100);
    expect(result.events).toEqual([
      expect.objectContaining({
        type: 'DAMAGE_DEALT',
        payload: expect.objectContaining({ targetId: 'player-2' }),
      }),
    ]);
  });

  it('teleports the caster to a free traversable tile', () => {
    const state = createState();
    const caster = state.players['player-1'];

    const result = service.executeEffect(
      state,
      createSpell({
        id: 'spell-bond',
        code: 'spell-bond',
        name: 'Bond',
        type: SpellType.BUFF,
        visualType: SpellVisualType.UTILITY,
        family: SpellFamily.WARRIOR,
        cooldown: 1,
        minRange: 1,
        maxRange: 4,
        damage: { min: 0, max: 0 },
        requiresLineOfSight: false,
        effectKind: SpellEffectKind.TELEPORT,
      }),
      caster,
      { x: 3, y: 3 },
    );

    expect(caster.position).toEqual({ x: 3, y: 3 });
    expect(result.events).toEqual([
      {
        type: 'PLAYER_JUMPED',
        payload: {
          playerId: 'player-1',
          from: { x: 1, y: 1 },
          to: { x: 3, y: 3 },
        },
      },
    ]);
  });

  it('applies PM buff immediately when configured', () => {
    const state = createState();
    const caster = state.players['player-1'];

    service.executeEffect(
      state,
      createSpell({
        id: 'spell-velocite',
        code: 'spell-velocite',
        name: 'Vélocité',
        type: SpellType.BUFF,
        visualType: SpellVisualType.UTILITY,
        family: SpellFamily.NINJA,
        minRange: 0,
        maxRange: 0,
        damage: { min: 0, max: 0 },
        cooldown: 1,
        effectKind: SpellEffectKind.BUFF_PM,
        effectConfig: { buffValue: 2, buffDuration: 1, applyImmediately: true },
      }),
      caster,
      caster.position,
    );

    expect(caster.remainingPm).toBe(5);
    expect(caster.buffs).toContainEqual({ type: 'PM', value: 2, remainingTurns: 1 });
  });

  it('summons a menhir on a free tile', () => {
    const state = createState();
    const caster = state.players['player-1'];

    service.executeEffect(
      state,
      createSpell({
        id: 'spell-menhir',
        code: 'spell-menhir',
        name: 'Menhir',
        type: SpellType.BUFF,
        visualType: SpellVisualType.PHYSICAL,
        family: SpellFamily.MAGE,
        maxRange: 3,
        damage: { min: 0, max: 0 },
        cooldown: 1,
        effectKind: SpellEffectKind.SUMMON_MENHIR,
        effectConfig: {
          skin: 'menhir',
          stats: {
            vit: 1,
            atk: 0,
            mag: 0,
            def: 0,
            res: 0,
            ini: 0,
            pa: 0,
            pm: 0,
            baseVit: 1,
            baseAtk: 0,
            baseMag: 0,
            baseDef: 0,
            baseRes: 0,
            baseIni: 0,
            basePa: 0,
            basePm: 0,
          },
        },
      }),
      caster,
      { x: 3, y: 2 },
    );

    expect(Object.values(state.players)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SUMMON',
          username: 'Menhir',
          position: { x: 3, y: 2 },
        }),
      ]),
    );
  });

  it('rejects teleportation to an occupied tile', () => {
    const state = createState();
    const caster = state.players['player-1'];

    expect(() =>
      service.executeEffect(
        state,
        createSpell({
          id: 'spell-bond',
          code: 'spell-bond',
          name: 'Bond',
          type: SpellType.BUFF,
          visualType: SpellVisualType.UTILITY,
          family: SpellFamily.WARRIOR,
          damage: { min: 0, max: 0 },
          cooldown: 1,
          effectKind: SpellEffectKind.TELEPORT,
          requiresLineOfSight: false,
        }),
        caster,
        { x: 2, y: 1 },
      ),
    ).toThrow(BadRequestException);
  });
});
