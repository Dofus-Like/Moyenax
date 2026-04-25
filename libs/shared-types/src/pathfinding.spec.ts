import { TerrainType } from './map.types';
import { canJumpOver, findPath, findPathToAdjacent } from './pathfinding';
import type { GameMap } from './map.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMap(rows: TerrainType[][]): GameMap {
  return {
    width: rows[0].length,
    height: rows.length,
    grid: rows,
    seedId: 'FORGE',
  };
}

const G = TerrainType.GROUND;
const W = TerrainType.IRON;    // WALL – not traversable
const H = TerrainType.GOLD;    // HOLE – not traversable by normal movement, jumpable

// ---------------------------------------------------------------------------
// findPath
// ---------------------------------------------------------------------------

describe('findPath', () => {
  it('returns an empty path when start equals end', () => {
    const map = makeMap([
      [G, G],
      [G, G],
    ]);
    const path = findPath(map, { x: 0, y: 0 }, { x: 0, y: 0 });
    // start === end means the path is trivially found and the result is empty
    // (start is excluded from the result)
    expect(path).not.toBeNull();
    expect(path).toHaveLength(0);
  });

  it('finds a direct horizontal path', () => {
    const map = makeMap([[G, G, G, G]]);
    const path = findPath(map, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(path).not.toBeNull();
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('finds a direct vertical path', () => {
    const map = makeMap([[G], [G], [G], [G]]);
    const path = findPath(map, { x: 0, y: 0 }, { x: 0, y: 3 });
    expect(path).not.toBeNull();
    expect(path).toEqual([{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }]);
  });

  it('finds a path around a wall', () => {
    // G G G
    // G W G
    // G G G
    const map = makeMap([
      [G, G, G],
      [G, W, G],
      [G, G, G],
    ]);
    const path = findPath(map, { x: 0, y: 1 }, { x: 2, y: 1 });
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
    // Must not pass through the wall tile (1,1)
    expect(path!.some((n) => n.x === 1 && n.y === 1)).toBe(false);
  });

  it('returns null when the destination is a wall', () => {
    const map = makeMap([
      [G, W],
      [G, G],
    ]);
    expect(findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
  });

  it('returns null when the destination is out of bounds', () => {
    const map = makeMap([[G, G]]);
    expect(findPath(map, { x: 0, y: 0 }, { x: 5, y: 0 })).toBeNull();
  });

  it('returns null when the destination is negative', () => {
    const map = makeMap([[G, G]]);
    expect(findPath(map, { x: 1, y: 0 }, { x: -1, y: 0 })).toBeNull();
  });

  it('returns null when no walkable path exists', () => {
    // Player is surrounded by walls
    const map = makeMap([
      [W, W, W],
      [W, G, W],
      [W, W, W],
    ]);
    expect(findPath(map, { x: 1, y: 1 }, { x: 0, y: 0 })).toBeNull();
  });

  it('respects occupiedPositionSet when the destination is occupied', () => {
    const map = makeMap([[G, G, G]]);
    const occupied = new Set(['2,0']);
    expect(findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 }, occupied)).toBeNull();
  });

  it('avoids occupied intermediate cells', () => {
    // Single-row map: only route through (1,0) is blocked
    const map = makeMap([[G, G, G]]);
    const occupied = new Set(['1,0']);
    // Can't reach (2,0) with only a horizontal map
    expect(findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 }, occupied)).toBeNull();
  });

  it('handles a large open grid without error', () => {
    const size = 15;
    const grid: TerrainType[][] = Array.from({ length: size }, () =>
      Array(size).fill(G),
    );
    const map = makeMap(grid);
    const path = findPath(map, { x: 0, y: 0 }, { x: size - 1, y: size - 1 });
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
  });

  it('GOLD tiles (HOLE) block normal movement', () => {
    const map = makeMap([[G, H, G]]);
    // Can't walk through gold (hole) tiles
    expect(findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('returns a single step when target is adjacent', () => {
    const map = makeMap([[G, G]]);
    const path = findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(path).toEqual([{ x: 1, y: 0 }]);
  });
});

// ---------------------------------------------------------------------------
// findPathToAdjacent
// ---------------------------------------------------------------------------

describe('findPathToAdjacent', () => {
  it('returns the path to a cell adjacent to the target', () => {
    // G G G
    // G G G
    const map = makeMap([
      [G, G, G],
      [G, G, G],
    ]);
    const path = findPathToAdjacent(map, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).not.toBeNull();
    // The last step must be adjacent to (2,0): either (1,0) or (2,1)
    const last = path![path!.length - 1];
    const adjacentToTarget =
      (last.x === 1 && last.y === 0) ||
      (last.x === 2 && last.y === 1);
    expect(adjacentToTarget).toBe(true);
  });

  it('returns empty path when already adjacent to the target', () => {
    const map = makeMap([[G, G, G]]);
    const path = findPathToAdjacent(map, { x: 0, y: 0 }, { x: 1, y: 0 });
    // Start is already adjacent to the target → path should be empty (no moves needed)
    expect(path).not.toBeNull();
    expect(path).toHaveLength(0);
  });

  it('returns null when target is completely surrounded by walls', () => {
    const map = makeMap([
      [W, W, W],
      [W, G, W],
      [W, W, W],
    ]);
    // No traversable adjacent cell exists
    expect(findPathToAdjacent(map, { x: 1, y: 1 }, { x: 0, y: 0 })).toBeNull();
  });

  it('finds a path even when the target cell itself is a wall', () => {
    const map = makeMap([
      [G, G, G],
      [G, W, G],
      [G, G, G],
    ]);
    const path = findPathToAdjacent(map, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(path).not.toBeNull();
  });

  it('respects occupiedPositionSet', () => {
    const map = makeMap([[G, G, G, G]]);
    const occupied = new Set(['1,0', '2,0']); // block the only adjacent cells
    expect(findPathToAdjacent(map, { x: 0, y: 0 }, { x: 3, y: 0 }, occupied)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// canJumpOver
// ---------------------------------------------------------------------------

describe('canJumpOver', () => {
  it('returns the landing cell when the jump is valid', () => {
    // G H G  – player at (0,0), hole at (1,0), landing at (2,0)
    const map = makeMap([[G, H, G]]);
    const landing = canJumpOver(map, { x: 0, y: 0 }, 1, 0);
    expect(landing).toEqual({ x: 2, y: 0 });
  });

  it('returns null when the hole is out of bounds', () => {
    const map = makeMap([[G]]);
    expect(canJumpOver(map, { x: 0, y: 0 }, -1, 0)).toBeNull();
  });

  it('returns null when the target cell is not a HOLE', () => {
    const map = makeMap([[G, G, G]]);
    expect(canJumpOver(map, { x: 0, y: 0 }, 1, 0)).toBeNull();
  });

  it('returns null when the hole is not adjacent (distance > 1)', () => {
    const map = makeMap([[G, G, H, G]]);
    // Hole at (2,0) is 2 tiles away from (0,0)
    expect(canJumpOver(map, { x: 0, y: 0 }, 2, 0)).toBeNull();
  });

  it('returns null when the landing cell would be out of bounds', () => {
    // H is the last tile: nothing to land on
    const map = makeMap([[G, H]]);
    expect(canJumpOver(map, { x: 0, y: 0 }, 1, 0)).toBeNull();
  });

  it('returns null when the landing cell is not walkable', () => {
    // G H W – landing is a wall
    const map = makeMap([[G, H, W]]);
    expect(canJumpOver(map, { x: 0, y: 0 }, 1, 0)).toBeNull();
  });

  it('handles vertical jumps correctly', () => {
    // Row 0: G
    // Row 1: H
    // Row 2: G
    const map = makeMap([[G], [H], [G]]);
    const landing = canJumpOver(map, { x: 0, y: 0 }, 0, 1);
    expect(landing).toEqual({ x: 0, y: 2 });
  });
});
