import type { CSSProperties, ReactElement } from 'react';

interface HubOnboardingHintProps {
  visible: boolean;
  onDismiss: () => void;
  onGoVsAi?: () => void;
}

const STYLE_TAG_ID = 'hub-onboarding-hint-styles';
const HINT_STYLES = `
@keyframes hub-onboarding-enter {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
@keyframes hub-onboarding-beacon {
  0%, 100% { opacity: 0.55; transform: scale(1);    box-shadow: 0 0 8px  rgba(56,189,248,0.7); }
  50%       { opacity: 1;    transform: scale(1.45); box-shadow: 0 0 18px rgba(56,189,248,1);   }
}
.hub-onboarding-card {
  animation: hub-onboarding-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.hub-onboarding-card::before {
  content: '';
  position: absolute;
  top: 0; left: 16px; right: 16px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(56,189,248,0.55), rgba(129,140,248,0.5), transparent);
  pointer-events: none;
}
.hub-onboarding-card::after {
  content: '';
  position: absolute;
  top: -5px; right: 20px;
  width: 9px; height: 9px; border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px rgba(56,189,248,0.7);
  animation: hub-onboarding-beacon 2.4s ease-in-out infinite;
}
.hub-onboarding-cta {
  position: relative;
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; margin-top: 16px;
  padding: 13px 22px;
  border: none; border-radius: 14px; cursor: pointer; overflow: hidden; isolation: isolate;
  font-family: inherit; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.02em;
  color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.4);
  background: linear-gradient(180deg, #7c3aed 0%, #4c1d95 100%);
  box-shadow: 0 6px 24px rgba(124,58,237,0.52), inset 0 1px 0 rgba(255,255,255,0.22);
  transition: transform 160ms ease, box-shadow 200ms ease, filter 160ms ease;
}
.hub-onboarding-cta::before {
  content: '';
  position: absolute; inset: 1px; border-radius: inherit;
  background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 52%);
  pointer-events: none;
}
.hub-onboarding-cta:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow: 0 12px 34px rgba(124,58,237,0.68), 0 2px 10px rgba(129,140,248,0.38), inset 0 1px 0 rgba(255,255,255,0.26);
}
.hub-onboarding-cta:active { transform: translateY(0); filter: brightness(0.94); }
.hub-onboarding-secondary {
  display: block; width: 100%; margin-top: 8px;
  padding: 10px 22px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.11);
  border-radius: 14px; cursor: pointer;
  font-family: inherit; font-size: 0.8rem; font-weight: 600;
  color: rgba(255,255,255,0.46);
  text-align: center;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.hub-onboarding-secondary:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.22);
  color: rgba(255,255,255,0.84);
}
.hub-onboarding-cta:focus-visible, .hub-onboarding-secondary:focus-visible {
  outline: 2px solid rgba(124,58,237,0.75);
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
  bottom: '32px',
  left: '28px',
  zIndex: 10,
  pointerEvents: 'none',
  maxWidth: 'calc(100% - 56px)',
};

const CARD: CSSProperties = {
  position: 'relative',
  width: '380px',
  maxWidth: '100%',
  background: [
    'radial-gradient(ellipse at 25% -15%, rgba(99,102,241,0.12) 0%, transparent 58%)',
    'linear-gradient(180deg, rgba(12,16,30,0.97) 0%, rgba(7,11,21,0.98) 100%)',
  ].join(', '),
  backdropFilter: 'blur(22px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
  border: '1px solid rgba(99,102,241,0.32)',
  boxShadow: [
    '0 0 0 1px rgba(56,189,248,0.06)',
    '0 28px 64px rgba(0,0,0,0.65)',
    'inset 0 1px 0 rgba(255,255,255,0.05)',
  ].join(', '),
  borderRadius: '18px',
  padding: '18px 22px 20px',
  pointerEvents: 'auto',
  color: 'white',
  fontFamily: 'system-ui, sans-serif',
};

const GUIDE_BADGE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '2px 9px 2px 7px',
  borderRadius: '999px',
  border: '1px solid rgba(56,189,248,0.30)',
  fontSize: '0.59rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(56,189,248,0.80)',
  background: 'rgba(56,189,248,0.06)',
  marginBottom: '10px',
};

const DOT: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: 'rgba(56,189,248,0.70)',
  flexShrink: 0,
};

const TITLE_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  margin: 0,
};

const TITLE_STAR: CSSProperties = {
  fontSize: '0.75rem',
  color: '#38bdf8',
  flexShrink: 0,
  lineHeight: 1,
  marginTop: '1px',
};

const TITLE_TEXT: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 800,
  color: '#f1f5f9',
  letterSpacing: '-0.02em',
  textShadow: '0 0 28px rgba(99,102,241,0.5)',
  margin: 0,
};

const DIVIDER: CSSProperties = {
  height: '1px',
  background: 'linear-gradient(90deg, rgba(99,102,241,0.32), rgba(56,189,248,0.18), rgba(99,102,241,0.32))',
  margin: '11px 0 12px',
};

const BODY: CSSProperties = {
  fontSize: '0.82rem',
  color: 'rgba(255,255,255,0.54)',
  lineHeight: 1.62,
  margin: 0,
};

function CardCorner(): ReactElement {
  return (
    <svg
      aria-hidden
      width="26"
      height="26"
      viewBox="0 0 52 52"
      fill="none"
      style={{ position: 'absolute', top: 10, left: 12, opacity: 0.30, pointerEvents: 'none' }}
    >
      <path d="M3 49V13C3 7.477 7.477 3 13 3H49" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 43V15C9 11.686 11.686 9 15 9H43" stroke="#818cf8" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function HubOnboardingHint({ visible, onDismiss, onGoVsAi }: HubOnboardingHintProps): ReactElement | null {
  ensureStyles();
  if (!visible) return null;

  return (
    <div style={OUTER}>
      <div className="hub-onboarding-card" style={CARD} role="region" aria-label="Guide de démarrage">
        <CardCorner />
        <div style={GUIDE_BADGE}>
          <span aria-hidden style={DOT} />
          Guide
        </div>
        <h3 style={TITLE_ROW}>
          <span aria-hidden style={TITLE_STAR}>✦</span>
          <span style={TITLE_TEXT}>Première aventure</span>
        </h3>
        <div aria-hidden style={DIVIDER} />
        <p style={BODY}>Lance un combat contre l'IA pour découvrir les bases.</p>
        {onGoVsAi && (
          <button type="button" className="hub-onboarding-cta" onClick={onGoVsAi} aria-label="Commencer avec VS AI">
            <span aria-hidden>◈</span>
            Commencer avec VS AI
          </button>
        )}
        <button type="button" className="hub-onboarding-secondary" onClick={onDismiss} aria-label="Plus tard, fermer le guide">
          Plus tard
        </button>
      </div>
    </div>
  );
}
