import React from "react";

import { SpellFamily, SpellEffectKind, PlayerStats } from "@game/shared-types";
import { useTranslation } from "../../store/language.store";
import "./SpellBar.css";

const SPELL_FAMILY_ORDER: Record<SpellFamily, number> = {
  [SpellFamily.COMMON]: 1,
  [SpellFamily.WARRIOR]: 2,
  [SpellFamily.MAGE]: 3,
  [SpellFamily.NINJA]: 4,
};

const SPELL_HOTKEYS = [
  "a",
  "z",
  "e",
  "r",
  "t",
  "y",
  "u",
  "i",
  "o",
  "p",
] as const;

function toFamilyClassName(family: SpellFamily | null | undefined) {
  return `family-${(family ?? SpellFamily.COMMON).toLowerCase()}`;
}

function isTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export interface SpellBarItem {
  id: string;
  name: string;
  description?: string | null;
  iconPath?: string | null;
  paCost: number;
  family: SpellFamily;
  sortOrder: number;
  cooldown?: number;
  damage?: { min: number; max: number };
  effectKind?: SpellEffectKind;
  effectConfig?: Record<string, unknown> | null;
  minRange?: number;
  maxRange?: number;
}

interface SpellBarProps {
  spells: SpellBarItem[];
  selectedSpellId?: string | null;
  onSpellClick: (id: string) => void;
  attackerStats?: PlayerStats;
  targetStats?: PlayerStats;
  remainingPa?: number;
  maxPa?: number;
  remainingPm?: number;
  maxPm?: number;
  isMyTurn?: boolean;
  showMannequins?: boolean;
  onToggleMannequins?: () => void;
  onPassTurn?: () => void;
  canPassTurn?: boolean;
  passLabel?: string;
  isReadyMode?: boolean;
  isReady?: boolean;
  disableGrimoire?: boolean;
  children?: React.ReactNode;
}

