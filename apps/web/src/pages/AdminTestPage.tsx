import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { IntegrationLabPanel } from '../game/AdminTest/IntegrationLabPanel';
import { ModelViewerPanel } from '../game/AdminTest/ModelViewerPanel';
import { SfxLabPanel } from '../game/AdminTest/SfxLabPanel';
import { SkinGalleryPanel } from '../game/AdminTest/SkinGalleryPanel';
import { SpellLabPanel } from '../game/AdminTest/SpellLabPanel';
import '../game/AdminTest/AdminTest.css';

type TabId = 'sfx' | 'skins' | 'spells' | 'integration' | 'models';

interface TabDef {
  id: TabId;
  label: string;
  ready: boolean;
}

const TABS: TabDef[] = [
  { id: 'sfx', label: '🔊 SFX', ready: true },
  { id: 'skins', label: '🎭 Skins', ready: true },
  { id: 'spells', label: '✨ Sorts & VFX', ready: true },
  { id: 'integration', label: '🧩 Intégration', ready: true },
  { id: 'models', label: '🧊 Modèles 3D', ready: true },
];

function renderTab(tab: TabId) {
  if (tab === 'sfx') return <SfxLabPanel />;
  if (tab === 'skins') return <SkinGalleryPanel />;
  if (tab === 'spells') return <SpellLabPanel />;
  if (tab === 'integration') return <IntegrationLabPanel />;
  if (tab === 'models') return <ModelViewerPanel />;
  return null;
}

export function AdminTestPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('sfx');

  return (
    <div className="at-page">
      <header className="at-header">
        <div className="at-header-top">
          <h1 className="at-app-title">🛠️ Atelier de test — Admin</h1>
          <button type="button" className="at-hub-btn" onClick={() => navigate('/')}>
            ← Hub
          </button>
        </div>
        <nav className="at-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`at-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {!t.ready && <span className="at-soon">bientôt</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="at-content">{renderTab(tab)}</main>
    </div>
  );
}
