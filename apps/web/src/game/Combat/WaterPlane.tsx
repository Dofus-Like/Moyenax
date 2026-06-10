import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useControls, folder } from 'leva';
import { type JSX, useMemo, useRef } from 'react';
import * as THREE from 'three';

import foamTextureUrl from '../../assets/textures/water_foam.png';
import patternTextureUrl from '../../assets/textures/water_pattern.png';
import { createSceneMetricRecorder, isSceneDebugEnabled } from '../../perf/scene-metric-recorder';
import { COMBAT_COLORS } from '../constants/colors';

import fragmentShader from './water.frag?raw';
import vertexShader from './water.vert?raw';

interface WaterPlaneProps {
  timeOfDay: number;
  /** Empreinte du plateau en unités monde (largeur, profondeur) pour l'ombre portée. */
  islandSize?: [number, number];
}

const NO_RAYCAST = (): null => null;

export function WaterPlane({ timeOfDay, islandSize = [10, 10] }: WaterPlaneProps): JSX.Element {
  const meshRef = useRef<THREE.Mesh>(null);
  const [islandW, islandD] = islandSize;

  const [foamTex, patternTex] = useTexture([foamTextureUrl, patternTextureUrl]);
  foamTex.wrapS    = foamTex.wrapT    = THREE.RepeatWrapping;
  patternTex.wrapS = patternTex.wrapT = THREE.RepeatWrapping;
  foamTex.needsUpdate    = true;
  patternTex.needsUpdate = true;

  const config = useControls('Water', {
    Ocean: folder({
      visible: true,
      y: { value: -8.0, min: -18, max: 0, label: 'Hauteur' },
      waveHeight: { value: 0.35, min: 0, max: 1.5, label: 'Vagues' },
      bigWaveStrength: { value: 0.55, min: 0, max: 2, label: 'Grosses vagues' },
      waveScale: { value: 0.35, min: 0.05, max: 1.5, label: 'Densité' },
      speed: { value: 1.0, min: 0, max: 3, label: 'Vitesse' },
      sparkle: { value: 0.6, min: 0, max: 2, label: 'Scintillement' },
      opacity: { value: 1.0, min: 0, max: 1 },
      dayDeep: { value: COMBAT_COLORS.WATER_DAY_DEEP },
      dayShallow: { value: COMBAT_COLORS.WATER_DAY_SHALLOW },
      dayFoam: { value: COMBAT_COLORS.WATER_DAY_FOAM },
      sunDeep: { value: COMBAT_COLORS.WATER_SUNSET_DEEP },
      sunShallow: { value: COMBAT_COLORS.WATER_SUNSET_SHALLOW },
      sunFoam: { value: COMBAT_COLORS.WATER_SUNSET_FOAM },
      nightDeep: { value: COMBAT_COLORS.WATER_NIGHT_DEEP },
      nightShallow: { value: COMBAT_COLORS.WATER_NIGHT_SHALLOW },
      nightFoam: { value: COMBAT_COLORS.WATER_NIGHT_FOAM },
    }),
    Ombre: folder({
      shadowStrength: { value: 0.45, min: 0, max: 1, label: 'Force' },
      shadowOffset: { value: 2.0, min: -8, max: 8, label: 'Décalage' },
      shadowSoft: { value: 4.0, min: 0.1, max: 10, label: 'Flou' },
      shadowScale: { value: 1.1, min: 0.3, max: 2, label: 'Taille' },
      shadowRound: { value: 2.5, min: 0, max: 5, label: 'Arrondi' },
    }),
    Reflets: folder({
      cloudAmount: { value: 0.16, min: 0, max: 0.6, label: 'Nuages' },
      cloudScale: { value: 0.16, min: 0.01, max: 0.5, label: 'Échelle nuages' },
      cloudSpeed: { value: 0.03, min: 0, max: 0.5, label: 'Vitesse nuages' },
      cloudColor: { value: COMBAT_COLORS.WATER_CLOUD },
      sunAmount: { value: 0.22, min: 0, max: 1, label: 'Soleil' },
      sunSpeed: { value: 0.045, min: 0, max: 0.5, label: 'Vitesse soleil' },
      sunRadius: { value: 6, min: 2, max: 30, label: 'Rayon soleil' },
      sunOffset: { value: 6, min: -15, max: 15, label: 'Position soleil' },
      sunDay: { value: COMBAT_COLORS.WATER_SUN_DAY },
      sunSunset: { value: COMBAT_COLORS.WATER_SUN_SUNSET },
      sunNight: { value: COMBAT_COLORS.WATER_SUN_NIGHT },
    }),
    Brume: folder({
      fogStart: { value: 55, min: 0, max: 300, label: 'Début' },
      fogEnd: { value: 240, min: 10, max: 700, label: 'Fin' },
      fogColor: { value: COMBAT_COLORS.WATER_FOG },
    }),
  });

  const uniforms = useRef({
    uTime: { value: 0 },
    uPhase: { value: timeOfDay },
    uOpacity: { value: config.opacity },
    uWaveHeight: { value: config.waveHeight },
    uBigWaveStrength: { value: config.bigWaveStrength },
    uWaveScale: { value: config.waveScale },
    uSparkle: { value: config.sparkle },
    uDayDeep: { value: new THREE.Color(config.dayDeep) },
    uDayShallow: { value: new THREE.Color(config.dayShallow) },
    uDayFoam: { value: new THREE.Color(config.dayFoam) },
    uSunDeep: { value: new THREE.Color(config.sunDeep) },
    uSunShallow: { value: new THREE.Color(config.sunShallow) },
    uSunFoam: { value: new THREE.Color(config.sunFoam) },
    uNightDeep: { value: new THREE.Color(config.nightDeep) },
    uNightShallow: { value: new THREE.Color(config.nightShallow) },
    uNightFoam: { value: new THREE.Color(config.nightFoam) },
    uShadowCenter: { value: new THREE.Vector2(config.shadowOffset, config.shadowOffset) },
    uShadowHalf: { value: new THREE.Vector2((islandW / 2) * config.shadowScale, (islandD / 2) * config.shadowScale) },
    uShadowSoft: { value: config.shadowSoft },
    uShadowStrength: { value: config.shadowStrength },
    uShadowRound: { value: config.shadowRound },
    uCloudColor: { value: new THREE.Color(config.cloudColor) },
    uCloudAmount: { value: config.cloudAmount },
    uCloudScale: { value: config.cloudScale },
    uCloudSpeed: { value: config.cloudSpeed },
    uSunDay: { value: new THREE.Color(config.sunDay) },
    uSunSunset: { value: new THREE.Color(config.sunSunset) },
    uSunNight: { value: new THREE.Color(config.sunNight) },
    uSunCenter: { value: new THREE.Vector2(config.sunOffset, config.sunOffset) },
    uSunRadius: { value: config.sunRadius },
    uSunAmount: { value: config.sunAmount },
    uSunSpeed: { value: config.sunSpeed },
    uFogColor: { value: new THREE.Color(config.fogColor) },
    uFogStart: { value: config.fogStart },
    uFogEnd: { value: config.fogEnd },
    uFoamTex: { value: foamTex },
    uWaterTex: { value: patternTex },
  });
  const recordWaterUniforms = useMemo(
    () => createSceneMetricRecorder('WaterPlane:uniform-update', 2),
    [],
  );

  useFrame((state) => {
    const startedAt = isSceneDebugEnabled() ? performance.now() : 0;
    const mesh = meshRef.current;
    if (!mesh) return;
    // L'eau suit la caméra en XZ → bord toujours à 750u, jamais visible
    // (les vagues restent ancrées au monde car calculées en position monde).
    mesh.position.x = state.camera.position.x;
    mesh.position.z = state.camera.position.z;
    mesh.position.y = config.y;
    const u = (mesh.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value = state.clock.getElapsedTime() * config.speed;
    u.uPhase.value = timeOfDay;
    u.uOpacity.value = config.opacity;
    u.uWaveHeight.value = config.waveHeight;
    u.uBigWaveStrength.value = config.bigWaveStrength;
    u.uWaveScale.value = config.waveScale;
    u.uSparkle.value = config.sparkle;
    u.uDayDeep.value.set(config.dayDeep);
    u.uDayShallow.value.set(config.dayShallow);
    u.uDayFoam.value.set(config.dayFoam);
    u.uSunDeep.value.set(config.sunDeep);
    u.uSunShallow.value.set(config.sunShallow);
    u.uSunFoam.value.set(config.sunFoam);
    u.uNightDeep.value.set(config.nightDeep);
    u.uNightShallow.value.set(config.nightShallow);
    u.uNightFoam.value.set(config.nightFoam);
    u.uShadowCenter.value.set(config.shadowOffset, config.shadowOffset);
    u.uShadowHalf.value.set((islandW / 2) * config.shadowScale, (islandD / 2) * config.shadowScale);
    u.uShadowSoft.value = config.shadowSoft;
    u.uShadowStrength.value = config.shadowStrength;
    u.uShadowRound.value = config.shadowRound;
    u.uCloudColor.value.set(config.cloudColor);
    u.uCloudAmount.value = config.cloudAmount;
    u.uCloudScale.value = config.cloudScale;
    u.uCloudSpeed.value = config.cloudSpeed;
    u.uSunDay.value.set(config.sunDay);
    u.uSunSunset.value.set(config.sunSunset);
    u.uSunNight.value.set(config.sunNight);
    u.uSunCenter.value.set(config.sunOffset, config.sunOffset);
    u.uSunRadius.value = config.sunRadius;
    u.uSunAmount.value = config.sunAmount;
    u.uSunSpeed.value = config.sunSpeed;
    u.uFogColor.value.set(config.fogColor);
    u.uFogStart.value = config.fogStart;
    u.uFogEnd.value = config.fogEnd;
    if (startedAt > 0) recordWaterUniforms(performance.now() - startedAt);
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, config.y, 0]}
      visible={config.visible}
      raycast={NO_RAYCAST}
      renderOrder={-900}
    >
      <planeGeometry args={[1500, 1500, 256, 256]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
        transparent={config.opacity < 1}
      />
    </mesh>
  );
}
