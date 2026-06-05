import { type ReactElement } from 'react';

import { TERRAIN_LABELS, TerrainType } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';

const BRUSHES: TerrainType[] = [
  TerrainType.GROUND,
  TerrainType.WALL,
  TerrainType.WOOD,
  TerrainType.IRON,
  TerrainType.CRYSTAL,
  TerrainType.FABRIC,
  TerrainType.LEATHER,
  TerrainType.HERB,
  TerrainType.GOLD,
];

export function EditorTerrainBrushPanel(): ReactElement {
  const editTool = useEditorStore((s) => s.editTool);
  const setEditTool = useEditorStore((s) => s.setEditTool);
  const brushType = useEditorStore((s) => s.brushType);
  const setBrushType = useEditorStore((s) => s.setBrushType);

  return (
    <aside className="editor-panel editor-brush">
      <p className="editor-panel-title">🖌 Édition</p>
      <div className="editor-btn-row">
        <button
          type="button"
          className={`editor-btn${editTool === 'props' ? ' is-on' : ''}`}
          onClick={() => setEditTool('props')}
        >
          🧊 Objets
        </button>
        <button
          type="button"
          className={`editor-btn${editTool === 'terrain' ? ' is-on' : ''}`}
          onClick={() => setEditTool('terrain')}
        >
          ⛰ Terrain
        </button>
      </div>
      {editTool === 'terrain' && (
        <>
          <div className="editor-btn-grid">
            {BRUSHES.map((type) => (
              <button
                key={type}
                type="button"
                className={`editor-btn${brushType === type ? ' is-on' : ''}`}
                onClick={() => setBrushType(type)}
              >
                {TERRAIN_LABELS[type]}
              </button>
            ))}
          </div>
          <p className="editor-hint">Clique/glisse sur la grille pour peindre.</p>
        </>
      )}
    </aside>
  );
}
