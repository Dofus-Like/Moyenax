import React, { useEffect } from 'react';

import {
  SpellEffectKind,
  SpellFamily,
  SpellType,
  SpellVisualType,
  type CombatState,
} from '@game/shared-types';

import { CombatHUD } from '../game/HUD/CombatHUD';
import '../game/constants/colors';
import { useAuthStore } from '../store/auth.store';
import { useCombatStore } from '../store/combat.store';
import './HudTestPage.css';

// ─── Mock data ─────────────────────────────────────────────────────────────────

const STATS_P1 = {
  vit: 120, atk: 45, def: 20, mag: 15, res: 18, pa: 6, pm: 3, ini: 12,
  baseVit: 120, baseAtk: 45, baseDef: 20, baseMag: 15, baseRes: 18,
  basePa: 6, basePm: 3, baseIni: 12,
};

const STATS_P2 = {
  vit: 150, atk: 60, def: 10, mag: 5, res: 8, pa: 5, pm: 2, ini: 8,
  baseVit: 150, baseAtk: 60, baseDef: 10, baseMag: 5, baseRes: 8,
  basePa: 5, basePm: 2, baseIni: 8,
};

const SPELLS_P1 = [
  { id: 's1', code: 'SLASH', name: 'Taillade', description: "Coup d'épée.", paCost: 3,
    minRange: 1, maxRange: 1, damage: { min: 10, max: 16 }, cooldown: 0,
    type: SpellType.DAMAGE, visualType: SpellVisualType.PHYSICAL, family: SpellFamily.WARRIOR,
    iconPath: '/assets/pack/spells/epee.png', sortOrder: 1,
    requiresLineOfSight: true, requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL, effectConfig: null },
  { id: 's2', code: 'FIREBALL', name: 'Boule de feu', description: 'Projectile enflammé.', paCost: 4,
    minRange: 2, maxRange: 4, damage: { min: 14, max: 22 }, cooldown: 0,
    type: SpellType.DAMAGE, visualType: SpellVisualType.PROJECTILE, family: SpellFamily.MAGE,
    iconPath: '/assets/pack/spells/epee.png', sortOrder: 2,
    requiresLineOfSight: true, requiresLinearTargeting: true,
    effectKind: SpellEffectKind.DAMAGE_MAGICAL, effectConfig: null },
  { id: 's3', code: 'HEAL', name: 'Soin', description: 'Restaure des PV.', paCost: 3,
    minRange: 0, maxRange: 2, damage: { min: 8, max: 12 }, cooldown: 2,
    type: SpellType.HEAL, visualType: SpellVisualType.UTILITY, family: SpellFamily.COMMON,
    iconPath: '/assets/pack/spells/epee.png', sortOrder: 0,
    requiresLineOfSight: false, requiresLinearTargeting: false,
    effectKind: SpellEffectKind.HEAL, effectConfig: null },
  { id: 's4', code: 'SHADOW', name: 'Ombre', description: "Frappe dans l'ombre.", paCost: 2,
    minRange: 1, maxRange: 2, damage: { min: 6, max: 10 }, cooldown: 0,
    type: SpellType.DAMAGE, visualType: SpellVisualType.PHYSICAL, family: SpellFamily.NINJA,
    iconPath: '/assets/pack/spells/epee.png', sortOrder: 1,
    requiresLineOfSight: false, requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL, effectConfig: null },
  { id: 's5', code: 'HEAL_PUSH', name: 'Souffle Protecteur', description: 'Soigne la cible et la repousse violemment.', paCost: 5,
    minRange: 1, maxRange: 3, damage: { min: 10, max: 15 }, cooldown: 3,
    type: SpellType.HEAL, visualType: SpellVisualType.UTILITY, family: SpellFamily.MAGE,
    iconPath: '/assets/pack/spells/epee.png', sortOrder: 5,
    requiresLineOfSight: true, requiresLinearTargeting: false,
    effectKind: SpellEffectKind.HEAL, effectConfig: null },
  { id: 's6', code: 'FIRE_PUSH', name: 'Déflagration', description: 'Inflige des dégâts, repousse et brûle la cible.', paCost: 4,
    minRange: 1, maxRange: 4, damage: { min: 15, max: 20 }, cooldown: 2,
    type: SpellType.DAMAGE, visualType: SpellVisualType.PROJECTILE, family: SpellFamily.MAGE,
    iconPath: '/assets/pack/spells/epee.png', sortOrder: 6,
    requiresLineOfSight: true, requiresLinearTargeting: true,
    effectKind: SpellEffectKind.DAMAGE_MAGICAL, effectConfig: null },
];

const SPELLS_P2 = [
  { id: 'e1', code: 'SMASH', name: 'Écrasement', description: 'Coup brutal.', paCost: 4,
    minRange: 1, maxRange: 1, damage: { min: 18, max: 28 }, cooldown: 0,
    type: SpellType.DAMAGE, visualType: SpellVisualType.PHYSICAL, family: SpellFamily.WARRIOR,
    iconPath: '/assets/pack/spells/epee.png', sortOrder: 1,
    requiresLineOfSight: true, requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL, effectConfig: null },
];

