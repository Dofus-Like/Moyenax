varying vec2 vScreenSpace;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec4 viewPos = viewMatrix * worldPos;
  vec4 projPos = projectionMatrix * viewPos;
  
  // Convert projected coordinates to [0,1] screen space for background sampling
  vScreenSpace = (projPos.xy / projPos.w) * 0.5 + 0.5;
  
  gl_Position = projPos;
}
