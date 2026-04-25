import { Canvas } from '@react-three/fiber';
import React from 'react';

import { CombatBackgroundShader } from '../game/Combat/CombatBackgroundShader';

export function GlobalBackground() {
  return (
    <div 
      className="global-background-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        background: '#0f172a',
        overflow: 'hidden'
      }}
    >
      <Canvas
        camera={{ fov: 30, position: [0, 0, 5] }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance'
        }}
        dpr={[1, 2]}
      >
        <CombatBackgroundShader />
      </Canvas>
    </div>
  );
}