const MOCK_STATE: CombatState = {
  sessionId: 'hud-test-session',
  currentTurnPlayerId: 'player-1',
  turnNumber: 3,
  winnerId: undefined,
  players: {
    'player-1': {
      playerId: 'player-1', username: 'HeroTest', type: 'PLAYER',
      skin: 'soldier-classic', position: { x: 2, y: 3 },
      stats: STATS_P1, currentVit: 120, remainingPa: 6, remainingPm: 3,
      spellCooldowns: {}, buffs: [{ type: 'BURN', remainingTurns: 2 }, { type: 'POISON', remainingTurns: 1 }] as any,
      items: [
        { id: 'i1', name: 'Épée de fer', rank: 2, description: 'Solide.', iconPath: '/assets/pack/items/Item__12.png', category: 'weapon' },
        { id: 'i2', name: 'Bouclier', rank: 1, description: 'Basique.', iconPath: '/assets/pack/items/Item__24.png', category: 'armor' },
      ],
      spells: SPELLS_P1,
    },
    'player-2': {
      playerId: 'player-2', username: 'EnemyOrc', type: 'PLAYER',
      skin: 'orc-classic', position: { x: 7, y: 3 },
      stats: STATS_P2, currentVit: 90, remainingPa: 5, remainingPm: 2,
      spellCooldowns: { s1: 2 }, buffs: [{ type: 'FREEZE', remainingTurns: 3 }] as any, items: [
        { id: 'e_i1', name: 'Hache de guerre', rank: 3, description: 'Lourde et mortelle.', iconPath: '/assets/pack/items/Item__08.png', category: 'weapon' },
        { id: 'e_i2', name: 'Armure d\'écailles', rank: 2, description: 'Solide contre les coups.', iconPath: '/assets/pack/items/Item__18.png', category: 'armor' },
        { id: 'e_i3', name: 'Amulette de rage', rank: 4, description: 'Booste l\'attaque.', iconPath: '/assets/pack/items/Item__28.png', category: 'accessory' },
        { id: 'e_i4', name: 'Bottes cloutées', rank: 1, description: 'Pour botter des fesses.', iconPath: '/assets/pack/items/Item__38.png', category: 'armor' },
        { id: 'e_i5', name: 'Anneau de vitalité', rank: 2, description: 'Donne de la santé.', iconPath: '/assets/pack/items/Item__48.png', category: 'accessory' },
        { id: 'e_i6', name: 'Gantelets de fer', rank: 3, description: 'Protège les mains.', iconPath: '/assets/pack/items/Item__58.png', category: 'armor' },
      ],
      spells: SPELLS_P2,
    },
  },
  map: { width: 10, height: 6, tiles: [] },
};

const MOCK_PLAYER = { id: 'player-1', username: 'HeroTest', email: 'dev@test.local', gold: 0, skin: 'soldier-classic' };

// ─── Controls ──────────────────────────────────────────────────────────────────

function TurnControl({ currentId, onToggle }: { currentId: string; onToggle: () => void }) {
  return (
    <div className="hud-test-group">
      <span className="hud-test-label">Tour</span>
      <button className={`hud-test-btn ${currentId === 'player-1' ? 'active' : ''}`} onClick={onToggle}>
        {currentId === 'player-1' ? '⚔ Mon tour' : '💀 Ennemi'}
      </button>
    </div>
  );
}

function HpControl({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="hud-test-group">
      <span className="hud-test-label">{label}</span>
      <input type="range" className="hud-test-slider" min={0} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="hud-test-label">{value}/{max}</span>
    </div>
  );
}

function ResourceControl({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="hud-test-group">
      <span className="hud-test-label">{label}</span>
      <input type="range" className="hud-test-slider" min={0} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="hud-test-label">{value}/{max}</span>
    </div>
  );
}

function OutcomeControl({ winnerId, onVictory, onDefeat, onReset }: {
  winnerId: string | null; onVictory: () => void; onDefeat: () => void; onReset: () => void;
}) {
  return (
    <div className="hud-test-group">
      <span className="hud-test-label">Fin</span>
      <button className={`hud-test-btn success ${winnerId === 'player-1' ? 'active' : ''}`} onClick={onVictory}>🏆 Victoire</button>
      <button className={`hud-test-btn danger ${winnerId === 'player-2' ? 'active' : ''}`} onClick={onDefeat}>💀 Défaite</button>
      {winnerId && <button className="hud-test-btn" onClick={onReset}>↺ Reset</button>}
    </div>
  );
}

