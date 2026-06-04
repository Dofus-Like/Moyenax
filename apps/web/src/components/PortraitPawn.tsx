import { useFrame, useLoader } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getSkinById } from '../game/constants/skins';

const ANIM_SPEED = 18;
const IDLE_FRAMES = 6;
const ATTACK_FRAMES = 6;

interface PortraitPawnProps {
  skinId?: string;
  isAttacking?: boolean;
  onAttackComplete?: () => void;
  /** Surcharge la teinte du skin (degrés). Défaut : valeur du preset. */
  hue?: number;
  /** Surcharge la saturation du skin (multiplicateur). Défaut : valeur du preset. */
  saturation?: number;
}

export const PortraitPawn = ({
  skinId = 'soldier-classic',
  isAttacking = false,
  onAttackComplete,
  hue,
  saturation,
}: PortraitPawnProps) => {
  const spriteRef = useRef<THREE.Sprite>(null);
  const animFrameRef = useRef(0);
  const frameCounterRef = useRef(0);

  const skinConfig = useMemo(() => getSkinById(skinId), [skinId]);
  const spriteType = skinConfig.type;
  const hueDeg = hue ?? skinConfig.hue;
  const satMul = saturation ?? skinConfig.saturation;

  const texIdle = useLoader(THREE.TextureLoader, `/assets/sprites/${spriteType}/idle.png`);
  const texAttack = useLoader(THREE.TextureLoader, `/assets/sprites/${spriteType}/attack.png`);

  const { textureIdle, textureAttack } = useMemo(() => {
    texIdle.magFilter = texIdle.minFilter = THREE.NearestFilter;
    texIdle.repeat.set(1 / IDLE_FRAMES, 1);
    texIdle.colorSpace = THREE.SRGBColorSpace;

    texAttack.magFilter = texAttack.minFilter = THREE.NearestFilter;
    texAttack.repeat.set(1 / ATTACK_FRAMES, 1);
    texAttack.colorSpace = THREE.SRGBColorSpace;

    return { textureIdle: texIdle, textureAttack: texAttack };
  }, [texIdle, texAttack]);

  const uniforms = useMemo(
    () => ({
      uHue: { value: (hueDeg * Math.PI) / 180 },
      uSat: { value: satMul },
    }),
    [hueDeg, satMul],
  );

  const spriteMaterial = useMemo(() => {
    const mat = new THREE.SpriteMaterial({
      map: textureIdle,
      transparent: true,
      alphaTest: 0.5,
    });

    mat.onBeforeCompile = (shader: any) => {
      shader.uniforms.uHue = uniforms.uHue;
      shader.uniforms.uSat = uniforms.uSat;
      shader.fragmentShader = `
        uniform float uHue;
        uniform float uSat;
        vec3 applyHue(vec3 rgb, float hueOffset) {
            const vec3 k = vec3(0.57735, 0.57735, 0.57735);
            float cosAngle = cos(hueOffset);
            return rgb * cosAngle + cross(k, rgb) * sin(hueOffset) + k * dot(k, rgb) * (1.0 - cosAngle);
        }
        vec3 applySat(vec3 rgb, float sat) {
            float intensity = dot(rgb, vec3(0.299, 0.587, 0.114));
            return mix(vec3(intensity), rgb, sat);
        }
        ${shader.fragmentShader}
      `.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec4 texelColor = texture2D( map, vMapUv );
          texelColor.rgb = applyHue(texelColor.rgb, uHue);
          texelColor.rgb = applySat(texelColor.rgb, uSat);
          diffuseColor *= texelColor;
        #endif
        `,
      );
    };
    return mat;
  }, [textureIdle, uniforms]);

  useFrame((state, delta) => {
    let frames = IDLE_FRAMES;
    let activeTex = textureIdle;

    if (isAttacking) {
      frames = ATTACK_FRAMES;
      activeTex = textureAttack;
    }

    frameCounterRef.current += delta * ANIM_SPEED;
    if (frameCounterRef.current >= 1) {
      if (isAttacking) {
        animFrameRef.current++;
        if (animFrameRef.current >= frames) {
          animFrameRef.current = 0;
          onAttackComplete?.();
        }
      } else {
        animFrameRef.current = (animFrameRef.current + 1) % frames;
      }
      frameCounterRef.current = 0;

      if (spriteRef.current) {
        spriteRef.current.material.map = activeTex;
        activeTex.offset.x = animFrameRef.current / frames;
      }
    }
  });

  return (
    <sprite ref={spriteRef} scale={[1, 1, 1]} position={[0, 0, 0]}>
      <primitive object={spriteMaterial} attach="material" />
    </sprite>
  );
};
