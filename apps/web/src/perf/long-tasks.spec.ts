import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startLongTaskObserver, stopLongTaskObserver } from './long-tasks';
import { usePerfHudStore } from './perf-hud.store';

describe('long-tasks', () => {
  let capturedCallback: ((list: { getEntries: () => any[] }) => void) | null = null;

  beforeEach(() => {
    usePerfHudStore.setState({ longTasks: [] });
    capturedCallback = null;

    class MockPerformanceObserver {
      static supportedEntryTypes = ['longtask'];
      constructor(callback: (list: { getEntries: () => any[] }) => void) {
        capturedCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
  });

  afterEach(() => {
    stopLongTaskObserver();
    vi.unstubAllGlobals();
  });

  it('démarre un observer', () => {
    startLongTaskObserver();
    expect(capturedCallback).not.toBeNull();
  });

  it('push long tasks dans le store', () => {
    startLongTaskObserver();
    capturedCallback!({
      getEntries: () => [
        {
          startTime: 100,
          duration: 75,
          name: 'self',
        },
      ],
    });

    const tasks = usePerfHudStore.getState().longTasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      startTime: 100,
      duration: 75,
      name: 'self',
    });
  });

  it('gère attribution si présente', () => {
    startLongTaskObserver();
    capturedCallback!({
      getEntries: () => [
        {
          startTime: 0,
          duration: 100,
          name: 'self',
          attribution: [{ containerType: 'iframe', containerName: 'ad' }],
        },
      ],
    });

    expect(usePerfHudStore.getState().longTasks[0].attribution).toBe('iframe:ad');
  });

  it('ne démarre pas 2 observers si déjà installé', () => {
    startLongTaskObserver();
    const firstCb = capturedCallback;
    startLongTaskObserver();
    expect(capturedCallback).toBe(firstCb);
  });

  it('stopLongTaskObserver disconnect l\'observer', () => {
    startLongTaskObserver();
    stopLongTaskObserver();
    // Re-start doit pouvoir créer un nouveau callback
    startLongTaskObserver();
    expect(capturedCallback).not.toBeNull();
  });

  it('stopLongTaskObserver sans start ne crash pas', () => {
    expect(() => stopLongTaskObserver()).not.toThrow();
  });
});
