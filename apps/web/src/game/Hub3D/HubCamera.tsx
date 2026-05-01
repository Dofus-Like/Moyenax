import { OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import type { OrthographicCamera as OrthographicCameraImpl } from 'three';

import { useHubGround } from './HubGround';
import {
  CAMERA_IDLE_AZIMUTH_AMP,
  CAMERA_IDLE_DELAY_S,
  CAMERA_IDLE_ELEVATION_AMP,
  CAMERA_IDLE_FREQ_AZ,
  CAMERA_IDLE_FREQ_EL,
  CAMERA_LERP_RATE,
  CAMERA_ORBIT_INITIAL_AZIMUTH,
  CAMERA_ORBIT_INITIAL_ELEVATION,
  CAMERA_ORBIT_MAX_ELEVATION,
  CAMERA_ORBIT_MIN_ELEVATION,
  CAMERA_ORBIT_RADIUS,
  CAMERA_ZOOM_SENSITIVITY,
} from './constants';
import { pickCameraViewportConfig, useViewportMode } from './viewport';

interface HubCameraProps {
  wasDraggingRef: MutableRefObject<boolean>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface PivotXYZ { x: number; y: number; z: number; }
interface CameraOrbitState { pivot: PivotXYZ; azimuth: number; elevation: number; zoom: number; }

function applySphericalToCamera(camera: OrthographicCameraImpl, state: CameraOrbitState): void {
  const { pivot, azimuth, elevation, zoom } = state;
  const horizontal = Math.cos(elevation) * CAMERA_ORBIT_RADIUS;
  camera.position.x = pivot.x + Math.sin(azimuth) * horizontal;
  camera.position.z = pivot.z + Math.cos(azimuth) * horizontal;
  camera.position.y = pivot.y + Math.sin(elevation) * CAMERA_ORBIT_RADIUS;
  camera.zoom = zoom;
  camera.lookAt(pivot.x, pivot.y, pivot.z);
  camera.updateProjectionMatrix();
}

function lerpAngle(current: number, target: number, t: number): number {
  return current + (target - current) * Math.min(1, t);
}

interface OrbitListenersConfig {
  azimuthRef: MutableRefObject<number>;
  elevationRef: MutableRefObject<number>;
  zoomRef: MutableRefObject<number>;
  wasDraggingRef: MutableRefObject<boolean>;
  lastInteractionRef: MutableRefObject<number>;
  rotateSensitivity: number;
  dragThresholdPx: number;
  zoomMin: number;
  zoomMax: number;
}

interface DragState {
  rightDragging: boolean;
  prevX: number;
  prevY: number;
  leftDragDistance: number;
}

function nowS(): number { return performance.now() / 1000; }

function handleOrbitPointerDown(event: PointerEvent, state: DragState, cfg: OrbitListenersConfig): void {
  if (event.button === 2) {
    state.rightDragging = true;
    state.prevX = event.clientX;
    state.prevY = event.clientY;
    cfg.lastInteractionRef.current = nowS();
    return;
  }
  if (event.button === 0) {
    state.leftDragDistance = 0;
    cfg.wasDraggingRef.current = false;
    state.prevX = event.clientX;
    state.prevY = event.clientY;
  }
}

function applyOrbitDelta(dx: number, dy: number, cfg: OrbitListenersConfig): void {
  cfg.azimuthRef.current -= dx * cfg.rotateSensitivity;
  cfg.elevationRef.current = clamp(
    cfg.elevationRef.current - dy * cfg.rotateSensitivity,
    CAMERA_ORBIT_MIN_ELEVATION,
    CAMERA_ORBIT_MAX_ELEVATION,
  );
  cfg.lastInteractionRef.current = nowS();
}

function handleOrbitPointerMove(event: PointerEvent, state: DragState, cfg: OrbitListenersConfig): void {
  const dx = event.clientX - state.prevX;
  const dy = event.clientY - state.prevY;
  state.prevX = event.clientX;
  state.prevY = event.clientY;
  if (state.rightDragging) {
    applyOrbitDelta(dx, dy, cfg);
    return;
  }
  if (event.buttons & 1) {
    state.leftDragDistance += Math.hypot(dx, dy);
    if (state.leftDragDistance > cfg.dragThresholdPx) cfg.wasDraggingRef.current = true;
  }
}

interface OrbitRefs {
  azimuthRef: MutableRefObject<number>;
  elevationRef: MutableRefObject<number>;
  zoomRef: MutableRefObject<number>;
  smoothedAzRef: MutableRefObject<number>;
  smoothedElRef: MutableRefObject<number>;
  smoothedZoomRef: MutableRefObject<number>;
  lastInteractionRef: MutableRefObject<number>;
}

function applyIdleDrift(t: number, lastInteract: number): { az: number; el: number } {
  const sinceInteract = t - lastInteract;
  const idleFactor = clamp((sinceInteract - CAMERA_IDLE_DELAY_S) * 0.5, 0, 1);
  return {
    az: Math.sin(t * CAMERA_IDLE_FREQ_AZ) * CAMERA_IDLE_AZIMUTH_AMP * idleFactor,
    el: Math.sin(t * CAMERA_IDLE_FREQ_EL + 1.3) * CAMERA_IDLE_ELEVATION_AMP * idleFactor,
  };
}

interface StepCameraArgs {
  camera: OrthographicCameraImpl;
  pivot: PivotXYZ;
  refs: OrbitRefs;
  delta: number;
  t: number;
}

function stepCamera({ camera, pivot, refs, delta, t }: StepCameraArgs): void {
  const drift = applyIdleDrift(t, refs.lastInteractionRef.current);
  const lerp = CAMERA_LERP_RATE * delta;
  refs.smoothedAzRef.current = lerpAngle(refs.smoothedAzRef.current, refs.azimuthRef.current, lerp);
  refs.smoothedElRef.current = lerpAngle(refs.smoothedElRef.current, refs.elevationRef.current, lerp);
  refs.smoothedZoomRef.current = lerpAngle(refs.smoothedZoomRef.current, refs.zoomRef.current, lerp);
  applySphericalToCamera(camera, {
    pivot,
    azimuth: refs.smoothedAzRef.current + drift.az,
    elevation: clamp(refs.smoothedElRef.current + drift.el, CAMERA_ORBIT_MIN_ELEVATION, CAMERA_ORBIT_MAX_ELEVATION),
    zoom: refs.smoothedZoomRef.current,
  });
}

function attachOrbitListeners(cfg: OrbitListenersConfig): () => void {
  const state: DragState = { rightDragging: false, prevX: 0, prevY: 0, leftDragDistance: 0 };

  const onDown = (e: PointerEvent): void => handleOrbitPointerDown(e, state, cfg);
  const onMove = (e: PointerEvent): void => handleOrbitPointerMove(e, state, cfg);
  const onUp = (e: PointerEvent): void => { if (e.button === 2) state.rightDragging = false; };
  const onWheel = (e: WheelEvent): void => {
    cfg.zoomRef.current = clamp(
      cfg.zoomRef.current - e.deltaY * CAMERA_ZOOM_SENSITIVITY,
      cfg.zoomMin,
      cfg.zoomMax,
    );
    cfg.lastInteractionRef.current = nowS();
  };
  const onCtx = (e: MouseEvent): void => e.preventDefault();

  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('contextmenu', onCtx);
  return () => {
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('contextmenu', onCtx);
  };
}

function useOrbitRefs(initialZoom: number): OrbitRefs {
  return {
    azimuthRef: useRef(CAMERA_ORBIT_INITIAL_AZIMUTH),
    elevationRef: useRef(CAMERA_ORBIT_INITIAL_ELEVATION),
    zoomRef: useRef(initialZoom),
    lastInteractionRef: useRef(0),
    smoothedAzRef: useRef(CAMERA_ORBIT_INITIAL_AZIMUTH),
    smoothedElRef: useRef(CAMERA_ORBIT_INITIAL_ELEVATION),
    smoothedZoomRef: useRef(initialZoom),
  };
}

function useReclampZoomOnViewportChange(zoomRef: MutableRefObject<number>, config: CameraViewportConfig): void {
  useEffect(() => {
    zoomRef.current = clamp(zoomRef.current, config.zoomMin, config.zoomMax);
    if (zoomRef.current === config.zoomMin || zoomRef.current === config.zoomMax) {
      zoomRef.current = config.zoom;
    }
  }, [zoomRef, config.zoom, config.zoomMin, config.zoomMax]);
}

export function HubCamera({ wasDraggingRef }: HubCameraProps): ReactElement {
  const camera = useThree((state) => state.camera) as OrthographicCameraImpl;
  const { pivotRef } = useHubGround();
  const viewportMode = useViewportMode();
  const viewportConfig = pickCameraViewportConfig(viewportMode);
  const refs = useOrbitRefs(viewportConfig.zoom);

  useReclampZoomOnViewportChange(refs.zoomRef, viewportConfig);

  useEffect(() => attachOrbitListeners({
    azimuthRef: refs.azimuthRef,
    elevationRef: refs.elevationRef,
    zoomRef: refs.zoomRef,
    wasDraggingRef,
    lastInteractionRef: refs.lastInteractionRef,
    rotateSensitivity: viewportConfig.rotateSensitivity,
    dragThresholdPx: viewportConfig.dragThresholdPx,
    zoomMin: viewportConfig.zoomMin,
    zoomMax: viewportConfig.zoomMax,
  }), [refs, wasDraggingRef, viewportConfig.rotateSensitivity, viewportConfig.dragThresholdPx, viewportConfig.zoomMin, viewportConfig.zoomMax]);

  useFrame((state, delta) => {
    if (!camera) return;
    stepCamera({ camera, pivot: pivotRef.current, refs, delta, t: state.clock.getElapsedTime() });
  });

  return (
    <OrthographicCamera
      makeDefault
      position={[
        Math.sin(CAMERA_ORBIT_INITIAL_AZIMUTH) * Math.cos(CAMERA_ORBIT_INITIAL_ELEVATION) * CAMERA_ORBIT_RADIUS,
        Math.sin(CAMERA_ORBIT_INITIAL_ELEVATION) * CAMERA_ORBIT_RADIUS,
        Math.cos(CAMERA_ORBIT_INITIAL_AZIMUTH) * Math.cos(CAMERA_ORBIT_INITIAL_ELEVATION) * CAMERA_ORBIT_RADIUS,
      ]}
      zoom={viewportConfig.zoom}
      near={0.1}
      far={300}
    />
  );
}
