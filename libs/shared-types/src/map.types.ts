// --- Resource families ---

export enum ResourceFamily {
  FORGE = 'FORGE',
  ARCANE = 'ARCANE',
  NATURE = 'NATURE',
  SPECIAL = 'SPECIAL',
}

// --- Combat terrain behavior ---

export enum CombatTerrainType {
  FLAT = 'FLAT',
  WALL = 'WALL',
  HOLE = 'HOLE',
}

// --- Terrain types (map cells) ---

export enum TerrainType {
  GROUND = 'GROUND',
  IRON = 'IRON',
  LEATHER = 'LEATHER',
  CRYSTAL = 'CRYSTAL',
  FABRIC = 'FABRIC',
  WOOD = 'WOOD',
  HERB = 'HERB',
  GOLD = 'GOLD',
}

export interface TerrainProperties {
  family: ResourceFamily | null;
  combatType: CombatTerrainType;
  traversable: boolean;
  blockLineOfSight: boolean;
  jumpable: boolean;
  harvestable: boolean;
  resourceName: string | null;
}

export const TERRAIN_PROPERTIES: Record<TerrainType, TerrainProperties> = {
  [TerrainType.GROUND]: {
    family: null,
    combatType: CombatTerrainType.FLAT,
    traversable: true,
    blockLineOfSight: false,
    jumpable: false,
    harvestable: false,
    resourceName: null,
  },
  [TerrainType.IRON]: {
    family: ResourceFamily.FORGE,
    combatType: CombatTerrainType.WALL,
    traversable: false,
    blockLineOfSight: true,
    jumpable: false,
    harvestable: true,
    resourceName: 'Fer',
  },
  [TerrainType.LEATHER]: {
    family: ResourceFamily.FORGE,
    combatType: CombatTerrainType.FLAT,
    traversable: true,
    blockLineOfSight: false,
    jumpable: false,
    harvestable: true,
    resourceName: 'Cuir',
  },
  [TerrainType.CRYSTAL]: {
    family: ResourceFamily.ARCANE, // Changed from null to ARCANE
    combatType: CombatTerrainType.WALL,
    traversable: false,
    blockLineOfSight: true,
    jumpable: false,
    harvestable: true,
    resourceName: 'Cristal magique',
  },
  [TerrainType.FABRIC]: {
    family: ResourceFamily.ARCANE,
    combatType: CombatTerrainType.FLAT,
    traversable: true,
    blockLineOfSight: false,
    jumpable: false,
    harvestable: true,
    resourceName: 'Étoffe',
  },
  [TerrainType.WOOD]: {
    family: ResourceFamily.NATURE,
    combatType: CombatTerrainType.WALL,
    traversable: false,
    blockLineOfSight: true,
    jumpable: false,
    harvestable: true,
    resourceName: 'Bois',
  },
  [TerrainType.HERB]: {
    family: ResourceFamily.NATURE,
    combatType: CombatTerrainType.FLAT,
    traversable: true,
    blockLineOfSight: false,
    jumpable: false,
    harvestable: true,
    resourceName: 'Herbe médicinale',
  },
  [TerrainType.GOLD]: {
    family: ResourceFamily.SPECIAL,
    combatType: CombatTerrainType.WALL,
    traversable: false,
    blockLineOfSight: true,
    jumpable: false,
    harvestable: true,
    resourceName: 'Or',
  },
};

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  [TerrainType.GROUND]: 'Sol libre',
  [TerrainType.IRON]: 'Fer',
  [TerrainType.LEATHER]: 'Cuir',
  [TerrainType.CRYSTAL]: 'Cristal magique',
  [TerrainType.FABRIC]: 'Étoffe',
  [TerrainType.WOOD]: 'Bois',
  [TerrainType.HERB]: 'Herbe médicinale',
  [TerrainType.GOLD]: 'Or',
};

// --- Map ---

export const MAP_SIZE = 20;

export interface GameMap {
  width: number;
  height: number;
  grid: TerrainType[][];
  seedId: SeedId;
}

export interface MapCell {
  x: number;
  y: number;
  terrain: TerrainType;
}

// --- Seed system ---

export type SeedId =
  | 'FORGE'
  | 'ARCANE'
  | 'NATURE'
  | 'FORGE_NATURE'
  | 'ARCANE_NATURE'
  | 'FORGE_ARCANE';

export interface SeedConfig {
  id: SeedId;
  label: string;
  resources: TerrainType[];
  dominantBuild: string;
  counterBuild: string;
}

export const SEED_CONFIGS: Record<SeedId, SeedConfig> = {
  FORGE: {
    id: 'FORGE',
    label: '🔴 FORGE',
    resources: [TerrainType.IRON, TerrainType.LEATHER, TerrainType.HERB, TerrainType.GOLD],
    dominantBuild: 'Guerrier',
    counterBuild: 'Mage (full shop)',
  },
  ARCANE: {
    id: 'ARCANE',
    label: '🟣 ARCANE',
    resources: [TerrainType.CRYSTAL, TerrainType.FABRIC, TerrainType.HERB, TerrainType.GOLD],
    dominantBuild: 'Mage',
    counterBuild: 'Ninja alchimiste',
  },
  NATURE: {
    id: 'NATURE',
    label: '🟢 NATURE',
    resources: [TerrainType.WOOD, TerrainType.HERB, TerrainType.LEATHER, TerrainType.GOLD],
    dominantBuild: 'Ninja (sans Kunaï)',
    counterBuild: 'Guerrier (Fer shop)',
  },
  FORGE_NATURE: {
    id: 'FORGE_NATURE',
    label: '🔴🟢 FORGE+NATURE',
    resources: [
      TerrainType.IRON, TerrainType.LEATHER, TerrainType.WOOD,
      TerrainType.HERB, TerrainType.GOLD,
    ],
    dominantBuild: 'Ninja / Guerrier',
    counterBuild: '—',
  },
  ARCANE_NATURE: {
    id: 'ARCANE_NATURE',
    label: '🟣🟢 ARCANE+NATURE',
    resources: [
      TerrainType.CRYSTAL, TerrainType.FABRIC, TerrainType.WOOD,
      TerrainType.HERB, TerrainType.LEATHER, TerrainType.GOLD,
    ],
    dominantBuild: 'Mage / Ninja',
    counterBuild: '—',
  },
  FORGE_ARCANE: {
    id: 'FORGE_ARCANE',
    label: '🔴🟣 FORGE+ARCANE',
    resources: [
      TerrainType.IRON, TerrainType.LEATHER, TerrainType.CRYSTAL,
      TerrainType.FABRIC, TerrainType.GOLD,
    ],
    dominantBuild: 'Guerrier / Mage',
    counterBuild: '—',
  },
};

export const ALL_SEED_IDS: SeedId[] = [
  'FORGE', 'ARCANE', 'NATURE', 'FORGE_NATURE', 'ARCANE_NATURE', 'FORGE_ARCANE',
];
