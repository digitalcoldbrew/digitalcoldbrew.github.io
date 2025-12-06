varying vec2 vUv;
uniform float uTime;

void main(){
  vUv = uv;
  vec3 p = position;
  p.z += sin((p.x + uTime*0.8) * 1.6) * 0.25;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
}
