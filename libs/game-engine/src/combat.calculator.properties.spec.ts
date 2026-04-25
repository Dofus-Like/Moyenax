/**
 * Property-based tests pour combat.calculator.ts (fast-check).
 *
 * Complète les tests par exemple en vérifiant des propriétés qui doivent
 * tenir pour TOUS les inputs possibles. Fait 100 runs par propriété par défaut.
 */

import * as fc from 'fast-check';
import {
  calculateDamage,
  calculateHeal,
  calculateInitiativeJet,
  isInRange,
  hasLineOfSight,
  canMoveTo,
  canJumpTo,
} from './combat.calculator';
import {
  PlayerStats,
  SpellDefinition,
  SpellEffectKind,
  SpellFamily,
  SpellType,
  SpellVisualType,
  Tile,
  TerrainType,
} from '@game/shared-types';

const statsArbitrary = fc.record({
  vit: fc.integer({ min: 1, max: 10_000 }),
  atk: fc.integer({ min: 0, max: 1_000 }),
  mag: fc.integer({ min: 0, max: 1_000 }),
  def: fc.integer({ min: 0, max: 1_000 }),
  res: fc.integer({ min: 0, max: 1_000 }),
  ini: fc.integer({ min: 0, max: 500 }),
  pa: fc.integer({ min: 1, max: 20 }),
  pm: fc.integer({ min: 1, max: 20 }),
}).map((s) => ({
  ...s,
  baseVit: s.vit,
  baseAtk: s.atk,
  baseMag: s.mag,
  baseDef: s.def,
  baseRes: s.res,
  baseIni: s.ini,
  basePa: s.pa,
  basePm: s.pm,
})) as fc.Arbitrary<PlayerStats>;

function spell(damage: { min: number; max: number }): SpellDefinition {
  return {
    id: 'p',
    code: 'P',
    name: 'P',
    description: null,
    paCost: 3,
    minRange: 1,
    maxRange: 5,
    damage,
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PROJECTILE,
    family: SpellFamily.MAGE,
    iconPath: null,
    sortOrder: 0,
    requiresLineOfSight: false,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_MAGICAL,
    effectConfig: null,
  };
}

const damageSpellArbitrary = fc
  .tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 500 }))
  .map(([min, extra]) => spell({ min, max: min + extra }));

