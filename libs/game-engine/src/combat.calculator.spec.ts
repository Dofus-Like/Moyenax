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

function stats(overrides: Partial<PlayerStats> = {}): PlayerStats {
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

function spell(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return {
    id: 's1',
    code: 'T',
    name: 'T',
    description: null,
    paCost: 3,
    minRange: 1,
    maxRange: 5,
    damage: { min: 10, max: 20 },
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PROJECTILE,
    family: SpellFamily.MAGE,
    iconPath: null,
    sortOrder: 0,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_MAGICAL,
    effectConfig: null,
    ...overrides,
  };
}

function emptyMap(width = 10, height = 10): Tile[] {
  const tiles: Tile[] = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.push({ x, y, type: TerrainType.GROUND });
    }
  }
  return tiles;
}

describe('calculateDamage', () => {
  const originalRandom = Math.random;

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('retourne (min + atk - def) quand random = 0 (magique=false)', () => {
    Math.random = () => 0;
    const s = spell({ damage: { min: 10, max: 20 } });
    const damage = calculateDamage(s, stats({ atk: 15 }), stats({ def: 3 }), false);
    // base=10 + atk=15 - def=3 = 22
    expect(damage).toBe(22);
  });

  it('retourne (max + atk - def) quand random proche de 1', () => {
    Math.random = () => 0.9999;
    const s = spell({ damage: { min: 10, max: 20 } });
    const damage = calculateDamage(s, stats({ atk: 10 }), stats({ def: 5 }), false);
    // base = 10 + floor(0.9999 * 11) = 10 + 10 = 20, raw = 20 + 10 = 30, - def=5 = 25
    expect(damage).toBe(25);
  });

  it('utilise mag/res quand isMagical=true', () => {
    Math.random = () => 0;
    const s = spell({ damage: { min: 5, max: 5 } });
    const damage = calculateDamage(s, stats({ mag: 30, atk: 999 }), stats({ res: 10, def: 999 }), true);
    expect(damage).toBe(25); // 5 + 30 - 10
  });

  it('garantit au minimum 1 point de dégâts (floor)', () => {
    Math.random = () => 0;
    const s = spell({ damage: { min: 1, max: 1 } });
    const damage = calculateDamage(s, stats({ atk: 1 }), stats({ def: 1000 }), false);
    expect(damage).toBe(1);
  });

  it('dégâts min=max produit une valeur déterministe', () => {
    const s = spell({ damage: { min: 50, max: 50 } });
    const damage = calculateDamage(s, stats({ atk: 0 }), stats({ def: 0 }), false);
    expect(damage).toBe(50);
  });

  it('gère des stats nulles', () => {
    Math.random = () => 0;
    const s = spell({ damage: { min: 10, max: 10 } });
    const damage = calculateDamage(s, stats({ atk: 0, mag: 0 }), stats({ def: 0, res: 0 }), false);
    expect(damage).toBe(10);
  });

  it('ne descend pas sous 1 même avec valeurs extrêmes de défense', () => {
    Math.random = () => 0;
    const s = spell({ damage: { min: 1, max: 1 } });
    const damage = calculateDamage(s, stats({ atk: 0 }), stats({ def: 1_000_000 }), false);
    expect(damage).toBe(1);
  });
});

describe('calculateHeal', () => {
  const originalRandom = Math.random;

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('retourne base + floor(mag * 0.5)', () => {
    Math.random = () => 0;
    const s = spell({ damage: { min: 20, max: 20 } });
    expect(calculateHeal(s, stats({ mag: 10 }))).toBe(25); // 20 + 5
  });

  it('retourne base quand mag = 0', () => {
    Math.random = () => 0;
    const s = spell({ damage: { min: 15, max: 15 } });
    expect(calculateHeal(s, stats({ mag: 0 }))).toBe(15);
  });

  it('arrondit vers le bas pour mag impair', () => {
    Math.random = () => 0;
    const s = spell({ damage: { min: 10, max: 10 } });
    expect(calculateHeal(s, stats({ mag: 7 }))).toBe(13); // 10 + floor(3.5) = 13
  });

  it('gère soin avec min < max', () => {
    Math.random = () => 0.9999;
    const s = spell({ damage: { min: 10, max: 20 } });
    expect(calculateHeal(s, stats({ mag: 0 }))).toBe(20);
  });
});

