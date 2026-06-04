import type { CSSProperties } from 'react';

import { getSkinById } from '../constants/skins';

// Les feuilles idle.png font 600×100 = 6 frames de 100px. On affiche la 1re frame,
// mise à l'échelle de la vignette, teintée par hue/saturation du skin.
const IDLE_FRAMES = 6;

export function SkinThumb({ skinId, size = 48 }: { skinId: string; size?: number }) {
  const skin = getSkinById(skinId);
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url(/assets/sprites/${skin.type}/idle.png)`,
    backgroundSize: `${size * IDLE_FRAMES}px ${size}px`,
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    filter: `hue-rotate(${skin.hue}deg) saturate(${skin.saturation})`,
  };
  return <div className="at-skin-thumb" style={style} aria-hidden="true" />;
}
