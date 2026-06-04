import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';

import { PortraitPawn } from '../../components/PortraitPawn';
import { getSkinById, SKINS } from '../constants/skins';

import { SkinThumb } from './SkinThumb';

import './AdminTest.css';

type AnimMode = 'idle' | 'attack';

function Stage({
  skinId,
  anim,
  override,
  hue,
  sat,
}: {
  skinId: string;
  anim: AnimMode;
  override: boolean;
  hue: number;
  sat: number;
}) {
  return (
    <div className="at-stage">
      <Canvas camera={{ position: [0, 0, 3], fov: 35 }} gl={{ alpha: true }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <group scale={2.2} position={[0, -0.15, 0]}>
            <PortraitPawn
              skinId={skinId}
              isAttacking={anim === 'attack'}
              hue={override ? hue : undefined}
              saturation={override ? sat : undefined}
            />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}

function SkinPicker({ skinId, onSelect }: { skinId: string; onSelect: (id: string) => void }) {
  return (
    <div className="at-skin-section">
      <p className="at-group-label">Skins</p>
      <div className="at-skin-grid">
        {SKINS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`at-skin-btn${s.id === skinId ? ' is-active' : ''}`}
            onClick={() => onSelect(s.id)}
            title={s.description}
          >
            <SkinThumb skinId={s.id} size={52} />
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

function Slider({
  label,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="at-slider">
      <span className="at-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      />
    </div>
  );
}

function VariantControls({
  override,
  hue,
  sat,
  type,
  onToggle,
  onHue,
  onSat,
}: {
  override: boolean;
  hue: number;
  sat: number;
  type: string;
  onToggle: () => void;
  onHue: (v: number) => void;
  onSat: (v: number) => void;
}) {
  return (
    <div className="at-skin-section">
      <label className="at-check">
        <input type="checkbox" checked={override} onChange={onToggle} />
        Variante personnalisée (base : {type})
      </label>
      <div className={override ? undefined : 'at-disabled'}>
        <Slider
          label={`Teinte ${hue}°`}
          min={-180}
          max={360}
          step={1}
          value={hue}
          disabled={!override}
          onChange={onHue}
        />
        <Slider
          label={`Saturation ${sat.toFixed(2)}`}
          min={0}
          max={2}
          step={0.05}
          value={sat}
          disabled={!override}
          onChange={onSat}
        />
        <p className="at-hint">
          hue: {hue}, saturation: {Number(sat.toFixed(2))} — valeurs à coller dans SKINS (skins.ts).
        </p>
      </div>
    </div>
  );
}

export function SkinGalleryPanel() {
  const [skinId, setSkinId] = useState('soldier-classic');
  const [anim, setAnim] = useState<AnimMode>('idle');
  const [override, setOverride] = useState(false);
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(1);

  const selectSkin = (id: string) => {
    const cfg = getSkinById(id);
    setSkinId(id);
    setHue(cfg.hue);
    setSat(cfg.saturation);
    setOverride(false);
  };

  return (
    <section className="at-panel">
      <h2 className="at-title">🎭 Skin Gallery</h2>
      <p className="at-hint">
        Prévisualise chaque skin (rendu de combat réel), bascule idle/attaque, et conçois une
        variante en réglant teinte et saturation.
      </p>
      <div className="at-skin-main">
        <Stage skinId={skinId} anim={anim} override={override} hue={hue} sat={sat} />
        <div className="at-skin-controls">
          <SkinPicker skinId={skinId} onSelect={selectSkin} />
          <AnimToggle anim={anim} onChange={setAnim} />
          <VariantControls
            override={override}
            hue={hue}
            sat={sat}
            type={getSkinById(skinId).type}
            onToggle={() => setOverride((o) => !o)}
            onHue={setHue}
            onSat={setSat}
          />
        </div>
      </div>
    </section>
  );
}
