import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { nextRequestId, usePerfHudStore } from './perf-hud.store';

type PerfConfig = InternalAxiosRequestConfig & { _perfStart?: number; _perfId?: number };

function parseServerTiming(header: string | undefined | null): number | undefined {
  if (!header) return undefined;
  const appEntry = header
    .split(',')
    .map((s) => s.trim())
    .find((entry) => entry.startsWith('app'));
  if (!appEntry) return undefined;
  const match = appEntry.match(/dur=([\d.]+)/);
  return match ? Number.parseFloat(match[1]) : undefined;
}

function buildUrl(config: InternalAxiosRequestConfig): string {
  const base = config.baseURL ?? '';
  const path = config.url ?? '';
  if (!base || path.startsWith('http')) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function shouldIgnore(url: string): boolean {
  return url.includes('/debug/perf');
}

export function installAxiosInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    const cfg = config as PerfConfig;
    cfg._perfStart = performance.now();
    cfg._perfId = nextRequestId();
    return config;
  });

  client.interceptors.response.use(
    (response: AxiosResponse) => {
      record(
        response.config as PerfConfig,
        response.status,
        response.headers?.['server-timing'] as string | undefined,
        response.headers?.['x-request-id'] as string | undefined,
        response.data,
      );
      return response;
    },
    (error: AxiosError) => {
      if (error.config) {
        record(
          error.config as PerfConfig,
          error.response?.status ?? 0,
          error.response?.headers?.['server-timing'] as string | undefined,
          error.response?.headers?.['x-request-id'] as string | undefined,
          undefined,
          true,
        );
      }
      return Promise.reject(error);
    },
  );
}

function record(
  config: PerfConfig,
  status: number,
  serverTiming: string | undefined,
  requestId: string | undefined,
  data: unknown,
  error = false,
): void {
  const started = config._perfStart;
  const id = config._perfId;
  if (!started || !id) return;
  const durationMs = performance.now() - started;
  const url = buildUrl(config);
  if (shouldIgnore(url)) return;
  let sizeBytes: number | undefined;
  if (typeof data === 'string') sizeBytes = data.length;
  else if (data && typeof data === 'object') {
    try {
      sizeBytes = JSON.stringify(data).length;
    } catch {
      // ignore
    }
  }
  usePerfHudStore.getState().pushRequest({
    id,
    method: (config.method ?? 'GET').toUpperCase(),
    url,
    status,
    durationMs,
    serverMs: parseServerTiming(serverTiming ?? null),
    sizeBytes,
    error: error || status >= 400,
    at: Date.now(),
    requestId,
  });
}
