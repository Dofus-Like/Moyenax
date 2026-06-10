varying vec2 vScreenSpace;
varying vec3 vDir;

uniform float uTime;
uniform float uOpacity;
uniform float uPhase; // 0.0: Day, 1.0: Sunset, 2.0: Night

// Color inputs
uniform vec3 uDayA;
uniform vec3 uDayB;
uniform vec3 uDayC;

uniform vec3 uNightA;
uniform vec3 uNightB;
uniform vec3 uNightC;

uniform vec3 uSunA;
uniform vec3 uSunB;
uniform vec3 uSunC;

// Utils
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
  // 3-state interpolation : A = horizon, B = zénith, C = nuages
  vec3 colorA, colorB, colorC;
  if (uPhase <= 1.0) {
    float t = uPhase;
    colorA = mix(uDayA, uSunA, t);
    colorB = mix(uDayB, uSunB, t);
    colorC = mix(uDayC, uSunC, t);
  } else {
    float t = uPhase - 1.0;
    colorA = mix(uSunA, uNightA, t);
    colorB = mix(uSunB, uNightB, t);
    colorC = mix(uSunC, uNightC, t);
  }

  // ── Ciel en direction monde (stable quand la caméra tourne) ────────────────
  vec3 dir = normalize(vDir);
  float elev = clamp(dir.y, -1.0, 1.0); // 0 = horizon, 1 = zénith

  // Dégradé vertical doux : pâle/brumeux à l'horizon → bleu profond au zénith.
  float grad = pow(smoothstep(-0.02, 0.85, elev), 0.8);
  vec3 color = mix(colorA, colorB, grad);

  // Légère brume claire qui s'accumule juste au-dessus de l'horizon.
  float haze = smoothstep(0.22, -0.04, elev) * smoothstep(-0.10, 0.04, elev);
  color = mix(color, mix(colorA, colorC, 0.5), haze * 0.45);

  // ── Nuages qui dérivent ────────────────────────────────────────────────────
  // Projection en dôme : dir.xz aplati par l'élévation → les nuages fuient
  // vers l'horizon en perspective. La dérive vient du uTime dans le fbm.
  vec2 dome = dir.xz / (elev + 0.32);
  float clouds = fbm(dome * 1.15 + vec2(uTime * 0.012, uTime * 0.004));
  clouds = smoothstep(0.48, 0.92, clouds);

  // Les nuages n'existent que dans le ciel (pas sous l'horizon, fondus au zénith).
  float cloudBand = smoothstep(0.015, 0.18, elev) * smoothstep(1.05, 0.35, elev);
  color = mix(color, colorC, clouds * cloudBand * 0.85);

  // Sous l'horizon : fond vers une teinte mer profonde (fallback si le plan
  // d'eau ne couvre pas un coin de l'écran → pas de bande cyan vif).
  float below = smoothstep(-0.01, -0.20, elev);
  color = mix(color, colorB * 0.55, below * 0.9);

  gl_FragColor = vec4(color, uOpacity);
}
