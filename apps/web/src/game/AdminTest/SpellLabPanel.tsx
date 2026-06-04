import { calculateDamage, calculateHeal } from '@game/game-engine';
import type { PlayerStats, SpellDefinition } from '@game/shared-types';
import { SpellEffectKind } from '@game/shared-types';
import { Canvas } from '@react-three/fiber';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { playgroundApi } from '../../api/playground.api';
import { playSfx, SPELL_CAST_SFX } from '../../utils/sfx';

import { CAM_DIST, CAM_FOV, CastScene } from './CastScene';
import { spellVfxType } from './vfx';

import './AdminTest.css';

// Sorts ayant un VFX dédié (les autres ne rendent aucun visuel dans SpellVFX).
const VFX_HINT = 'VFX projectile (comme en combat) : Boule de Feu, Kunaï, Bombe repousse.';

interface Stats {
  atk: number;
  mag: number;
  def: number;
  res: number;
}

interface DamageInfo {
  kind: 'damage' | 'heal' | 'none';
  min: number;
  max: number;
}

function buildStats(atk: number, mag: number, def: number, res: number): PlayerStats {
  return {
    vit: 0,
    atk,
    mag,
    def,
    res,
    ini: 0,
    pa: 0,
    pm: 0,
    baseVit: 0,
    baseAtk: atk,
    baseMag: mag,
    baseDef: def,
    baseRes: res,
    baseIni: 0,
    basePa: 0,
    basePm: 0,
  };
}

function computeRange(spell: SpellDefinition, s: Stats): DamageInfo {
  if (spell.effectKind === SpellEffectKind.HEAL) {
    const bonus = Math.floor(s.mag * 0.5);
    return { kind: 'heal', min: spell.damage.min + bonus, max: spell.damage.max + bonus };
  }
  const isMagical = spell.effectKind === SpellEffectKind.DAMAGE_MAGICAL;
  if (isMagical || spell.effectKind === SpellEffectKind.DAMAGE_PHYSICAL) {
    const power = isMagical ? s.mag : s.atk;
    const mitig = isMagical ? s.res : s.def;
    return {
      kind: 'damage',
      min: Math.max(1, spell.damage.min + power - mitig),
      max: Math.max(1, spell.damage.max + power - mitig),
    };
  }
  return { kind: 'none', min: 0, max: 0 };
}

function rollSample(spell: SpellDefinition, s: Stats): number {
  const attacker = buildStats(s.atk, s.mag, 0, 0);
  if (spell.effectKind === SpellEffectKind.HEAL) return calculateHeal(spell, attacker);
  const isMagical = spell.effectKind === SpellEffectKind.DAMAGE_MAGICAL;
  return calculateDamage(spell, attacker, buildStats(0, 0, s.def, s.res), isMagical);
}

function LabSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="at-slider">
      <span className="at-slider-label">
        {label} {value}
      </span>
      <input
        type="range"
        min={0}
        max={200}
        step={1}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
      />
    </div>
  );
}

function StatSliders({
  stats,
  onChange,
}: {
  stats: Stats;
  onChange: (key: keyof Stats, value: number) => void;
}) {
  return (
    <>
      <p className="at-group-label">Stats lanceur / cible</p>
      <LabSlider label="ATK" value={stats.atk} onChange={(v) => onChange('atk', v)} />
      <LabSlider label="MAG" value={stats.mag} onChange={(v) => onChange('mag', v)} />
      <LabSlider label="DEF (cible)" value={stats.def} onChange={(v) => onChange('def', v)} />
      <LabSlider label="RES (cible)" value={stats.res} onChange={(v) => onChange('res', v)} />
    </>
  );
}

