import { apiClient } from '../api/client';
import type { BackendSnapshot } from './perf-hud.store';
import { usePerfHudStore } from './perf-hud.store';

let timer: ReturnType<typeof setInterval> | null = null;

export function startBackendPoller(intervalMs = 2000): void {
  if (timer !== null || typeof window === 'undefined') return;

  const poll = async () => {
    const state = usePerfHudStore.getState();
    if (!state.enabled || state.minimized) return;
    try {
      const { data } = await apiClient.get<BackendSnapshot>('/debug/perf', {
        headers: { 'x-perf-hud': '1' },
      });
      usePerfHudStore.getState().setBackend(data, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      usePerfHudStore.getState().setBackend(null, message);
    }
  };

  void poll();
  timer = setInterval(poll, intervalMs);
}

export function stopBackendPoller(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
