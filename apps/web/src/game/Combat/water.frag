uniform float uTime;
uniform float uOpacity;
uniform float uPhase;   // 0.0: jour, 1.0: coucher, 2.0: nuit
uniform float uWaveHeight;
uniform float uSparkle;

uniform vec3 uDayDeep;
uniform vec3 uDayShallow;
uniform vec3 uDayFoam;
uniform vec3 uSunDeep;
uniform vec3 uSunShallow;
uniform vec3 uSunFoam;
uniform vec3 uNightDeep;
uniform vec3 uNightShallow;
uniform vec3 uNightFoam;

// Ombre portée de l'île (procédurale, en espace monde XZ).
uniform vec2 uShadowCenter;
uniform vec2 uShadowHalf;
uniform float uShadowSoft;
uniform float uShadowStrength;
uniform float uShadowRound;

// Reflets de nuages + soleil (style Pokémon Émeraude, dérive lente).
uniform vec3 uCloudColor;
uniform float uCloudAmount;
uniform float uCloudScale;
uniform float uCloudSpeed;
uniform vec3 uSunDay;
uniform vec3 uSunSunset;
uniform vec3 uSunNight;
uniform vec2 uSunCenter;
uniform float uSunRadius;
uniform float uSunAmount;
uniform float uSunSpeed;

// Brume de distance : fond l'horizon de l'eau dans une teinte atmosphérique.
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;

// Textures cartoon (seamless, repeat).
uniform sampler2D uFoamTex;    // masque d'écume N&B : blanc = écume, noir = eau
uniform sampler2D uWaterTex;   // pattern de vagues stylisé (deux tons de bleu)

varying float vHeight;
varying vec3 vNormal;
varying vec2 vWorldXZ;
varying float vViewDist;
varying float vCurvature;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

