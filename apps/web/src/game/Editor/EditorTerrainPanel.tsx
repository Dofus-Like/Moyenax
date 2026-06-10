import { type ReactElement } from 'react';

import { ALL_SEED_IDS, SEED_CONFIGS, type SeedId } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';

export function EditorTerrainPanel(): ReactElement {
  const seedId = useEditorStore((s) => s.template.terrain.seedId);
  const setSeedId = useEditorStore((s) => s.setSeedId);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const playing = mode === 'play';

  return (
    <aside className="editor-panel editor-terrain">
      <p className="editor-panel-title">🌍 Terrain</p>
      <select
        className="editor-select"
        value={seedId}
        onChange={(event) => setSeedId(event.target.value as SeedId)}
      >
        {ALL_SEED_IDS.map((id) => (
          <option key={id} value={id}>
            {SEED_CONFIGS[id].label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`editor-btn editor-btn-play${playing ? ' is-editing' : ''}`}
        onClick={() => setMode(playing ? 'edit' : 'play')}
      >
        {playing ? '✏ Revenir à l’édition' : '▶ Jouer la scène'}
      </button>
      <p className="editor-hint">Ressources générées procéduralement depuis le seed.</p>
    </aside>
  );
}
