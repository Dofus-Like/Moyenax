varying vec2 vScreenSpace;

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
  vec2 uv = vScreenSpace;
  
  // Layer 1: Base motion
  float n1 = fbm(uv * 2.0 + uTime * 0.05);
  
  // Layer 2: Detail motion
  float n2 = fbm(uv * 4.0 - uTime * 0.02);
  
  // 3-state interpolation
  vec3 colorA, colorB, colorC;
  
  if (uPhase <= 1.0) {
    // Day to Sunset
    float t = uPhase;
    colorA = mix(uDayA, uSunA, t);
    colorB = mix(uDayB, uSunB, t);
    colorC = mix(uDayC, uSunC, t);
  } else {
    // Sunset to Night
    float t = uPhase - 1.0;
    colorA = mix(uSunA, uNightA, t);
    colorB = mix(uSunB, uNightB, t);
    colorC = mix(uSunC, uNightC, t);
  }

  // Combine layers
  vec3 color = mix(colorA, colorB, n1);
  color = mix(color, colorC, n2 * 0.5);
  
  // Vignette for depth
  float dist = length(uv - 0.5);
  color *= smoothstep(1.0, 0.2, dist);

  gl_FragColor = vec4(color, uOpacity);
}
