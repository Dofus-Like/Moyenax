import { create } from 'zustand';

import type { PlacedProp, SceneTemplate, SeedId, TimeOfDay, Vec3 } from '@game/shared-types';
import {
  DEFAULT_PROP_COLLIDES,
  DEFAULT_PROP_ROTATION,
  DEFAULT_PROP_SCALE,
  ambianceForTimeOfDay,
  createEmptyTemplate,
} from '@game/shared-types';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type EditorMode = 'edit' | 'play';

const HISTORY_LIMIT = 50;

let propCounter = 0;
function nextPropId(): string {
  propCounter += 1;
  return `prop-${propCounter}`;
}

export function snapVec(position: Vec3): Vec3 {
  return [Math.round(position[0]), position[1], Math.round(position[2])];
}

// Keep generated ids ahead of any loaded template's ids to avoid collisions.
function syncCounterTo(props: PlacedProp[]): void {
  for (const prop of props) {
    const match = /^prop-(\d+)$/.exec(prop.id);
    if (match) propCounter = Math.max(propCounter, Number(match[1]));
  }
}

type TemplateProducer = (template: SceneTemplate) => SceneTemplate;
type Extra = Partial<Pick<EditorStoreState, 'selectedId' | 'placingModelKey'>>;

interface EditorStoreState {
  template: SceneTemplate;
  selectedId: string | null;
  gizmoMode: GizmoMode;
  placingModelKey: string | null;
  mode: EditorMode;
  snapToGrid: boolean;
  showColliders: boolean;
  past: SceneTemplate[];
  future: SceneTemplate[];
  clipboard: PlacedProp | null;
  showShortcuts: boolean;
  resetViewSignal: number;
  addProp: (modelKey: string, position: Vec3) => void;
  updateProp: (id: string, patch: Partial<Omit<PlacedProp, 'id'>>) => void;
  removeProp: (id: string) => void;
  duplicateProp: (id: string) => void;
  copySelected: () => void;
  paste: () => void;
  select: (id: string | null) => void;
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

function offsetClone(prop: PlacedProp): PlacedProp {
  return {
    ...prop,
    id: nextPropId(),
    position: [prop.position[0] + 1, prop.position[1], prop.position[2] + 1],
  };
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

  return {
    template: createEmptyTemplate(),
    selectedId: null,
    gizmoMode: 'translate',
    placingModelKey: null,
    mode: 'edit',
    snapToGrid: false,
    showColliders: false,
    past: [],
    future: [],
    clipboard: null,
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
      change((t) => ({ ...t, props: [...t.props, prop] }), { selectedId: prop.id });
    },

    updateProp: (id, patch): void =>
      change((t) => ({ ...t, props: t.props.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

    removeProp: (id): void => {
      const sel = get().selectedId;
      change((t) => ({ ...t, props: t.props.filter((p) => p.id !== id) }), {
        selectedId: sel === id ? null : sel,
      });
    },

    duplicateProp: (id): void => {
      const original = get().template.props.find((p) => p.id === id);
      if (!original) return;
      const clone = offsetClone(original);
      change((t) => ({ ...t, props: [...t.props, clone] }), { selectedId: clone.id });
    },

    copySelected: (): void => {
      const prop = get().template.props.find((p) => p.id === get().selectedId);
      if (prop) set({ clipboard: prop });
    },

    paste: (): void => {
      const { clipboard } = get();
      if (!clipboard) return;
      const clone = offsetClone(clipboard);
      change((t) => ({ ...t, props: [...t.props, clone] }), { selectedId: clone.id });
    },

    select: (id): void => set({ selectedId: id }),
    setGizmoMode: (mode): void => set({ gizmoMode: mode }),
    setPlacingModel: (modelKey): void => set({ placingModelKey: modelKey }),
    setSnapToGrid: (value): void => set({ snapToGrid: value }),
    setShowColliders: (value): void => set({ showColliders: value }),
    setMode: (mode): void => set({ mode }),
    setShowShortcuts: (value): void => set({ showShortcuts: value }),
    requestResetView: (): void => set((s) => ({ resetViewSignal: s.resetViewSignal + 1 })),

    selectNext: (direction): void => {
      const { props } = get().template;
      if (props.length === 0) return;
      const index = props.findIndex((p) => p.id === get().selectedId);
      let base = index;
      if (index < 0) base = direction > 0 ? -1 : 0;
      const next = (base + direction + props.length) % props.length;
      set({ selectedId: props[next].id });
    },

    nudgeSelected: (dx, dz): void => {
      const id = get().selectedId;
      if (!id) return;
      change((t) => ({
        ...t,
        props: t.props.map((p) =>
          p.id === id
            ? { ...p, position: [p.position[0] + dx, p.position[1], p.position[2] + dz] }
            : p,
        ),
      }));
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
      change(() => template, { selectedId: null, placingModelKey: null });
    },
    resetTemplate: (): void =>
      change(() => createEmptyTemplate(), { selectedId: null, placingModelKey: null }),

    undo: (): void =>
      set((state) => {
        if (state.past.length === 0) return {};
        const previous = state.past[state.past.length - 1];
        return {
          template: previous,
          past: state.past.slice(0, -1),
          future: [state.template, ...state.future],
          selectedId: null,
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
          selectedId: null,
          placingModelKey: null,
        };
      }),
  };
});
