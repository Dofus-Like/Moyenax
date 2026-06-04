import type { SpellDefinition } from '@game/shared-types';
import { Canvas } from '@react-three/fiber';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { playgroundApi } from '../../api/playground.api';
import { playSfx, type SfxName, SPELL_CAST_SFX } from '../../utils/sfx';
import { SKINS } from '../constants/skins';
import { modelUrl } from '../models/modelRegistry';

import { CAM_DIST, CAM_FOV, CastScene } from './CastScene';
import { SkinThumb } from './SkinThumb';
import { spellVfxType } from './vfx';

import './AdminTest.css';

type AnimMode = 'idle' | 'attack';

const VERDANT_URL = modelUrl('environments/verdant_battlefield.glb');

interface SceneState {
  skinId: string;
  anim: AnimMode;
  vfxType: string | null;
  runId: number;
  playing: boolean;
  casting: boolean;
}

function IntegrationStage({
  state,
  onVfxEnd,
  onCastEnd,
}: {
  state: SceneState;
  onVfxEnd: () => void;
  onCastEnd: () => void;
}) {
  return (
    <div className="at-stage at-stage--wide at-stage--tall">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: CAM_FOV, position: [0, 2, CAM_DIST] }}>
        <CastScene
          skinId={state.skinId}
          attacking={state.anim === 'attack' || state.casting}
          playing={state.playing}
          vfxType={state.vfxType}
          runId={state.runId}
          groundUrl={VERDANT_URL}
          groundTargetSize={14}
          onVfxEnd={onVfxEnd}
          onCastEnd={onCastEnd}
        />
      </Canvas>
    </div>
  );
}

function SkinThumbs({ skinId, onSelect }: { skinId: string; onSelect: (id: string) => void }) {
  return (
    <div className="at-skin-section">
      <p className="at-group-label">Entité (skin)</p>
      <div className="at-skin-grid">
        {SKINS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`at-skin-btn${s.id === skinId ? ' is-active' : ''}`}
            onClick={() => onSelect(s.id)}
            title={s.description}
          >
            <SkinThumb skinId={s.id} size={44} />
            <span className="at-skin-name">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AnimToggle({ anim, onChange }: { anim: AnimMode; onChange: (a: AnimMode) => void }) {
  return (
    <div className="at-skin-section">
      <p className="at-group-label">Animation</p>
      <div className="at-mode-row">
        <button
          type="button"
          className={`at-toggle${anim === 'idle' ? ' is-on' : ''}`}
          onClick={() => onChange('idle')}
        >
          Idle
        </button>
        <button
          type="button"
          className={`at-toggle${anim === 'attack' ? ' is-on' : ''}`}
          onClick={() => onChange('attack')}
        >
          Attaque
        </button>
      </div>
    </div>
  );
}

function SpellPicker({
  spells,
  spellCode,
  onSelect,
}: {
  spells: SpellDefinition[];
  spellCode: string;
  onSelect: (code: string) => void;
}) {
  return (
    <div className="at-skin-section">
      <p className="at-group-label">Sort</p>
      <select className="at-select" value={spellCode} onChange={(e) => onSelect(e.target.value)}>
        {spells.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ControlsProps {
  state: SceneState;
  spells: SpellDefinition[];
  spellCode: string;
  sfxName: string;
  onSkin: (id: string) => void;
  onAnim: (a: AnimMode) => void;
  onSpell: (code: string) => void;
  onCast: () => void;
}

function Controls(props: ControlsProps) {
  const { state, spells, spellCode, sfxName, onSkin, onAnim, onSpell, onCast } = props;
  return (
    <div className="at-skin-controls">
      <SkinThumbs skinId={state.skinId} onSelect={onSkin} />
      <AnimToggle anim={state.anim} onChange={onAnim} />
      <SpellPicker spells={spells} spellCode={spellCode} onSelect={onSpell} />
      <button type="button" className="at-toggle is-on" onClick={onCast}>
        🎯 Lancer le sort ({sfxName})
      </button>
    </div>
  );
}

function useCastController(sfxName: SfxName) {
  const [runId, setRunId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [casting, setCasting] = useState(false);
  const cast = useCallback(() => {
    playSfx(sfxName);
    setRunId((n) => n + 1);
    setPlaying(true);
    setCasting(true);
  }, [sfxName]);
  return {
    runId,
    playing,
    casting,
    cast,
    endVfx: () => setPlaying(false),
    endCast: () => setCasting(false),
  };
}

export function IntegrationLabPanel() {
  const { data: spells = [] } = useQuery({
    queryKey: ['playground', 'spells'],
    queryFn: async () => (await playgroundApi.listSpells()).data,
  });

  const [skinId, setSkinId] = useState('soldier-classic');
  const [anim, setAnim] = useState<AnimMode>('idle');
  const [spellCode, setSpellCode] = useState('');

  const activeSpell = useMemo(
    () => spells.find((s) => s.id === spellCode) ?? spells[0],
    [spells, spellCode],
  );
  const sfxName = SPELL_CAST_SFX[activeSpell?.id ?? ''] ?? 'spellCast';
  const { runId, playing, casting, cast, endVfx, endCast } = useCastController(sfxName);

  const sceneState: SceneState = {
    skinId,
    anim,
    vfxType: spellVfxType(activeSpell),
    runId,
    playing,
    casting,
  };

  return (
    <section className="at-panel">
      <h2 className="at-title">🧩 Intégration</h2>
      <p className="at-hint">
        Place un asset en contexte (carte Verdant) : choisis skin et sort, puis lance le rendu
        (animation + VFX + son).
      </p>
      <div className="at-skin-main">
        <IntegrationStage state={sceneState} onVfxEnd={endVfx} onCastEnd={endCast} />
        <Controls
          state={sceneState}
          spells={spells}
          spellCode={activeSpell?.id ?? ''}
          sfxName={sfxName}
          onSkin={setSkinId}
          onAnim={setAnim}
          onSpell={setSpellCode}
          onCast={cast}
        />
      </div>
    </section>
  );
}
