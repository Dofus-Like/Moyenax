import React, { useState, useEffect } from 'react';
import { Text } from '@react-three/drei';

interface DamagePopupProps {
  position: [number, number, number];
  value: number;
  onComplete: () => void;
}

export function DamagePopup({ position, value, onComplete }: DamagePopupProps) {
  const [opacity, setOpacity] = useState(1);
  const [yOffset, setYOffset] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = elapsed / duration;

      if (progress >= 1) {
        clearInterval(interval);
        onComplete();
      } else {
        setOpacity(1 - progress);
        setYOffset(progress * 1);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <Text
      position={[position[0], position[1] + 1.5 + yOffset, position[2]]}
      fontSize={0.5}
      color="#ef4444"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.04}
      outlineColor="black"
    >
      {value}
      <meshStandardMaterial opacity={opacity} transparent />
    </Text>
  );
}
