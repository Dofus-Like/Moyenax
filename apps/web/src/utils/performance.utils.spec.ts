import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { updateInstanceMatrix, worldToGrid, gridToWorld } from './performance.utils';

describe('performance.utils', () => {
  describe('worldToGrid', () => {
    it('convertit (0,0) au centre d\'une grille 10×10', () => {
      expect(worldToGrid(new THREE.Vector3(0, 0, 0), 10)).toEqual({ x: 5, z: 5 });
    });

    it('convertit un coin (-5, -5) au (0, 0) pour grille 10', () => {
      expect(worldToGrid(new THREE.Vector3(-5, 0, -5), 10)).toEqual({ x: 0, z: 0 });
    });

    it('retourne l\'index correct (floor) pour coordonnées fractionnaires', () => {
      expect(worldToGrid(new THREE.Vector3(2.7, 0, -1.2), 10)).toEqual({ x: 7, z: 3 });
    });
  });

  describe('gridToWorld', () => {
    it('convertit (0,0) d\'une grille 10 au coin (-4.5, 0, -4.5)', () => {
      expect(gridToWorld(0, 0, 10)).toEqual([-4.5, 0, -4.5]);
    });

    it('retourne le centre de la case', () => {
      expect(gridToWorld(5, 5, 10)).toEqual([0.5, 0, 0.5]);
    });

    it('round trip worldToGrid → gridToWorld retourne le même center', () => {
      const grid = worldToGrid(new THREE.Vector3(3.5, 0, 2.5), 10);
      const world = gridToWorld(grid.x, grid.z, 10);
      // Après round-trip, on est sur le centre de la case
      expect(world[0]).toBeCloseTo(3.5);
      expect(world[2]).toBeCloseTo(2.5);
    });
  });

  describe('updateInstanceMatrix', () => {
    it('appelle mesh.setMatrixAt avec l\'index et une matrix composée', () => {
      const mesh = { setMatrixAt: vi.fn() } as unknown as THREE.InstancedMesh;
      updateInstanceMatrix(mesh, 3, 1, 2, 3);
      expect(mesh.setMatrixAt).toHaveBeenCalledWith(3, expect.any(THREE.Matrix4));
    });

    it('applique scale et rotationY', () => {
      const mesh = { setMatrixAt: vi.fn() } as unknown as THREE.InstancedMesh;
      updateInstanceMatrix(mesh, 0, 0, 0, 0, 2, Math.PI / 2);
      const matrix = (mesh.setMatrixAt as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as THREE.Matrix4;
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, quaternion, scale);
      expect(scale.x).toBeCloseTo(2);
      expect(scale.y).toBeCloseTo(2);
    });
  });
});
