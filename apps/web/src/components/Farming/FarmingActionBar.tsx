import React from 'react';

import { assetUrl } from '../../game/constants/assetUrl';
import { useTranslation } from '../../store/language.store';
import './FarmingActionBar.css';

interface Spell {
  id: string;
  name: string;
  iconPath?: string;
  cost?: number;
}

interface FarmingActionBarProps {
  spells: Spell[];
  onSpellClick: (spell: Spell) => void;
  selectedSpellId?: string | null;
}

export const FarmingActionBar = ({ 
  spells = [], 
  onSpellClick,
  selectedSpellId 
}: FarmingActionBarProps) => {
  const { t } = useTranslation();
  const [hoveredSpellId, setHoveredSpellId] = React.useState<string | null>(null);

  // Ensure we have 8 slots for that classic Dofus look
  const slots = Array(8).fill(null);
  for (const [i, spell] of spells.entries()) {
    if (i < slots.length) slots[i] = spell;
  }

  console.log('FarmingActionBar: rendering with spells', spells);

  return (
    <div className="farming-hud-anchor">
      <div className="spell-bar glass">
        {slots.map((spell, index) => {
          const isActive = spell && selectedSpellId === spell.id;
          const isHovered = spell && hoveredSpellId === spell.id;

          return (
            <div
              key={spell?.id || `empty-${index}`}
              className={`spell-card ${spell ? 'has-spell' : 'empty'} ${isActive ? 'active' : ''}`}
              onMouseEnter={() => spell && setHoveredSpellId(spell.id)}
              onMouseLeave={() => setHoveredSpellId(null)}
              onClick={() => spell && onSpellClick(spell)}
            >
              {spell && isHovered && (
                <div className="spell-hover-tag">{spell.name}</div>
              )}

              <span className="spell-index-badge">{index + 1}</span>
              {spell?.cost && <span className="spell-pa-cost">{spell.cost}</span>}

              {spell && (
                <img
                  src={assetUrl(spell.iconPath || '/assets/pack/spells/epee.png')}
                  className="spell-icon-img"
                  alt={spell.name}
                />
              )}
              {spell && <span className="spell-name">{spell.name}</span>}
            </div>
          );
        })}

        {/* Separator */}
        <div className="spell-bar-separator" />

        {/* Grimoire / Equipment toggle */}
        <button
          type="button"
          className="spell-bar-action grimoire"
          title={t('grimoireEquipment')}
        >
          📖
        </button>

        {/* Passer = End turn (Placeholder in farming) */}
        <button
          type="button"
          className="spell-bar-action pass ready"
          title={t('goShopCrafting')}
        >
          <span className="pass-icon">⏭</span>
          <span className="pass-label">{t('pass')}</span>
        </button>
      </div>
    </div>
  );
};
