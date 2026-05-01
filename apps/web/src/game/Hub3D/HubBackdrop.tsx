import type { CSSProperties, ReactElement } from 'react';

const SKY_URL = '/backgrounds/hub-sky.png';

if (typeof window !== 'undefined') {
  const _preloadSky = new window.Image();
  _preloadSky.src = SKY_URL;
}

const WRAPPER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  backgroundColor: '#07101f',
};

const IMAGE_STYLE: CSSProperties = {
  position: 'absolute',
  inset: '-2%',
  backgroundImage: `url('${SKY_URL}')`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  filter: 'blur(2px) saturate(0.92) brightness(0.78)',
  transform: 'scale(1.04)',
};

const OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: [
    'radial-gradient(ellipse at 50% 38%, rgba(96,140,220,0.18), transparent 55%)',
    'linear-gradient(180deg, rgba(10,16,36,0.45) 0%, rgba(8,12,28,0.55) 60%, rgba(4,7,20,0.78) 100%)',
    'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(2,4,12,0.65) 100%)',
  ].join(', '),
};

export function HubBackdrop(): ReactElement {
  return (
    <div aria-hidden style={WRAPPER_STYLE}>
      <div style={IMAGE_STYLE} />
      <div style={OVERLAY_STYLE} />
    </div>
  );
}
