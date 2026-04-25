import type { TerrainType, GameMap} from './map.types';
import { TERRAIN_PROPERTIES, CombatTerrainType } from './map.types';

export interface PathNode {
  x: number;
  y: number;
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

function heuristic(a: PathNode, b: PathNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const DIRECTIONS: PathNode[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/**
 * Determines if a terrain cell can be walked through during normal movement.
 * WALL and HOLE block normal movement. Only FLAT terrain is walkable.
 */
function isWalkable(terrain: TerrainType): boolean {
  return TERRAIN_PROPERTIES[terrain].traversable;
}

/**
 * A* pathfinding on a TerrainType grid (walking only, no jumps).
 * Returns the path from start (exclusive) to end (inclusive),
 * or null if no walkable path exists.
 */
export function findPath(
  map: GameMap,
  start: PathNode,
  end: PathNode,
  occupiedPositionSet?: Set<string>,
): PathNode[] | null {
  if (
    end.x < 0 ||
    end.x >= map.width ||
    end.y < 0 ||
    end.y >= map.height ||
    !isWalkable(map.grid[end.y][end.x]) ||
    occupiedPositionSet?.has(`${end.x},${end.y}`)
  ) {
    return null;
  }

  const key = (x: number, y: number) => `${x},${y}`;
  const open: AStarNode[] = [];
  const closed = new Set<string>();

  const dx2 = start.x - end.x;
  const dy2 = start.y - end.y;

  const startNode: AStarNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
    parent: null,
  };
  open.push(startNode);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const currentKey = key(current.x, current.y);

    if (current.x === end.x && current.y === end.y) {
      const path: PathNode[] = [];
      let node: AStarNode | null = current;
      while (node && !(node.x === start.x && node.y === start.y)) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(currentKey);

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;

      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
      if (closed.has(key(nx, ny))) continue;
      if (!isWalkable(map.grid[ny][nx])) continue;
      if (occupiedPositionSet?.has(key(nx, ny))) continue;

      const g = current.g + 1;
      let h = heuristic({ x: nx, y: ny }, end);

      const dx1 = nx - end.x;
      const dy1 = ny - end.y;
      const cross = Math.abs(dx1 * dy2 - dx2 * dy1);
      h += cross * 0.0001;

      const f = g + h;

      const existing = open.find((n) => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
        continue;
      }

      open.push({ x: nx, y: ny, g, h, f, parent: current });
    }
  }

  return null;
}

/**
 * Finds the shortest path from start to ANY tile adjacent to the target.
 * Useful for interacting with objects (harvesting, etc).
 */
export function findPathToAdjacent(
  map: GameMap,
  start: PathNode,
  target: PathNode,
  occupiedPositionSet?: Set<string>,
): PathNode[] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const open: AStarNode[] = [];
  const closed = new Set<string>();

  const dx2 = start.x - target.x;
  const dy2 = start.y - target.y;

  const startNode: AStarNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, target),
    f: heuristic(start, target),
    parent: null,
  };
  open.push(startNode);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const currentKey = key(current.x, current.y);

    const dist = Math.abs(current.x - target.x) + Math.abs(current.y - target.y);
    if (dist === 1) {
      const path: PathNode[] = [];
      let node: AStarNode | null = current;
      while (node && !(node.x === start.x && node.y === start.y)) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(currentKey);

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;

      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
      if (closed.has(key(nx, ny))) continue;
      if (!isWalkable(map.grid[ny][nx])) continue;
      if (occupiedPositionSet?.has(key(nx, ny))) continue;

      const g = current.g + 1;
      let h = heuristic({ x: nx, y: ny }, target);

      const dx1 = nx - target.x;
      const dy1 = ny - target.y;
      const cross = Math.abs(dx1 * dy2 - dx2 * dy1);
      h += cross * 0.0001;

      const f = g + h;

      const existing = open.find((n) => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
        continue;
      }

      open.push({ x: nx, y: ny, g, h, f, parent: current });
    }
  }

  return null;
}

/**
 * Checks if a HOLE (TROU) cell is adjacent and jumpable:
 * the cell on the other side must be walkable and in bounds.
 */
export function canJumpOver(
  map: GameMap,
  from: PathNode,
  holeX: number,
  holeY: number,
): PathNode | null {
  if (holeX < 0 || holeX >= map.width || holeY < 0 || holeY >= map.height) return null;

  const terrain = map.grid[holeY][holeX];
  if (TERRAIN_PROPERTIES[terrain].combatType !== CombatTerrainType.HOLE) return null;

  const dx = holeX - from.x;
  const dy = holeY - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;

  const landX = holeX + dx;
  const landY = holeY + dy;
  if (landX < 0 || landX >= map.width || landY < 0 || landY >= map.height) return null;
  if (!isWalkable(map.grid[landY][landX])) return null;

  return { x: landX, y: landY };
}
