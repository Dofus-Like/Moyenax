import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Box3, Raycaster, Vector3, type Object3D } from 'three';

import { PLAYER_GROUND_Y } from './constants';

const RAYCAST_FROM_Y = 200;
const RAYCAST_DIRECTION = new Vector3(0, -1, 0);

function groundRaycast(object: Object3D, raycaster: Raycaster, origin: Vector3, x: number, z: number): number | null {
  origin.set(x, RAYCAST_FROM_Y, z);
  raycaster.set(origin, RAYCAST_DIRECTION);
  const hits = raycaster.intersectObject(object, true);
  return hits.length > 0 ? hits[0].point.y : null;
}

// Dev-only perf tracker — logs snapY timing every 10 s of activity.
const DEV = import.meta.env.DEV;
interface SnapPerfWindow { calls: number; totalMs: number; maxMs: number; startMs: number }
const snapPerf: SnapPerfWindow = { calls: 0, totalMs: 0, maxMs: 0, startMs: 0 };
function recordSnapPerf(t0: number): void {
  const dt = performance.now() - t0;
  if (snapPerf.calls === 0) snapPerf.startMs = performance.now();
  snapPerf.calls++;
  snapPerf.totalMs += dt;
  if (dt > snapPerf.maxMs) snapPerf.maxMs = dt;
  const elapsed = performance.now() - snapPerf.startMs;
  if (elapsed >= 10_000) {
    const s = elapsed / 1000;
    // eslint-disable-next-line no-console
    console.log(
      `[snapY] ${snapPerf.calls} calls in ${s.toFixed(1)}s`,
      `| ${(snapPerf.calls / s).toFixed(0)}/s`,
      `| avg ${(snapPerf.totalMs / snapPerf.calls).toFixed(3)}ms`,
      `| max ${snapPerf.maxMs.toFixed(3)}ms`,
    );
    snapPerf.calls = 0; snapPerf.totalMs = 0; snapPerf.maxMs = 0; snapPerf.startMs = 0;
  }
}

export interface HubGroundContextValue {
  snapY: (x: number, z: number) => number;
  visualSnapY: (x: number, z: number) => number;
  pivotRef: MutableRefObject<Vector3>;
  hubMeshRef: MutableRefObject<Object3D | null>;
  registerHub: (object: Object3D | null) => void;
  registerCollider: (object: Object3D | null) => void;
  ready: boolean;
}

const FALLBACK_PIVOT = new Vector3(0, 0, 0);
const FALLBACK_GROUND_Y = PLAYER_GROUND_Y;

const HubGroundContext = createContext<HubGroundContextValue | null>(null);

function computePivot(target: Vector3, hub: Object3D): void {
  const box = new Box3().setFromObject(hub);
  target.set(
    (box.min.x + box.max.x) * 0.5,
    box.max.y,
    (box.min.z + box.max.z) * 0.5,
  );
}

interface HubGroundProviderProps {
  children: ReactNode;
}

export function HubGroundProvider({ children }: HubGroundProviderProps): ReactElement {
  const hubRef = useRef<Object3D | null>(null);
  const colliderRef = useRef<Object3D | null>(null);
  const raycaster = useMemo(() => new Raycaster(), []);
  const pivotRef = useRef<Vector3>(new Vector3().copy(FALLBACK_PIVOT));
  const originRef = useRef<Vector3>(new Vector3());
  const groundSurfaceYRef = useRef(FALLBACK_GROUND_Y);
  const [ready, setReady] = useState(false);

  const snapY = useCallback((x: number, z: number): number => {
    // Flat collider preferred (few triangles); falls back to visual mesh if collider not yet registered.
    const target = colliderRef.current ?? hubRef.current;
    if (!target || !ready) return FALLBACK_GROUND_Y;
    const t0 = DEV ? performance.now() : 0;
    const y = groundRaycast(target, raycaster, originRef.current, x, z);
    if (DEV) recordSnapPerf(t0);
    return y ?? FALLBACK_GROUND_Y;
  }, [raycaster, ready]);

  const visualSnapY = useCallback((x: number, z: number): number => {
    const hub = hubRef.current;
    if (!hub || !ready) return groundSurfaceYRef.current;
    return groundRaycast(hub, raycaster, originRef.current, x, z) ?? groundSurfaceYRef.current;
  }, [raycaster, ready]);

  const registerHub = useCallback((object: Object3D | null): void => {
    hubRef.current = object;
    if (object) {
      computePivot(pivotRef.current, object);
      groundSurfaceYRef.current = groundRaycast(object, raycaster, originRef.current, 0, 0) ?? FALLBACK_GROUND_Y;
    } else {
      pivotRef.current.copy(FALLBACK_PIVOT);
      groundSurfaceYRef.current = FALLBACK_GROUND_Y;
    }
    setReady(!!object);
  }, [raycaster]);

  const registerCollider = useCallback((o: Object3D | null): void => { colliderRef.current = o; }, []);

  const value = useMemo<HubGroundContextValue>(() => ({
    snapY,
    visualSnapY,
    pivotRef,
    hubMeshRef: hubRef,
    registerHub,
    registerCollider,
    ready,
  }), [snapY, visualSnapY, registerHub, registerCollider, ready]);

  return <HubGroundContext.Provider value={value}>{children}</HubGroundContext.Provider>;
}

export function useHubGround(): HubGroundContextValue {
  const ctx = useContext(HubGroundContext);
  if (!ctx) {
    throw new Error('useHubGround must be used within HubGroundProvider');
  }
  return ctx;
}
