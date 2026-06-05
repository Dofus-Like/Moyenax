import { type GizmoMode, useEditorStore } from '../../store/editor.store';

import { downloadTemplate } from './sceneIo';

type EditorStore = ReturnType<typeof useEditorStore.getState>;

const GIZMO_KEYS: Record<string, GizmoMode> = {
  w: 'translate',
  '1': 'translate',
  e: 'rotate',
  '2': 'rotate',
  r: 'scale',
  '3': 'scale',
};

const ARROW_NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export interface ShortcutGroup {
  title: string;
  items: { keys: string; label: string }[];
}

export const SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Transformer',
    items: [
      { keys: 'W · 1', label: 'Déplacer' },
      { keys: 'E · 2', label: 'Tourner' },
      { keys: 'R · 3', label: 'Redimensionner (3 axes)' },
      { keys: 'Flèches', label: 'Décaler la sélection (1 case)' },
    ],
  },
  {
    title: 'Objets',
    items: [
      { keys: 'Maj+clic', label: 'Ajouter / retirer de la sélection' },
      { keys: 'Ctrl+A', label: 'Tout sélectionner' },
      { keys: 'Ctrl+D', label: 'Dupliquer' },
      { keys: 'Ctrl+C · Ctrl+V', label: 'Copier · Coller' },
      { keys: 'Suppr', label: 'Supprimer' },
      { keys: 'Tab · Maj+Tab', label: 'Sélection suivante · précédente' },
      { keys: 'Échap', label: 'Désélectionner / fermer' },
    ],
  },
  {
    title: 'Historique',
    items: [
      { keys: 'Ctrl+Z', label: 'Annuler' },
      { keys: 'Ctrl+Y · Ctrl+Maj+Z', label: 'Rétablir' },
    ],
  },
  {
    title: 'Affichage',
    items: [
      { keys: 'G', label: 'Aligner sur la grille' },
      { keys: 'B', label: 'Afficher les collisions' },
      { keys: 'F', label: 'Recentrer la caméra' },
      { keys: 'P', label: 'Jouer / Éditer' },
    ],
  },
  {
    title: 'Scène',
    items: [
      { keys: 'Ctrl+S', label: 'Exporter en JSON' },
      { keys: '? · H', label: 'Afficher cette aide' },
    ],
  },
];

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
}

function handleGlobalShortcut(event: KeyboardEvent, store: EditorStore): boolean {
  if (!event.ctrlKey && !event.metaKey) return false;
  const key = event.key.toLowerCase();
  const actions: Record<string, () => void> = {
    z: () => (event.shiftKey ? store.redo() : store.undo()),
    y: () => store.redo(),
    a: () => store.selectAll(),
    c: () => store.copySelected(),
    v: () => store.paste(),
    d: () => store.duplicateSelected(),
    s: () => downloadTemplate(store.template),
  };
  const action = actions[key];
  if (!action) return false;
  if (key !== 'c') event.preventDefault();
  action();
  return true;
}

function handleSelectionKey(event: KeyboardEvent, store: EditorStore): boolean {
  if (store.selectedIds.length === 0) return false;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    store.removeSelected();
    return true;
  }
  return false;
}

function handleNavKey(event: KeyboardEvent, store: EditorStore): boolean {
  if (event.key === 'Tab') {
    event.preventDefault();
    store.selectNext(event.shiftKey ? -1 : 1);
    return true;
  }
  const nudge = ARROW_NUDGE[event.key];
  if (nudge && store.selectedId) {
    event.preventDefault();
    store.nudgeSelected(nudge[0], nudge[1]);
    return true;
  }
  return false;
}

function handleToggleKey(event: KeyboardEvent, store: EditorStore): boolean {
  if (event.key === '?' || event.key.toLowerCase() === 'h') {
    store.setShowShortcuts(!store.showShortcuts);
    return true;
  }
  const toggles: Record<string, () => void> = {
    g: () => store.setSnapToGrid(!store.snapToGrid),
    b: () => store.setShowColliders(!store.showColliders),
    f: () => store.requestResetView(),
    p: () => store.setMode(store.mode === 'play' ? 'edit' : 'play'),
  };
  const toggle = toggles[event.key.toLowerCase()];
  if (!toggle) return false;
  toggle();
  return true;
}

export function handleEditorKey(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) return;
  const store = useEditorStore.getState();
  if (event.key === 'Escape') {
    if (store.showShortcuts) store.setShowShortcuts(false);
    else {
      store.setPlacingModel(null);
      store.select(null);
    }
    return;
  }
  if (handleGlobalShortcut(event, store)) return;
  if (handleSelectionKey(event, store)) return;
  if (handleNavKey(event, store)) return;
  if (handleToggleKey(event, store)) return;
  const gizmo = GIZMO_KEYS[event.key.toLowerCase()];
  if (gizmo) store.setGizmoMode(gizmo);
}