function SpellToggleControl({ allSpells, activeSpells, onToggle }: { allSpells: any[]; activeSpells: any[]; onToggle: (id: string) => void }) {
  return (
    <div className="hud-test-group" style={{ flexDirection: 'row', gap: 4 }}>
      <span className="hud-test-label">Sorts Actifs:</span>
      {allSpells.map(s => {
        const isActive = activeSpells.some(active => active.id === s.id);
        return (
          <button
            key={s.id}
            className={`hud-test-btn ${isActive ? 'active' : ''}`}
            onClick={() => onToggle(s.id)}
            title={s.family}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function HudTestPage() {
  const combatState = useCombatStore((s) => s.combatState);
  const selectedSpellId = useCombatStore((s) => s.selectedSpellId);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  const winnerId = useCombatStore((s) => s.winnerId);

  useEffect(() => {
    useCombatStore.setState({ combatState: MOCK_STATE, winnerId: null, sessionId: MOCK_STATE.sessionId });
    useAuthStore.setState({ player: MOCK_PLAYER, token: null });
    return () => {
      useCombatStore.setState({ combatState: null, winnerId: null, sessionId: null, selectedSpellId: null, isSelectingTarget: false, uiMessage: null });
      useAuthStore.setState({ player: null, token: null });
    };
  }, []);

  const state = combatState ?? MOCK_STATE;
  const p1 = state.players['player-1'];
  const p2 = state.players['player-2'];

  const handleTurnToggle = () => {
    const next = state.currentTurnPlayerId === 'player-1' ? 'player-2' : 'player-1';
    useCombatStore.setState({ combatState: { ...state, currentTurnPlayerId: next } });
  };

  const handleP1Hp = (v: number) => useCombatStore.setState({
    combatState: { ...state, players: { ...state.players, 'player-1': { ...p1, currentVit: v } } },
  });

  const handleP2Hp = (v: number) => useCombatStore.setState({
    combatState: { ...state, players: { ...state.players, 'player-2': { ...p2, currentVit: v } } },
  });

  const handlePa = (v: number) => useCombatStore.setState({
    combatState: { ...state, players: { ...state.players, 'player-1': { ...p1, remainingPa: v } } },
  });

  const handleBasePa = (v: number) => useCombatStore.setState({
    combatState: { ...state, players: { ...state.players, 'player-1': { ...p1, stats: { ...p1.stats, pa: v } } } },
  });

  const handlePm = (v: number) => useCombatStore.setState({
    combatState: { ...state, players: { ...state.players, 'player-1': { ...p1, remainingPm: v } } },
  });

  const handleBasePm = (v: number) => useCombatStore.setState({
    combatState: { ...state, players: { ...state.players, 'player-1': { ...p1, stats: { ...p1.stats, pm: v } } } },
  });

  const handleVictory = () => useCombatStore.setState({ winnerId: 'player-1', combatState: { ...state, winnerId: 'player-1' } });
  const handleDefeat  = () => useCombatStore.setState({ winnerId: 'player-2', combatState: { ...state, winnerId: 'player-2' } });
  const handleReset   = () => useCombatStore.setState({ winnerId: null, combatState: { ...state, winnerId: undefined } });

  const handleToggleSpell = (spellId: string) => {
    const currentSpells = p1.spells;
    const hasSpell = currentSpells.some(s => s.id === spellId);
    let newSpells;
    if (hasSpell) {
      newSpells = currentSpells.filter(s => s.id !== spellId);
    } else {
      const spellToAdd = SPELLS_P1.find(s => s.id === spellId)!;
      newSpells = [...currentSpells, spellToAdd].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    useCombatStore.setState({
      combatState: { ...state, players: { ...state.players, 'player-1': { ...p1, spells: newSpells } } }
    });
  };

  if (!p1 || !p2) return null;

  return (
    <div className="hud-test-page">
      <div className="hud-test-bar">
        <span className="hud-test-title">HUD Test</span>
        <div className="hud-test-sep" />
        <TurnControl currentId={state.currentTurnPlayerId} onToggle={handleTurnToggle} />
        <div className="hud-test-sep" />
        <HpControl label="HP Héros" value={p1.currentVit} max={p1.stats.vit} onChange={handleP1Hp} />
        <HpControl label="HP Ennemi" value={p2.currentVit} max={p2.stats.vit} onChange={handleP2Hp} />
        <ResourceControl label="PA Actuels" value={p1.remainingPa} max={30} onChange={handlePa} />
        <ResourceControl label="PA Base" value={p1.stats.pa} max={30} onChange={handleBasePa} />
        <ResourceControl label="PM Actuels" value={p1.remainingPm} max={20} onChange={handlePm} />
        <ResourceControl label="PM Base" value={p1.stats.pm} max={20} onChange={handleBasePm} />
        <div className="hud-test-sep" />
        <div className="hud-test-group">
          <span className="hud-test-label">Sélect. Sort</span>
          <button className={`hud-test-btn ${selectedSpellId ? 'active' : ''}`}
            onClick={() => setSelectedSpell(selectedSpellId ? null : 's1')}>
            {selectedSpellId ? '✦ Sélectionné' : '✧ Aucun'}
          </button>
        </div>
        <SpellToggleControl allSpells={SPELLS_P1} activeSpells={p1.spells} onToggle={handleToggleSpell} />
        <div className="hud-test-sep" />
        <OutcomeControl winnerId={winnerId} onVictory={handleVictory} onDefeat={handleDefeat} onReset={handleReset} />
      </div>
      <div className="hud-test-stage">
        <div className="hud-test-stage-bg" />
        <CombatHUD />
      </div>
    </div>
  );
}
