import { Injectable } from '@nestjs/common';
import { CombatPosition } from '@game/shared-types';
import { canMoveToPosition } from '@game/game-engine';

interface CombatMap {
  width: number;
  height: number;
  obstacles: CombatPosition[];
}

@Injectable()
export class MapService {
  generateCombatMap(width: number, height: number): CombatMap {
    const obstacles: CombatPosition[] = [];
    const obstacleCount = Math.floor((width * height) * 0.1);

    for (let i = 0; i < obstacleCount; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);

      // Éviter les coins de spawn
      if ((x === 0 && y === 0) || (x === width - 1 && y === height - 1)) {
        continue;
      }

      if (!obstacles.some((o) => o.x === x && o.y === y)) {
        obstacles.push({ x, y });
      }
    }

    return { width, height, obstacles };
  }

  getReachablePositions(
    from: CombatPosition,
    remainingMp: number,
    obstacles: CombatPosition[],
  ): CombatPosition[] {
    const reachable: CombatPosition[] = [];

    for (let dx = -remainingMp; dx <= remainingMp; dx++) {
      for (let dy = -remainingMp; dy <= remainingMp; dy++) {
        const target = { x: from.x + dx, y: from.y + dy };
        if (canMoveToPosition(from, target, remainingMp, obstacles)) {
          reachable.push(target);
        }
      }
    }

    return reachable;
  }
}
