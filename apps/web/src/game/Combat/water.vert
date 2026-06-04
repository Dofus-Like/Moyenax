uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveScale;
uniform float uBigWaveStrength;

varying float vHeight;
varying vec3 vNormal;
varying vec2 vWorldXZ;
varying float vViewDist;
varying float vCurvature; // laplacien de hauteur : négatif au crêtes, positif aux creux

// Houle cartoon : somme de sinus directionnels, peu coûteuse.
float waveHeight(vec2 p) {
  float h = 0.0;

  // Vagues normales (rapides, petites)
  h += sin(p.x * 0.60 + uTime * 1.10) * 0.50;
  h += sin(p.y * 0.50 - uTime * 0.90) * 0.40;
  h += sin((p.x + p.y) * 0.35 + uTime * 0.70) * 0.30;
  h += sin((p.x - p.y) * 0.80 - uTime * 1.40) * 0.15;

  // Grosses vagues occasionnelles :
  // Produit de deux enveloppes lentes (périodes ~31s et ~48s).
  // Elles se combinent rarement → de temps en temps une grosse houle passe.
  float env1 = pow(max(0.0, sin(uTime * 0.20 + 0.4)), 2.8);
  float env2 = pow(max(0.0, sin(uTime * 0.13 + 1.9)), 2.0);
  float bigEnv = env1 * env2;

  h += sin(p.x * 0.16 + p.y * 0.10 + uTime * 0.55) * 1.6 * bigEnv * uBigWaveStrength;
  h += sin(p.x * 0.12 - p.y * 0.14 + uTime * 0.42) * 1.1 * bigEnv * uBigWaveStrength;

  return h;
}

void main() {
  vec3 pos = position;

  // Position horizontale en espace monde (le plan est tourné -PI/2 sur X,
  // donc le local z devient le haut du monde).
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vec2 p = world.xz * uWaveScale;

  float h = waveHeight(p) * uWaveHeight;

  // Normale analytique par différences finies → ombrage doux des crêtes.
  float e = 0.5;
  float hL = waveHeight(p - vec2(e, 0.0)) * uWaveHeight;
  float hR = waveHeight(p + vec2(e, 0.0)) * uWaveHeight;
  float hD = waveHeight(p - vec2(0.0, e)) * uWaveHeight;
  float hU = waveHeight(p + vec2(0.0, e)) * uWaveHeight;
  vNormal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
  // Laplacien discret : négatif = crête convexe (va déferler), positif = creux.
  vCurvature = hL + hR + hD + hU - 4.0 * h;

  vHeight = h;
  vWorldXZ = world.xz;

  vec3 displacedWorld = vec3(world.x, world.y + h, world.z);
  vec4 viewPos = viewMatrix * vec4(displacedWorld, 1.0);
  vViewDist = -viewPos.z; // distance caméra (linéaire) pour la brume
  gl_Position = projectionMatrix * viewPos;
}
