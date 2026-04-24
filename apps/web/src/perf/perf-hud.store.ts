import { create } from 'zustand';

export interface NetworkSample {
  id: number;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  serverMs?: number;
  sizeBytes?: number;
  error?: boolean;
  at: number;
  requestId?: string;
}

export interface LongTaskSample {
  id: number;
  startTime: number;
  duration: number;
  name: string;
  attribution?: string;
  at: number;
}

export interface RenderAggregate {
  id: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  lastPhase: 'mount' | 'update' | 'nested-update';
  lastAt: number;
}

export interface SseEventSample {
  id: number;
  source: string;
  type: string;
  sizeBytes: number;
  at: number;
  data?: string;
}

export interface WebVitals {
  LCP?: number;
  INP?: number;
  CLS?: number;
  TTFB?: number;
  FCP?: number;
}

export interface FpsSample {
  fps: number;
  ms: number;
  at: number;
}

export interface BackendRouteStat {
  key: string;
  method: string;
  path: string;
  count: number;
  errorCount: number;
  avgMs: number;
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
  lastMs: number;
}

export interface BackendPrismaStat {
  key: string;
  model: string;
  action: string;
  count: number;
  avgMs: number;
  p95: number;
  maxMs: number;
  lastMs: number;
}

export interface BackendRawQuery {
  id: string;
  sql: string;
  lastParams: unknown[];
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  p95: number;
  lastAt: number;
}

export interface BackendGameMetric {
  key: string;
  scope: string;
  name: string;
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  p95: number;
}

export interface BackendRedisStat {
  key: string;
  command: string;
  prefix: string;
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  p95: number;
  hits: number;
  misses: number;
  hitRate: number | null;
}

export interface BackendGcStats {
  count: number;
  totalPauseMs: number;
  maxPauseMs: number;
  lastPauseMs: number;
  byKind: Record<string, { count: number; totalPauseMs: number }>;
}

export interface BackendSnapshot {
  ts: string;
  runtime: {
    eventLoopLagP95Ms: number;
    eventLoopLagMeanMs: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    heapLimitMb: number;
    heapHistory: Array<{ at: number; usedMb: number }>;
    gc: BackendGcStats;
    activeSseStreams: number;
    activeSseSubscribers: number;
    totalSseEvents: number;
    nodeVersion: string;
    uptimeSec: number;
  };
  totals: { totalRequests: number; totalErrors: number; uptimeMs: number };
  routes: BackendRouteStat[];
  prisma: BackendPrismaStat[];
  rawQueries: BackendRawQuery[];
  gameMetrics: BackendGameMetric[];
  redis: BackendRedisStat[];
  recent: Array<{
    method: string;
    path: string;
    statusCode?: number;
    durationMs: number;
    slow: boolean;
    at: number;
  }>;
}

export interface MemorySample {
  usedMb: number;
  totalMb: number;
  limitMb: number;
  at: number;
}

interface PerfHudState {
  enabled: boolean;
  minimized: boolean;
  fps: FpsSample;
  fpsHistory: number[];
  vitals: WebVitals;
  requests: NetworkSample[];
  longTasks: LongTaskSample[];
  renders: Record<string, RenderAggregate>;
  sseEvents: SseEventSample[];
  sseByType: Record<string, { count: number; totalBytes: number; lastAt: number }>;
  memory: MemorySample | null;
  memoryHistory: number[];
  backend: BackendSnapshot | null;
  backendError: string | null;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
  setMinimized: (value: boolean) => void;
  pushRequest: (sample: NetworkSample) => void;
  clearRequests: () => void;
  pushLongTask: (sample: LongTaskSample) => void;
  clearLongTasks: () => void;
  recordRender: (id: string, phase: 'mount' | 'update' | 'nested-update', durationMs: number) => void;
  clearRenders: () => void;
  pushSseEvent: (sample: SseEventSample) => void;
  clearSseEvents: () => void;
  setVital: (key: keyof WebVitals, value: number) => void;
  setFps: (fps: number, ms: number) => void;
  setMemory: (sample: MemorySample) => void;
  setBackend: (snapshot: BackendSnapshot | null, error?: string | null) => void;
}

const MAX_REQUESTS = 50;
const MAX_LONG_TASKS = 30;
const MAX_SSE_EVENTS = 60;
const MAX_FPS_HISTORY = 120;

export const usePerfHudStore = create<PerfHudState>((set) => ({
  enabled: false,
  minimized: false,
  fps: { fps: 0, ms: 0, at: 0 },
  fpsHistory: [],
  vitals: {},
  requests: [],
  longTasks: [],
  renders: {},
  sseEvents: [],
  sseByType: {},
  memory: null,
  memoryHistory: [],
  backend: null,
  backendError: null,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setEnabled: (value) => set({ enabled: value }),
  setMinimized: (value) => set({ minimized: value }),
  pushRequest: (sample) =>
    set((state) => {
      const next = [sample, ...state.requests];
      if (next.length > MAX_REQUESTS) next.length = MAX_REQUESTS;
      return { requests: next };
    }),
  clearRequests: () => set({ requests: [] }),
  pushLongTask: (sample) =>
    set((state) => {
      const next = [sample, ...state.longTasks];
      if (next.length > MAX_LONG_TASKS) next.length = MAX_LONG_TASKS;
      return { longTasks: next };
    }),
  clearLongTasks: () => set({ longTasks: [] }),
  recordRender: (id, phase, durationMs) =>
    set((state) => {
      const prev = state.renders[id];
      const updated: RenderAggregate = prev
        ? {
            ...prev,
            count: prev.count + 1,
            totalMs: prev.totalMs + durationMs,
            maxMs: Math.max(prev.maxMs, durationMs),
            lastMs: durationMs,
            lastPhase: phase,
            lastAt: Date.now(),
          }
        : { id, count: 1, totalMs: durationMs, maxMs: durationMs, lastMs: durationMs, lastPhase: phase, lastAt: Date.now() };
      return { renders: { ...state.renders, [id]: updated } };
    }),
  clearRenders: () => set({ renders: {} }),
  pushSseEvent: (sample) =>
    set((state) => {
      const next = [sample, ...state.sseEvents];
      if (next.length > MAX_SSE_EVENTS) next.length = MAX_SSE_EVENTS;
      const prev = state.sseByType[sample.type] ?? { count: 0, totalBytes: 0, lastAt: 0 };
      return {
        sseEvents: next,
        sseByType: {
          ...state.sseByType,
          [sample.type]: {
            count: prev.count + 1,
            totalBytes: prev.totalBytes + sample.sizeBytes,
            lastAt: sample.at,
          },
        },
      };
    }),
  clearSseEvents: () => set({ sseEvents: [], sseByType: {} }),
  setVital: (key, value) =>
    set((state) => ({ vitals: { ...state.vitals, [key]: value } })),
  setFps: (fps, ms) =>
    set((state) => {
      const history = [...state.fpsHistory, fps];
      if (history.length > MAX_FPS_HISTORY) history.shift();
      return { fps: { fps, ms, at: Date.now() }, fpsHistory: history };
    }),
  setMemory: (sample) =>
    set((state) => {
      const history = [...state.memoryHistory, sample.usedMb];
      if (history.length > MAX_FPS_HISTORY) history.shift();
      return { memory: sample, memoryHistory: history };
    }),
  setBackend: (snapshot, error = null) => set({ backend: snapshot, backendError: error }),
}));

let requestIdSeed = 0;
export function nextRequestId(): number {
  requestIdSeed += 1;
  return requestIdSeed;
}
