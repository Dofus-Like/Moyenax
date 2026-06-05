import { useGLTF } from '@react-three/drei';
import { type ThreeEvent } from '@react-three/fiber';
import { type ReactElement, useMemo } from 'react';
import { Box3, type Object3D, Vector3 } from 'three';

import type { Vec3 } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';
import { modelUrl } from '../models/modelRegistry';

interface PropModelProps {
  modelKey: string;
  selected: boolean;
  collides: boolean;
  onSelect: (event: ThreeEvent<MouseEvent>) => void;
}

interface ClonedModel {
  scene: Object3D;
  boxSize: Vec3;
  boxCenter: Vec3;
}

export function PropModel({
  modelKey,
  selected,
  collides,
  onSelect,
}: PropModelProps): ReactElement {
  const gltf = useGLTF(modelUrl(modelKey));
  const showColliders = useEditorStore((s) => s.showColliders);

  const { scene, boxSize, boxCenter } = useMemo<ClonedModel>(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((node) => {
      node.castShadow = true;
      node.receiveShadow = true;
    });
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    return { scene: clone, boxSize: size.toArray(), boxCenter: center.toArray() };
  }, [gltf.scene]);

  return (
    <group onPointerDown={onSelect}>
      <primitive object={scene} />
      {selected && <SelectionRing />}
      {showColliders && <ColliderBox size={boxSize} center={boxCenter} collides={collides} />}
    </group>
  );
}

function ColliderBox({
  size,
  center,
  collides,
}: {
  size: Vec3;
  center: Vec3;
  collides: boolean;
}): ReactElement {
  return (
    <mesh position={center} userData={{ editorHelper: true }}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        wireframe
        transparent
        opacity={collides ? 0.6 : 0.25}
        color={collides ? '#22c55e' : '#ef4444'}
      />
    </mesh>
  );
}

function SelectionRing(): ReactElement {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} userData={{ editorHelper: true }}>
      <ringGeometry args={[0.9, 1.1, 48]} />
      <meshBasicMaterial color="#60a5fa" transparent opacity={0.9} depthTest={false} />
    </mesh>
  );
}
