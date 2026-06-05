import { type ReactElement, useEffect } from 'react';

import { EditorAmbiancePanel } from '../game/Editor/EditorAmbiancePanel';
import { EditorArrangePanel } from '../game/Editor/EditorArrangePanel';
import { EditorAssetPalette } from '../game/Editor/EditorAssetPalette';
import { EditorInspector } from '../game/Editor/EditorInspector';
import { EditorLayersPanel } from '../game/Editor/EditorLayersPanel';
import { EditorPlayScene } from '../game/Editor/EditorPlayScene';
import { EditorScene } from '../game/Editor/EditorScene';
import { EditorSceneIO } from '../game/Editor/EditorSceneIO';
import { EditorShortcutsPanel } from '../game/Editor/EditorShortcutsPanel';
import { EditorTerrainPanel } from '../game/Editor/EditorTerrainPanel';
import { EditorToolbar } from '../game/Editor/EditorToolbar';
import { handleEditorKey } from '../game/Editor/shortcuts';
import { useEditorStore } from '../store/editor.store';

import '../game/Editor/Editor.css';

export function EditorPage(): ReactElement {
  const mode = useEditorStore((s) => s.mode);
  const editing = mode === 'edit';

  useEffect(() => {
    window.addEventListener('keydown', handleEditorKey);
    return (): void => window.removeEventListener('keydown', handleEditorKey);
  }, []);

  return (
    <div className="editor-root">
      {editing ? <EditorScene /> : <EditorPlayScene />}
      <div className="editor-overlay">
        {editing && (
          <div className="editor-left">
            <EditorAssetPalette />
            <EditorLayersPanel />
          </div>
        )}
        <div className="editor-right">
          {editing && <EditorToolbar />}
          {editing && <EditorInspector />}
          {editing && <EditorArrangePanel />}
          <EditorTerrainPanel />
          <EditorAmbiancePanel />
          <EditorSceneIO />
        </div>
      </div>
      <EditorShortcutsPanel />
    </div>
  );
}
