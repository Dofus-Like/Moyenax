import { useMemo, useState } from 'react';

import {
  playSfx,
  previewSfxString,
  SFX_NAMES,
  type SfxName,
  SPELL_CAST_SFX,
  setSfxMuted,
} from '../../utils/sfx';

import './AdminTest.css';

interface SfxGroupDef {
  label: string;
  names: SfxName[];
}

const GROUPS: SfxGroupDef[] = [
  {
    label: 'UI',
    names: [
      'uiClick',
      'uiHover',
      'uiOpenPanel',
      'uiClosePanel',
      'uiConfirm',
      'uiCancel',
      'uiError',
      'notification',
    ],
  },
  { label: 'Déplacements', names: ['footstepA', 'footstepB'] },
  { label: 'Hub', names: ['hubMove', 'hubPoiEnter', 'hubChatMessage'] },
  {
    label: 'Combat',
    names: [
      'combatStart',
      'turnStart',
      'turnPass',
      'spellHover',
      'spellSelect',
      'spellCast',
      'damageDealt',
      'damageTaken',
      'heal',
      'death',
      'victory',
      'defeat',
    ],
  },
  {
    label: 'Sorts',
    names: [
      'castFireball',
      'castSlash',
      'castSlap',
      'castKunai',
      'castBomb',
      'castHeal',
      'castEndurance',
      'castVelocite',
      'castLeap',
      'castMenhir',
    ],
  },
  {
    label: 'Récolte',
    names: [
      'harvestStart',
      'harvestComplete',
      'harvestWood',
      'harvestIron',
      'harvestCrystal',
      'harvestLeather',
      'harvestFabric',
      'harvestHerb',
      'harvestGold',
    ],
  },
  {
    label: 'Économie / Craft',
    names: ['itemEquip', 'itemPickup', 'coinGain', 'craftSuccess', 'craftFail', 'levelUp'],
  },
];

function matchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || name.toLowerCase().includes(q);
}

function buildGroups(query: string): SfxGroupDef[] {
  const known = new Set(GROUPS.flatMap((g) => g.names));
  const others = SFX_NAMES.filter((n) => !known.has(n));
  const all = others.length > 0 ? [...GROUPS, { label: 'Autres', names: others }] : GROUPS;
  return all
    .map((g) => ({ label: g.label, names: g.names.filter((n) => matchesQuery(n, query)) }))
    .filter((g) => g.names.length > 0);
}

function SfxButton({ name }: { name: SfxName }) {
  return (
    <button type="button" className="at-sfx-btn" onClick={() => playSfx(name)} title={name}>
      <span className="at-sfx-play">▶</span>
      {name}
    </button>
  );
}

function CatalogSection() {
  const [query, setQuery] = useState('');
  const [muted, setMuted] = useState(false);
  const groups = useMemo(() => buildGroups(query), [query]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSfxMuted(next);
  };

  return (
    <section className="at-panel">
      <div className="at-toolbar">
        <h2 className="at-title">🔊 SFX Lab</h2>
        <input
          className="at-search"
          type="text"
          placeholder="Filtrer un son…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className={`at-toggle${muted ? ' is-on' : ''}`} onClick={toggleMute}>
          {muted ? '🔇 Muet' : '🔊 Muet'}
        </button>
      </div>
      <p className="at-hint">
        {SFX_NAMES.length} sons au catalogue. Clique pour écouter ; le bouton « Muet » applique le
        réglage global.
      </p>
      {groups.map((group) => (
        <div key={group.label} className="at-group">
          <p className="at-group-label">{group.label}</p>
          <div className="at-sfx-grid">
            {group.names.map((name) => (
              <SfxButton key={name} name={name} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

type PreviewStatus = 'idle' | 'ok' | 'error';

const PREVIEW_LABEL: Record<PreviewStatus, string> = {
  idle: '',
  ok: '✓ son joué',
  error: '✕ chaîne invalide',
};

function PreviewSection() {
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('idle');

  const testDraft = () => setStatus(previewSfxString(draft) ? 'ok' : 'error');

  return (
    <section className="at-panel at-preview">
      <h2 className="at-title">🧪 Tester une chaîne sfxr</h2>
      <p className="at-hint">
        Colle une chaîne base58 (ou un nom de preset : explosion, powerUp, hitHurt…) pour l'écouter
        avant de l'intégrer au catalogue.
      </p>
      <textarea
        className="at-preview-input"
        placeholder="ex. : 11111mqKRconoRwXjTTz… ou « explosion »"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus('idle');
        }}
      />
      <div className="at-preview-row">
        <button type="button" className="at-toggle" onClick={testDraft}>
          ▶ Tester
        </button>
        {status !== 'idle' && (
          <span className={`at-preview-status is-${status === 'ok' ? 'ok' : 'error'}`}>
            {PREVIEW_LABEL[status]}
          </span>
        )}
      </div>
    </section>
  );
}

function MappingSection() {
  return (
    <section className="at-panel">
      <h2 className="at-title">🪄 Mapping sort → son</h2>
      <p className="at-hint">Son de lancement par code de sort (fallback : « spellCast »).</p>
      <div className="at-map-list">
        {Object.entries(SPELL_CAST_SFX).map(([spellCode, sfxName]) => (
          <div key={spellCode} className="at-map-row">
            <span className="at-map-spell">{spellCode}</span>
            <button
              type="button"
              className="at-map-sfx"
              onClick={() => playSfx(sfxName)}
              title={sfxName}
            >
              ▶ {sfxName}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SfxLabPanel() {
  return (
    <>
      <CatalogSection />
      <PreviewSection />
      <MappingSection />
    </>
  );
}