describe('[PROPERTY] combat.calculator', () => {
  describe('calculateDamage', () => {
    it('∀ attacker, target, spell, isMagical → damage ≥ 1', () => {
      fc.assert(
        fc.property(
          statsArbitrary,
          statsArbitrary,
          damageSpellArbitrary,
          fc.boolean(),
          (attacker, target, s, isMagical) => {
            const damage = calculateDamage(s, attacker, target, isMagical);
            return damage >= 1;
          },
        ),
      );
    });

    it('∀ inputs → damage est un entier', () => {
      fc.assert(
        fc.property(
          statsArbitrary,
          statsArbitrary,
          damageSpellArbitrary,
          (attacker, target, s) => {
            const damage = calculateDamage(s, attacker, target, false);
            return Number.isInteger(damage);
          },
        ),
      );
    });

    it('∀ inputs → damage ≤ spell.damage.max + attacker.atk (borne supérieure)', () => {
      fc.assert(
        fc.property(
          statsArbitrary,
          statsArbitrary,
          damageSpellArbitrary,
          (attacker, target, s) => {
            const damage = calculateDamage(s, attacker, target, false);
            return damage <= s.damage.max + attacker.atk;
          },
        ),
      );
    });
  });

  describe('calculateHeal', () => {
    it('∀ stats, spell → heal ≥ spell.damage.min (au pire pas de malus)', () => {
      fc.assert(
        fc.property(statsArbitrary, damageSpellArbitrary, (attacker, s) => {
          const heal = calculateHeal(s, attacker);
          return heal >= s.damage.min;
        }),
      );
    });

    it('∀ stats → heal est un entier', () => {
      fc.assert(
        fc.property(statsArbitrary, damageSpellArbitrary, (attacker, s) => {
          return Number.isInteger(calculateHeal(s, attacker));
        }),
      );
    });
  });

  describe('calculateInitiativeJet', () => {
    it('∀ stats → ini ≤ jet ≤ ini + 9', () => {
      fc.assert(
        fc.property(statsArbitrary, (stats) => {
          const jet = calculateInitiativeJet(stats);
          return jet >= stats.ini && jet <= stats.ini + 9;
        }),
      );
    });

    it('∀ stats → jet est un entier', () => {
      fc.assert(
        fc.property(statsArbitrary, (stats) => Number.isInteger(calculateInitiativeJet(stats))),
      );
    });
  });

  describe('isInRange', () => {
    const posArb = fc.record({
      x: fc.integer({ min: -100, max: 100 }),
      y: fc.integer({ min: -100, max: 100 }),
    });

    it('∀ position → isInRange(p, p, 0, N) === true pour N ≥ 0', () => {
      fc.assert(
        fc.property(posArb, fc.nat({ max: 50 }), (p, maxRange) => {
          return isInRange(p, p, 0, maxRange) === true;
        }),
      );
    });

    it('symétrie: isInRange(a, b, min, max) === isInRange(b, a, min, max)', () => {
      fc.assert(
        fc.property(
          posArb,
          posArb,
          fc.nat({ max: 10 }),
          fc.nat({ max: 20 }),
          (a, b, min, maxExtra) => {
            const max = min + maxExtra;
            return isInRange(a, b, min, max) === isInRange(b, a, min, max);
          },
        ),
      );
    });

    it('∀ inputs avec max < min → false', () => {
      fc.assert(
        fc.property(posArb, posArb, (a, b) => {
          // min=10, max=5 → impossible
          return isInRange(a, b, 10, 5) === false;
        }),
      );
    });
  });

  describe('hasLineOfSight', () => {
    const posArb = fc.record({
      x: fc.integer({ min: 0, max: 9 }),
      y: fc.integer({ min: 0, max: 9 }),
    });

    // Map vide 10x10
    const emptyTiles: Tile[] = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => ({ x, y, type: TerrainType.GROUND })),
    ).flat();

    it('∀ positions sur map vide → LOS = true', () => {
      fc.assert(
        fc.property(posArb, posArb, (a, b) => {
          return hasLineOfSight(a, b, emptyTiles) === true;
        }),
      );
    });

    it('∀ position p → hasLineOfSight(p, p) === true', () => {
      fc.assert(
        fc.property(posArb, (p) => {
          return hasLineOfSight(p, p, emptyTiles) === true;
        }),
      );
    });
  });

  describe('canMoveTo', () => {
    const posArb = fc.record({
      x: fc.integer({ min: 0, max: 9 }),
      y: fc.integer({ min: 0, max: 9 }),
    });

    const emptyTiles: Tile[] = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => ({ x, y, type: TerrainType.GROUND })),
    ).flat();

    it('∀ position p, pm → canMoveTo(p, pm, p, tiles, []) === false (même case)', () => {
      fc.assert(
        fc.property(posArb, fc.nat({ max: 10 }), (p, pm) => {
          return canMoveTo(p, pm, p, emptyTiles, []) === false;
        }),
      );
    });

    it('∀ position occupée → canMoveTo vers cette position === false', () => {
      fc.assert(
        fc.property(posArb, posArb, fc.nat({ max: 20 }), (from, to, pm) => {
          // skip si from===to (déjà couvert par autre propriété)
          fc.pre(from.x !== to.x || from.y !== to.y);
          return canMoveTo(to, pm, from, emptyTiles, [to]) === false;
        }),
      );
    });
  });

  describe('canJumpTo', () => {
    const posArb = fc.record({
      x: fc.integer({ min: 2, max: 7 }),
      y: fc.integer({ min: 2, max: 7 }),
    });

    it('∀ position p → canJumpTo(p, 0, ...) === false (PM insuffisants)', () => {
      const tiles: Tile[] = Array.from({ length: 10 }, (_, x) =>
        Array.from({ length: 10 }, (_, y) => ({ x, y, type: TerrainType.GOLD })),
      ).flat();
      fc.assert(
        fc.property(posArb, (p) => {
          return canJumpTo({ x: p.x + 2, y: p.y }, 0, p, tiles, []) === false;
        }),
      );
    });

    it('∀ diag (dx≠0 ET dy≠0) → canJumpTo === false', () => {
      const tiles: Tile[] = Array.from({ length: 10 }, (_, x) =>
        Array.from({ length: 10 }, (_, y) => ({ x, y, type: TerrainType.GOLD })),
      ).flat();
      fc.assert(
        fc.property(posArb, posArb, (from, to) => {
          fc.pre(from.x !== to.x && from.y !== to.y); // garanti diagonal
          return canJumpTo(to, 5, from, tiles, []) === false;
        }),
      );
    });
  });
});
