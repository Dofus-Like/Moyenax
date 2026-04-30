import { useEffect, useRef, type ReactElement } from 'react';
import type { Mesh } from 'three';

import { useHubGround } from './HubGround';
import { NAVIGATION_PLANE_SIZE } from './constants';

/**
 * Invisible flat plane used exclusively as the snapY raycast target.
 * 2 triangles vs 635K on the visual mesh → near-zero raycast cost per frame.
 * colorWrite/depthWrite=false: renders nothing, but remains raycastable.
 */
export function HubGroundCollider(): ReactElement {
  const meshRef = useRef<Mesh>(null);
  const { registerCollider } = useHubGround();

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    registerCollider(mesh);
    return (): void => registerCollider(null);
  }, [registerCollider]);

  return (
    <mesh
      ref={meshRef}
      name="hub-ground-collider"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <planeGeometry args={[NAVIGATION_PLANE_SIZE, NAVIGATION_PLANE_SIZE]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  );
}
