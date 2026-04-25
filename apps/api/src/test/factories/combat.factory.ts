import { CombatPlayer, CombatState, Tile, TerrainType } from '@game/shared-types';
import { makePlayerStats } from './player.factory';

export function makeEmptyMap(width = 10, height = 10): { width: number; height: number; tiles: Tile[] } {
  const tiles: Tile[] = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.push({ x, y, type: TerrainType.GROUND });
    }
  }
  return { width, height, tiles };
}

export function makeMapWithObstacles(
  width: number,
  height: number,
  obstacles: Array<{ x: number; y: number; type: TerrainType }>,
): { width: number; height: number; tiles: Tile[] } {
  const map = makeEmptyMap(width, height);
  for (const obs of obstacles) {
    const tile = map.tiles.find((t) => t.x === obs.x && t.y === obs.y);
    if (tile) tile.type = obs.type;
  }
  return map;
}

export function makeCombatPlayer(overrides: Partial<CombatPlayer> = {}): CombatPlayer {
  const stats = overrides.stats ?? makePlayerStats();
  return {
    playerId: 'player-1',
    username: 'Alice',
    type: 'PLAYER',
    stats,
    position: { x: 0, y: 0 },
    spells: [],
    remainingPa: stats.pa,
    remainingPm: stats.pm,
    currentVit: stats.vit,
    spellCooldowns: {},
    buffs: [],
    ...overrides,
  };
}

export function makeCombatState(overrides: Partial<CombatState> = {}): CombatState {
  const p1 = makeCombatPlayer({ playerId: 'p1', username: 'Alice', position: { x: 0, y: 0 } });
  const p2 = makeCombatPlayer({
    playerId: 'p2',
    username: 'Bob',
    position: { x: 5, y: 5 },
  });
  return {
    sessionId: 'session-1',
    currentTurnPlayerId: 'p1',
    turnNumber: 1,
    players: { p1, p2 },
    map: makeEmptyMap(10, 10),
    ...overrides,
  };
}
