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

export interface HubGroundContextValue {
  snapY: (x: number, z: number) => number;
  pivotRef: MutableRefObject<Vector3>;
  hubMeshRef: MutableRefObject<Object3D | null>;
  registerHub: (object: Object3D | null) => void;
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
  const raycaster = useMemo(() => new Raycaster(), []);
  const pivotRef = useRef<Vector3>(new Vector3().copy(FALLBACK_PIVOT));
  const originRef = useRef<Vector3>(new Vector3());
  const [ready, setReady] = useState(false);

  const snapY = useCallback((x: number, z: number): number => {
    const hub = hubRef.current;
    if (!hub || !ready) return FALLBACK_GROUND_Y;
    originRef.current.set(x, RAYCAST_FROM_Y, z);
    raycaster.set(originRef.current, RAYCAST_DIRECTION);
    const hits = raycaster.intersectObject(hub, true);
    if (hits.length === 0) return FALLBACK_GROUND_Y;
    return hits[0].point.y;
  }, [raycaster, ready]);

  const registerHub = useCallback((object: Object3D | null): void => {
    hubRef.current = object;
    if (object) {
      computePivot(pivotRef.current, object);
      setReady(true);
    } else {
      pivotRef.current.copy(FALLBACK_PIVOT);
      setReady(false);
    }
  }, []);

  const value = useMemo<HubGroundContextValue>(() => ({
    snapY,
    pivotRef,
    hubMeshRef: hubRef,
    registerHub,
    ready,
  }), [snapY, registerHub, ready]);

  return <HubGroundContext.Provider value={value}>{children}</HubGroundContext.Provider>;
}

export function useHubGround(): HubGroundContextValue {
  const ctx = useContext(HubGroundContext);
  if (!ctx) {
    throw new Error('useHubGround must be used within HubGroundProvider');
  }
  return ctx;
}
