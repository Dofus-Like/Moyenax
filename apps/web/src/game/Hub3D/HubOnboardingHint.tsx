import type { CSSProperties, ReactElement } from 'react';

interface HubOnboardingHintProps {
  visible: boolean;
  onDismiss: () => void;
  onGoVsAi?: () => void;
}

const STYLE_TAG_ID = 'hub-onboarding-hint-styles';
const HINT_STYLES = `
.hub-onboarding-dismiss:hover { background: rgba(255,255,255,0.14) !important; border-color: rgba(255,255,255,0.28) !important; }
.hub-onboarding-vsai:hover { filter: brightness(1.12); transform: translateY(-1px); }
.hub-onboarding-dismiss:focus-visible, .hub-onboarding-vsai:focus-visible {
  outline: 2px solid rgba(250,204,21,0.65);
  outline-offset: 2px;
}
`;

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_TAG_ID;
  tag.textContent = HINT_STYLES;
  document.head.appendChild(tag);
}

const CONTAINER: CSSProperties = {
  position: 'absolute',
  bottom: '28px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  pointerEvents: 'auto',
  maxWidth: 'calc(100vw - 32px)',
};

const PANEL: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(8,12,22,0.84) 0%, rgba(14,20,36,0.80) 100%)',
  backdropFilter: 'blur(14px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
  border: '1px solid rgba(250,204,21,0.22)',
  boxShadow: '0 0 24px rgba(250,204,21,0.08), 0 8px 32px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.06)',
  borderRadius: '16px',
  padding: '14px 18px',
  color: 'white',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  width: '320px',
  maxWidth: '100%',
};

const ICON_WRAP: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  flexShrink: 0,
  marginTop: '2px',
  color: 'rgba(250,204,21,0.75)',
};

const TEXT_WRAP: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const TITLE: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 800,
  color: 'rgba(255,255,255,0.95)',
  marginBottom: '3px',
  letterSpacing: '-0.01em',
};

const BODY: CSSProperties = {
  fontSize: '0.775rem',
  color: 'rgba(255,255,255,0.6)',
  lineHeight: 1.55,
  margin: 0,
};

const ACTIONS: CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '10px',
  flexWrap: 'wrap',
};

const BTN_BASE: CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.76rem',
  fontWeight: 700,
  padding: '6px 14px',
  lineHeight: 1.4,
  transition: 'filter 140ms ease, transform 140ms ease, background 140ms ease, border-color 140ms ease',
};

const BTN_DISMISS: CSSProperties = {
  ...BTN_BASE,
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.82)',
};

const BTN_VSAI: CSSProperties = {
  ...BTN_BASE,
  background: 'linear-gradient(180deg, rgba(250,204,21,0.9) 0%, rgba(202,163,0,0.9) 100%)',
  color: 'rgba(0,0,0,0.82)',
  boxShadow: '0 2px 8px rgba(250,204,21,0.28)',
};

export function HubOnboardingHint({ visible, onDismiss, onGoVsAi }: HubOnboardingHintProps): ReactElement | null {
  ensureStyles();
  if (!visible) return null;

  return (
    <div style={CONTAINER}>
      <div style={PANEL} role="region" aria-label="Aide de démarrage">
        <span aria-hidden style={ICON_WRAP}>✦</span>
        <div style={TEXT_WRAP}>
          <div style={TITLE}>Bienvenue dans le hub</div>
          <p style={BODY}>
            Clique sur un lieu pour interagir.<br />
            VS AI est idéal pour tester un combat.
          </p>
          <div style={ACTIONS}>
            {onGoVsAi && (
              <button
                type="button"
                className="hub-onboarding-vsai"
                style={BTN_VSAI}
                onClick={onGoVsAi}
                aria-label="Commencer par VS AI"
              >
                🤖 Commencer par VS AI
              </button>
            )}
            <button
              type="button"
              className="hub-onboarding-dismiss"
              style={BTN_DISMISS}
              onClick={onDismiss}
              aria-label="J'ai compris, fermer ce message"
            >
              J'ai compris
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
