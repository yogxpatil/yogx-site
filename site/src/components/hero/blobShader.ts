import { SIGMA, RIM } from '@/lib/blob/goo';
export const N_BALLS = 7;
export const vertex = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
export const fragment = /* glsl */ `
precision highp float;
uniform vec3 uBalls[${N_BALLS}];
uniform vec2 uRes, uBuf;           // canvas size in css px, drawing buffer size in device px (floored, so not uRes * dpr)
uniform float uTime;
uniform sampler2D uTex;
uniform vec3 uAstro;               // astrolabe centre + radius (css px); z = 0 when hidden
const vec3 RUST = vec3(0.533, 0.153, 0.0);
float erfA(float x){ float x2 = x*x; float a = 0.147; return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732395 + a*x2) / (1.0 + a*x2))); }
float field(vec2 p, float grow){
  float a = 0.0;
  for (int i = 0; i < ${N_BALLS}; i++){ float d = length(p - uBalls[i].xy); a += 0.5 - 0.5 * erfA((d - uBalls[i].z - grow) / (${SIGMA.toFixed(1)} * 1.4142136)); }
  return min(a, 1.0);
}
float goo(float a){ return clamp(34.0 * a - 15.0, 0.0, 1.0); }
// Sin-free hash (Hoskins) so large coordinates stay precise on mobile GPUs. Mirrored in lib/blob/grit.ts.
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f*f*(3.0 - 2.0*f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){ return 0.6 * vnoise(p) + 0.4 * vnoise(p * 2.03 + vec2(17.1, 5.3)); }
// Known limitation: this sums a blurred coverage per disc, while the prototype's SVG filter blurs the UNION of the discs.
// Where a satellite sits just inside the edge the two differ by up to ~10 px of bump.
void main(){
  if (uBalls[0].z <= 0.0) { gl_FragColor = vec4(0.0); return; }  // no blob yet (radius 0): nothing, never the whole plane
  vec2 p = vec2(gl_FragCoord.x, uBuf.y - gl_FragCoord.y) * uRes / uBuf;  // device px -> css px, y down
  float rim = goo(field(p, ${RIM.toFixed(1)}));
  if (rim <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float inside = goo(field(p, 0.0));
  vec2 q = p;
  if (uAstro.z > 0.0 && length(p - uAstro.xy) < uAstro.z + 2.0) {
    float a = -radians(uTime * 12.5);                          // proto: rotate(t/80 deg) = 12.5 deg/s
    q = uAstro.xy + mat2(cos(a), sin(a), -sin(a), cos(a)) * (p - uAstro.xy);
  }
  vec3 col = texture2D(uTex, q / uRes).rgb;
  float n = 0.5 + 0.6 * (fbm(p * 0.75) - 0.5);
  col = mix(col, RUST, clamp(0.55 * n - 0.12, 0.0, 1.0));                   // static grit (proto #grit)
  if (uAstro.z > 0.0) {                                                        // hand + hub, not rotated
    vec2 d = p - uAstro.xy;
    float hand = step(abs(d.x), 0.8) * step(-uAstro.z * 0.95, d.y) * step(d.y, 0.0);
    col = mix(col, RUST, max(hand, step(length(d), 3.5)));
  }
  for (int j = 0; j < 4; j++){                                                // proto ripples: 4 rings, 2.4 s, 1.3 px rust
    float age = mod(uTime + float(j) * 0.6, 2.4) / 2.4;
    float rr = uBalls[0].z * (0.25 + age * 1.3);
    float cov = clamp(1.15 - abs(length(p - uBalls[0].xy) - rr), 0.0, 1.0);
    col = mix(col, RUST, cov * (1.0 - age) * 0.55);
  }
  gl_FragColor = vec4(mix(RUST, col, inside), max(inside, rim));
}`;
