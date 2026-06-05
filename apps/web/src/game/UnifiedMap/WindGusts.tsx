import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { GameMap } from '@game/shared-types';

import { seededRandom } from './noise';

// Faint 3D wind streaks gliding over the ground — irregular gusts that fade in/out.
const GUST_COUNT = 10; // number of concurrent streaks
const GUST_LENGTH = 3.8; // world units along travel direction
const GUST_WIDTH = 0.35; // width across travel direction
const GUST_HEIGHT = 0.1; // height of streak above ground
const GUST_SPEED_MIN = 0.2; // world units / second (each gust picks its own in this range)
const GUST_SPEED_MAX = 1.5;
const GUST_OPACITY = 0.15; // peak opacity (very faint)
const GUST_REST_MAX = 5.0; // max idle seconds between passes (drives irregularity)
const GUST_AREA_SCALE_LATERAL = 0.7; // lateral (width) coverage as fraction of map diagonal
const GUST_AREA_SCALE_LENGTH = 0.3;  // travel-axis (length) coverage as fraction of map diagonal
const GUST_FADE = 0.28;              // fraction of the travel span used for smooth fade in/out
const GUST_BASE_ANGLE = Math.PI / 6; // base wind angle (radians from +X axis, ~30°)
const GUST_ANGLE_SPREAD = Math.PI;   // max random angular deviation per combat (π = full rotation)

interface GustState {
  s: number; // position along travel axis (−half … +half)
  lateral: number; // sideways offset
  speed: number;
  rest: number; // remaining idle seconds before re-entering
}

function hashMapWind(map: GameMap): number {
  let h = 2166136261 >>> 0;
  const mix = (v: number): void => { h = Math.imul(h ^ v, 16777619) >>> 0; };
  mix(map.width);
  mix(map.height);
  for (let y = 0; y < map.height; y++) {
    const row = map.grid[y];
    for (let x = 0; x < map.width; x++) {
      const t = String(row[x]);
      for (let k = 0; k < t.length; k++) mix(t.charCodeAt(k));
    }
  }
  return (h % 1_000_000) + 1;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function makeStreakTexture(): THREE.Texture {
  const w = 128;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Soft oval: bright at centre, fading to 0 at both ends and edges.
      const u = Math.sin((Math.PI * x) / (w - 1));
      const v = Math.sin((Math.PI * y) / (h - 1));
      const a = Math.pow(u, 1.5) * Math.pow(v, 1.2);
      const i = (y * w + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.floor(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export const WindGusts = React.memo(({ map }: { map: GameMap }) => {
  // Per-combat seeded direction: base angle + random offset from map hash.
  const dir = useMemo(() => {
    const angle = GUST_BASE_ANGLE + seededRandom(hashMapWind(map) * 1.7) * GUST_ANGLE_SPREAD;
    return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  }, [map]);
  const texture = useMemo(() => makeStreakTexture(), []);

  // Coverage: lateral and travel-axis each scale independently from map diagonal.
  const span = Math.hypot(map.width, map.height);
  const travelHalf = span * GUST_AREA_SCALE_LENGTH / 2 + GUST_LENGTH;
  const lateralSpread = span * GUST_AREA_SCALE_LATERAL;

  // Fixed orientation: lay the plane flat, then yaw it to align its length with travel dir.
  const quaternion = useMemo(() => {
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-dir.y, dir.x));
    return yaw.multiply(flat);
  }, [dir]);

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const materials = useMemo(
    () =>
      Array.from({ length: GUST_COUNT }, () =>
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      ),
    [texture],
  );

  const gusts = useRef<GustState[]>(
    Array.from({ length: GUST_COUNT }, (_, i) => ({
      s: -travelHalf + seededRandom(i * 7.3) * travelHalf * 2,
      lateral: (seededRandom(i * 3.1) - 0.5) * lateralSpread,
      speed: GUST_SPEED_MIN + seededRandom(i * 5.9) * (GUST_SPEED_MAX - GUST_SPEED_MIN),
      rest: seededRandom(i * 11.7) * GUST_REST_MAX,
    })),
  );

  const perp = useMemo(() => new THREE.Vector2(-dir.y, dir.x), [dir]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < GUST_COUNT; i++) {
      const g = gusts.current[i];
      const mesh = meshRefs.current[i];
      const mat = materials[i];
      if (!mesh) continue;

      if (g.rest > 0) {
        g.rest -= dt;
        mat.opacity = 0;
        continue;
      }

      g.s += g.speed * dt;
      if (g.s > travelHalf) {
        // Respawn with new randomised pass.
        g.s = -travelHalf;
        g.lateral = (Math.random() - 0.5) * lateralSpread;
        g.speed = GUST_SPEED_MIN + Math.random() * (GUST_SPEED_MAX - GUST_SPEED_MIN);
        g.rest = Math.random() * GUST_REST_MAX;
      }

      mesh.position.set(
        dir.x * g.s + perp.x * g.lateral,
        GUST_HEIGHT,
        dir.y * g.s + perp.y * g.lateral,
      );
      // Smooth (cubic) fade in at the start and out at the end of the travel span.
      const progress = (g.s + travelHalf) / (2 * travelHalf);
      const env = Math.min(smoothstep(0, GUST_FADE, progress), smoothstep(0, GUST_FADE, 1 - progress));
      mat.opacity = GUST_OPACITY * env;
    }
  });

  return (
    <group>
      {materials.map((mat, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          quaternion={quaternion}
          material={mat}
          raycast={() => null}
        >
          <planeGeometry args={[GUST_LENGTH, GUST_WIDTH]} />
        </mesh>
      ))}
    </group>
  );
});
