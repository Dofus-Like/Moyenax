import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';

import { usePerfHudStore } from './perf-hud.store';

const SHOW_DEBUG = import.meta.env.VITE_SHOW_DEBUG === '1';

const FLUSH_INTERVAL_MS = 1000;

interface LocalAccumulator {
  id: string;
  count: number;
  totalMs: number;
  maxMs: number;
  slowCount: number;
  lastMs: number;
  lastFlushAt: number;
  slowMs: number;
}

function createAccumulator(id: string, slowMs: number): LocalAccumulator {
  return {
    id,
    count: 0,
    totalMs: 0,
    maxMs: 0,
    slowCount: 0,
    lastMs: 0,
    lastFlushAt: performance.now(),
    slowMs,
  };
}

function flushAccumulator(acc: LocalAccumulator, now: number): void {
  if (acc.count === 0) return;
  usePerfHudStore.getState().recordSceneMetric({
    id: acc.id,
    count: acc.count,
    totalMs: acc.totalMs,
    maxMs: acc.maxMs,
    slowCount: acc.slowCount,
    lastMs: acc.lastMs,
    lastAt: Date.now(),
  });
  acc.count = 0;
  acc.totalMs = 0;
  acc.maxMs = 0;
  acc.slowCount = 0;
  acc.lastFlushAt = now;
}

export function isScenePerfEnabled(): boolean {
  return SHOW_DEBUG;
}

export function useScenePerfAccumulator(id: string, slowMs = 4): (durationMs: number) => void {
  const ref = useRef<LocalAccumulator | null>(null);
  if (!ref.current || ref.current.id !== id || ref.current.slowMs !== slowMs) {
    ref.current = createAccumulator(id, slowMs);
  }

  return useCallback((durationMs: number): void => {
    if (!SHOW_DEBUG) return;
    const acc = ref.current;
    if (!acc) return;
    const now = performance.now();
    acc.count += 1;
    acc.totalMs += durationMs;
    acc.maxMs = Math.max(acc.maxMs, durationMs);
    acc.lastMs = durationMs;
    if (durationMs >= acc.slowMs) acc.slowCount += 1;
    if (now - acc.lastFlushAt >= FLUSH_INTERVAL_MS) {
      flushAccumulator(acc, now);
    }
  }, []);
}

export function ScenePerfProbe({ id }: { id: string }): null {
  const gl = useThree((state) => state.gl);
  const lastFrameAtRef = useRef<number | null>(null);
  const lastGpuAtRef = useRef(0);
  const recordFrameGap = useScenePerfAccumulator(`${id}:r3f-frame-gap`, 33);

  useEffect(() => {
    if (!SHOW_DEBUG || !gl.info) return undefined;
    const previousAutoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = previousAutoReset;
      gl.info.reset();
    };
  }, [gl]);

  useFrame(() => {
    if (!SHOW_DEBUG || !gl.info) return;
    const now = performance.now();
    const lastFrameAt = lastFrameAtRef.current;
    lastFrameAtRef.current = now;
    if (lastFrameAt !== null) recordFrameGap(now - lastFrameAt);

    if (now - lastGpuAtRef.current < FLUSH_INTERVAL_MS) return;
    lastGpuAtRef.current = now;
    usePerfHudStore.getState().setSceneGpu({
      id,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      lines: gl.info.render.lines,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
      at: Date.now(),
    });
    gl.info.reset();
  });

  return null;
}
