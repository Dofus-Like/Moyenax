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
  background: '#07101f',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
  fontFamily: 'system-ui, sans-serif',
  userSelect: 'none',
  transition: 'opacity 400ms ease',
};


const TEXT: CSSProperties = {
  color: 'rgba(255,255,255,0.78)',
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textShadow: '0 0 24px rgba(96,140,220,0.55)',
};

const SLOW_TEXT: CSSProperties = {
  ...TEXT,
  color: 'rgba(255,200,100,0.85)',
  textShadow: '0 0 24px rgba(255,180,60,0.4)',
  fontSize: 13,
};

const ERROR_TEXT: CSSProperties = {
  ...TEXT,
  color: 'rgba(239,68,68,0.85)',
  textShadow: '0 0 24px rgba(239,68,68,0.4)',
};

const RETRY_BTN: CSSProperties = {
  marginTop: 4,
  padding: '7px 20px',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 6,
  color: 'rgba(255,255,255,0.75)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.06em',
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
