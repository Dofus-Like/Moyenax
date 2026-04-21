import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three';
import { COMBAT_COLORS } from '../constants/colors';

const vertexShader = `
  varying vec2 vScreenSpace;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 viewPos = viewMatrix * worldPos;
    vec4 projPos = projectionMatrix * viewPos;
    vScreenSpace = (projPos.xy / projPos.w) * 0.5 + 0.5;
    gl_Position = projPos;
  }
`;

const fragmentShader = `
  varying vec2 vScreenSpace;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = noise(i);
    float b = noise(i + vec2(1.0, 0.0));
    float c = noise(i + vec2(0.0, 1.0));
    float d = noise(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6,  1.2, -1.2,  1.6);
    for (int i = 0; i < 5; i++) {
      v += a * smoothNoise(p);
      p = m * p + vec2(uTime * 0.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vScreenSpace;
    
    // Layer 1
    float n1 = fbm(uv * 2.0 + uTime * 0.05);
    
    // Layer 2
    float n2 = fbm(uv * 4.0 - uTime * 0.02);
    
    vec3 color = mix(uColorA, uColorB, n1);
    color = mix(color, uColorC, n2 * 0.5);
    
    // Add some "nebula" highlights
    float highlight = pow(smoothNoise(uv * 8.0 + uTime * 0.1), 3.0);
    color += highlight * 0.1;
    
    // Vignette
    float dist = length(uv - 0.5);
    color *= smoothstep(1.0, 0.2, dist);

    gl_FragColor = vec4(color, uOpacity);
  }
`;

export function CombatBackgroundShader() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const config = useControls('Background Shader', {
    colorA: { value: COMBAT_COLORS.SHADER_BG_A },
    colorB: { value: COMBAT_COLORS.SHADER_BG_B },
    colorC: { value: COMBAT_COLORS.SHADER_BG_C },
    speed: { value: 1.0, min: 0, max: 2 },
    scale: { value: 1.0, min: 0.1, max: 10 },
    opacity: { value: 1.0, min: 0, max: 1 },
    visible: true,
  });

  const uniforms = useRef({
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(config.colorA) },
    uColorB: { value: new THREE.Color(config.colorB) },
    uColorC: { value: new THREE.Color(config.colorC) },
    uOpacity: { value: config.opacity },
  });

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime() * config.speed;
      material.uniforms.uColorA.value.set(config.colorA);
      material.uniforms.uColorB.value.set(config.colorB);
      material.uniforms.uColorC.value.set(config.colorC);
      material.uniforms.uOpacity.value = config.opacity;
      
      // Move to camera position to surround it
      meshRef.current.position.copy(camera.position);
    }
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
