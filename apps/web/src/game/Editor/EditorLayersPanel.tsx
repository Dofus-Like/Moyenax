import { type ReactElement, type MouseEvent } from 'react';

import type { PlacedProp } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';

export function EditorLayersPanel(): ReactElement {
  const props = useEditorStore((s) => s.template.props);

  return (
    <aside className="editor-panel editor-layers">
      <p className="editor-panel-title">🗂 Calques ({props.length})</p>
      <div className="editor-layers-list">
        {props.length === 0 && <p className="editor-hint">Aucun objet.</p>}
        {[...props].reverse().map((prop, i) => (
          <LayerRow key={prop.id} prop={prop} index={props.length - i} />
        ))}
      </div>
    </aside>
  );
}

function LayerRow({ prop, index }: { prop: PlacedProp; index: number }): ReactElement {
  const selected = useEditorStore((s) => s.selectedIds.includes(prop.id));
  const name = prop.modelKey.split('/').pop()?.replace('.glb', '') ?? prop.modelKey;

  const onSelect = (event: MouseEvent): void => {
    if (prop.locked) return;
    const store = useEditorStore.getState();
    if (event.shiftKey) store.toggleSelect(prop.id);
    else store.select(prop.id);
  };

  return (
    <div className={`editor-layer-row${selected ? ' is-active' : ''}`}>
      <button type="button" className="editor-layer-name" onClick={onSelect} title={prop.modelKey}>
        <span className="editor-layer-index">{index}</span>
        {name}
      </button>
      <button
        type="button"
        className={`editor-layer-toggle${prop.hidden ? ' is-off' : ''}`}
        title={prop.hidden ? 'Afficher' : 'Masquer'}
        onClick={() => useEditorStore.getState().toggleHide(prop.id)}
      >
        {prop.hidden ? '🚫' : '👁'}
      </button>
      <button
        type="button"
        className={`editor-layer-toggle${prop.locked ? ' is-on' : ''}`}
        title={prop.locked ? 'Déverrouiller' : 'Verrouiller'}
        onClick={() => useEditorStore.getState().toggleLock(prop.id)}
      >
        {prop.locked ? '🔒' : '🔓'}
      </button>
    </div>
  );
}
