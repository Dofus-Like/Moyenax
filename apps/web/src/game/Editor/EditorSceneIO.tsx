import { type ChangeEvent, type ReactElement, useRef, useState } from 'react';

import { parseSceneTemplate } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';

import { downloadTemplate } from './sceneIo';

export function EditorSceneIO(): ReactElement {
  const template = useEditorStore((s) => s.template);
  const loadTemplate = useEditorStore((s) => s.loadTemplate);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = parseSceneTemplate(JSON.parse(await file.text()));
      if (!parsed) {
        setError('Fichier invalide : ce n’est pas une scène.');
        return;
      }
      setError(null);
      loadTemplate(parsed);
    } catch {
      setError('JSON illisible.');
    }
  };

  return (
    <aside className="editor-panel editor-io">
      <p className="editor-panel-title">💾 Scène</p>
      <div className="editor-btn-row">
        <button type="button" className="editor-btn" onClick={() => downloadTemplate(template)}>
          ⬇ Exporter
        </button>
        <button type="button" className="editor-btn" onClick={() => inputRef.current?.click()}>
          ⬆ Importer
        </button>
      </div>
      {error && <p className="editor-hint editor-io-error">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void handleImport(event)}
      />
    </aside>
  );
}
