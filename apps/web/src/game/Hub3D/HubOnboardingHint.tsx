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
  border: none; border-radius: 10px; cursor: pointer;
  font-family: inherit; font-size: 0.875rem; font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #a855f7 100%);
  box-shadow: 0 4px 16px rgba(124,58,237,0.32);
  transition: filter 140ms ease, transform 120ms ease, box-shadow 140ms ease;
  outline: none;
}
.hub-onboarding-btn-primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 6px 22px rgba(124,58,237,0.48);
}
.hub-onboarding-btn-primary:active {
  filter: brightness(0.94);
  transform: translateY(0);
}
.hub-onboarding-btn-primary:focus-visible {
  outline: 2px solid rgba(124,58,237,0.75);
  outline-offset: 3px;
}
.hub-onboarding-btn-secondary {
  display: flex; align-items: center; justify-content: center;
  width: 100%; padding: 10px 20px; margin-top: 8px;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; cursor: pointer;
  font-family: inherit; font-size: 0.82rem; font-weight: 500;
  color: rgba(255,255,255,0.48);
  background: rgba(255,255,255,0.04);
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
  outline: none;
}
.hub-onboarding-btn-secondary:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.22);
  color: rgba(255,255,255,0.78);
}
.hub-onboarding-btn-secondary:active { background: rgba(255,255,255,0.05); }
.hub-onboarding-btn-secondary:focus-visible {
  outline: 2px solid rgba(99,102,241,0.75);
  outline-offset: 3px;
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
  borderRadius: '14px',
  background: 'rgba(8,14,28,0.88)',
  backdropFilter: 'blur(16px) saturate(1.3)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
  border: '1px solid rgba(99,102,241,0.22)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
  pointerEvents: 'auto',
  color: 'white',
  fontFamily: 'system-ui, sans-serif',
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
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#f1f5f9',
  letterSpacing: '-0.01em',
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
    <div style={OUTER}>
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
