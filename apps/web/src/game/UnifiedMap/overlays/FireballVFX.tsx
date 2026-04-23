import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FireballParticlesProps {
  count?: number;
}

export function FireballParticles({ count = 40 }: FireballParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // On prépare les données des particules (vitesse, taille, vie)
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 10 + Math.random() * 10;
      const speed = 0.01 + Math.random() * 0.02;
      const xFactor = -0.5 + Math.random();
      const yFactor = -0.5 + Math.random();
      const zFactor = -0.5 + Math.random();
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0, mz: 0 });
    }
    return temp;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;

    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor } = particle;

      // On fait avancer le temps de la particule
      t = particle.t += speed / 2;
      const a = Math.cos(t) + Math.sin(t * 1) / 10;
      const b = Math.sin(t) + Math.cos(t * 2) / 10;
      const s = Math.cos(t);

      // Mouvement en spirale derrière la boule
      particle.mx += xFactor * a * 0.05;
      particle.my += yFactor * b * 0.05;
      particle.mz += zFactor * s * 0.05;

      dummy.position.set(particle.mx, particle.my, particle.mz);
      dummy.scale.set(s, s, s);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();

      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial
        color="#ff4d00"
        emissive="#ffcc00"
        emissiveIntensity={4}
        transparent
        opacity={0.6}
      />
    </instancedMesh>
  );
}
