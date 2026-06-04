import { useCallback, useRef } from 'react';

import type { CombatState } from '@game/shared-types';

import { playgroundApi } from '../../api/playground.api';
import { useAuthStore } from '../../store/auth.store';
import { useCombatStore } from '../../store/combat.store';

import './Playground.css';

const TARGET_SPOTS: Array<[number, number]> = [
  [4, 4],
  [6, 4],
  [4, 6],
  [2, 4],
  [6, 6],
  [2, 2],
  [8, 4],
];

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  color: string;
  onCommit: (v: number) => void;
}

function Slider({ label, value, min, max, step = 1, color, onCommit }: SliderProps) {
  return (
    <label className="pg-slider">
      <span className="pg-slider-label">
        {label} <b style={{ color }}>{value}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ accentColor: color }}
        onChange={(e) => onCommit(Number(e.target.value))}
      />
    </label>
  );
}

interface PlaygroundControlsPanelProps {
  sessionId: string;
}

export function PlaygroundControlsPanel({ sessionId }: PlaygroundControlsPanelProps) {
  const combatState = useCombatStore((s) => s.combatState);
  const setCombatState = useCombatStore((s) => s.setCombatState);
  const user = useAuthStore((s) => s.player);
  const userId = user?.id ?? (user as { _id?: string } | null)?._id ?? undefined;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const me = userId ? combatState?.players?.[userId] : undefined;
  const dummies = Object.values(combatState?.players ?? {}).filter((p) => p.playerId !== userId);
  const noCooldown = combatState?.noCooldown ?? false;

  // Débounce les appels pendant le drag d'un slider.
  const debounced = useCallback((key: string, fn: () => Promise<{ data: CombatState }>) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      void fn().then(({ data }) => setCombatState(data));
    }, 120);
  }, [setCombatState]);

  const setStat = (field: 'atk' | 'mag' | 'def' | 'res' | 'vit', v: number) =>
    debounced(`me-${field}`, () => playgroundApi.setPlayerStats(sessionId, { [field]: v }));

  const setDummyStat = (id: string, field: 'def' | 'res' | 'vit', v: number) =>
    debounced(`${id}-${field}`, () => playgroundApi.setDummy(sessionId, { dummyId: id, [field]: v }));

  const addTarget = async () => {
    const [x, y] = TARGET_SPOTS[dummies.length % TARGET_SPOTS.length];
    const { data } = await playgroundApi.addDummy(sessionId, { x, y });
    setCombatState(data);
  };

  const removeTarget = async (id: string) => {
    const { data } = await playgroundApi.removeDummy(sessionId, id);
    setCombatState(data);
  };

  const resetTargets = async () => {
    const { data } = await playgroundApi.resetDummies(sessionId);
    setCombatState(data);
  };

  const toggleNoCd = async () => {
    const { data } = await playgroundApi.setNoCooldown(sessionId, !noCooldown);
    setCombatState(data);
  };

  if (!me) return null;

  return (
    <div className="pg-panel">
      <h3 className="pg-title">🎛️ Stats &amp; options</h3>

      <p className="pg-subtitle">Stats joueur (brutes)</p>
      <Slider label="ATK" value={me.stats.atk} min={0} max={500} color="#fca800" onCommit={(v) => setStat('atk', v)} />
      <Slider label="MAG" value={me.stats.mag} min={0} max={500} color="#a855f7" onCommit={(v) => setStat('mag', v)} />
      <Slider label="DEF" value={me.stats.def} min={0} max={500} color="#60a5fa" onCommit={(v) => setStat('def', v)} />
      <Slider label="RES" value={me.stats.res} min={0} max={500} color="#22c55e" onCommit={(v) => setStat('res', v)} />
      <Slider label="VIT" value={me.stats.vit} min={1} max={5000} step={10} color="#ef4444" onCommit={(v) => setStat('vit', v)} />

      <label className="pg-check">
        <input type="checkbox" checked={noCooldown} onChange={toggleNoCd} />
        Sorts sans cooldown
      </label>

      <div className="pg-meter-head" style={{ marginTop: '8px' }}>
        <p className="pg-subtitle" style={{ margin: 0 }}>Cibles ({dummies.length})</p>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" className="pg-mini-btn" onClick={addTarget}>+ Cible</button>
          {dummies.length > 0 && (
            <button type="button" className="pg-mini-btn" onClick={resetTargets}>Reset</button>
          )}
        </div>
      </div>

      {dummies.map((d, i) => (
        <div key={d.playerId} className="pg-target">
          <div className="pg-target-head">
            <span>Cible {i + 1} ({d.position.x},{d.position.y}) — {d.currentVit}/{d.stats.vit} PV</span>
            <button type="button" className="pg-unequip" onClick={() => removeTarget(d.playerId)}>✕</button>
          </div>
          <Slider label="PV" value={d.stats.vit} min={1} max={5000} step={10} color="#ef4444" onCommit={(v) => setDummyStat(d.playerId, 'vit', v)} />
          <Slider label="DEF" value={d.stats.def} min={0} max={500} color="#60a5fa" onCommit={(v) => setDummyStat(d.playerId, 'def', v)} />
          <Slider label="RES" value={d.stats.res} min={0} max={500} color="#22c55e" onCommit={(v) => setDummyStat(d.playerId, 'res', v)} />
        </div>
      ))}
    </div>
  );
}
