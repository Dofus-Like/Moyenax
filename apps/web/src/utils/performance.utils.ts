import * as THREE from 'three';

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempRotation = new THREE.Euler();
const tempScale = new THREE.Vector3(1, 1, 1);

/**
 * Updates an instance matrix for an InstancedMesh
 */
export function updateInstanceMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  scale: number = 1,
  rotationY: number = 0,
) {
  tempPosition.set(x, y, z);
  tempRotation.set(0, rotationY, 0);
  tempScale.set(scale, scale, scale);

  tempMatrix.compose(tempPosition, new THREE.Quaternion().setFromEuler(tempRotation), tempScale);
  mesh.setMatrixAt(index, tempMatrix);
}

/**
 * Calculates grid coordinates from a world position
 */
export function worldToGrid(point: THREE.Vector3, gridSize: number): { x: number; z: number } {
  const x = Math.floor(point.x + gridSize / 2);
  const z = Math.floor(point.z + gridSize / 2);
  return { x, z };
}

/**
 * Calculates world position from grid coordinates
 */
export function gridToWorld(x: number, z: number, gridSize: number): [number, number, number] {
  return [x - gridSize / 2 + 0.5, 0, z - gridSize / 2 + 0.5];
}
