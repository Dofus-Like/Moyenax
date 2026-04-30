import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { startFpsMonitor, stopFpsMonitor } from './fps-monitor';
import { usePerfHudStore } from './perf-hud.store';

describe('fps-monitor', () => {
  let rafCallbacks: Array<(ts: number) => void>;
  let currentTime = 0;
  let rafIdCounter = 0;

  beforeEach(() => {
    rafCallbacks = [];
    currentTime = 0;
    rafIdCounter = 0;

    vi.stubGlobal('requestAnimationFrame', (cb: (ts: number) => void) => {
      rafCallbacks.push(cb);
      return ++rafIdCounter;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

    usePerfHudStore.setState({ fps: { fps: 0, ms: 0, at: 0 }, fpsHistory: [] });
  });

  afterEach(() => {
    stopFpsMonitor();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function tick(elapsedMs: number) {
    currentTime += elapsedMs;
    const next = rafCallbacks.shift();
    next?.(currentTime);
  }

  it('démarre une boucle RAF', () => {
    startFpsMonitor();
    expect(rafCallbacks).toHaveLength(1);
  });

  it('appel multiple startFpsMonitor n\'en lance qu\'un (idempotent)', () => {
    startFpsMonitor();
    startFpsMonitor();
    startFpsMonitor();
    expect(rafCallbacks).toHaveLength(1);
  });

  it('met à jour le store après 1s écoulée', () => {
    startFpsMonitor();
    // simuler 60 frames sur ~1s
    for (let i = 0; i < 60; i++) {
      tick(16.7);
    }
    const fps = usePerfHudStore.getState().fps.fps;
    expect(fps).toBeGreaterThan(0);
    expect(usePerfHudStore.getState().fpsHistory.length).toBeGreaterThan(0);
  });

  it('stopFpsMonitor appelle cancelAnimationFrame', () => {
    startFpsMonitor();
    stopFpsMonitor();
    expect(vi.mocked(globalThis.cancelAnimationFrame)).toHaveBeenCalled();
  });

  it('stopFpsMonitor sans start ne crash pas', () => {
    expect(() => stopFpsMonitor()).not.toThrow();
  });
});
