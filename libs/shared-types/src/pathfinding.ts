import { TerrainType, TERRAIN_PROPERTIES, GameMap } from './map.types';

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

function isTraversable(terrain: TerrainType): boolean {
  return TERRAIN_PROPERTIES[terrain].traversable;
}

const DIRECTIONS: PathNode[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/**
 * A* pathfinding on a TerrainType grid.
 * Returns the path as an array of {x, y} from start (exclusive) to end (inclusive),
 * or null if no path exists.
 */
export function findPath(
  map: GameMap,
  start: PathNode,
  end: PathNode,
): PathNode[] | null {
  if (
    end.x < 0 || end.x >= map.width ||
    end.y < 0 || end.y >= map.height ||
    !isTraversable(map.grid[end.y][end.x])
  ) {
    return null;
  }

  const key = (x: number, y: number) => `${x},${y}`;
  const open: AStarNode[] = [];
  const closed = new Set<string>();

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
      if (!isTraversable(map.grid[ny][nx])) continue;

      const g = current.g + 1;
      const h = heuristic({ x: nx, y: ny }, end);
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
