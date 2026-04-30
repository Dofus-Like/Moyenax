import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { startMemoryMonitor, stopMemoryMonitor } from './memory-monitor';
import { usePerfHudStore } from './perf-hud.store';

describe('memory-monitor', () => {
  beforeEach(() => {
    usePerfHudStore.setState({ memory: null, memoryHistory: [] });
  });

  afterEach(() => {
    stopMemoryMonitor();
    vi.restoreAllMocks();
  });

  it('ne démarre pas si performance.memory absent', () => {
    // Par défaut, jsdom n'a pas performance.memory
    startMemoryMonitor(100);
    expect(usePerfHudStore.getState().memory).toBeNull();
  });

  it('sample le memory si disponible', () => {
    const mockMemory = {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 500 * 1024 * 1024,
    };
    (performance as unknown as { memory: typeof mockMemory }).memory = mockMemory;

    startMemoryMonitor(100);

    expect(usePerfHudStore.getState().memory).toMatchObject({
      usedMb: 50,
      totalMb: 100,
      limitMb: 500,
    });

    // cleanup
    delete (performance as unknown as { memory?: unknown }).memory;
  });

  it('stopMemoryMonitor sans start ne crash pas', () => {
    expect(() => stopMemoryMonitor()).not.toThrow();
  });
});
