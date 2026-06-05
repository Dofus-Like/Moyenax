import { create } from 'zustand';

import type { PlacedProp } from '@game/shared-types';

import { type Prefab, buildPrefab } from './prefabs';

const STORAGE_KEY = 'editor.prefabs.v1';

let prefabCounter = 0;
function nextPrefabId(): string {
  prefabCounter += 1;
  return `pf-${prefabCounter}`;
}

function load(): Prefab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Prefab[];
    for (const pf of parsed) {
      const match = /^pf-(\d+)$/.exec(pf.id);
      if (match) prefabCounter = Math.max(prefabCounter, Number(match[1]));
    }
    return parsed;
  } catch {
    return [];
  }
}

function persist(prefabs: Prefab[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefabs));
  } catch {
    // localStorage indisponible : on garde la lib en mémoire.
  }
}

interface PrefabState {
  prefabs: Prefab[];
  savePrefab: (name: string, props: PlacedProp[]) => void;
  removePrefab: (id: string) => void;
}

export const usePrefabStore = create<PrefabState>((set, get) => ({
  prefabs: load(),
  savePrefab: (name, props): void => {
    if (props.length === 0) return;
    const prefab = buildPrefab(
      nextPrefabId(),
      name.trim() || `Prefab ${get().prefabs.length + 1}`,
      props,
    );
    const prefabs = [...get().prefabs, prefab];
    persist(prefabs);
    set({ prefabs });
  },
  removePrefab: (id): void => {
    const prefabs = get().prefabs.filter((p) => p.id !== id);
    persist(prefabs);
    set({ prefabs });
  },
}));
