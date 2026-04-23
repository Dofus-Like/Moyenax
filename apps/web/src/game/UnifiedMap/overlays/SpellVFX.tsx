import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { ParticleTrail } from './ParticleTrail';
import { FireballParticles } from './FireballVFX';
import { COMBAT_COLORS } from '../../constants/colors';

interface SpellVFXProps {
  type: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  onComplete: () => void;
}

export function SpellVFX({ type, from, to, onComplete }: SpellVFXProps) {
  const meshRef = useRef<THREE.Group>(null);
  const kunaiMeshRef = useRef<THREE.Mesh>(null);

  // Chargement textures (optionnel pour kunai/arrow)
  const arrowTexture = useLoader(THREE.TextureLoader, '/assets/vfx/arrow.png');

  // recalage -4.5 pour correspondre au toWorld des persos (gridSize: 10)
  const startPos = useMemo(
    () => new THREE.Vector3(from.x - 4.5, 0.8, from.y - 4.5),
    [from.x, from.y],
  );
  const endPos = useMemo(() => new THREE.Vector3(to.x - 4.5, 0.8, to.y - 4.5), [to.x, to.y]);
  const [progress, setProgress] = useState(0);

  // Calcul de la rotation pour les projectiles orientés (comme l'arc)
  const rotation = useMemo(() => {
    const angle = Math.atan2(endPos.x - startPos.x, endPos.z - startPos.z);
    // On pivote de PI/2 si l'asset de base regarde vers le haut (souvent le cas)
    // Mais on va tester. D'abord on va mettre 0.
    return angle;
  }, [startPos, endPos]);

  useFrame((state, delta) => {
    if (progress >= 1) {
      onComplete();
      return;
    }

    // Sécurité anti-crash
    if (isNaN(startPos.x) || isNaN(endPos.x)) {
      onComplete();
      return;
    }

    setProgress((p) => Math.min(p + delta * 3.5, 1));
    if (meshRef.current) {
      meshRef.current.position.lerpVectors(startPos, endPos, progress);
    }

    // On fait pointer la flèche vers l'objectif (en restant face caméra)
    if (kunaiMeshRef.current && type.includes('kunai')) {
      const pStart = startPos.clone().project(state.camera);
      const pEnd = endPos.clone().project(state.camera);
      const angle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x);
      // On applique une rotation Z sur le mesh interne du Billboard
      // On utilise la valeur de calibration validée (-0.80)
      kunaiMeshRef.current.rotation.z = angle - 0.8;
    }
  });

  const isFire = type.includes('fire') || type.includes('Boule');
  const isKunai = type.includes('kunai');

  // On calcule l'angle de la flèche par rapport à la trajectoire (vision dessus simplifié)
  // Pour le Billboard, on veut une inclinaison "2D" sur l'écran.
  // Mais par défaut on va garder l'angle de rotation Y pour donner une direction.

  if (isFire || type === 'spell-frappe' || isKunai) {
    return (
      <group>
        <Billboard ref={meshRef}>
          <mesh ref={isKunai ? kunaiMeshRef : null} rotation={[0, 0, 0]}>
            {isKunai ? (
              <>
                <planeGeometry args={[2.5, 2.5]} />
                <meshBasicMaterial
                  map={arrowTexture}
                  transparent
                  alphaTest={0.5}
                  side={THREE.DoubleSide}
                />
              </>
            ) : (
              <>
                <sphereGeometry args={[isFire ? 0.35 : 0.2, 16, 16]} />
                <meshStandardMaterial
                  color={isFire ? '#ff0000' : '#94a3b8'}
                  emissive={isFire ? '#cc0000' : '#64748b'}
                  emissiveIntensity={isFire ? 8 : 2}
                />
              </>
            )}
          </mesh>

          {isFire && <pointLight color="#ff0000" intensity={5} distance={5} decay={2} />}
          {isFire && <FireballParticles count={45} />}
          {!isFire && (
            <ParticleTrail
              position={new THREE.Vector3(0, 0, 0)}
              color={isKunai ? '#ffffff' : '#cbd5e1'}
              count={isKunai ? 12 : 15}
              spread={0.2}
            />
          )}
        </Billboard>
      </group>
    );
  }

  if (type === 'spell-heal') {
    return (
      <group>
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial
            color={COMBAT_COLORS.HEAL_GREEN}
            emissive={COMBAT_COLORS.HEAL_GREEN}
            emissiveIntensity={2}
            transparent
            opacity={0.7}
          />
          <pointLight color={COMBAT_COLORS.HEAL_GREEN} intensity={1.5} distance={2} />
        </mesh>
        <ParticleTrail
          position={new THREE.Vector3(0, 0, 0)}
          color={COMBAT_COLORS.HP_RED_LIGHT}
          count={40}
          spread={0.8}
        />
      </group>
    );
  }

  return null;
}
