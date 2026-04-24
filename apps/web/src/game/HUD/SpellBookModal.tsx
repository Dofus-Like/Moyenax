import React from 'react';
import ReactDOM from 'react-dom';
import { SpellDefinition, SpellEffectKind, SpellFamily, SpellType } from '@game/shared-types';
import './SpellBookModal.css';

interface SpellBookModalProps {
  spells: SpellDefinition[];
  onClose: () => void;
}

const EFFECT_LABELS: Record<SpellEffectKind, string> = {
  [SpellEffectKind.DAMAGE_PHYSICAL]: 'Dégâts physiques',
  [SpellEffectKind.DAMAGE_MAGICAL]:  'Dégâts magiques',
  [SpellEffectKind.HEAL]:            'Soin',
  [SpellEffectKind.TELEPORT]:        'Téléportation',
  [SpellEffectKind.BUFF_VIT_MAX]:    'Buff Vitalité max',
  [SpellEffectKind.SUMMON_MENHIR]:   'Invocation Menhir',
  [SpellEffectKind.PUSH_LINE]:       'Poussée en ligne',
  [SpellEffectKind.BUFF_PM]:         'Buff Points de Mouvement',
};

const FAMILY_LABELS: Record<SpellFamily, string> = {
  [SpellFamily.COMMON]:  'Commun',
  [SpellFamily.WARRIOR]: 'Guerrier',
  [SpellFamily.MAGE]:    'Mage',
  [SpellFamily.NINJA]:   'Ninja',
};

function SpellCard({ spell }: { spell: SpellDefinition }) {
  const isDamage = spell.type === SpellType.DAMAGE;
  const familyClass = `family-${spell.family.toLowerCase()}`;

  return (
    <div className={`sbm-card ${familyClass}`}>
      <div className="sbm-card-header">
        <img
          className="sbm-card-icon"
          src={spell.iconPath ?? '/assets/pack/spells/epee.png'}
          alt={spell.name}
        />
        <div className="sbm-card-title">
          <span className="sbm-card-name">{spell.name}</span>
          <span className={`sbm-card-family ${familyClass}`}>{FAMILY_LABELS[spell.family]}</span>
        </div>
        <span className="sbm-card-effect-tag">{EFFECT_LABELS[spell.effectKind]}</span>
      </div>

      <div className="sbm-card-stats">
        <div className="sbm-stat sbm-stat-pa">
          <span className="sbm-stat-label">PA</span>
          <strong>{spell.paCost}</strong>
        </div>
        <div className="sbm-stat sbm-stat-range">
          <span className="sbm-stat-label">Portée</span>
          <strong>
            {spell.minRange === spell.maxRange
              ? spell.minRange
              : `${spell.minRange}–${spell.maxRange}`}
          </strong>
        </div>
        {isDamage && (
          <div className="sbm-stat sbm-stat-dmg">
            <span className="sbm-stat-label">Dégâts</span>
            <strong>{spell.damage.min}–{spell.damage.max}</strong>
          </div>
        )}
        {spell.cooldown > 0 && (
          <div className="sbm-stat sbm-stat-cd">
            <span className="sbm-stat-label">CD</span>
            <strong>{spell.cooldown}</strong>
          </div>
        )}
      </div>

      {spell.description && (
        <p className="sbm-card-desc">{spell.description}</p>
      )}

      <div className="sbm-card-flags">
        {spell.requiresLineOfSight && (
          <span className="sbm-flag">Ligne de vue</span>
        )}
        {spell.requiresLinearTargeting && (
          <span className="sbm-flag">Ciblage linéaire</span>
        )}
      </div>
    </div>
  );
}

export function SpellBookModal({ spells, onClose }: SpellBookModalProps) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const grouped = Object.values(SpellFamily).reduce<Record<SpellFamily, SpellDefinition[]>>(
    (acc, family) => {
      acc[family] = spells.filter(s => s.family === family);
      return acc;
    },
    {} as Record<SpellFamily, SpellDefinition[]>,
  );

  return ReactDOM.createPortal(
    <div className="sbm-overlay" onClick={onClose}>
      <div className="sbm-panel ornate-frame" onClick={e => e.stopPropagation()}>
        <header className="sbm-header">
          <h2 className="sbm-title">📖 Grimoire des Sorts</h2>
          <button type="button" className="sbm-close" onClick={onClose} title="Fermer">✕</button>
        </header>

        <div className="sbm-content">
          {Object.entries(grouped).map(([family, familySpells]) => {
            if (familySpells.length === 0) return null;
            return (
              <section key={family} className="sbm-section">
                <h3 className={`sbm-section-title family-${family.toLowerCase()}`}>
                  {FAMILY_LABELS[family as SpellFamily]}
                </h3>
                <div className="sbm-grid">
                  {familySpells.map(spell => (
                    <SpellCard key={spell.id} spell={spell} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
