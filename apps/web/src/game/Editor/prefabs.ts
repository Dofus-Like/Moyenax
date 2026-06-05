import type { PlacedProp, Vec3 } from '@game/shared-types';

export type PropInit = Omit<PlacedProp, 'id'>;

export interface PrefabPart {
  modelKey: string;
  /** Position relative au centre du prefab. */
  position: Vec3;
  rotation: Vec3;
  scale: number;
  collides: boolean;
}

export interface Prefab {
  id: string;
  name: string;
  parts: PrefabPart[];
}

function centroidXZ(props: PlacedProp[]): [number, number] {
  const sum = props.reduce((acc, p) => [acc[0] + p.position[0], acc[1] + p.position[2]], [0, 0]);
  return [sum[0] / props.length, sum[1] / props.length];
}

/** Construit un prefab depuis des props, positions rendues relatives au centre (XZ). */
export function buildPrefab(id: string, name: string, props: PlacedProp[]): Prefab {
  const [cx, cz] = centroidXZ(props);
  const parts: PrefabPart[] = props.map((p) => ({
    modelKey: p.modelKey,
    position: [p.position[0] - cx, p.position[1], p.position[2] - cz],
    rotation: [...p.rotation] as Vec3,
    scale: p.scale,
    collides: p.collides,
  }));
  return { id, name, parts };
}

/** Instancie un prefab à un point monde → props (sans id) à ajouter. */
export function instantiateParts(prefab: Prefab, at: Vec3): PropInit[] {
  return prefab.parts.map((part) => ({
    modelKey: part.modelKey,
    position: [at[0] + part.position[0], part.position[1], at[2] + part.position[2]],
    rotation: [...part.rotation] as Vec3,
    scale: part.scale,
    collides: part.collides,
  }));
}
