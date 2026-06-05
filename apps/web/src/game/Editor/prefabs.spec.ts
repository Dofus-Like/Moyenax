import { describe, expect, it } from 'vitest';

import type { PlacedProp } from '@game/shared-types';

import { buildPrefab, instantiateParts } from './prefabs';

function prop(id: string, x: number, z: number): PlacedProp {
  return {
    id,
    modelKey: `m-${id}`,
    position: [x, 0, z],
    rotation: [0, 0, 0],
    scale: 1,
    collides: true,
  };
}

describe('prefabs', () => {
  it('buildPrefab rend les positions relatives au centre', () => {
    const prefab = buildPrefab('pf1', 'Mur', [prop('a', 0, 0), prop('b', 4, 0)]);
    // centre X = 2 → parts à -2 et +2
    expect(prefab.parts.map((p) => p.position[0])).toEqual([-2, 2]);
    expect(prefab.name).toBe('Mur');
  });

  it('instantiateParts replace le centre au point demandé', () => {
    const prefab = buildPrefab('pf1', 'Mur', [prop('a', 0, 0), prop('b', 4, 0)]);
    const parts = instantiateParts(prefab, [10, 0, 5]);
    expect(parts.map((p) => p.position[0])).toEqual([8, 12]); // 10-2, 10+2
    expect(parts.every((p) => p.position[2] === 5)).toBe(true);
    expect(parts[0]).not.toHaveProperty('id');
  });

  it('round-trip conserve les écarts relatifs', () => {
    const original = [prop('a', 1, 1), prop('b', 5, 1), prop('c', 3, 4)];
    const parts = instantiateParts(buildPrefab('p', 'g', original), [0, 0, 0]);
    const dx = parts[1].position[0] - parts[0].position[0];
    expect(dx).toBe(4); // écart b-a conservé
  });
});
