import { Sky, Stars } from '@react-three/drei';
import { type ReactElement, useMemo } from 'react';
import { Vector3 } from 'three';

import { useEditorStore } from '../../store/editor.store';

import { SKY_PRESETS } from './skyPresets';

const SUN_DISTANCE = 30;

export function EditorSky(): ReactElement {
  const ambiance = useEditorStore((s) => s.template.ambiance);
  const preset = SKY_PRESETS[ambiance.timeOfDay];

  const sunDir = useMemo(
    () => new Vector3(...preset.sunPosition).normalize().multiplyScalar(SUN_DISTANCE),
    [preset.sunPosition],
  );

  return (
    <>
      <color attach="background" args={[preset.background]} />
      <Sky
        sunPosition={preset.sunPosition}
        turbidity={preset.turbidity}
        rayleigh={preset.rayleigh}
        mieCoefficient={preset.mieCoefficient}
        mieDirectionalG={preset.mieDirectionalG}
      />
      {preset.stars && <Stars radius={120} depth={50} count={1500} factor={4} fade />}
      <ambientLight intensity={ambiance.ambientIntensity} />
      <hemisphereLight args={['#bcd7ff', '#3a2a1a', ambiance.ambientIntensity * 0.6]} />
      <directionalLight
        position={[sunDir.x, Math.max(sunDir.y, 4), sunDir.z]}
        intensity={ambiance.directionalIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
    </>
  );
}
