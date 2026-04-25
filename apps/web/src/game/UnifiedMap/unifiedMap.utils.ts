import type { PathNode, Tile } from '@game/shared-types';

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

export interface BoundaryEdge {
  start: [number, number]; // [x, z] relative to tile center
  end: [number, number];   // [x, z] relative to tile center
}

/**
 * Calculates the perimeter edges for a set of tiles.
 * Useful for drawing silhouettes/outlines around reachable areas.
 */
export function calculateBoundaryEdges(tiles: { x: number; y: number }[]): BoundaryEdge[] {
  const tileSet = new Set(tiles.map(t => toPositionKey(t.x, t.y)));
  const boundaryEdges: BoundaryEdge[] = [];

  for (const tile of tiles) {
    // Neighbors: Top (dy -1), Bottom (dy +1), Left (dx -1), Right (dx +1)
    const neighbors = [
      { dx: 0, dy: -1, start: [-0.5, -0.5], end: [0.5, -0.5] }, // Top
      { dx: 0, dy: 1, start: [-0.5, 0.5], end: [0.5, 0.5] },   // Bottom
      { dx: -1, dy: 0, start: [-0.5, -0.5], end: [-0.5, 0.5] }, // Left
      { dx: 1, dy: 0, start: [0.5, -0.5], end: [0.5, 0.5] },   // Right
    ];

    for (const { dx, dy, start, end } of neighbors) {
      if (!tileSet.has(toPositionKey(tile.x + dx, tile.y + dy))) {
        boundaryEdges.push({ 
          start: [tile.x + start[0], tile.y + start[1]], 
          end: [tile.x + end[0], tile.y + end[1]]
        });
      }
    }
  }

  return boundaryEdges;
}
