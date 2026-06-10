import { type ReactElement } from 'react';

import { type GizmoMode, useEditorStore } from '../../store/editor.store';

const GIZMO_MODES: { mode: GizmoMode; label: string }[] = [
  { mode: 'translate', label: '↔ Déplacer' },
  { mode: 'rotate', label: '⟳ Tourner' },
  { mode: 'scale', label: '⤢ Redim.' },
];

export function EditorToolbar(): ReactElement {
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const setGizmoMode = useEditorStore((s) => s.setGizmoMode);

  return (
    <aside className="editor-panel editor-toolbar">
      <p className="editor-panel-title">🛠 Outils</p>
      <div className="editor-btn-row">
        {GIZMO_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className={`editor-btn${gizmoMode === mode ? ' is-on' : ''}`}
            onClick={() => setGizmoMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <PrefsRow />
      <HistoryRow />
      <SceneActions />
    </aside>
  );
}

function SceneActions(): ReactElement {
  const selectedId = useEditorStore((s) => s.selectedId);
  const removeProp = useEditorStore((s) => s.removeProp);
  const resetTemplate = useEditorStore((s) => s.resetTemplate);
  const setShowShortcuts = useEditorStore((s) => s.setShowShortcuts);
  const propCount = useEditorStore((s) => s.template.props.length);
  return (
    <>
      <button
        type="button"
        className="editor-btn editor-btn-danger"
        disabled={!selectedId}
        onClick={() => selectedId && removeProp(selectedId)}
      >
        🗑 Supprimer la sélection
      </button>
      <button
        type="button"
        className="editor-btn"
        disabled={propCount === 0}
        onClick={resetTemplate}
      >
        ♻ Vider la scène
      </button>
      <button type="button" className="editor-btn" onClick={() => setShowShortcuts(true)}>
        ⌨ Raccourcis (?)
      </button>
      <p className="editor-hint">{propCount} objet(s) · glisse un asset depuis la palette</p>
    </>
  );
}

function HistoryRow(): ReactElement {
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  return (
    <div className="editor-btn-row">
      <button type="button" className="editor-btn" disabled={!canUndo} onClick={undo}>
        ↶ Annuler
      </button>
      <button type="button" className="editor-btn" disabled={!canRedo} onClick={redo}>
        ↷ Rétablir
      </button>
    </div>
  );
}

function PrefsRow(): ReactElement {
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const setSnapToGrid = useEditorStore((s) => s.setSnapToGrid);
  const showColliders = useEditorStore((s) => s.showColliders);
  const setShowColliders = useEditorStore((s) => s.setShowColliders);
  return (
    <div className="editor-btn-row">
      <button
        type="button"
        className={`editor-btn${snapToGrid ? ' is-on' : ''}`}
        onClick={() => setSnapToGrid(!snapToGrid)}
      >
        ▦ Aligner grille
      </button>
      <button
        type="button"
        className={`editor-btn${showColliders ? ' is-on' : ''}`}
        onClick={() => setShowColliders(!showColliders)}
      >
        🟩 Collisions
      </button>
    </div>
  );
}
