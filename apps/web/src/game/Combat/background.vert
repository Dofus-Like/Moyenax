varying vec2 vScreenSpace;
varying vec3 vDir; // direction monde depuis la caméra (la sphère suit la caméra)

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec4 viewPos = viewMatrix * worldPos;
  vec4 projPos = projectionMatrix * viewPos;

  vScreenSpace = (projPos.xy / projPos.w) * 0.5 + 0.5;
  vDir = normalize(position); // position locale sur la sphère = direction monde

  gl_Position = projPos;
}
