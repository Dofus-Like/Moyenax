import { PathNode, Tile } from '@game/shared-types';

export function toPositionKey(x: number, y: number) {
  return `${x},${y}`;
}

export function toWorldPosition(x: number, y: number, gridSize: number): [number, number, number] {
  return [x - gridSize / 2 + 0.5, 0, y - gridSize / 2 + 0.5];
}

export function buildTileIndex(tiles: Tile[]) {
  return new Map(tiles.map((tile) => [toPositionKey(tile.x, tile.y), tile]));
}

export function buildOccupiedPositionSet(positions: PathNode[]) {
  return new Set(positions.map((position) => toPositionKey(position.x, position.y)));
}
