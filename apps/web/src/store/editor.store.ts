import { create } from 'zustand';

import type { PlacedProp, SceneTemplate, SeedId, TimeOfDay, Vec3 } from '@game/shared-types';
import {
  DEFAULT_PROP_COLLIDES,
  DEFAULT_PROP_ROTATION,
  DEFAULT_PROP_SCALE,
  ambianceForTimeOfDay,
  createEmptyTemplate,
} from '@game/shared-types';

import { type AlignMode, type Axis, alignProps, distributeProps } from '../game/Editor/arrange';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type EditorMode = 'edit' | 'play';
export interface PropPatch {
  id: string;
  patch: Partial<Omit<PlacedProp, 'id'>>;
}

const HISTORY_LIMIT = 50;

let propCounter = 0;
function nextPropId(): string {
  propCounter += 1;
  return `prop-${propCounter}`;
}

export function snapVec(position: Vec3): Vec3 {
  return [Math.round(position[0]), position[1], Math.round(position[2])];
}

function isSelectable(prop: PlacedProp): boolean {
  return !prop.locked && !prop.hidden;
}

function syncCounterTo(props: PlacedProp[]): void {
  for (const prop of props) {
    const match = /^prop-(\d+)$/.exec(prop.id);
    if (match) propCounter = Math.max(propCounter, Number(match[1]));
  }
}

function offsetClone(prop: PlacedProp): PlacedProp {
  return {
    ...prop,
    id: nextPropId(),
    position: [prop.position[0] + 1, prop.position[1], prop.position[2] + 1],
    locked: false,
    hidden: false,
  };
}

type TemplateProducer = (template: SceneTemplate) => SceneTemplate;
type Selection = Pick<EditorStoreState, 'selectedId' | 'selectedIds'>;
type Extra = Partial<Selection & Pick<EditorStoreState, 'placingModelKey'>>;

function selection(ids: string[]): Selection {
  return { selectedIds: ids, selectedId: ids.length > 0 ? ids[ids.length - 1] : null };
}

