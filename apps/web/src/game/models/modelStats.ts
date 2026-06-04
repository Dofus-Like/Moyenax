import * as THREE from 'three';

export interface ModelStats {
  meshes: number;
  vertices: number;
  triangles: number;
  materials: number;
  textures: number;
  animations: number;
  size: { x: number; y: number; z: number };
}

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'alphaMap',
] as const;

function collectTextures(material: THREE.Material, into: Set<THREE.Texture>): void {
  const rec = material as unknown as Record<string, THREE.Texture | undefined>;
  for (const key of TEXTURE_KEYS) {
    const tex = rec[key];
    if (tex?.isTexture) into.add(tex);
  }
}

/** Statistiques d'un modèle 3D (meshes, géométrie, matériaux, dimensions). */
export function computeModelStats(root: THREE.Object3D, animations: number): ModelStats {
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    meshes += 1;
    const pos = mesh.geometry.getAttribute('position');
    if (pos) vertices += pos.count;
    const index = mesh.geometry.getIndex();
    if (index) triangles += index.count / 3;
    else if (pos) triangles += pos.count / 3;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      if (!mat) continue;
      materials.add(mat);
      collectTextures(mat, textures);
    }
  });

  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(root).getSize(size);
  return {
    meshes,
    vertices,
    triangles: Math.round(triangles),
    materials: materials.size,
    textures: textures.size,
    animations,
    size: { x: size.x, y: size.y, z: size.z },
  };
}

/** Octets → unité lisible (o / Ko / Mo / Go). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