const SpellTooltip = ({
  spell,
  attackerStats,
  targetStats,
}: {
  spell: SpellBarItem;
  attackerStats?: PlayerStats;
  targetStats?: PlayerStats;
}) => {
  const { t } = useTranslation();
  const isMagical = spell.effectKind === SpellEffectKind.DAMAGE_MAGICAL;
  const isHeal = spell.effectKind === SpellEffectKind.HEAL;
  const isDamage = spell.effectKind === SpellEffectKind.DAMAGE_PHYSICAL || isMagical;
  const isPush = spell.effectKind === SpellEffectKind.PUSH_LINE;

  const lines: React.ReactNode[] = [];
  let keywords: Array<{ name: string; desc: string }> = [];

  if (isDamage && spell.damage) {
    const power = attackerStats ? (isMagical ? attackerStats.mag : attackerStats.atk) : 0;
    const defense = attackerStats ? (isMagical ? (targetStats?.res ?? 0) : (targetStats?.def ?? 0)) : 0;
    const minTotal = Math.max(1, spell.damage.min + power - defense);
    const maxTotal = Math.max(1, spell.damage.max + power - defense);
    if (isMagical) {
      lines.push(<div key="dmg">Inflige <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{minTotal}-{maxTotal}</span> dégâts magiques.</div>);
    } else {
      lines.push(<div key="dmg">Inflige <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{minTotal}-{maxTotal}</span> dégâts physiques.</div>);
    }
  } else if (isHeal && spell.damage) {
    const power = attackerStats ? Math.floor(attackerStats.mag * 0.5) : 0;
    const minHeal = spell.damage.min + power;
    const maxHeal = spell.damage.max + power;
    lines.push(<div key="heal">Soigne <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{minHeal}-{maxHeal}</span> PV.</div>);
  }

  const lowerDesc = spell.description?.toLowerCase() || "";
  if (spell.effectKind === SpellEffectKind.BUFF_PM && spell.effectConfig?.buffValue) {
    const duration = spell.effectConfig.buffDuration ?? 1;
    lines.push(<div key="buff-pm">Donne <span className="pmcolor">+{String(spell.effectConfig.buffValue)} PM</span> pendant <span className="pacolor">{String(duration)}</span> tour{(duration > 1 ? 's' : '')}</div>);
  }

  if (isPush || lowerDesc.includes("repouss") || lowerDesc.includes("pousse")) {
    lines.push(<div key="push"><span style={{ color: '#fca800', fontWeight: 'bold' }}>REPOUSSE</span> la cible.</div>);
    keywords.push({ name: "REPOUSSE", desc: "Déplace la cible dans la direction de l'impact." });
  }
  
  if (lowerDesc.includes("brule") || lowerDesc.includes("brûle")) {
    lines.push(<div key="burn"><span style={{ color: '#fca800', fontWeight: 'bold' }}>BRÛLE</span> la cible.</div>);
    keywords.push({ name: "BRÛLURE", desc: "Inflige des dégâts à la fin de chaque tour." });
  }

  // Fallback if no lines generated
  if (lines.length === 0 && spell.description) {
    lines.push(<div key="desc">{spell.description}</div>);
  }

  return (
    <div className={`spell-tooltip-container ${toFamilyClassName(spell.family)}`}>
      <div className="spell-tooltip">
        <div className="tooltip-header">
          <div className="tooltip-title">{spell.name}</div>
          <div className="tooltip-cost">◆{spell.paCost} PA</div>
        </div>

        <div className="tooltip-description" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {lines}
        </div>

        <div className="tooltip-footer">
          {spell.minRange !== undefined && (
            <div className="tooltip-range">
              {t("range")}: {spell.minRange}-{spell.maxRange}
            </div>
          )}
          {spell.cooldown !== undefined && spell.cooldown > 0 && (
            <div className="tooltip-cooldown">
              {t("cooldown")}: {spell.cooldown} tr.
            </div>
          )}
        </div>
      </div>

      {keywords.length > 0 && (
        <div className="spell-keywords-container">
          {keywords.map((kw, idx) => (
            <div 
              key={idx} 
              className="spell-keyword-tooltip"
              style={{ animationDelay: `${0.2 + idx * 0.15}s` }}
            >
              <div className="tooltip-title">{kw.name}</div>
              <div className="tooltip-description">{kw.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MAX_SPELLS = 6;

function EmptySpellSlot({ index }: { index: number }) {
  const hotkey = SPELL_HOTKEYS[index]?.toUpperCase() ?? index + 1;
  return (
    <div className="spell-card spell-card--empty">
      <span className="spell-index-badge">{hotkey}</span>
    </div>
  );
}

function PaDiamonds({
  remainingPa,
  maxPa,
}: {
  remainingPa: number;
  maxPa: number;
}) {
  const visualMax = Math.min(maxPa, 10);
  return (
    <div className="spell-bar-pa">
      <span className="pa-count-text">{remainingPa}/{maxPa}</span>
      {Array.from({ length: visualMax }, (_, i) => {
        let state = "empty";
        if (i < remainingPa - 20) state = "overflow-2";
        else if (i < remainingPa - 10) state = "overflow";
        else if (i < remainingPa) state = "full";
        
        return (
          <span
            key={i}
            className={`pa-diamond pa-diamond--${state}`}
          />
        );
      })}
    </div>
  );
}

function PmDiamonds({
  remainingPm,
  maxPm,
}: {
  remainingPm: number;
  maxPm: number;
}) {
  const visualMax = Math.min(maxPm, 5);
  return (
    <div className="spell-bar-pm">
      {Array.from({ length: visualMax }, (_, i) => {
        let state = "empty";
        if (i < remainingPm - 15) state = "overflow-3";
        else if (i < remainingPm - 10) state = "overflow-2";
        else if (i < remainingPm - 5) state = "overflow";
        else if (i < remainingPm) state = "full";
        
        return (
          <span
            key={i}
            className={`pm-diamond pm-diamond--${state}`}
          />
        );
      })}
      <span className="pm-count-text">{remainingPm}/{maxPm}</span>
    </div>
  );
}

export const SpellBar = ({
  spells,
  selectedSpellId,
  onSpellClick,
  attackerStats,
  targetStats,
  remainingPa = 999,
  maxPa,
  remainingPm = 999,
  maxPm,
  isMyTurn = true,
  showMannequins = false,
  onToggleMannequins,
  onPassTurn,
  canPassTurn = true,
  passLabel,
  isReadyMode = false,
  isReady = false,
  disableGrimoire = false,
  children,
}: SpellBarProps) => {
  const { t } = useTranslation();
  const [hoveredSpellId, setHoveredSpellId] = React.useState<string | null>(
    null,
  );
  const effectivePassLabel = passLabel ?? t("pass");

  const sortedSpells = React.useMemo(
    () =>
      [...spells]
        .sort((a, b) => {
          const familyOrder =
            SPELL_FAMILY_ORDER[a.family] - SPELL_FAMILY_ORDER[b.family];
          if (familyOrder !== 0) return familyOrder;
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          return a.name.localeCompare(b.name);
        })
        .slice(0, MAX_SPELLS),
    [spells],
  );

  const isSpellDisabled = React.useCallback(
    (spell: SpellBarItem) => {
      const onCooldown = (spell.cooldown ?? 0) > 0;
      const notEnoughPa = remainingPa < spell.paCost;
      return !isMyTurn || onCooldown || notEnoughPa;
    },
    [isMyTurn, remainingPa],
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTextInputTarget(event.target)
      )
        return;

      const spellIndex = SPELL_HOTKEYS.indexOf(
        event.key.toLowerCase() as (typeof SPELL_HOTKEYS)[number],
      );
      if (spellIndex === -1) return;

      const spell = sortedSpells[spellIndex];
      if (!spell || isSpellDisabled(spell)) return;

      event.preventDefault();
      onSpellClick(selectedSpellId === spell.id ? "" : spell.id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSpellDisabled, onSpellClick, selectedSpellId, sortedSpells]);

  const showActions =
    onPassTurn !== undefined || onToggleMannequins !== undefined;
  const effectiveMaxPa = maxPa ?? (remainingPa < 999 ? remainingPa : undefined);
  const effectiveMaxPm = maxPm ?? (remainingPm < 999 ? remainingPm : undefined);

  return (
    <div className="spell-bar glass">
      <div className="spell-bar-spells">
        {Array.from({ length: MAX_SPELLS }, (_, index) => {
          const spell = sortedSpells[index];
          if (!spell)
            return <EmptySpellSlot key={`empty-${index}`} index={index} />;

          const onCooldown = (spell.cooldown ?? 0) > 0;
          const isActive = selectedSpellId === spell.id;
          const disabled = isSpellDisabled(spell);
          const familyClassName = toFamilyClassName(spell.family);
          const isHovered = hoveredSpellId === spell.id;
          const hotkey = SPELL_HOTKEYS[index]?.toUpperCase() ?? index + 1;

          return (
            <div
              key={spell.id}
              className={`spell-card ${disabled ? "disabled" : ""} ${isActive ? "active" : ""} ${familyClassName}`}
              onMouseEnter={() => setHoveredSpellId(spell.id)}
              onMouseLeave={() => setHoveredSpellId(null)}
              onClick={() =>
                !disabled && onSpellClick(isActive ? "" : spell.id)
              }
            >
              {isHovered && (
                <SpellTooltip
                  spell={spell}
                  attackerStats={attackerStats}
                  targetStats={targetStats}
                />
              )}

              <span className="spell-index-badge">{hotkey}</span>
              <div className="spell-pa-cost">
                <span className="spell-pa-cost-text">{spell.paCost}</span>
              </div>

              <div className="spell-card-inner">
                <img
                  src={spell.iconPath || "/assets/pack/spells/epee.png"}
                  className="spell-icon-img"
                  alt={spell.name}
                />
                {onCooldown && (
                  <div className="spell-cooldown-overlay">
                    <span className="spell-cooldown-value">
                      {spell.cooldown}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {showActions && <div className="spell-bar-separator" />}

        {!disableGrimoire && onToggleMannequins !== undefined && (
          <button
            type="button"
            className={`spell-bar-action grimoire ${showMannequins ? "active" : ""}`}
            onClick={onToggleMannequins}
            title={t("grimoireEquipment")}
          >
            📖
          </button>
        )}

        {onPassTurn !== undefined && (
          <button
            type="button"
            className={`spell-bar-action pass ${(isMyTurn && canPassTurn) || isReadyMode ? "ready" : ""} ${isReady ? "is-ready" : ""}`}
            disabled={(!isMyTurn || !canPassTurn) && !isReadyMode}
            onClick={onPassTurn}
            title={isReadyMode ? t("ready") : t("endTurn")}
          >
            <span className="pass-icon">{isReadyMode ? "✓" : "⏭"}</span>
            <span className="pass-label">{effectivePassLabel}</span>
          </button>
        )}

        {children}
      </div>

      <div className="spell-bar-resources">
        {effectiveMaxPa !== undefined && (
          <PaDiamonds remainingPa={remainingPa} maxPa={effectiveMaxPa} />
        )}
        {effectiveMaxPm !== undefined && (
          <PmDiamonds remainingPm={remainingPm} maxPm={effectiveMaxPm} />
        )}
      </div>
    </div>
  );
};
