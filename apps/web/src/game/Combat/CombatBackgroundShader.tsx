import { useFrame, useThree } from '@react-three/fiber';
import { useControls, button, folder } from 'leva';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { createSceneMetricRecorder, isSceneDebugEnabled } from '../../perf/scene-metric-recorder';
import { COMBAT_COLORS } from '../constants/colors';

import fragmentShader from './background.frag?raw';
import vertexShader from './background.vert?raw';

interface CombatBackgroundShaderProps {
  timeOfDay: number;
}

export function CombatBackgroundShader({ timeOfDay }: CombatBackgroundShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const recordShaderUpdate = useMemo(
    () => createSceneMetricRecorder('CombatBackgroundShader:uniform-update', 2),
    [],
  );

  const config = useControls('Background Shader', {
    'Sky Colors': folder({
      dayA: { value: COMBAT_COLORS.SHADER_BG_A },
      dayB: { value: COMBAT_COLORS.SHADER_BG_B },
      dayC: { value: COMBAT_COLORS.SHADER_BG_C },
      sunA: { value: COMBAT_COLORS.SHADER_SUNSET_A },
      sunB: { value: COMBAT_COLORS.SHADER_SUNSET_B },
      sunC: { value: COMBAT_COLORS.SHADER_SUNSET_C },
      nightA: { value: '#000000' },
      nightB: { value: '#000000' },
      nightC: { value: '#ffffff' },
      speed: { value: 1.0, min: 0, max: 2, label: 'Noise Speed' },
      scale: { value: 1.0, min: 0.1, max: 10 },
      opacity: { value: 1.0, min: 0, max: 1 },
      visible: true,
    }),
    'Log for AI': button((_get) => {
      // Debug button - intentionally unused for now
    }),
  });

  const uniforms = useRef({
    uTime: { value: 0 },
    uPhase: { value: 0.5 },
    uDayA: { value: new THREE.Color(config.dayA) },
    uDayB: { value: new THREE.Color(config.dayB) },
    uDayC: { value: new THREE.Color(config.dayC) },
    uNightA: { value: new THREE.Color(config.nightA) },
    uNightB: { value: new THREE.Color(config.nightB) },
    uNightC: { value: new THREE.Color(config.nightC) },
    uSunA: { value: new THREE.Color(config.sunA) },
    uSunB: { value: new THREE.Color(config.sunB) },
    uSunC: { value: new THREE.Color(config.sunC) },
    uOpacity: { value: config.opacity },
  });

  useFrame((state) => {
    const startedAt = isSceneDebugEnabled() ? performance.now() : 0;
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime() * config.speed;
      
      material.uniforms.uPhase.value = timeOfDay;

      material.uniforms.uDayA.value.set(config.dayA);
      material.uniforms.uDayB.value.set(config.dayB);
      material.uniforms.uDayC.value.set(config.dayC);
      material.uniforms.uNightA.value.set(config.nightA);
      material.uniforms.uNightB.value.set(config.nightB);
      material.uniforms.uNightC.value.set(config.nightC);
      material.uniforms.uSunA.value.set(config.sunA);
      material.uniforms.uSunB.value.set(config.sunB);
      material.uniforms.uSunC.value.set(config.sunC);
      material.uniforms.uOpacity.value = config.opacity;
      
      // Move to camera position to surround it
      meshRef.current.position.copy(camera.position);
    }
    if (startedAt > 0) recordShaderUpdate(performance.now() - startedAt);
  });

  return (
    <mesh 
      ref={meshRef} 
      renderOrder={-1000} // Explicitly very low to render first
      visible={config.visible}
      scale={config.scale}
    >
      <sphereGeometry args={[500, 32, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={true} // Allow depth testing so closer objects hide it
        transparent={true}
      />
    </mesh>
  );
}
