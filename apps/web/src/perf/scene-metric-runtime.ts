import { usePerfHudStore } from './perf-hud.store';

const FLUSH_INTERVAL_MS = 1000;

interface LocalAccumulator {
  count: number;
  totalMs: number;
  maxMs: number;
  slowCount: number;
  lastMs: number;
  lastFlushAt: number;
  slowMs: number;
}

const accumulators = new Map<string, LocalAccumulator>();

function getAccumulator(id: string, slowMs: number): LocalAccumulator {
  const existing = accumulators.get(id);
  if (existing && existing.slowMs === slowMs) return existing;

  const next = {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    slowCount: 0,
    lastMs: 0,
    lastFlushAt: performance.now(),
    slowMs,
  };
  accumulators.set(id, next);
  return next;
}

export function recordSceneMetric(id: string, durationMs: number, slowMs: number): void {
  const acc = getAccumulator(id, slowMs);
  const now = performance.now();
  acc.count += 1;
  acc.totalMs += durationMs;
  acc.maxMs = Math.max(acc.maxMs, durationMs);
  acc.lastMs = durationMs;
  if (durationMs >= acc.slowMs) acc.slowCount += 1;
  if (now - acc.lastFlushAt < FLUSH_INTERVAL_MS) return;

  usePerfHudStore.getState().recordSceneMetric({
    id,
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
