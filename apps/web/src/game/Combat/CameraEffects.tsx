import { useFrame, useThree } from '@react-three/fiber';
import type CameraControls from 'camera-controls';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { useCombatStore } from '../../store/combat.store';

interface CameraEffectsProps {
  controlsRef: React.RefObject<CameraControls | null>;
}

export function CameraEffects({ controlsRef }: CameraEffectsProps) {
  const { camera } = useThree();
  const combatState = useCombatStore((s) => s.combatState);
  const lastDamageEvent = useCombatStore((s) => s.lastDamageEvent);
  const lastSpellCast = useCombatStore((s) => s.lastSpellCast);
  
  // State for shake
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const shakeDecay = 0.9; // Fast decay
  const lastUserInteractionRef = useRef(0);
  
  // Refs to avoid processed events
  const lastProcessedDamageTime = useRef(0);
  const lastProcessedSpellTime = useRef(0);
  const lastTurnPlayerId = useRef<string | null>(null);

  // Monitor user interaction to avoid fighting the camera
  useEffect(() => {
    const handleInteraction = () => {
      lastUserInteractionRef.current = Date.now();
    };
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('wheel', handleInteraction);
    return () => {
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('wheel', handleInteraction);
    };
  }, []);

  // 1. Shake Triggers
  useEffect(() => {
    if (!lastDamageEvent || lastDamageEvent.timestamp === lastProcessedDamageTime.current) return;
    lastProcessedDamageTime.current = lastDamageEvent.timestamp;
    
    // Strong shake for damage
    setShakeIntensity((prev) => Math.min(prev + 0.4, 0.8));
  }, [lastDamageEvent]);

  useEffect(() => {
    if (!lastSpellCast || lastSpellCast.timestamp === lastProcessedSpellTime.current) return;
    lastProcessedSpellTime.current = lastSpellCast.timestamp;
    
    // Light shake for spell cast
    setShakeIntensity((prev) => Math.min(prev + 0.15, 0.3));

    // Optional: Nudge camera towards target
    if (controlsRef.current && Date.now() - lastUserInteractionRef.current > 2000) {
      const targetX = lastSpellCast.targetX - (combatState?.map?.width || 10) / 2 + 0.5;
      const targetY = lastSpellCast.targetY - (combatState?.map?.height || 10) / 2 + 0.5;
      
      // Subtle nudge
      const currentPos = new THREE.Vector3();
      controlsRef.current.getTarget(currentPos);
      const nudgeX = (targetX + currentPos.x) / 2;
      const nudgeZ = (targetY + currentPos.z) / 2;
      
      controlsRef.current.setLookAt(
        camera.position.x + (nudgeX - currentPos.x) * 0.2,
        camera.position.y,
        camera.position.z + (nudgeZ - currentPos.z) * 0.2,
        nudgeX,
        0,
        nudgeZ,
        true
      );
    }
  }, [lastSpellCast, combatState, camera, controlsRef]);

  // 2. Auto-Focus on Turn Change
  useEffect(() => {
    if (!combatState || !controlsRef.current) return;
    if (combatState.currentTurnPlayerId === lastTurnPlayerId.current) return;
    
    const prevPlayerId = lastTurnPlayerId.current;
    lastTurnPlayerId.current = combatState.currentTurnPlayerId;

    // Only auto-focus if turn actually changed and user hasn't touched the camera recently
    if (prevPlayerId && Date.now() - lastUserInteractionRef.current > 3000) {
      const activePlayer = combatState.players[combatState.currentTurnPlayerId];
      if (activePlayer) {
        const targetX = activePlayer.position.x - combatState.map.width / 2 + 0.5;
        const targetZ = activePlayer.position.y - combatState.map.height / 2 + 0.5;
        
        // Find center between current view and player for a smoother "feel"
        // or just center on player
        controlsRef.current.setLookAt(
          targetX + 10, 10, targetZ + 10, // Offset for orthographic angle
          targetX, 0, targetZ,
          true
        );
      }
    }
  }, [combatState, controlsRef]);

  // 3. Shake Animation Frame
  useFrame(() => {
    if (shakeIntensity > 0.01) {
      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;
      const shakeZ = (Math.random() - 0.5) * shakeIntensity;
      
      camera.position.x += shakeX;
      camera.position.y += shakeY;
      camera.position.z += shakeZ;
      
      setShakeIntensity((prev) => prev * shakeDecay);
    }
  });

  return null;
}
