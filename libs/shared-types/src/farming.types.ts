import type { SeedId, TerrainType } from './map.types';

export interface FarmingState {
  playerId: string;
  seedId: SeedId;
  mapSeed: number;
  map: { x: number; y: number; terrain: TerrainType }[];
  pips: number;
  round: number;
  spendableGold: number;
}
