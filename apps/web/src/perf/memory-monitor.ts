import { usePerfHudStore } from './perf-hud.store';

interface ChromeMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

let timer: ReturnType<typeof setInterval> | null = null;

function readMemory(): ChromeMemory | null {
  if (typeof performance === 'undefined') return null;
  const mem = (performance as Performance & { memory?: ChromeMemory }).memory;
  if (!mem) return null;
  return mem;
}

export function startMemoryMonitor(intervalMs = 2000): void {
  if (timer !== null || typeof window === 'undefined') return;
  if (!readMemory()) return;

  const sample = () => {
    const mem = readMemory();
    if (!mem) return;
    usePerfHudStore.getState().setMemory({
      usedMb: Number((mem.usedJSHeapSize / (1024 * 1024)).toFixed(1)),
      totalMb: Number((mem.totalJSHeapSize / (1024 * 1024)).toFixed(1)),
      limitMb: Number((mem.jsHeapSizeLimit / (1024 * 1024)).toFixed(0)),
      at: Date.now(),
    });
  };

  sample();
  timer = setInterval(sample, intervalMs);
}

export function stopMemoryMonitor(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
