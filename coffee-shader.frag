#ifdef GL_ES
precision mediump float;
#endif

varying vec2 vUv;
uniform float uTime;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
}

void main(){
  vec2 uv = vUv;
  float t = uTime * 0.15;
  float n = 0.0;
  n += 0.55 * noise(uv * 3.0 + t * 0.3);
  n += 0.30 * noise(uv * 8.0 - t * 0.6);
  n += 0.10 * noise(uv * 20.0 + t * 1.6);

  vec3 warm = vec3(0.95, 0.45, 0.38);
  vec3 mid = vec3(0.22, 0.38, 0.44);
  vec3 cool = vec3(0.06, 0.12, 0.18);

  float g = smoothstep(0.0, 1.0, uv.x + 0.06 * sin(t + uv.y * 4.0));
  vec3 base = mix(warm, mid, g);
  base = mix(base, cool, pow(uv.y, 1.6) * 0.6);
  base += 0.14 * vec3(n, n*0.6, n*0.35);

  float vign = smoothstep(0.9, 0.35, distance(uv, vec2(0.5)));
  base *= (1.0 - 0.55 * vign);

  gl_FragColor = vec4(base, 1.0);
}
