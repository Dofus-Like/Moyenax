import { generateMap } from '@game/game-engine';
import { ALL_SEED_IDS } from '@game/shared-types';
import type { GameMap, SeedId } from '@game/shared-types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MapGeneratorService {
  async getOrCreateMap(seedId?: SeedId, randomSeed?: number): Promise<GameMap> {
    return this.generate(seedId ?? this.pickRandomSeed(), randomSeed);
  }

  async resetMap(seedId?: SeedId, randomSeed?: number): Promise<GameMap> {
    return this.generate(seedId ?? this.pickRandomSeed(), randomSeed);
  }

  private pickRandomSeed(): SeedId {
    return ALL_SEED_IDS[Math.floor(Math.random() * ALL_SEED_IDS.length)];
  }

  // Pure generation lives in libs/game-engine (single source of truth, shared with the web editor).
  generate(seedId: SeedId, randomSeed?: number): GameMap {
    return generateMap(seedId, randomSeed);
  }
}
