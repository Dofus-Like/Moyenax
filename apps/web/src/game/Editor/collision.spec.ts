import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { type Obstacle, freePositionAmong, hasNewCollision } from './collision';

function box(cx: number, half = 0.5): Box3 {
  return new Box3(new Vector3(cx - half, -half, -half), new Vector3(cx + half, half, half));
}

describe('hasNewCollision', () => {
  it('détecte une nouvelle collision avec un obstacle non chevauché au départ', () => {
    const obstacles: Obstacle[] = [{ box: box(1), overlappingAtStart: false }];
    expect(hasNewCollision(box(0.6), obstacles)).toBe(true); // boîtes se recouvrent
    expect(hasNewCollision(box(3), obstacles)).toBe(false); // loin
  });

  it('ignore les obstacles déjà chevauchés au départ (séparation possible)', () => {
    const obstacles: Obstacle[] = [{ box: box(0), overlappingAtStart: true }];
    expect(hasNewCollision(box(0), obstacles)).toBe(false);
  });

  it('renvoie false sans obstacle', () => {
    expect(hasNewCollision(box(0), [])).toBe(false);
  });
});

describe('freePositionAmong', () => {
  it('garde le point s’il est libre', () => {
    expect(freePositionAmong([5, 0, 5], [box(0)])).toEqual([5, 0, 5]);
  });

  it('décale le point hors d’une boîte occupée', () => {
    const occupied = new Box3(new Vector3(-0.5, -100, -0.5), new Vector3(0.5, 100, 0.5));
    const result = freePositionAmong([0, 0, 0], [occupied]);
    expect(result).not.toEqual([0, 0, 0]);
    // déplacé d'au moins une case et hors de la boîte occupée
    expect(Math.max(Math.abs(result[0]), Math.abs(result[2]))).toBeGreaterThanOrEqual(1);
    const probe = new Box3(
      new Vector3(result[0] - 0.4, -100, result[2] - 0.4),
      new Vector3(result[0] + 0.4, 100, result[2] + 0.4),
    );
    expect(occupied.intersectsBox(probe)).toBe(false);
  });
});
