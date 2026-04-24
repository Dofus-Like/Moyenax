import { usePerfHudStore } from './perf-hud.store';

let observer: PerformanceObserver | null = null;
let idSeed = 0;

export function startLongTaskObserver(): void {
  if (observer !== null || typeof window === 'undefined') return;
  if (typeof PerformanceObserver === 'undefined') return;
  if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return;

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        idSeed += 1;
        const attr = (entry as PerformanceEntry & {
          attribution?: Array<{ name?: string; containerType?: string; containerName?: string }>;
        }).attribution?.[0];
        usePerfHudStore.getState().pushLongTask({
          id: idSeed,
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name,
          attribution: attr
            ? `${attr.containerType ?? 'unknown'}${attr.containerName ? `:${attr.containerName}` : ''}`
            : undefined,
          at: Date.now(),
        });
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    observer = null;
  }
}

export function stopLongTaskObserver(): void {
  observer?.disconnect();
  observer = null;
}
