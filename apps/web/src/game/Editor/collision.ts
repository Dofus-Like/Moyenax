import { Box3, type Mesh, type Object3D, Vector3 } from 'three';

import type { PlacedProp, Vec3 } from '@game/shared-types';

import type { ObjectsRef } from './PlacedProps';

export interface Obstacle {
  box: Box3;
  /** L'objet déplacé chevauchait-il déjà cet obstacle au début du drag ? */
  overlappingAtStart: boolean;
}

/**
 * Boîte englobante monde des seuls meshes du modèle — exclut les helpers d'éditeur
 * (anneau de sélection, wireframe de collision) marqués `userData.editorHelper`,
 * qui sinon gonfleraient la collision.
 */
export function worldModelBox(root: Object3D): Box3 {
  const box = new Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || mesh.userData['editorHelper']) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) {
      box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    }
  });
  return box;
}

/** Boîtes monde des autres props bloquantes, avec l'état de chevauchement initial. */
export function collectObstacles(
  selfId: string,
  selfBox: Box3,
  objects: ObjectsRef,
  props: PlacedProp[],
): Obstacle[] {
  const obstacles: Obstacle[] = [];
  for (const prop of props) {
    if (prop.id === selfId || !prop.collides) continue;
    const obj = objects.current.get(prop.id);
    if (!obj) continue;
    const box = worldModelBox(obj);
    obstacles.push({ box, overlappingAtStart: box.intersectsBox(selfBox) });
  }
  return obstacles;
}

/**
 * Vrai si la boîte en mouvement entre en collision *nouvelle* avec un obstacle.
 * Les chevauchements présents dès le départ sont ignorés pour pouvoir séparer
 * deux objets déjà imbriqués.
 */
export function hasNewCollision(movingBox: Box3, obstacles: Obstacle[]): boolean {
  return obstacles.some((o) => !o.overlappingAtStart && o.box.intersectsBox(movingBox));
}

function collidableBoxes(objects: ObjectsRef, props: PlacedProp[]): Box3[] {
  const boxes: Box3[] = [];
  for (const prop of props) {
    if (!prop.collides) continue;
    const obj = objects.current.get(prop.id);
    if (obj) boxes.push(worldModelBox(obj));
  }
  return boxes;
}

function isBlocked(point: Vec3, boxes: Box3[], half: number): boolean {
  const probe = new Box3(
    new Vector3(point[0] - half, -1000, point[2] - half),
    new Vector3(point[0] + half, 1000, point[2] + half),
  );
  return boxes.some((b) => b.intersectsBox(probe));
}

function ringOffsets(radius: number): [number, number][] {
  const offsets: [number, number][] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) === radius) offsets.push([dx, dz]);
    }
  }
  return offsets;
}

/** Pure: nudge a point outward (1-unit rings) to the nearest spot clear of `boxes`. */
export function freePositionAmong(point: Vec3, boxes: Box3[]): Vec3 {
  if (!isBlocked(point, boxes, 0.4)) return point;
  for (let radius = 1; radius <= 12; radius++) {
    for (const [dx, dz] of ringOffsets(radius)) {
      const candidate: Vec3 = [point[0] + dx, point[1], point[2] + dz];
      if (!isBlocked(candidate, boxes, 0.4)) return candidate;
    }
  }
  return point;
}

/** Nudge a drop point outward to the nearest cell free of collidable props. */
export function findFreePosition(point: Vec3, objects: ObjectsRef, props: PlacedProp[]): Vec3 {
  return freePositionAmong(point, collidableBoxes(objects, props));
}
