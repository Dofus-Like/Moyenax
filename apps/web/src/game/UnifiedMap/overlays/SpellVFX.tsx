import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleTrail } from './ParticleTrail';

interface SpellVFXProps {
  type: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  onComplete: () => void;
}

export function SpellVFX({ type, from, to, onComplete }: SpellVFXProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startPos = new THREE.Vector3(from.x, 1, from.y);
  const endPos = new THREE.Vector3(to.x, 1, to.y);
  const [progress, setProgress] = useState(0);

  useFrame((_, delta) => {
    if (progress >= 1) {
      onComplete();
      return;
    }
    setProgress((p) => Math.min(p + delta * 2.5, 1));
    if (meshRef.current) {
      meshRef.current.position.lerpVectors(startPos, endPos, progress);
      if (type === 'Épée' || type === 'spell-frappe') {
        meshRef.current.rotation.z = progress * Math.PI * 2;
      }
    }
  });

  if (type === 'Boule de Feu' || type === 'spell-fireball') {
    return (
      <group>
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={2} />
          <pointLight color="#f97316" intensity={2} distance={3} />
        </mesh>
        {meshRef.current && (
          <ParticleTrail position={meshRef.current.position} color="#f97316" count={30} spread={0.6} />
        )}
      </group>
    );
  }

  if (type === 'spell-heal') {
    return (
      <group>
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#16a34a"
            emissiveIntensity={2}
            transparent
            opacity={0.7}
          />
          <pointLight color="#22c55e" intensity={1.5} distance={2} />
        </mesh>
        {meshRef.current && (
          <ParticleTrail position={meshRef.current.position} color="#86efac" count={40} spread={0.8} />
        )}
      </group>
    );
  }

  return (
    <group>
      <mesh ref={meshRef}>
        <boxGeometry args={[0.1, 0.8, 0.2]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#94a3b8" />
      </mesh>
      {meshRef.current && (
        <ParticleTrail position={meshRef.current.position} color="#cbd5e1" count={15} spread={0.3} />
      )}
    </group>
  );
}
