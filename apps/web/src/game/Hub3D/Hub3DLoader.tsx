import type { CSSProperties, ReactElement } from 'react';

import { SpinnerRuneIcon } from '../../assets/icons/hub3d/HubIcons';

export type Hub3DLoaderState = 'loading' | 'slow' | 'error' | 'done';

function getMessage(state: Hub3DLoaderState): string {
  if (state === 'slow') return 'Chargement plus long que prévu…';
  if (state === 'error') return 'Erreur de chargement du royaume';
  return 'Chargement du royaume…';
}

function getTextStyle(state: Hub3DLoaderState): CSSProperties {
  if (state === 'slow') return SLOW_TEXT;
  if (state === 'error') return ERROR_TEXT;
  return TEXT;
}

const WRAPPER: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 100,
  background: '#0f172a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
  fontFamily: 'var(--font-hud)',
  userSelect: 'none',
  transition: 'opacity 400ms ease',
};

const PIXEL_OUTLINE =
  '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 -2px 0 #000, 0 2px 0 #000, -2px 0 0 #000, 2px 0 0 #000';

const TEXT: CSSProperties = {
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 400,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textShadow: PIXEL_OUTLINE,
};

const SLOW_TEXT: CSSProperties = {
  ...TEXT,
  color: '#fca800',
  fontSize: 13,
};

const ERROR_TEXT: CSSProperties = {
  ...TEXT,
  color: '#ef4444',
};

const RETRY_BTN: CSSProperties = {
  marginTop: 4,
  padding: '8px 20px',
  background: 'rgba(0,0,0,0.55)',
  border: '2px solid rgba(255,255,255,0.4)',
  outline: '1.5px solid rgba(0,0,0,0.85)',
  borderRadius: 6,
  color: '#fff',
  fontSize: 12,
  fontWeight: 400,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-hud)',
  cursor: 'pointer',
};

interface Hub3DLoaderProps {
  state: Hub3DLoaderState;
}

export function Hub3DLoader({ state }: Hub3DLoaderProps): ReactElement {
  const visible = state !== 'done';
  return (
    <div
      aria-hidden={!visible}
      style={{ ...WRAPPER, opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      {state !== 'error' && <SpinnerRuneIcon size={40} style={{ color: 'rgba(96,140,220,0.9)' }} />}
      <span style={getTextStyle(state)}>{getMessage(state)}</span>
      {(state === 'slow' || state === 'error') && (
        <button type="button" style={RETRY_BTN} onClick={() => window.location.reload()}>
          Réessayer
        </button>
      )}
    </div>
  );
}
