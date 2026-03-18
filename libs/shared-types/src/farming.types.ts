import { SeedId, TerrainType } from './map.types';

export interface FarmingState {
  playerId: string;
  seedId: SeedId;
  map: { x: number; y: number; terrain: TerrainType }[];
  pips: number;
  round: number;
}
