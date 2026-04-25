import React, { Suspense, lazy } from 'react';

import { usePerfHudStore } from './perf-hud.store';

const SHOW_DEBUG = ['1', 'true', 'on', 'yes'].includes(
  String(import.meta.env.VITE_SHOW_DEBUG ?? '').toLowerCase().trim(),
);

const LazyPerf = SHOW_DEBUG
  ? lazy(() => import('r3f-perf').then((mod) => ({ default: mod.Perf })))
  : null;

/**
 * Drop inside any <Canvas>. Renders r3f-perf only when SHOW_DEBUG is set AND the HUD is enabled.
 * When SHOW_DEBUG is off, r3f-perf is not loaded at all.
 */
export function CanvasPerfOverlay() {
  const enabled = usePerfHudStore((s) => s.enabled);
  if (!LazyPerf || !enabled) return null;
  return (
    <Suspense fallback={null}>
      <LazyPerf position="top-left" minimal deepAnalyze matrixUpdate />
    </Suspense>
  );
}
