import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import type { Mesh } from 'three';

import { useHubGround } from './HubGround';
import { NAVIGATION_PLANE_SIZE } from './constants';

export function HubGroundCollider(): ReactElement {
  const meshRef = useRef<Mesh>(null);
  const { registerCollider, visualSnapY } = useHubGround();

  // Position the flat navigation plane at the actual visual ground level.
  // Called once when the hub mesh is ready; reuses the lightweight visual raycast.
  const colliderY = useMemo(() => visualSnapY(0, 0), [visualSnapY]);

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
      position={[0, colliderY, 0]}
    >
      <planeGeometry args={[NAVIGATION_PLANE_SIZE, NAVIGATION_PLANE_SIZE]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  );
}
