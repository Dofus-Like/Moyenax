import { calculateEffectiveStats } from './stats.calculator';
import { ItemDefinition, ItemType, PlayerStats } from '@game/shared-types';

function baseStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
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

function makeItem(id: string, bonus: Partial<PlayerStats>): ItemDefinition {
  return {
    id,
    name: id,
    description: null,
    type: ItemType.WEAPON,
    family: null,
    statsBonus: bonus,
    grantsSpells: null,
    craftCost: null,
    shopPrice: null,
    rank: 1,
  };
}

describe('calculateEffectiveStats', () => {
  it('retourne les stats de base si aucun item équipé', () => {
    const base = baseStats();
    const result = calculateEffectiveStats(base, []);
    expect(result).toEqual(base);
  });

  it('ne mute pas les stats de base (retourne un nouvel objet)', () => {
    const base = baseStats();
    const snapshot = JSON.parse(JSON.stringify(base));
    calculateEffectiveStats(base, [makeItem('sword', { atk: 10 })]);
    expect(base).toEqual(snapshot);
  });

  it('ajoute le bonus d\'un item simple', () => {
    const result = calculateEffectiveStats(baseStats(), [makeItem('sword', { atk: 20 })]);
    expect(result.atk).toBe(30);
  });

  it('cumule les bonus de plusieurs items', () => {
    const result = calculateEffectiveStats(baseStats(), [
      makeItem('sword', { atk: 10 }),
      makeItem('gloves', { atk: 5, def: 3 }),
      makeItem('helmet', { def: 7, res: 2 }),
    ]);
    expect(result.atk).toBe(25);
    expect(result.def).toBe(15);
    expect(result.res).toBe(7);
  });

  it('supporte des bonus négatifs (malus)', () => {
    const result = calculateEffectiveStats(baseStats(), [makeItem('cursed', { pm: -1, atk: 50 })]);
    expect(result.pm).toBe(2);
    expect(result.atk).toBe(60);
  });

  it('ignore les bonus undefined', () => {
    const item: ItemDefinition = {
      id: 'x',
      name: 'x',
      description: null,
      type: ItemType.WEAPON,
      family: null,
      statsBonus: { atk: undefined, def: 5 },
      grantsSpells: null,
      craftCost: null,
      shopPrice: null,
      rank: 1,
    };
    const result = calculateEffectiveStats(baseStats(), [item]);
    expect(result.atk).toBe(10); // inchangé
    expect(result.def).toBe(10); // 5 + 5
  });

  it('ignore statsBonus=null', () => {
    const item: ItemDefinition = {
      id: 'x',
      name: 'x',
      description: null,
      type: ItemType.ACCESSORY,
      family: null,
      statsBonus: null,
      grantsSpells: null,
      craftCost: null,
      shopPrice: null,
      rank: 1,
    };
    const result = calculateEffectiveStats(baseStats(), [item]);
    expect(result).toEqual(baseStats());
  });

  it('gère des clés inconnues dans statsBonus (ignorées)', () => {
    const item = makeItem('weird', {
      atk: 5,
      // @ts-expect-error: on simule une clé non PlayerStats
      unknownStat: 999,
    });
    const result = calculateEffectiveStats(baseStats(), [item]);
    expect(result.atk).toBe(15);
    const resultRecord = result as unknown as Record<string, number>;
    expect(resultRecord['unknownStat']).toBeUndefined();
  });

  it('gère un bonus nul (0)', () => {
    const result = calculateEffectiveStats(baseStats(), [makeItem('neutral', { atk: 0, def: 0 })]);
    expect(result.atk).toBe(10);
    expect(result.def).toBe(5);
  });

  it('gère plusieurs items identiques (cumul)', () => {
    const item = makeItem('ring', { ini: 5 });
    const result = calculateEffectiveStats(baseStats(), [item, item, item]);
    expect(result.ini).toBe(35); // 20 + 5*3
  });
});
