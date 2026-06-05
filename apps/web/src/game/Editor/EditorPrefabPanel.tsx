import { type ReactElement } from 'react';

import { useEditorStore } from '../../store/editor.store';

import { usePrefabStore } from './prefabStore';
import { type Prefab, instantiateParts } from './prefabs';

export function EditorPrefabPanel(): ReactElement {
  const prefabs = usePrefabStore((s) => s.prefabs);
  const savePrefab = usePrefabStore((s) => s.savePrefab);
  const selectedCount = useEditorStore((s) => s.selectedIds.length);

  const onSave = (): void => {
    const store = useEditorStore.getState();
    const ids = new Set(store.selectedIds);
    const selected = store.template.props.filter((p) => ids.has(p.id));
    if (selected.length === 0) return;
    const name = window.prompt('Nom du prefab ?', `Prefab ${prefabs.length + 1}`);
    if (name === null) return;
    savePrefab(name, selected);
  };

  return (
    <aside className="editor-panel editor-prefabs">
      <p className="editor-panel-title">🧱 Prefabs ({prefabs.length})</p>
      <button type="button" className="editor-btn" disabled={selectedCount === 0} onClick={onSave}>
        💾 Enregistrer la sélection
      </button>
      <div className="editor-prefab-list">
        {prefabs.length === 0 && (
          <p className="editor-hint">
            Sélectionne des objets puis enregistre-les comme prefab réutilisable.
          </p>
        )}
        {prefabs.map((prefab) => (
          <PrefabRow key={prefab.id} prefab={prefab} />
        ))}
      </div>
    </aside>
  );
}

function PrefabRow({ prefab }: { prefab: Prefab }): ReactElement {
  const removePrefab = usePrefabStore((s) => s.removePrefab);
  const place = (): void => useEditorStore.getState().addProps(instantiateParts(prefab, [0, 0, 0]));
  return (
    <div className="editor-layer-row">
      <button type="button" className="editor-layer-name" onClick={place} title="Placer au centre">
        🧱 {prefab.name}
        <span className="editor-layer-index">×{prefab.parts.length}</span>
      </button>
      <button
        type="button"
        className="editor-layer-toggle"
        title="Supprimer le prefab"
        onClick={() => removePrefab(prefab.id)}
      >
        🗑
      </button>
    </div>
  );
}
