import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo } from 'react';
import { Raycaster, Vector2, type Camera, type Intersection, type Object3D, type Vector3 } from 'three';

import type { PoiId } from './constants';

const HUB_INPUT_DEBUG = false;
const NAV_PLANE_NAME = 'hub-navigation-plane';

interface UseHubInputControllerOptions {
  enabled: boolean;
  wasDraggingRef: React.MutableRefObject<boolean>;
  hubMeshRef: React.MutableRefObject<Object3D | null>;
  onPoiActivate: (id: PoiId) => void;
  onGroundClick: (point: Vector3) => void;
}

interface ResolvedHit {
  type: 'poi' | 'ground';
  poiId?: PoiId;
  point?: Vector3;
}

function isDescendantOf(child: Object3D, ancestor: Object3D): boolean {
  let cur: Object3D | null = child;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

function resolveFirstHit(hits: Intersection[], hub: Object3D | null): ResolvedHit | null {
  let navFallback: Vector3 | null = null;
  for (const hit of hits) {
    const poiId = hit.object.userData?.poiId as PoiId | undefined;
    if (poiId) return { type: 'poi', poiId };
    const isHub = hub !== null && isDescendantOf(hit.object, hub);
    if (isHub) return { type: 'ground', point: hit.point.clone() };
    if (hit.object.name === NAV_PLANE_NAME && !navFallback) {
      navFallback = hit.point.clone();
    }
  }
  if (navFallback) return { type: 'ground', point: navFallback };
  return null;
}

interface NdcRect { left: number; top: number; width: number; height: number; }
interface NdcPointer { clientX: number; clientY: number; }

export function computeNdcFromRect(
  pointer: NdcPointer,
  rect: NdcRect,
  out: Vector2,
): boolean {
  if (rect.width === 0 || rect.height === 0) return false;
  out.x = ((pointer.clientX - rect.left) / rect.width) * 2 - 1;
  out.y = -((pointer.clientY - rect.top) / rect.height) * 2 + 1;
  return true;
}

function computeNdc(event: PointerEvent, canvas: HTMLCanvasElement, out: Vector2): boolean {
  return computeNdcFromRect(event, canvas.getBoundingClientRect(), out);
}

interface DebugContext { event: PointerEvent; ndc: Vector2; camera: Camera; hits: Intersection[]; resolved: ResolvedHit | null; }

function logDebug(ctx: DebugContext): void {
  const summary = ctx.hits.slice(0, 5).map((h) => ({
    name: h.object.name || '(noname)',
    poiId: h.object.userData?.poiId ?? null,
    distance: h.distance.toFixed(2),
    point: h.point.toArray().map((n) => n.toFixed(2)),
  }));
  console.warn('[HubInput] click', {
    screen: { x: ctx.event.clientX, y: ctx.event.clientY },
    ndc: { x: ctx.ndc.x.toFixed(3), y: ctx.ndc.y.toFixed(3) },
    camera: ctx.camera.position.toArray().map((n) => n.toFixed(2)),
    zoom: 'zoom' in ctx.camera ? (ctx.camera as { zoom: number }).zoom : null,
    hits: summary,
    resolved: ctx.resolved,
  });
}

export function useHubInputController({ enabled, wasDraggingRef, hubMeshRef, onPoiActivate, onGroundClick }: UseHubInputControllerOptions): void {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);

  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);

  const handleClick = useCallback((event: PointerEvent): void => {
    if (event.button !== 0 || wasDraggingRef.current) return;
    if (!computeNdc(event, gl.domElement, ndc)) return;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(scene, true);
    const resolved = resolveFirstHit(hits, hubMeshRef.current);
    if (HUB_INPUT_DEBUG) logDebug({ event, ndc, camera, hits, resolved });
    if (!resolved) return;
    if (resolved.type === 'poi' && resolved.poiId) {
      onPoiActivate(resolved.poiId);
      return;
    }
    if (resolved.type === 'ground' && resolved.point) {
      onGroundClick(resolved.point);
    }
  }, [camera, gl, ndc, wasDraggingRef, hubMeshRef, onPoiActivate, onGroundClick, raycaster, scene]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;
    canvas.addEventListener('pointerup', handleClick);
    return (): void => {
      canvas.removeEventListener('pointerup', handleClick);
    };
  }, [enabled, gl, handleClick]);
}
