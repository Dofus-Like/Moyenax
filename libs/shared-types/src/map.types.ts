export enum TerrainType {
  GROUND = 'GROUND',
  WATER = 'WATER',
  IRON_ORE = 'IRON_ORE',
  GOLD_ORE = 'GOLD_ORE',
  WOOD = 'WOOD',
  HERB = 'HERB',
  CRYSTAL = 'CRYSTAL',
  LEATHER = 'LEATHER',
}

export interface TerrainProperties {
  traversable: boolean;
  blockLineOfSight: boolean;
  jumpable: boolean;
  harvestable: boolean;
  resourceName: string | null;
}

export const TERRAIN_PROPERTIES: Record<TerrainType, TerrainProperties> = {
  [TerrainType.GROUND]: {
    traversable: true,
    blockLineOfSight: false,
    jumpable: false,
    harvestable: false,
    resourceName: null,
  },
  [TerrainType.WATER]: {
    traversable: false,
    blockLineOfSight: false,
    jumpable: true,
    harvestable: false,
    resourceName: null,
  },
  [TerrainType.IRON_ORE]: {
    traversable: false,
    blockLineOfSight: true,
    jumpable: false,
    harvestable: true,
    resourceName: 'Minerai de Fer',
  },
  [TerrainType.GOLD_ORE]: {
    traversable: false,
    blockLineOfSight: true,
    jumpable: false,
    harvestable: true,
    resourceName: "Minerai d'Or",
  },
  [TerrainType.WOOD]: {
    traversable: false,
    blockLineOfSight: true,
    jumpable: false,
    harvestable: true,
    resourceName: 'Bois de Frêne',
  },
  [TerrainType.HERB]: {
    traversable: true,
    blockLineOfSight: false,
    jumpable: false,
    harvestable: true,
    resourceName: 'Herbe Médicinale',
  },
  [TerrainType.CRYSTAL]: {
    traversable: false,
    blockLineOfSight: true,
    jumpable: false,
    harvestable: true,
    resourceName: "Cristal d'Ombre",
  },
  [TerrainType.LEATHER]: {
    traversable: true,
    blockLineOfSight: false,
    jumpable: false,
    harvestable: true,
    resourceName: 'Cuir Robuste',
  },
};

export const MAP_SIZE = 20;

export interface GameMap {
  width: number;
  height: number;
  grid: TerrainType[][];
}

export interface MapCell {
  x: number;
  y: number;
  terrain: TerrainType;
}

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  [TerrainType.GROUND]: 'Sol libre',
  [TerrainType.WATER]: 'Mare d\'eau',
  [TerrainType.IRON_ORE]: 'Minerai de Fer',
  [TerrainType.GOLD_ORE]: 'Minerai d\'Or',
  [TerrainType.WOOD]: 'Bois de Frêne',
  [TerrainType.HERB]: 'Herbe Médicinale',
  [TerrainType.CRYSTAL]: 'Cristal d\'Ombre',
  [TerrainType.LEATHER]: 'Cuir Robuste',
};
