import { describe, it, expect, beforeEach } from 'vitest';

import { usePerfHudStore, nextRequestId } from './perf-hud.store';

describe('usePerfHudStore', () => {
  beforeEach(() => {
    usePerfHudStore.setState({
      enabled: false,
      minimized: false,
      fps: { fps: 0, ms: 0, at: 0 },
      fpsHistory: [],
      vitals: {},
      requests: [],
      longTasks: [],
      renders: {},
      sceneMetrics: {},
      sceneGpu: {},
      sseEvents: [],
      sseByType: {},
      memory: null,
      memoryHistory: [],
      backend: null,
      backendError: null,
    });
  });

  describe('toggle/enabled/minimized', () => {
    it('toggle bascule enabled', () => {
      usePerfHudStore.getState().toggle();
      expect(usePerfHudStore.getState().enabled).toBe(true);
      usePerfHudStore.getState().toggle();
      expect(usePerfHudStore.getState().enabled).toBe(false);
    });

    it('setEnabled met la valeur', () => {
      usePerfHudStore.getState().setEnabled(true);
      expect(usePerfHudStore.getState().enabled).toBe(true);
    });

    it('setMinimized met la valeur', () => {
      usePerfHudStore.getState().setMinimized(true);
      expect(usePerfHudStore.getState().minimized).toBe(true);
    });
  });

  describe('requests (rolling buffer)', () => {
    it('pushRequest ajoute en tête', () => {
      usePerfHudStore.getState().pushRequest({
        id: 1, method: 'GET', url: '/', status: 200, durationMs: 50, at: 0,
      });
      expect(usePerfHudStore.getState().requests).toHaveLength(1);
    });

    it('rolling buffer cappé à 50', () => {
      for (let i = 0; i < 60; i++) {
        usePerfHudStore.getState().pushRequest({
          id: i, method: 'GET', url: '/', status: 200, durationMs: 50, at: i,
        });
      }
      expect(usePerfHudStore.getState().requests).toHaveLength(50);
      // Le plus récent doit être id=59 (en tête)
      expect(usePerfHudStore.getState().requests[0].id).toBe(59);
    });

    it('clearRequests vide la liste', () => {
      usePerfHudStore.getState().pushRequest({
        id: 1, method: 'GET', url: '/', status: 200, durationMs: 50, at: 0,
      });
      usePerfHudStore.getState().clearRequests();
      expect(usePerfHudStore.getState().requests).toEqual([]);
    });
  });

  describe('recordRender', () => {
    it('première occurrence initialise', () => {
      usePerfHudStore.getState().recordRender('Comp', 'mount', 5.0);
      const r = usePerfHudStore.getState().renders['Comp'];
      expect(r.count).toBe(1);
      expect(r.totalMs).toBe(5.0);
      expect(r.lastPhase).toBe('mount');
    });

    it('occurrences suivantes cumulent', () => {
      usePerfHudStore.getState().recordRender('Comp', 'mount', 5);
      usePerfHudStore.getState().recordRender('Comp', 'update', 10);
      const r = usePerfHudStore.getState().renders['Comp'];
      expect(r.count).toBe(2);
      expect(r.totalMs).toBe(15);
      expect(r.maxMs).toBe(10);
      expect(r.lastPhase).toBe('update');
    });

    it('clearRenders vide', () => {
      usePerfHudStore.getState().recordRender('Comp', 'mount', 5);
      usePerfHudStore.getState().clearRenders();
      expect(usePerfHudStore.getState().renders).toEqual({});
    });
  });

  describe('scene perf', () => {
    it('recordSceneMetric cumule les batches', () => {
      const store = usePerfHudStore.getState();
      store.recordSceneMetric({
        id: 'Canvas:frame',
        count: 2,
        totalMs: 40,
        maxMs: 25,
        slowCount: 1,
        lastMs: 15,
        lastAt: 1,
      });
      store.recordSceneMetric({
        id: 'Canvas:frame',
        count: 1,
        totalMs: 30,
        maxMs: 30,
        slowCount: 1,
        lastMs: 30,
        lastAt: 2,
      });

      const metric = usePerfHudStore.getState().sceneMetrics['Canvas:frame'];
      expect(metric.count).toBe(3);
      expect(metric.totalMs).toBe(70);
      expect(metric.avgMs).toBeCloseTo(23.33, 2);
      expect(metric.maxMs).toBe(30);
      expect(metric.slowCount).toBe(2);
      expect(metric.lastMs).toBe(30);
    });

    it('setSceneGpu stocke un snapshot par canvas', () => {
      usePerfHudStore.getState().setSceneGpu({
        id: 'CombatCanvas',
        calls: 120,
        triangles: 5000,
        points: 0,
        lines: 0,
        geometries: 12,
        textures: 8,
        programs: 4,
        at: 1,
      });

      expect(usePerfHudStore.getState().sceneGpu.CombatCanvas.calls).toBe(120);
    });

    it('clearScenePerf vide les métriques scène', () => {
      const store = usePerfHudStore.getState();
      store.recordSceneMetric({
        id: 'WaterPlane:uniform-update',
        count: 1,
        totalMs: 5,
        maxMs: 5,
        slowCount: 1,
        lastMs: 5,
        lastAt: 1,
      });
      store.setSceneGpu({
        id: 'FarmingCanvas',
        calls: 1,
        triangles: 1,
        points: 0,
        lines: 0,
        geometries: 1,
        textures: 1,
        programs: 1,
        at: 1,
      });
      store.clearScenePerf();
      expect(usePerfHudStore.getState().sceneMetrics).toEqual({});
      expect(usePerfHudStore.getState().sceneGpu).toEqual({});
    });
  });

  describe('sseEvents', () => {
    it('pushSseEvent aggregate par type', () => {
      const store = usePerfHudStore.getState();
      store.pushSseEvent({ id: 1, source: 's', type: 'DAMAGE', sizeBytes: 100, at: 0 });
      store.pushSseEvent({ id: 2, source: 's', type: 'DAMAGE', sizeBytes: 50, at: 1 });
      const byType = usePerfHudStore.getState().sseByType['DAMAGE'];
      expect(byType.count).toBe(2);
      expect(byType.totalBytes).toBe(150);
    });

    it('cappé à 60 entrées', () => {
      const store = usePerfHudStore.getState();
      for (let i = 0; i < 80; i++) {
        store.pushSseEvent({ id: i, source: 's', type: 't', sizeBytes: 1, at: i });
      }
      expect(usePerfHudStore.getState().sseEvents).toHaveLength(60);
    });
  });

  describe('fps', () => {
    it('setFps push dans l\'historique', () => {
      usePerfHudStore.getState().setFps(60, 16.7);
      expect(usePerfHudStore.getState().fps.fps).toBe(60);
      expect(usePerfHudStore.getState().fpsHistory).toEqual([60]);
    });

    it('fpsHistory cappé à 120', () => {
      const store = usePerfHudStore.getState();
      for (let i = 0; i < 150; i++) store.setFps(i, 16);
      expect(usePerfHudStore.getState().fpsHistory).toHaveLength(120);
    });
  });

  describe('memory', () => {
    it('setMemory stocke et push history', () => {
      usePerfHudStore.getState().setMemory({ usedMb: 100, totalMb: 200, limitMb: 500, at: 0 });
      expect(usePerfHudStore.getState().memory?.usedMb).toBe(100);
      expect(usePerfHudStore.getState().memoryHistory).toEqual([100]);
    });
  });

  describe('vitals', () => {
    it('setVital met à jour une clé', () => {
      usePerfHudStore.getState().setVital('LCP', 1500);
      expect(usePerfHudStore.getState().vitals.LCP).toBe(1500);
      usePerfHudStore.getState().setVital('INP', 200);
      expect(usePerfHudStore.getState().vitals.LCP).toBe(1500);
      expect(usePerfHudStore.getState().vitals.INP).toBe(200);
    });
  });

  describe('backend', () => {
    it('setBackend stocke snapshot', () => {
      usePerfHudStore.getState().setBackend(null, 'some error');
      expect(usePerfHudStore.getState().backend).toBeNull();
      expect(usePerfHudStore.getState().backendError).toBe('some error');
    });
  });
});

describe('nextRequestId', () => {
  it('incrémente à chaque appel', () => {
    const a = nextRequestId();
    const b = nextRequestId();
    expect(b).toBe(a + 1);
  });
});
