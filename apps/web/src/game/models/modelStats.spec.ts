import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { computeModelStats, formatBytes } from './modelStats';

describe('computeModelStats', () => {
  it('compte meshes, triangles, matériaux et dimensions d’un cube', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial());
    const stats = computeModelStats(mesh, 3);
    expect(stats.meshes).toBe(1);
    expect(stats.triangles).toBe(12);
    expect(stats.materials).toBe(1);
    expect(stats.animations).toBe(3);
    expect(stats.size.x).toBeCloseTo(2);
    expect(stats.size.y).toBeCloseTo(2);
  });

  it('agrège plusieurs meshes', () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    expect(computeModelStats(group, 0).meshes).toBe(2);
  });
});

describe('formatBytes', () => {
  it('formate en unités lisibles', () => {
    expect(formatBytes(0)).toBe('—');
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(1536)).toBe('1.5 Ko');
    expect(formatBytes(51 * 1024 * 1024)).toBe('51.0 Mo');
  });
});
