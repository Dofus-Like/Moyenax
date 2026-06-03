import { TERRAIN_LABELS, TerrainType } from '@game/shared-types';

import { TERRAIN_COLORS } from '../ResourceMap/TerrainTile';

import './Playground.css';

export type PlaygroundMode = 'play' | 'paint' | 'gather';

const PAINTABLE_TERRAINS: TerrainType[] = [
  TerrainType.GROUND,
  TerrainType.IRON,
  TerrainType.LEATHER,
  TerrainType.CRYSTAL,
  TerrainType.FABRIC,
  TerrainType.WOOD,
  TerrainType.HERB,
  TerrainType.GOLD,
];

const MODES: { key: PlaygroundMode; label: string }[] = [
  { key: 'play', label: 'Jouer' },
  { key: 'paint', label: 'Peindre' },
  { key: 'gather', label: 'Récolter' },
];

interface TerrainBrushPanelProps {
  mode: PlaygroundMode;
  onModeChange: (mode: PlaygroundMode) => void;
  selectedTerrain: TerrainType;
  onTerrainChange: (terrain: TerrainType) => void;
}

export function TerrainBrushPanel({
  mode,
  onModeChange,
  selectedTerrain,
  onTerrainChange,
}: TerrainBrushPanelProps) {
  return (
    <div className="pg-panel">
      <h3 className="pg-title">🧪 Playground</h3>

      <div className="pg-mode-row">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`pg-mode-btn${mode === m.key ? ' is-active' : ''}`}
            onClick={() => onModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'paint' && (
        <>
          <p className="pg-subtitle">Ressource à poser</p>
          <div className="pg-terrain-grid">
            {PAINTABLE_TERRAINS.map((terrain) => (
              <button
                key={terrain}
                type="button"
                title={TERRAIN_LABELS[terrain]}
                className={`pg-terrain-btn${selectedTerrain === terrain ? ' is-active' : ''}`}
                style={{ background: TERRAIN_COLORS[terrain].base }}
                onClick={() => onTerrainChange(terrain)}
              >
                <span>{terrain === TerrainType.GROUND ? 'Sol' : TERRAIN_LABELS[terrain]}</span>
              </button>
            ))}
          </div>
          <p className="pg-hint">Clique une case pour y poser « {TERRAIN_LABELS[selectedTerrain]} ». « Sol » efface le node.</p>
        </>
      )}

      {mode === 'gather' && (
        <p className="pg-hint">Clique un node de ressource pour le récolter (ajouté à l'inventaire, la case redevient du sol).</p>
      )}

      {mode === 'play' && (
        <p className="pg-hint">Mode combat normal : sélectionne un sort puis tape le mannequin. Il ne bouge pas, n'attaque pas et ne meurt jamais.</p>
      )}
    </div>
  );
}
