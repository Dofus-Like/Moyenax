import type { CSSProperties, ReactElement } from 'react';

import { OnboardingBadgeGuideIcon } from '../../assets/icons/hub3d/HubIcons';

interface HubOnboardingHintProps {
  visible: boolean;
  onDismiss: () => void;
  onGoVsAi?: () => void;
}

const STYLE_TAG_ID = 'hub-onboarding-hint-styles';
const HINT_STYLES = `
@keyframes hub-onboarding-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
.hub-onboarding-card {
  animation: hub-onboarding-enter 280ms ease-out both;
}
.hub-onboarding-btn-primary {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 11px 20px; margin-top: 14px;
  border: 2px solid #fca800; outline: 1.5px solid rgba(0,0,0,0.85); border-radius: 6px; cursor: pointer;
  font-family: var(--font-hud); font-size: 0.85rem; font-weight: 400; letter-spacing: 0.05em; text-transform: uppercase;
  color: #fff;
  text-shadow: -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 -1.5px 0 #000, 0 1.5px 0 #000, -1.5px 0 0 #000, 1.5px 0 0 #000;
  background: rgba(0,0,0,0.55);
  box-shadow: 0 0 16px rgba(252,168,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.75), inset 0 0 20px rgba(0,0,0,0.55);
  transition: filter 140ms ease, transform 120ms ease, box-shadow 140ms ease, background 140ms ease;
}
.hub-onboarding-btn-primary:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.08);
  box-shadow: 0 0 26px rgba(252,168,0,0.8), inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 0 20px rgba(0,0,0,0.5);
}
.hub-onboarding-btn-primary:active {
  filter: brightness(0.94);
  transform: translateY(0);
}
.hub-onboarding-btn-primary:focus-visible {
  outline: 2px solid #fca800;
  outline-offset: 2px;
}
.hub-onboarding-btn-secondary {
  display: flex; align-items: center; justify-content: center;
  width: 100%; padding: 10px 20px; margin-top: 8px;
  border: 2px solid rgba(255,255,255,0.4); outline: 1.5px solid rgba(0,0,0,0.85); border-radius: 6px; cursor: pointer;
  font-family: var(--font-hud); font-size: 0.78rem; font-weight: 400; letter-spacing: 0.04em; text-transform: uppercase;
  color: rgba(255,255,255,0.6);
  background: rgba(0,0,0,0.55);
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
}
.hub-onboarding-btn-secondary:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.85);
  color: #fff;
}
.hub-onboarding-btn-secondary:active { background: rgba(255,255,255,0.05); }
.hub-onboarding-btn-secondary:focus-visible {
  outline: 2px solid rgba(255,255,255,0.6);
  outline-offset: 2px;
}
@media (max-width: 480px) {
  .hub-onboarding-outer {
    left: 12px !important;
    bottom: 16px !important;
    max-width: calc(100% - 24px) !important;
  }
  .hub-onboarding-card {
    width: 100% !important;
    max-width: 320px !important;
    padding: 14px 16px 16px !important;
  }
  .hub-onboarding-btn-primary { padding: 10px 16px !important; font-size: 0.84rem !important; }
  .hub-onboarding-btn-secondary { padding: 9px 16px !important; font-size: 0.78rem !important; }
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

const OUTER: CSSProperties = {
  position: 'absolute',
  bottom: '28px',
  left: '24px',
  zIndex: 10,
  pointerEvents: 'none',
  maxWidth: 'calc(100% - 48px)',
};

const CARD: CSSProperties = {
  width: '300px',
  maxWidth: '100%',
  padding: '16px 18px 18px',
  borderRadius: '6px',
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  border: '2px solid rgba(255,255,255,0.9)',
  outline: '1.5px solid rgba(0,0,0,0.85)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.75), inset 0 0 40px rgba(0,0,0,0.65)',
  pointerEvents: 'auto',
  color: 'white',
  fontFamily: 'var(--font-hud)',
};

const GUIDE_LABEL: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  marginBottom: '8px',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '0.63rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(103,210,255,0.82)',
  background: 'rgba(6,182,212,0.1)',
  border: '1px solid rgba(6,182,212,0.2)',
};

const TITLE: CSSProperties = {
  margin: '0 0 6px',
  fontSize: '1rem',
  fontWeight: 400,
  color: '#ffffff',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  textShadow:
    '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 -2px 0 #000, 0 2px 0 #000, -2px 0 0 #000, 2px 0 0 #000',
};

const BODY: CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  color: 'rgba(255,255,255,0.62)',
  lineHeight: 1.55,
};

export function HubOnboardingHint({ visible, onDismiss, onGoVsAi }: HubOnboardingHintProps): ReactElement | null {
  ensureStyles();
  if (!visible) return null;

  return (
    <div className="hub-onboarding-outer" style={OUTER}>
      <div className="hub-onboarding-card" style={CARD} role="region" aria-label="Guide de démarrage">
        <div style={GUIDE_LABEL}>
          <OnboardingBadgeGuideIcon size={10} style={{ color: 'rgba(103,210,255,0.82)' }} />
          Guide
        </div>
        <h3 style={TITLE}>Première aventure</h3>
        <p style={BODY}>Lance un combat contre l&apos;IA pour découvrir les bases.</p>
        {onGoVsAi && (
          <button
            type="button"
            className="hub-onboarding-btn-primary"
            onClick={onGoVsAi}
            aria-label="Commencer avec VS AI"
          >
            Commencer avec VS AI
          </button>
        )}
        <button
          type="button"
          className="hub-onboarding-btn-secondary"
          onClick={onDismiss}
          aria-label="Plus tard, fermer le guide"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
