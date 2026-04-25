import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted localStorage
const { _lsStore } = vi.hoisted(() => {
  const _lsStore = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (_lsStore.has(k) ? (_lsStore.get(k) ?? null) : null),
    setItem: (k: string, v: string) => _lsStore.set(k, String(v)),
    removeItem: (k: string) => _lsStore.delete(k),
    clear: () => _lsStore.clear(),
  };
  (globalThis as unknown as { localStorage: typeof stub }).localStorage = stub;
  return { _lsStore };
});

import {
  listSnapshots,
  saveCurrentSnapshot,
  deleteSnapshot,
  clearSnapshots,
  buildDiff,
  type SavedSnapshot,
} from './snapshots';
import { usePerfHudStore } from './perf-hud.store';

function makeSnapshot(overrides: Partial<SavedSnapshot> = {}): SavedSnapshot {
  return {
    id: 'test-id',
    label: 'test',
    createdAt: new Date().toISOString(),
    url: 'http://test/',
    fps: { fps: 60, ms: 16, at: 0 },
    fpsAvg: 60,
    fpsMin: 55,
    fpsMax: 62,
    vitals: {},
    longTasks: [],
    renders: {},
    requests: [],
    backend: null,
    ...overrides,
  };
}

describe('snapshots', () => {
  beforeEach(() => {
    _lsStore.clear();
    // Reset store
    usePerfHudStore.setState({
      fps: { fps: 60, ms: 16, at: 0 },
      fpsHistory: [55, 60, 62],
      vitals: {},
      longTasks: [],
      renders: {},
      requests: [],
      backend: null,
    });
  });

  describe('listSnapshots', () => {
    it('retourne [] si localStorage vide', () => {
      expect(listSnapshots()).toEqual([]);
    });

    it('retourne [] si le payload est invalide', () => {
      localStorage.setItem('perf-hud:snapshots', '{"not":"array"}');
      expect(listSnapshots()).toEqual([]);
    });

    it('retourne [] si le JSON est corrompu', () => {
      localStorage.setItem('perf-hud:snapshots', 'not-json');
      expect(listSnapshots()).toEqual([]);
    });
  });

  describe('saveCurrentSnapshot', () => {
    it('calcule fpsAvg / min / max depuis l\'historique', () => {
      const snap = saveCurrentSnapshot('my-label');
      expect(snap.fpsAvg).toBe(59); // round((55+60+62)/3)
      expect(snap.fpsMin).toBe(55);
      expect(snap.fpsMax).toBe(62);
      expect(snap.label).toBe('my-label');
    });

    it('génère un label par défaut si vide', () => {
      const snap = saveCurrentSnapshot('');
      expect(snap.label).toMatch(/snapshot/);
    });

    it('ajoute le snapshot à la liste en localStorage', () => {
      saveCurrentSnapshot('a');
      saveCurrentSnapshot('b');
      const list = listSnapshots();
      expect(list).toHaveLength(2);
      expect(list[0].label).toBe('b'); // le plus récent en tête
    });

    it('fpsAvg/min/max=0 si l\'historique est vide', () => {
      usePerfHudStore.setState({ fpsHistory: [] });
      const snap = saveCurrentSnapshot('empty');
      expect(snap.fpsAvg).toBe(0);
      expect(snap.fpsMin).toBe(0);
      expect(snap.fpsMax).toBe(0);
    });
  });

  describe('deleteSnapshot / clearSnapshots', () => {
    it('deleteSnapshot retire l\'entrée par id', () => {
      const snap = saveCurrentSnapshot('a');
      deleteSnapshot(snap.id);
      expect(listSnapshots()).toEqual([]);
    });

    it('deleteSnapshot sur id inexistant no-op', () => {
      saveCurrentSnapshot('a');
      deleteSnapshot('unknown');
      expect(listSnapshots()).toHaveLength(1);
    });

    it('clearSnapshots vide tout', () => {
      saveCurrentSnapshot('a');
      saveCurrentSnapshot('b');
      clearSnapshots();
      expect(listSnapshots()).toEqual([]);
    });
  });

  describe('buildDiff', () => {
    it('inclut FPS avg et min', () => {
      const before = makeSnapshot({ fpsAvg: 50 });
      const after = makeSnapshot({ fpsAvg: 60 });
      const rows = buildDiff(before, after);
      const fpsAvgRow = rows.find((r) => r.label === 'FPS avg');
      expect(fpsAvgRow?.before).toBe(50);
      expect(fpsAvgRow?.after).toBe(60);
      expect(fpsAvgRow?.delta).toBe(10);
    });

    it('calcule deltaPct', () => {
      const before = makeSnapshot({ fpsAvg: 50 });
      const after = makeSnapshot({ fpsAvg: 60 });
      const rows = buildDiff(before, after);
      const row = rows.find((r) => r.label === 'FPS avg');
      expect(row?.deltaPct).toBe(20);
    });

    it('n\'inclut les vitals que si présents', () => {
      const before = makeSnapshot({ vitals: {} });
      const after = makeSnapshot({ vitals: {} });
      const rows = buildDiff(before, after);
      expect(rows.find((r) => r.label.startsWith('Vitals'))).toBeUndefined();
    });

    it('inclut les vitals présents', () => {
      const before = makeSnapshot({ vitals: { LCP: 1000 } });
      const after = makeSnapshot({ vitals: { LCP: 800 } });
      const rows = buildDiff(before, after);
      const row = rows.find((r) => r.label.includes('LCP'));
      expect(row).toBeDefined();
      expect(row?.betterIsLower).toBe(true);
    });

    it('deltaPct undefined si before=0', () => {
      const before = makeSnapshot({ fpsAvg: 0 });
      const after = makeSnapshot({ fpsAvg: 60 });
      const rows = buildDiff(before, after);
      const row = rows.find((r) => r.label === 'FPS avg');
      expect(row?.delta).toBe(60);
      expect(row?.deltaPct).toBeUndefined();
    });

    it('inclut long tasks count', () => {
      const before = makeSnapshot({ longTasks: [] });
      const after = makeSnapshot({ longTasks: [{ id: 1, startTime: 0, duration: 60, name: 't', at: 0 }] });
      const rows = buildDiff(before, after);
      const row = rows.find((r) => r.label === 'Long tasks count');
      expect(row?.before).toBe(0);
      expect(row?.after).toBe(1);
    });
  });
});