describe('calculateInitiativeJet', () => {
  const originalRandom = Math.random;

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('retourne ini + valeur dans [0, 9]', () => {
    Math.random = () => 0;
    expect(calculateInitiativeJet(stats({ ini: 25 }))).toBe(25);
    Math.random = () => 0.99;
    expect(calculateInitiativeJet(stats({ ini: 25 }))).toBe(34); // 25 + floor(9.9) = 34
  });

  it('range observée sur 1000 tirages est [ini, ini+9]', () => {
    Math.random = originalRandom;
    const s = stats({ ini: 50 });
    const values = Array.from({ length: 1000 }, () => calculateInitiativeJet(s));
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(min).toBeGreaterThanOrEqual(50);
    expect(max).toBeLessThanOrEqual(59);
  });

  it('gère ini=0', () => {
    Math.random = () => 0;
    expect(calculateInitiativeJet(stats({ ini: 0 }))).toBe(0);
  });
});

describe('isInRange', () => {
  it('retourne true pour distance Manhattan dans [min, max]', () => {
    expect(isInRange({ x: 0, y: 0 }, { x: 3, y: 0 }, 1, 5)).toBe(true);
    expect(isInRange({ x: 0, y: 0 }, { x: 2, y: 2 }, 1, 5)).toBe(true); // dist=4
  });

  it('retourne false si trop proche (< min)', () => {
    expect(isInRange({ x: 0, y: 0 }, { x: 1, y: 0 }, 2, 5)).toBe(false);
  });

  it('retourne false si trop loin (> max)', () => {
    expect(isInRange({ x: 0, y: 0 }, { x: 10, y: 0 }, 1, 5)).toBe(false);
  });

  it('retourne true pour même case si min=0', () => {
    expect(isInRange({ x: 3, y: 3 }, { x: 3, y: 3 }, 0, 1)).toBe(true);
  });

  it('retourne false pour même case si min>=1', () => {
    expect(isInRange({ x: 3, y: 3 }, { x: 3, y: 3 }, 1, 5)).toBe(false);
  });

  it('utilise distance absolue (négatif ok)', () => {
    expect(isInRange({ x: 5, y: 5 }, { x: 0, y: 0 }, 1, 10)).toBe(true);
    expect(isInRange({ x: -3, y: -3 }, { x: 0, y: 0 }, 1, 10)).toBe(true);
  });

  it('borne min et max inclusives', () => {
    expect(isInRange({ x: 0, y: 0 }, { x: 3, y: 0 }, 3, 3)).toBe(true);
    expect(isInRange({ x: 0, y: 0 }, { x: 2, y: 0 }, 3, 3)).toBe(false);
  });
});

