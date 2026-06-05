import { type ReactElement, useMemo } from 'react';

import { useEditorStore } from '../../store/editor.store';
import {
  MODELS,
  type ModelEntry,
  type ModelTreeNode,
  buildModelTree,
} from '../models/modelRegistry';

import { DROP_MIME } from './DropTarget';

export function EditorAssetPalette(): ReactElement {
  const tree = useMemo(() => buildModelTree(MODELS), []);
  const placingModelKey = useEditorStore((s) => s.placingModelKey);
  const setPlacingModel = useEditorStore((s) => s.setPlacingModel);

  return (
    <aside className="editor-panel editor-palette">
      <p className="editor-panel-title">🧊 Catalogue ({MODELS.length})</p>
      <p className="editor-hint">
        {placingModelKey
          ? `À poser : ${placingModelKey.split('/').pop()} — clique le sol (Échap pour annuler)`
          : 'Choisis un modèle, puis clique le sol pour le poser.'}
      </p>
      <div className="editor-tree">
        <PaletteTree node={tree} activeKey={placingModelKey} onArm={setPlacingModel} />
      </div>
    </aside>
  );
}

interface PaletteTreeProps {
  node: ModelTreeNode;
  activeKey: string | null;
  onArm: (key: string) => void;
}

function PaletteTree({ node, activeKey, onArm }: PaletteTreeProps): ReactElement {
  return (
    <div className="editor-tree-group">
      {node.folders.map((folder) => (
        <div key={folder.path} className="editor-tree-folder">
          <p className="editor-tree-folder-name">📁 {folder.name}</p>
          <div className="editor-tree-indent">
            <PaletteTree node={folder} activeKey={activeKey} onArm={onArm} />
          </div>
        </div>
      ))}
      {node.models.map((model) => (
        <PaletteItem key={model.key} model={model} active={model.key === activeKey} onArm={onArm} />
      ))}
    </div>
  );
}

interface PaletteItemProps {
  model: ModelEntry;
  active: boolean;
  onArm: (key: string) => void;
}

function PaletteItem({ model, active, onArm }: PaletteItemProps): ReactElement {
  return (
    <button
      type="button"
      className={`editor-tree-item${active ? ' is-active' : ''}`}
      onClick={() => onArm(model.key)}
      draggable
      onDragStart={(event) => event.dataTransfer.setData(DROP_MIME, model.key)}
      title={`${model.key} — clique pour armer, ou glisse dans la scène`}
    >
      ⠿ {model.name}
    </button>
  );
}
