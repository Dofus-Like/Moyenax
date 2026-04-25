import { Text, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useState, useRef } from 'react';

import { COMBAT_COLORS } from '../../constants/colors';

interface DamagePopupProps {
  position: [number, number, number];
  value: number;
  onComplete: () => void;
}

export function DamagePopup({ position, value, onComplete }: DamagePopupProps) {
  const [progress, setProgress] = useState(0);
  const textRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (progress >= 1) {
      onComplete();
      return;
    }
    // Animation dure 1 seconde
    const next = progress + delta;
    setProgress(next);
  });

  const opacity = 1 - progress;
  const yOffset = progress * 1.5; // Monte plus haut pour la visibilité

  return (
    <Billboard position={[position[0], position[1] + yOffset, position[2]]}>
      <Text
        ref={textRef}
        fontSize={0.8}
        color={value > 0 ? COMBAT_COLORS.HP_RED : COMBAT_COLORS.HEAL_GREEN} // Rouge dégâts, vert soin
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="black"
        renderOrder={1000}
        fillOpacity={opacity}
      >
        {Math.abs(value)}
      </Text>
    </Billboard>
  );
}
