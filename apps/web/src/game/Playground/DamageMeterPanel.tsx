import { useEffect, useRef, useState } from 'react';

import type { CombatPlayer, SpellDefinition } from '@game/shared-types';
import { SpellEffectKind } from '@game/shared-types';

import { useCombatStore } from '../../store/combat.store';

import './Playground.css';

interface MeterEntry {
  id: number;
  kind: 'damage' | 'heal';
  spell: string;
  value: number;
  min: number;
  max: number;
  paCost: number;
  range: string;
  target: string;
}

function findSpell(caster: CombatPlayer | undefined, spellId: string | undefined): SpellDefinition | undefined {
  if (!caster || !spellId) return undefined;
  return caster.spells.find((s) => s.id === spellId);
}

/** Borne effective d'un sort de dégâts : (base + atk|mag) - def|res, clampée à 1. */
function effectiveRange(spell: SpellDefinition, caster: CombatPlayer, target: CombatPlayer) {
  const magical = spell.effectKind === SpellEffectKind.DAMAGE_MAGICAL;
  const power = magical ? caster.stats.mag : caster.stats.atk;
  const mitig = magical ? target.stats.res : target.stats.def;
  return {
    min: Math.max(1, spell.damage.min + power - mitig),
    max: Math.max(1, spell.damage.max + power - mitig),
  };
}

export function DamageMeterPanel() {
  const combatState = useCombatStore((s) => s.combatState);
  const lastSpellCast = useCombatStore((s) => s.lastSpellCast);
  const lastDamageEvent = useCombatStore((s) => s.lastDamageEvent);
  const lastHealEvent = useCombatStore((s) => s.lastHealEvent);
  const [log, setLog] = useState<MeterEntry[]>([]);
  const seq = useRef(0);
  const lastDmgTs = useRef(0);
  const lastHealTs = useRef(0);

  useEffect(() => {
    if (!lastDamageEvent || lastDamageEvent.timestamp === lastDmgTs.current) return;
    lastDmgTs.current = lastDamageEvent.timestamp;
    const players = combatState?.players ?? {};
    const caster = lastSpellCast ? players[lastSpellCast.casterId] : undefined;
    const target = players[lastDamageEvent.targetId];
    const spell = findSpell(caster, lastSpellCast?.spellId);
    const range = spell && caster && target ? effectiveRange(spell, caster, target) : { min: 0, max: 0 };
    seq.current += 1;
    const entry: MeterEntry = {
      id: seq.current,
      kind: 'damage',
      spell: spell?.name ?? 'Sort',
      value: lastDamageEvent.damage,
      min: range.min,
      max: range.max,
      paCost: spell?.paCost ?? 0,
      range: spell ? `${spell.minRange}-${spell.maxRange}` : '—',
      target: target?.username ?? 'cible',
    };
    setLog((prev) => [entry, ...prev].slice(0, 40));
  }, [lastDamageEvent, lastSpellCast, combatState]);

  useEffect(() => {
    if (!lastHealEvent || lastHealEvent.timestamp === lastHealTs.current) return;
    lastHealTs.current = lastHealEvent.timestamp;
    const players = combatState?.players ?? {};
    const caster = lastSpellCast ? players[lastSpellCast.casterId] : undefined;
    const spell = findSpell(caster, lastSpellCast?.spellId);
    seq.current += 1;
    const entry: MeterEntry = {
      id: seq.current,
      kind: 'heal',
      spell: spell?.name ?? 'Soin',
      value: lastHealEvent.heal,
      min: spell?.damage.min ?? 0,
      max: spell?.damage.max ?? 0,
      paCost: spell?.paCost ?? 0,
      range: spell ? `${spell.minRange}-${spell.maxRange}` : '—',
      target: players[lastHealEvent.targetId]?.username ?? 'cible',
    };
    setLog((prev) => [entry, ...prev].slice(0, 40));
  }, [lastHealEvent, lastSpellCast, combatState]);

  return (
    <div className="pg-panel">
      <div className="pg-meter-head">
        <h3 className="pg-title">📊 Damage meter</h3>
        {log.length > 0 && (
          <button type="button" className="pg-mini-btn" onClick={() => setLog([])}>
            Vider
          </button>
        )}
      </div>
      {log.length === 0 ? (
        <p className="pg-hint">Lance un sort sur une cible pour mesurer les dégâts.</p>
      ) : (
        <div className="pg-meter-list">
          {log.map((e) => (
            <div key={e.id} className={`pg-meter-row pg-meter-row--${e.kind}`}>
              <span className="pg-meter-spell">{e.spell}</span>
              <span className="pg-meter-val">
                {e.kind === 'heal' ? '+' : '-'}
                {e.value}
              </span>
              <span className="pg-meter-meta">
                {e.min}-{e.max} · {e.paCost} PA · ◎{e.range}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