describe('hasLineOfSight', () => {
  it('retourne true si même case', () => {
    expect(hasLineOfSight({ x: 3, y: 3 }, { x: 3, y: 3 }, [])).toBe(true);
  });

  it('retourne true sur chemin libre', () => {
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, emptyMap())).toBe(true);
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 3, y: 3 }, emptyMap())).toBe(true);
  });

  it('retourne false avec un obstacle bloquant sur le chemin', () => {
    const tiles = emptyMap();
    const block = tiles.find((t) => t.x === 2 && t.y === 0);
    if (block) block.type = TerrainType.IRON; // blockLineOfSight = true
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, tiles)).toBe(false);
  });

  it('ignore les obstacles sur les cases de départ et d\'arrivée', () => {
    const tiles = emptyMap();
    const start = tiles.find((t) => t.x === 0 && t.y === 0);
    const end = tiles.find((t) => t.x === 5 && t.y === 0);
    if (start) start.type = TerrainType.IRON;
    if (end) end.type = TerrainType.IRON;
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, tiles)).toBe(true);
  });

  it('retourne true via case de ressource traversable (HERB)', () => {
    const tiles = emptyMap();
    const mid = tiles.find((t) => t.x === 2 && t.y === 0);
    if (mid) mid.type = TerrainType.HERB; // blockLineOfSight = false
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, tiles)).toBe(true);
  });

  it('bloque pour trajet diagonal traversant un obstacle', () => {
    const tiles = emptyMap();
    const block = tiles.find((t) => t.x === 2 && t.y === 2);
    if (block) block.type = TerrainType.WOOD;
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 4 }, tiles)).toBe(false);
  });

  it('retourne true si tile manquante dans la liste (ne bloque pas)', () => {
    // hasLineOfSight check uniquement les tiles présentes; si absent = traverse OK
    const tiles: Tile[] = [
      { x: 0, y: 0, type: TerrainType.GROUND },
      { x: 5, y: 0, type: TerrainType.GROUND },
    ];
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, tiles)).toBe(true);
  });

  it('fonctionne dans le sens inverse (to < from)', () => {
    const tiles = emptyMap();
    const block = tiles.find((t) => t.x === 2 && t.y === 0);
    if (block) block.type = TerrainType.IRON;
    expect(hasLineOfSight({ x: 5, y: 0 }, { x: 0, y: 0 }, tiles)).toBe(false);
  });

  it('fonctionne en vertical pur', () => {
    const tiles = emptyMap();
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 0, y: 5 }, tiles)).toBe(true);
    const block = tiles.find((t) => t.x === 0 && t.y === 2);
    if (block) block.type = TerrainType.IRON;
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 0, y: 5 }, tiles)).toBe(false);
  });

  it('fonctionne en vertical inverse (from.y > to.y)', () => {
    const tiles = emptyMap();
    expect(hasLineOfSight({ x: 0, y: 5 }, { x: 0, y: 0 }, tiles)).toBe(true);
  });
});

describe('canMoveTo', () => {
  it('retourne false si même position que départ', () => {
    expect(canMoveTo({ x: 2, y: 2 }, 5, { x: 2, y: 2 }, emptyMap(), [])).toBe(false);
  });

  it('retourne false si case occupée', () => {
    expect(canMoveTo({ x: 3, y: 0 }, 5, { x: 0, y: 0 }, emptyMap(), [{ x: 3, y: 0 }])).toBe(false);
  });

  it('retourne false si case non traversable', () => {
    const tiles = emptyMap();
    const target = tiles.find((t) => t.x === 3 && t.y === 0);
    if (target) target.type = TerrainType.IRON; // non-traversable
    expect(canMoveTo({ x: 3, y: 0 }, 5, { x: 0, y: 0 }, tiles, [])).toBe(false);
  });

  it('retourne false si target absent de la map', () => {
    expect(canMoveTo({ x: 999, y: 999 }, 5, { x: 0, y: 0 }, emptyMap(), [])).toBe(false);
  });

  it('retourne true pour déplacement direct dans la limite PM', () => {
    expect(canMoveTo({ x: 3, y: 0 }, 5, { x: 0, y: 0 }, emptyMap(), [])).toBe(true);
  });

  it('retourne false si distance > PM restants', () => {
    expect(canMoveTo({ x: 5, y: 0 }, 3, { x: 0, y: 0 }, emptyMap(), [])).toBe(false);
  });

  it('trouve un chemin qui contourne un obstacle', () => {
    const tiles = emptyMap(5, 5);
    // mur vertical en x=2 sauf y=4
    for (let y = 0; y < 4; y++) {
      const b = tiles.find((t) => t.x === 2 && t.y === y);
      if (b) b.type = TerrainType.WOOD;
    }
    // Pour passer (0,0) -> (4,0), il faut contourner par y=4
    // Distance mini contournée = 4+4+4 = 12
    expect(canMoveTo({ x: 4, y: 0 }, 12, { x: 0, y: 0 }, tiles, [])).toBe(true);
    expect(canMoveTo({ x: 4, y: 0 }, 5, { x: 0, y: 0 }, tiles, [])).toBe(false);
  });

  it('ne traverse pas un autre joueur', () => {
    const occupied = [{ x: 1, y: 0 }];
    // Contournement (0,0) -> (0,1) -> (1,1) -> (2,1) -> (2,0) = 4 pas
    expect(canMoveTo({ x: 2, y: 0 }, 4, { x: 0, y: 0 }, emptyMap(3, 3), occupied)).toBe(true);
    // Avec 3 PM c'est insuffisant pour contourner
    expect(canMoveTo({ x: 2, y: 0 }, 3, { x: 0, y: 0 }, emptyMap(3, 3), occupied)).toBe(false);
  });

  it('autorise la case d\'arrivée même si "proche" d\'un joueur (mais pas dessus)', () => {
    expect(canMoveTo({ x: 1, y: 0 }, 5, { x: 0, y: 0 }, emptyMap(), [{ x: 2, y: 0 }])).toBe(true);
  });
});

