import type {
  BackendSnapshot,
  FpsSample,
  LongTaskSample,
  NetworkSample,
  RenderAggregate,
  WebVitals,
} from './perf-hud.store';
import { usePerfHudStore } from './perf-hud.store';

const STORAGE_KEY = 'perf-hud:snapshots';
const MAX_SNAPSHOTS = 20;

export interface SavedSnapshot {
  id: string;
  label: string;
  createdAt: string;
  url: string;
  fps: FpsSample;
  fpsAvg: number;
  fpsMin: number;
  fpsMax: number;
  vitals: WebVitals;
  longTasks: LongTaskSample[];
  renders: Record<string, RenderAggregate>;
  requests: NetworkSample[];
  backend: BackendSnapshot | null;
}

function read(): SavedSnapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: SavedSnapshot[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SNAPSHOTS)));
  } catch {
    // quota exceeded or unavailable — silently drop
  }
}

export function listSnapshots(): SavedSnapshot[] {
  return read();
}

export function saveCurrentSnapshot(label: string): SavedSnapshot {
  const state = usePerfHudStore.getState();
  const history = state.fpsHistory;
  const fpsAvg = history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
  const fpsMin = history.length ? Math.min(...history) : 0;
  const fpsMax = history.length ? Math.max(...history) : 0;

  const snapshot: SavedSnapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: label.trim() || `snapshot ${new Date().toLocaleTimeString()}`,
    createdAt: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    fps: state.fps,
    fpsAvg,
    fpsMin,
    fpsMax,
    vitals: state.vitals,
    longTasks: state.longTasks,
    renders: state.renders,
    requests: state.requests,
    backend: state.backend,
  };

  const next = [snapshot, ...read()];
  write(next);
  return snapshot;
}

export function deleteSnapshot(id: string): void {
  write(read().filter((s) => s.id !== id));
}

export function clearSnapshots(): void {
  write([]);
}

export interface DiffRow {
  label: string;
  before: number | string;
  after: number | string;
  delta?: number;
  deltaPct?: number;
  betterIsLower?: boolean;
}

function safeDelta(before: number | undefined, after: number | undefined): { delta?: number; deltaPct?: number } {
  if (before === undefined || after === undefined) return {};
  const delta = after - before;
  const deltaPct = before !== 0 ? (delta / before) * 100 : undefined;
  return { delta, deltaPct };
}

export function buildDiff(before: SavedSnapshot, after: SavedSnapshot): DiffRow[] {
  const rows: DiffRow[] = [];

  rows.push({
    label: 'FPS avg',
    before: before.fpsAvg,
    after: after.fpsAvg,
    ...safeDelta(before.fpsAvg, after.fpsAvg),
  });
  rows.push({
    label: 'FPS min',
    before: before.fpsMin,
    after: after.fpsMin,
    ...safeDelta(before.fpsMin, after.fpsMin),
  });

  const vitalKeys: Array<keyof WebVitals> = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'];
  for (const key of vitalKeys) {
    const b = before.vitals[key];
    const a = after.vitals[key];
    if (b === undefined && a === undefined) continue;
    rows.push({
      label: `Vitals ${key}`,
      before: b ?? '–',
      after: a ?? '–',
      ...safeDelta(b, a),
      betterIsLower: true,
    });
  }

  if (before.backend && after.backend) {
    rows.push({
      label: 'Event loop p95',
      before: before.backend.runtime.eventLoopLagP95Ms,
      after: after.backend.runtime.eventLoopLagP95Ms,
      ...safeDelta(before.backend.runtime.eventLoopLagP95Ms, after.backend.runtime.eventLoopLagP95Ms),
      betterIsLower: true,
    });
    rows.push({
      label: 'RSS MB',
      before: before.backend.runtime.rssMb,
      after: after.backend.runtime.rssMb,
      ...safeDelta(before.backend.runtime.rssMb, after.backend.runtime.rssMb),
      betterIsLower: true,
    });
    rows.push({
      label: 'Heap MB',
      before: before.backend.runtime.heapUsedMb,
      after: after.backend.runtime.heapUsedMb,
      ...safeDelta(before.backend.runtime.heapUsedMb, after.backend.runtime.heapUsedMb),
      betterIsLower: true,
    });
  }

  rows.push({
    label: 'Long tasks count',
    before: before.longTasks.length,
    after: after.longTasks.length,
    ...safeDelta(before.longTasks.length, after.longTasks.length),
    betterIsLower: true,
  });

  const topBeforeRender = topTotalMs(before.renders);
  const topAfterRender = topTotalMs(after.renders);
  rows.push({
    label: `Render hot spot (${topBeforeRender.id || '–'} → ${topAfterRender.id || '–'})`,
    before: topBeforeRender.totalMs,
    after: topAfterRender.totalMs,
    ...safeDelta(topBeforeRender.totalMs, topAfterRender.totalMs),
    betterIsLower: true,
  });

  return rows;
}

function topTotalMs(agg: Record<string, RenderAggregate>): { id: string; totalMs: number } {
  let best: RenderAggregate | null = null;
  for (const r of Object.values(agg)) {
    if (!best || r.totalMs > best.totalMs) best = r;
  }
  return best ? { id: best.id, totalMs: Number(best.totalMs.toFixed(1)) } : { id: '', totalMs: 0 };
}
