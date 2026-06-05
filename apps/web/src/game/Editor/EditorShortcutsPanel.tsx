import { type ReactElement } from 'react';

import { useEditorStore } from '../../store/editor.store';

import { SHORTCUTS } from './shortcuts';

export function EditorShortcutsPanel(): ReactElement | null {
  const open = useEditorStore((s) => s.showShortcuts);
  const setShowShortcuts = useEditorStore((s) => s.setShowShortcuts);
  if (!open) return null;

  return (
    <div className="editor-shortcuts-backdrop" onClick={() => setShowShortcuts(false)}>
      <aside className="editor-panel editor-shortcuts" onClick={(event) => event.stopPropagation()}>
        <div className="editor-shortcuts-head">
          <p className="editor-panel-title">⌨ Raccourcis</p>
          <button type="button" className="editor-btn" onClick={() => setShowShortcuts(false)}>
            ✕
          </button>
        </div>
        <div className="editor-shortcuts-grid">
          {SHORTCUTS.map((group) => (
            <div key={group.title} className="editor-shortcuts-group">
              <p className="editor-tree-folder-name">{group.title}</p>
              {group.items.map((item) => (
                <div key={item.label} className="editor-shortcut-row">
                  <kbd className="editor-kbd">{item.keys}</kbd>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
