import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls, button, folder } from 'leva';
import * as THREE from 'three';
import { COMBAT_COLORS } from '../constants/colors';

const vertexShader = [
  'varying vec2 vScreenSpace;',
  'void main() {',
  '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
  '  vec4 viewPos = viewMatrix * worldPos;',
  '  vec4 projPos = projectionMatrix * viewPos;',
  '  vScreenSpace = (projPos.xy / projPos.w) * 0.5 + 0.5;',
  '  gl_Position = projPos;',
  '}',
].join('\n');

const fragmentShader = [
  'varying vec2 vScreenSpace;',
  'uniform float uTime;',
  'uniform float uOpacity;',
  'uniform float uPhase; // 0.0 - 1.0 cycle',
  'uniform vec3 uDayA;',
  'uniform vec3 uDayB;',
  'uniform vec3 uDayC;',
  'uniform vec3 uNightA;',
  'uniform vec3 uNightB;',
  'uniform vec3 uNightC;',
  'uniform vec3 uSunA;',
  'uniform vec3 uSunB;',
  'uniform vec3 uSunC;',
  '',
  'float noise(vec2 p) {',
  '  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);',
  '}',
  '',
  'float smoothNoise(vec2 p) {',
  '  vec2 i = floor(p);',
  '  vec2 f = fract(p);',
  '  f = f * f * (3.0 - 2.0 * f);',
  '  float a = noise(i);',
  '  float b = noise(i + vec2(1.0, 0.0));',
  '  float c = noise(i + vec2(0.0, 1.0));',
  '  float d = noise(i + vec2(1.0, 1.0));',
  '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
  '}',
  '',
  'float fbm(vec2 p) {',
  '  float v = 0.0;',
  '  float a = 0.5;',
  '  mat2 m = mat2(1.6,  1.2, -1.2,  1.6);',
  '  for (int i = 0; i < 5; i++) {',
  '    v += a * smoothNoise(p);',
  '    p = m * p + vec2(uTime * 0.1);',
  '    a *= 0.5;',
  '  }',
  '  return v;',
  '}',
  '',
  'void main() {',
  '  vec2 uv = vScreenSpace;',
  '  ',
  '  // Layer 1',
  '  float n1 = fbm(uv * 2.0 + uTime * 0.05);',
  '  ',
  '  // Layer 2',
  '  float n2 = fbm(uv * 4.0 - uTime * 0.02);',
  '  ',
  '  // 3-state interpolation',
  '  vec3 colorA, colorB, colorC;',
  '  ',
  '  // 0.0: Day, 1.0: Sunset, 2.0: Night',
  '  if (uPhase <= 1.0) {',
  '    // Day to Sunset',
  '    float t = uPhase;',
  '    colorA = mix(uDayA, uSunA, t);',
  '    colorB = mix(uDayB, uSunB, t);',
  '    colorC = mix(uDayC, uSunC, t);',
  '  } else {',
  '    // Sunset to Night',
  '    float t = uPhase - 1.0;',
  '    colorA = mix(uSunA, uNightA, t);',
  '    colorB = mix(uSunB, uNightB, t);',
  '    colorC = mix(uSunC, uNightC, t);',
  '  }',
  '',
  '  vec3 color = mix(colorA, colorB, n1);',
  '  color = mix(color, colorC, n2 * 0.5);',
  '  ',
  '  // Vignette',
  '  float dist = length(uv - 0.5);',
  '  color *= smoothstep(1.0, 0.2, dist);',
  '',
  '  gl_FragColor = vec4(color, uOpacity);',
  '}',
].join('\n');

export function CombatBackgroundShader() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const config = useControls('Background Shader', {
    timeOfDay: { value: 0, min: 0, max: 2, step: 1, label: 'Moment (0:J, 1:C, 2:N)' },
    'Sky Colors': folder({
      dayA: { value: COMBAT_COLORS.SHADER_BG_A },
      dayB: { value: COMBAT_COLORS.SHADER_BG_B },
      dayC: { value: COMBAT_COLORS.SHADER_BG_C },
      sunA: { value: COMBAT_COLORS.SHADER_SUNSET_A },
      sunB: { value: COMBAT_COLORS.SHADER_SUNSET_B },
      sunC: { value: COMBAT_COLORS.SHADER_SUNSET_C },
      nightA: { value: COMBAT_COLORS.SHADER_NIGHT_A },
      nightB: { value: COMBAT_COLORS.SHADER_NIGHT_B },
      nightC: { value: COMBAT_COLORS.SHADER_NIGHT_C },
      speed: { value: 1.0, min: 0, max: 2, label: 'Noise Speed' },
      scale: { value: 1.0, min: 0.1, max: 10 },
      opacity: { value: 1.0, min: 0, max: 1 },
      visible: true,
    }),
    'Log for AI': button((get) => {
      // Get values from the folder
      const allValues = {
        dayA: get('Background Shader.Sky Colors.dayA'),
        dayB: get('Background Shader.Sky Colors.dayB'),
        dayC: get('Background Shader.Sky Colors.dayC'),
        sunA: get('Background Shader.Sky Colors.sunA'),
        sunB: get('Background Shader.Sky Colors.sunB'),
        sunC: get('Background Shader.Sky Colors.sunC'),
        nightA: get('Background Shader.Sky Colors.nightA'),
        nightB: get('Background Shader.Sky Colors.nightB'),
        nightC: get('Background Shader.Sky Colors.nightC'),
      };
      console.log('--- SKY CONFIG ---');
      console.log(JSON.stringify(allValues, null, 2));
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
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime() * config.speed;
      
      // Use fixed timeOfDay from config
      material.uniforms.uPhase.value = config.timeOfDay;

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