interface EditorStoreState {
  template: SceneTemplate;
  /** Primaire (dernier sélectionné) — compat mono-sélection. */
  selectedId: string | null;
  selectedIds: string[];
  gizmoMode: GizmoMode;
  placingModelKey: string | null;
  mode: EditorMode;
  snapToGrid: boolean;
  showColliders: boolean;
  past: SceneTemplate[];
  future: SceneTemplate[];
  clipboard: PlacedProp[];
  showShortcuts: boolean;
  resetViewSignal: number;
  addProp: (modelKey: string, position: Vec3) => void;
  addProps: (inits: Omit<PlacedProp, 'id'>[]) => void;
  updateProp: (id: string, patch: Partial<Omit<PlacedProp, 'id'>>) => void;
  batchUpdateProps: (updates: PropPatch[]) => void;
  removeProp: (id: string) => void;
  removeSelected: () => void;
  duplicateProp: (id: string) => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  paste: () => void;
  select: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  selectMany: (ids: string[]) => void;
  selectAll: () => void;
  toggleLock: (id: string) => void;
  toggleHide: (id: string) => void;
  alignSelected: (axis: Axis, mode: AlignMode) => void;
  distributeSelected: (axis: Axis) => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setPlacingModel: (modelKey: string | null) => void;
  setSnapToGrid: (value: boolean) => void;
  setShowColliders: (value: boolean) => void;
  setTimeOfDay: (timeOfDay: TimeOfDay) => void;
  setAmbientIntensity: (value: number) => void;
  setDirectionalIntensity: (value: number) => void;
  setSeedId: (seedId: SeedId) => void;
  setMode: (mode: EditorMode) => void;
  setShowShortcuts: (value: boolean) => void;
  requestResetView: () => void;
  selectNext: (direction: 1 | -1) => void;
  nudgeSelected: (dx: number, dz: number) => void;
  loadTemplate: (template: SceneTemplate) => void;
  resetTemplate: () => void;
  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorStoreState>((set, get) => {
  // Every template mutation flows through here so undo/redo history stays consistent.
  const change = (producer: TemplateProducer, extra: Extra = {}): void =>
    set((state) => ({
      template: producer(state.template),
      past: [...state.past, state.template].slice(-HISTORY_LIMIT),
      future: [],
      ...extra,
    }));

  const mapProps = (fn: (p: PlacedProp) => PlacedProp, extra: Extra = {}): void =>
    change((t) => ({ ...t, props: t.props.map(fn) }), extra);

  const selectedSet = (): Set<string> => new Set(get().selectedIds);

  return {
    template: createEmptyTemplate(),
    selectedId: null,
    selectedIds: [],
    gizmoMode: 'translate',
    placingModelKey: null,
    mode: 'edit',
    snapToGrid: false,
    showColliders: false,
    past: [],
    future: [],
    clipboard: [],
    showShortcuts: false,
    resetViewSignal: 0,

    addProp: (modelKey, position): void => {
      const prop: PlacedProp = {
        id: nextPropId(),
        modelKey,
        position: get().snapToGrid ? snapVec(position) : position,
        rotation: [...DEFAULT_PROP_ROTATION] as Vec3,
        scale: DEFAULT_PROP_SCALE,
        collides: DEFAULT_PROP_COLLIDES,
      };
      change((t) => ({ ...t, props: [...t.props, prop] }), selection([prop.id]));
    },

    addProps: (inits): void => {
      if (inits.length === 0) return;
      const created: PlacedProp[] = inits.map((init) => ({ ...init, id: nextPropId() }));
      change((t) => ({ ...t, props: [...t.props, ...created] }), selection(created.map((c) => c.id)));
    },

    updateProp: (id, patch): void => mapProps((p) => (p.id === id ? { ...p, ...patch } : p)),

    batchUpdateProps: (updates): void => {
      const byId = new Map(updates.map((u) => [u.id, u.patch]));
      mapProps((p) => (byId.has(p.id) ? { ...p, ...byId.get(p.id) } : p));
    },

    removeProp: (id): void => {
      const remaining = get().selectedIds.filter((sid) => sid !== id);
      change((t) => ({ ...t, props: t.props.filter((p) => p.id !== id) }), selection(remaining));
    },

    removeSelected: (): void => {
      const ids = selectedSet();
      if (ids.size === 0) return;
      change((t) => ({ ...t, props: t.props.filter((p) => !ids.has(p.id)) }), selection([]));
    },

    duplicateProp: (id): void => {
      const original = get().template.props.find((p) => p.id === id);
      if (!original) return;
      const clone = offsetClone(original);
      change((t) => ({ ...t, props: [...t.props, clone] }), selection([clone.id]));
    },

    duplicateSelected: (): void => {
      const ids = selectedSet();
      const clones = get()
        .template.props.filter((p) => ids.has(p.id))
        .map(offsetClone);
      if (clones.length === 0) return;
      change((t) => ({ ...t, props: [...t.props, ...clones] }), selection(clones.map((c) => c.id)));
    },

    copySelected: (): void => {
      const ids = selectedSet();
      const copied = get().template.props.filter((p) => ids.has(p.id));
      if (copied.length > 0) set({ clipboard: copied });
    },

    paste: (): void => {
      const clones = get().clipboard.map(offsetClone);
      if (clones.length === 0) return;
      change((t) => ({ ...t, props: [...t.props, ...clones] }), selection(clones.map((c) => c.id)));
    },

    select: (id): void => set(selection(id ? [id] : [])),
    toggleSelect: (id): void => {
      const ids = get().selectedIds;
      set(selection(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    },
    selectMany: (ids): void => set(selection(ids)),
    selectAll: (): void =>
      set(
        selection(
          get()
            .template.props.filter(isSelectable)
            .map((p) => p.id),
        ),
      ),

    toggleLock: (id): void =>
      mapProps(
        (p) => (p.id === id ? { ...p, locked: !p.locked } : p),
        selection(get().selectedIds.filter((sid) => sid !== id)),
      ),
    toggleHide: (id): void =>
      mapProps(
        (p) => (p.id === id ? { ...p, hidden: !p.hidden } : p),
        selection(get().selectedIds.filter((sid) => sid !== id)),
      ),

    alignSelected: (axis, mode): void =>
      change((t) => ({ ...t, props: alignProps(t.props, selectedSet(), axis, mode) })),
    distributeSelected: (axis): void =>
      change((t) => ({ ...t, props: distributeProps(t.props, selectedSet(), axis) })),

    setGizmoMode: (mode): void => set({ gizmoMode: mode }),
    setPlacingModel: (modelKey): void => set({ placingModelKey: modelKey }),
    setSnapToGrid: (value): void => set({ snapToGrid: value }),
    setShowColliders: (value): void => set({ showColliders: value }),
    setMode: (mode): void => set({ mode }),
    setShowShortcuts: (value): void => set({ showShortcuts: value }),
    requestResetView: (): void => set((s) => ({ resetViewSignal: s.resetViewSignal + 1 })),

    selectNext: (direction): void => {
      const selectables = get().template.props.filter(isSelectable);
      if (selectables.length === 0) return;
      const index = selectables.findIndex((p) => p.id === get().selectedId);
      let base = index;
      if (index < 0) base = direction > 0 ? -1 : 0;
      const next = (base + direction + selectables.length) % selectables.length;
      set(selection([selectables[next].id]));
    },

    nudgeSelected: (dx, dz): void => {
      const ids = selectedSet();
      if (ids.size === 0) return;
      mapProps((p) =>
        ids.has(p.id) && !p.locked
          ? { ...p, position: [p.position[0] + dx, p.position[1], p.position[2] + dz] }
          : p,
      );
    },

    setTimeOfDay: (timeOfDay): void =>
      change((t) => ({ ...t, ambiance: ambianceForTimeOfDay(timeOfDay) })),
    setAmbientIntensity: (value): void =>
      change((t) => ({ ...t, ambiance: { ...t.ambiance, ambientIntensity: value } })),
    setDirectionalIntensity: (value): void =>
      change((t) => ({ ...t, ambiance: { ...t.ambiance, directionalIntensity: value } })),
    setSeedId: (seedId): void => change((t) => ({ ...t, terrain: { ...t.terrain, seedId } })),

    loadTemplate: (template): void => {
      syncCounterTo(template.props);
      change(() => template, { ...selection([]), placingModelKey: null });
    },
    resetTemplate: (): void =>
      change(() => createEmptyTemplate(), { ...selection([]), placingModelKey: null }),

    undo: (): void =>
      set((state) => {
        if (state.past.length === 0) return {};
        const previous = state.past[state.past.length - 1];
        return {
          template: previous,
          past: state.past.slice(0, -1),
          future: [state.template, ...state.future],
          ...selection([]),
          placingModelKey: null,
        };
      }),

    redo: (): void =>
      set((state) => {
        if (state.future.length === 0) return {};
        const [next, ...rest] = state.future;
        return {
          template: next,
          past: [...state.past, state.template],
          future: rest,
          ...selection([]),
          placingModelKey: null,
        };
      }),
  };
});