describe('canJumpTo', () => {
  it('retourne false si PM < 1', () => {
    expect(canJumpTo({ x: 2, y: 0 }, 0, { x: 0, y: 0 }, emptyMap(), [])).toBe(false);
  });

  it('retourne false si destination pas à exactement 2 cases en ligne droite', () => {
    expect(canJumpTo({ x: 1, y: 0 }, 5, { x: 0, y: 0 }, emptyMap(), [])).toBe(false); // distance 1
    expect(canJumpTo({ x: 3, y: 0 }, 5, { x: 0, y: 0 }, emptyMap(), [])).toBe(false); // distance 3
    expect(canJumpTo({ x: 2, y: 2 }, 5, { x: 0, y: 0 }, emptyMap(), [])).toBe(false); // diagonale
  });

  it('retourne false si case intermédiaire pas jumpable', () => {
    // GROUND n'est PAS jumpable (jumpable: false dans TERRAIN_PROPERTIES)
    expect(canJumpTo({ x: 2, y: 0 }, 5, { x: 0, y: 0 }, emptyMap(), [])).toBe(false);
  });

  it('autorise saut par dessus une case GOLD (jumpable=true)', () => {
    const tiles = emptyMap();
    const mid = tiles.find((t) => t.x === 1 && t.y === 0);
    if (mid) mid.type = TerrainType.GOLD;
    expect(canJumpTo({ x: 2, y: 0 }, 5, { x: 0, y: 0 }, tiles, [])).toBe(true);
  });

  it('retourne false si destination non-traversable', () => {
    const tiles = emptyMap();
    const mid = tiles.find((t) => t.x === 1 && t.y === 0);
    const target = tiles.find((t) => t.x === 2 && t.y === 0);
    if (mid) mid.type = TerrainType.GOLD;
    if (target) target.type = TerrainType.WOOD;
    expect(canJumpTo({ x: 2, y: 0 }, 5, { x: 0, y: 0 }, tiles, [])).toBe(false);
  });

  it('retourne false si destination occupée', () => {
    const tiles = emptyMap();
    const mid = tiles.find((t) => t.x === 1 && t.y === 0);
    if (mid) mid.type = TerrainType.GOLD;
    expect(canJumpTo({ x: 2, y: 0 }, 5, { x: 0, y: 0 }, tiles, [{ x: 2, y: 0 }])).toBe(false);
  });

  it('retourne false si case intermédiaire absente de la map', () => {
    const tiles: Tile[] = [
      { x: 0, y: 0, type: TerrainType.GROUND },
      { x: 2, y: 0, type: TerrainType.GROUND },
    ];
    expect(canJumpTo({ x: 2, y: 0 }, 5, { x: 0, y: 0 }, tiles, [])).toBe(false);
  });

  it('autorise saut vertical', () => {
    const tiles = emptyMap();
    const mid = tiles.find((t) => t.x === 0 && t.y === 1);
    if (mid) mid.type = TerrainType.GOLD;
    expect(canJumpTo({ x: 0, y: 2 }, 5, { x: 0, y: 0 }, tiles, [])).toBe(true);
  });

  it('autorise saut négatif (en arrière)', () => {
    const tiles = emptyMap();
    const mid = tiles.find((t) => t.x === 1 && t.y === 0);
    if (mid) mid.type = TerrainType.GOLD;
    expect(canJumpTo({ x: 0, y: 0 }, 5, { x: 2, y: 0 }, tiles, [])).toBe(true);
  });
});
