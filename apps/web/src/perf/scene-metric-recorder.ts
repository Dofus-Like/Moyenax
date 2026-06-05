const SHOW_DEBUG = import.meta.env.VITE_SHOW_DEBUG === '1';

type SceneMetricRuntime = typeof import('./scene-metric-runtime');

let runtime: SceneMetricRuntime | null = null;

if (SHOW_DEBUG) {
  void import('./scene-metric-runtime').then((mod) => {
    runtime = mod;
  });
}

const noopRecord = (_durationMs: number): void => undefined;

export function isSceneDebugEnabled(): boolean {
  return SHOW_DEBUG;
}

export function createSceneMetricRecorder(id: string, slowMs = 4): (durationMs: number) => void {
  if (!SHOW_DEBUG) return noopRecord;
  return (durationMs: number): void => {
    runtime?.recordSceneMetric(id, durationMs, slowMs);
  };
}
