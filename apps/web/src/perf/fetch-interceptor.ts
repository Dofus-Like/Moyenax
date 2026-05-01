import { nextRequestId, usePerfHudStore } from './perf-hud.store';

let installed = false;

function parseServerTiming(header: string | null): number | undefined {
  if (!header) return undefined;
  const appEntry = header.split(',').map((s) => s.trim()).find((entry) => entry.startsWith('app'));
  if (!appEntry) return undefined;
  const match = appEntry.match(/dur=([\d.]+)/);
  return match ? Number.parseFloat(match[1]) : undefined;
}

function shouldIgnore(url: string): boolean {
  return url.includes('/debug/perf') || url.startsWith('ws:') || url.startsWith('wss:');
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function installFetchInterceptor(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = resolveUrl(input);

    if (shouldIgnore(url)) {
      return originalFetch(input, init);
    }

    const id = nextRequestId();
    const startedAt = performance.now();
    try {
      const response = await originalFetch(input, init);
      const durationMs = performance.now() - startedAt;
      const serverMs = parseServerTiming(response.headers.get('Server-Timing'));
      const contentLength = response.headers.get('Content-Length');
      const requestId = response.headers.get('x-request-id') ?? undefined;
      usePerfHudStore.getState().pushRequest({
        id,
        method,
        url,
        status: response.status,
        durationMs,
        serverMs,
        sizeBytes: contentLength ? Number.parseInt(contentLength, 10) : undefined,
        error: response.status >= 400,
        at: Date.now(),
        requestId,
      });
      return response;
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      usePerfHudStore.getState().pushRequest({
        id,
        method,
        url,
        status: 0,
        durationMs,
        error: true,
        at: Date.now(),
      });
      throw error;
    }
  };
}
