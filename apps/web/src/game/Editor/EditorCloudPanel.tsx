import { type ReactElement, useCallback, useEffect, useState } from 'react';

import { parseSceneTemplate } from '@game/shared-types';

import { type SceneSummary, scenesApi } from '../../api/scene-templates.api';
import { useEditorStore } from '../../store/editor.store';

export function EditorCloudPanel(): ReactElement {
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await scenesApi.list();
      setScenes(res.data);
      setError(null);
    } catch {
      setError('Connexion au serveur impossible.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = useCallback(async (): Promise<void> => {
    const template = useEditorStore.getState().template;
    const name = window.prompt('Nom de la scène ?', template.name);
    if (name === null) return;
    setBusy(true);
    try {
      await scenesApi.save(name, { ...template, name });
      await refresh();
    } catch {
      setError('Échec de l’enregistrement.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const onLoad = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await scenesApi.get(id);
      const parsed = parseSceneTemplate(res.data.data);
      if (parsed) useEditorStore.getState().loadTemplate(parsed);
      else setError('Scène corrompue.');
    } catch {
      setError('Échec du chargement.');
    }
  }, []);

  const onDelete = useCallback(
    async (id: string): Promise<void> => {
      try {
        await scenesApi.remove(id);
        await refresh();
      } catch {
        setError('Échec de la suppression.');
      }
    },
    [refresh],
  );

  return (
    <aside className="editor-panel editor-cloud">
      <p className="editor-panel-title">☁ Mes scènes ({scenes.length})</p>
      <button type="button" className="editor-btn" disabled={busy} onClick={() => void onSave()}>
        💾 Enregistrer en ligne
      </button>
      {error && <p className="editor-hint editor-io-error">{error}</p>}
      <div className="editor-prefab-list">
        {scenes.map((scene) => (
          <div key={scene.id} className="editor-layer-row">
            <button
              type="button"
              className="editor-layer-name"
              onClick={() => void onLoad(scene.id)}
              title="Charger cette scène"
            >
              ☁ {scene.name}
            </button>
            <button
              type="button"
              className="editor-layer-toggle"
              onClick={() => void onDelete(scene.id)}
              title="Supprimer"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
