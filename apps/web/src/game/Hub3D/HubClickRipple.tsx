import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactElement } from 'react';
import { DoubleSide, type Mesh, type MeshBasicMaterial, Vector3 } from 'three';

interface HubClickRippleProps {
  point: Vector3 | null;
  stamp: number;
  color?: string;
}

const RIPPLE_DURATION = 0.6;
const RIPPLE_START_RADIUS = 0.22;
const RIPPLE_END_RADIUS = 1.05;
const RIPPLE_LIFT = 0.03;
const RIPPLE_TUBE = 0.035;

function stepRipple(ring: Mesh, disc: Mesh, position: Vector3, k: number): void {
  const easedOut = 1 - (1 - k) * (1 - k);
  const radius = RIPPLE_START_RADIUS + (RIPPLE_END_RADIUS - RIPPLE_START_RADIUS) * easedOut;
  ring.scale.setScalar(radius);
  disc.scale.setScalar(radius);
  ring.position.copy(position);
  ring.position.y = position.y + RIPPLE_LIFT;
  disc.position.copy(position);
  disc.position.y = position.y + RIPPLE_LIFT - 0.002;
  ring.visible = true;
  disc.visible = true;
  (ring.material as MeshBasicMaterial).opacity = 0.85 * (1 - k);
  (disc.material as MeshBasicMaterial).opacity = 0.35 * (1 - easedOut);
}

export function HubClickRipple({ point, stamp, color = '#9ddfff' }: HubClickRippleProps): ReactElement | null {
  const ringRef = useRef<Mesh>(null);
  const discRef = useRef<Mesh>(null);
  const startRef = useRef<number | null>(null);
  const positionRef = useRef<Vector3>(new Vector3());

  useEffect(() => {
    if (!point) return;
    positionRef.current.copy(point);
    startRef.current = performance.now() / 1000;
  }, [point, stamp]);

  useFrame(() => {
    if (startRef.current === null) return;
    const ring = ringRef.current;
    const disc = discRef.current;
    if (!ring || !disc) return;
    const t = performance.now() / 1000 - startRef.current;
    if (t >= RIPPLE_DURATION) {
      ring.visible = false;
      disc.visible = false;
      startRef.current = null;
      return;
    }
    stepRipple(ring, disc, positionRef.current, t / RIPPLE_DURATION);
  });

  return (
    <>
      <mesh ref={discRef} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={3}>
        <ringGeometry args={[1 - RIPPLE_TUBE, 1, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>
    </>
  );
}