// FBM léger pour les nuages et le miroitement solaire.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * smoothNoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {

  // ── 1. Palette couleurs selon le cycle jour/coucher/nuit ──────────────────
  vec3 deep, shallow, foam, sunCol;
  if (uPhase <= 1.0) {
    float t = uPhase;
    deep    = mix(uDayDeep,    uSunDeep,    t);
    shallow = mix(uDayShallow, uSunShallow, t);
    foam    = mix(uDayFoam,    uSunFoam,    t);
    sunCol  = mix(uSunDay,     uSunSunset,  t);
  } else {
    float t = uPhase - 1.0;
    deep    = mix(uSunDeep,    uNightDeep,    t);
    shallow = mix(uSunShallow, uNightShallow, t);
    foam    = mix(uSunFoam,    uNightFoam,    t);
    sunCol  = mix(uSunSunset,  uSunNight,     t);
  }

  // ── 2. Hauteur normalisée et éclairage ────────────────────────────────────
  float amp      = max(uWaveHeight, 0.001);
  float elevation = clamp(vHeight / (1.35 * amp) * 0.5 + 0.5, 0.0, 1.0);
  float diff     = clamp(dot(vNormal, normalize(vec3(0.4, 1.0, 0.3))), 0.0, 1.0);

  // ── 3. Couleur de base : pattern cartoon + houle grande échelle ─────────────
  // Deux passes du pattern décalées en vitesse → évite le tiling répétitif.
  vec2 patUv1 = vWorldXZ * 0.085 + vec2(uTime * 0.022, uTime *  0.006);
  vec2 patUv2 = vWorldXZ * 0.055 + vec2(uTime * 0.014, uTime * -0.005);
  float patLuma1 = dot(texture2D(uWaterTex, patUv1).rgb, vec3(0.299, 0.587, 0.114));
  float patLuma2 = dot(texture2D(uWaterTex, patUv2).rgb, vec3(0.299, 0.587, 0.114));
  // Extrait les lignes claires (≈ 0.45) du fond sombre (≈ 0.27) du pattern.
  float patStructure = smoothstep(0.28, 0.50, (patLuma1 + patLuma2) * 0.5);

  float swell   = smoothNoise(vWorldXZ * 0.10 + uTime * 0.025);
  float baseMix = clamp(elevation * 0.55 + swell * 0.20 + patStructure * 0.30, 0.0, 1.0);

  vec3 color = mix(deep, shallow, baseMix);
  color *= 0.82 + 0.34 * diff;

  // ── 4. Écume physiquement motivée : seulement aux vagues qui déferlent ─────
  //
  //  Principe réel : une vague déferle quand elle devient trop raide.
  //  En termes de champ de hauteur h(x,z) :
  //    - vCurvature < 0  →  crête convexe (Laplacien négatif = pic pointu)
  //    - slopeStrength↑  →  pente forte de chaque côté de la crête
  //
  //  La conjonction des deux (crête ET pente) = vague qui déferle.
  //  On ajoute un bruit animé pour texturer l'écume en plaques naturelles.

  // Pente : 1 - vNormal.y est 0 sur surface plate, monte avec l'inclinaison.
  float slopeStrength = 1.0 - vNormal.y;

  // Courbure normalisée : à l'amplitude actuelle, la valeur absolue du Laplacien
  // à une crête vaut typiquement amp * 0.04 à 0.12.
  // On normalise pour obtenir un signal [0, 1].
  float normCurv = clamp(-vCurvature / max(amp * 0.07, 0.001), 0.0, 1.0);

  // Condition de déferlement : crête pointue (normCurv) + pente forte + position haute
  float breakCond = normCurv
                  * smoothstep(0.06, 0.45, slopeStrength)
                  * smoothstep(0.15, 0.60, elevation);

  // Texture d'écume cartoon : deux couches à vitesses différentes
  // → filaments et spirales style Dofus/Wakfu, pas un aplat uniforme.
  vec2 foamUv1 = vWorldXZ * 0.10 + vec2( uTime * 0.26, -uTime * 0.11);
  vec2 foamUv2 = vWorldXZ * 0.07 + vec2(-uTime * 0.18,  uTime * 0.08);
  float foamT1  = texture2D(uFoamTex, foamUv1).r;
  float foamT2  = texture2D(uFoamTex, foamUv2).r * 0.60;
  float foamPatch = clamp(foamT1 + foamT2, 0.0, 1.0);

  float foamAmount = clamp(breakCond * foamPatch * 3.8, 0.0, 1.0);
  color = mix(color, foam, foamAmount);

  // ── 5. Scintillement solaire (reflet chaud, pas de l'écume blanche) ────────
  float sp = smoothNoise(vWorldXZ * 3.0 + uTime * 0.6);
  sp = smoothstep(0.87, 0.99, sp) * diff * uSparkle;
  color += sunCol * sp * 0.55;

  // ── 6. Reflets de nuages ──────────────────────────────────────────────────
  vec2 cloudUv = vWorldXZ * uCloudScale + vec2(uTime * uCloudSpeed, uTime * uCloudSpeed * 0.6);
  float clouds = fbm(cloudUv);
  clouds = smoothstep(0.58, 0.86, clouds) * uCloudAmount;
  color = mix(color, uCloudColor, clouds);

  // ── 7. Reflet du soleil : lueur chaude qui miroite ────────────────────────
  float sunGlow = smoothstep(uSunRadius, 0.0, length(vWorldXZ - uSunCenter));
  float shimmer = fbm(vWorldXZ * 0.5 - vec2(uTime * uSunSpeed, uTime * uSunSpeed * 0.7));
  float sun = sunGlow * (0.35 + 0.65 * smoothstep(0.45, 0.85, shimmer)) * uSunAmount;
  color += sunCol * sun;

  // ── 8. Ombre portée de l'île ──────────────────────────────────────────────
  float sd     = sdRoundBox(vWorldXZ - uShadowCenter, uShadowHalf, uShadowRound);
  float shadow = (1.0 - smoothstep(0.0, uShadowSoft, sd)) * uShadowStrength;
  color *= 1.0 - shadow;

  // ── 9. Brume de distance ──────────────────────────────────────────────────
  float fog = smoothstep(uFogStart, uFogEnd, vViewDist);
  color = mix(color, uFogColor, fog);

  gl_FragColor = vec4(color, uOpacity);
}