function SpellList({
  spells,
  selectedId,
  onSelect,
}: {
  spells: SpellDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="at-skin-section">
      <p className="at-group-label">Sorts ({spells.length})</p>
      <div className="at-spell-grid">
        {spells.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`at-spell-btn${s.id === selectedId ? ' is-active' : ''}`}
            onClick={() => onSelect(s.id)}
            title={s.description ?? s.code}
          >
            <span className="at-spell-name">{s.name}</span>
            <span className="at-spell-meta">
              {s.paCost} PA · ◎{s.minRange}-{s.maxRange}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SpellDetail({ spell }: { spell: SpellDefinition }) {
  return (
    <div className="at-spell-detail">
      <span>PA {spell.paCost}</span>
      <span>
        Portée {spell.minRange}-{spell.maxRange}
      </span>
      <span>CD {spell.cooldown}</span>
      <span>{spell.family}</span>
      <span>{spell.effectKind}</span>
    </div>
  );
}

function SpellResult({ range, lastRoll }: { range: DamageInfo; lastRoll: number | null }) {
  if (range.kind === 'none')
    return <span className="at-hint">Sort sans dégâts (buff/utilitaire).</span>;
  return (
    <span className={range.kind === 'heal' ? 'pg-diff-up' : 'pg-diff-down'}>
      {range.kind === 'heal' ? 'Soin' : 'Dégâts'} {range.min}–{range.max}
      {lastRoll !== null && <> · jet : {lastRoll}</>}
    </span>
  );
}

function VfxStage({
  spell,
  runId,
  playing,
  casting,
  onVfxEnd,
  onCastEnd,
}: {
  spell: SpellDefinition;
  runId: number;
  playing: boolean;
  casting: boolean;
  onVfxEnd: () => void;
  onCastEnd: () => void;
}) {
  return (
    <div className="at-stage at-stage--wide at-stage--tall">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: CAM_FOV, position: [0, 2, CAM_DIST] }}>
        <CastScene
          skinId="soldier-classic"
          attacking={casting}
          playing={playing}
          vfxType={spellVfxType(spell)}
          runId={runId}
          onVfxEnd={onVfxEnd}
          onCastEnd={onCastEnd}
        />
      </Canvas>
    </div>
  );
}

function SpellActions({
  sfxName,
  onSound,
  onVfx,
  onAll,
}: {
  sfxName: string;
  onSound: () => void;
  onVfx: () => void;
  onAll: () => void;
}) {
  return (
    <div className="at-spell-actions">
      <button type="button" className="at-toggle" onClick={onSound}>
        ▶ Son ({sfxName})
      </button>
      <button type="button" className="at-toggle" onClick={onVfx}>
        ✨ VFX
      </button>
      <button type="button" className="at-toggle is-on" onClick={onAll}>
        🎯 Tout lancer
      </button>
    </div>
  );
}

function SpellBench({ spell }: { spell: SpellDefinition }) {
  const [stats, setStats] = useState<Stats>({ atk: 50, mag: 50, def: 0, res: 0 });
  const [runId, setRunId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [casting, setCasting] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);

  const range = useMemo(() => computeRange(spell, stats), [spell, stats]);
  const sfxName = SPELL_CAST_SFX[spell.id] ?? 'spellCast';

  const fireVfx = () => {
    setRunId((n) => n + 1);
    setPlaying(true);
    setCasting(true);
  };
  const fireAll = () => {
    playSfx(sfxName);
    setLastRoll(rollSample(spell, stats));
    fireVfx();
  };

  return (
    <div className="at-skin-controls">
      <h3 className="at-subtitle">{spell.name}</h3>
      <SpellDetail spell={spell} />
      <StatSliders
        stats={stats}
        onChange={(key, value) => setStats((s) => ({ ...s, [key]: value }))}
      />
      <div className="at-spell-result">
        <SpellResult range={range} lastRoll={lastRoll} />
      </div>
      <SpellActions
        sfxName={sfxName}
        onSound={() => playSfx(sfxName)}
        onVfx={fireVfx}
        onAll={fireAll}
      />
      <VfxStage
        spell={spell}
        runId={runId}
        playing={playing}
        casting={casting}
        onVfxEnd={() => setPlaying(false)}
        onCastEnd={() => setCasting(false)}
      />
    </div>
  );
}

export function SpellLabPanel() {
  const { data: spells = [], isLoading } = useQuery({
    queryKey: ['playground', 'spells'],
    queryFn: async () => (await playgroundApi.listSpells()).data,
  });
  const [selectedId, setSelectedId] = useState('');
  const spell = useMemo(
    () => spells.find((s) => s.id === selectedId) ?? spells[0],
    [spells, selectedId],
  );

  if (isLoading)
    return (
      <div className="at-panel">
        <p className="at-hint">Chargement du catalogue de sorts…</p>
      </div>
    );
  if (!spell)
    return (
      <div className="at-panel">
        <p className="at-hint">Aucun sort dans le catalogue.</p>
      </div>
    );

  return (
    <section className="at-panel">
      <h2 className="at-title">✨ Sorts & VFX</h2>
      <p className="at-hint">
        Inspecte un sort, calcule ses dégâts (formule de combat partagée), déclenche son VFX et son
        son. {VFX_HINT}
      </p>
      <div className="at-skin-main">
        <div className="at-skin-controls">
          <SpellList spells={spells} selectedId={spell.id} onSelect={setSelectedId} />
        </div>
        <SpellBench key={spell.id} spell={spell} />
      </div>
    </section>
  );
}
