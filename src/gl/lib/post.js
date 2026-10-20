/* Final pass: two scene layers dissolved through ink-bleed noise, or split at a wiping sheet's edge (wipe: the edge's
   line, 0 top … 1 bottom of the screen; the sheet above it, feathered into the scene below, with a faint warm edge
   light; bleed: instead, the scene below eats up into the one above through the dissolve's ink-bleed noise, in a band
   under the edge and never above it, while the scene above dims to bleedDim), then the film finish (grain, vignette, a touch of chromatic fringe that follows
   scroll speed). */
import * as THREE from 'three';

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = /* glsl */`
precision highp float;
uniform sampler2D tA; uniform sampler2D tB;
uniform float mixAB; uniform float time; uniform vec2 res; uniform float wipe; uniform float bleed; uniform float bleedDim;
uniform float grain; uniform float vignette; uniform float fringe; uniform vec3 fadeColor; uniform float fade;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
vec3 sampleA(vec2 uv){
  if (fringe < 0.0005) return texture2D(tA, uv).rgb;
  vec2 d = (uv - 0.5) * fringe;
  return vec3(texture2D(tA, uv + d).r, texture2D(tA, uv).g, texture2D(tA, uv - d).b);
}
void main(){
  vec3 a = sampleA(vUv);
  vec3 c = a;
  if (mixAB > 0.0005) {
    vec3 b = texture2D(tB, vUv).rgb;
    float n = fbm(vUv * vec2(res.x / res.y, 1.0) * 2.4 + 3.1);
    float edge = smoothstep(mixAB * 1.25 - 0.18, mixAB * 1.25 + 0.02, n);   // 1 = still A
    float rim = smoothstep(0.0, 0.08, edge) * (1.0 - smoothstep(0.08, 0.22, edge));
    c = mix(b, a, edge);
    c += vec3(0.85, 0.66, 0.38) * rim * 0.18 * (1.0 - abs(mixAB - 0.5) * 2.0);
  } else if (wipe >= 0.0 && bleed > 0.5) {
    // the dissolve's noise and rim, its threshold a ramp from the edge (all A) to a band below it (all B); the band
    // narrows as the edge nears the top, so A is gone exactly when the edge leaves the screen (no pop)
    // the scene above goes down to bleedDim as the edge climbs (from 0.95 to 0.5 of the screen), so what it shows
    // beside the rising title (the film's line art, Results' ring of watchers) recedes instead of competing with it
    a *= mix(bleedDim, 1.0, smoothstep(0.5, 0.95, wipe));
    vec3 b = texture2D(tB, vUv).rgb;
    float m = clamp((1.0 - vUv.y - wipe) / max(0.001, 0.3 * min(1.0, wipe / 0.3)), 0.0, 1.0);
    float n = fbm(vUv * vec2(res.x / res.y, 1.0) * 2.4 + 3.1);
    float edge = smoothstep(m * 1.25 - 0.18, m * 1.25 + 0.02, n);   // 1 = still A
    float rim = smoothstep(0.0, 0.08, edge) * (1.0 - smoothstep(0.08, 0.22, edge));
    c = mix(b, a, edge) + vec3(0.85, 0.66, 0.38) * rim * 0.18 * step(0.001, m) * (1.0 - m);
  } else if (wipe >= 0.0) {
    vec3 b = texture2D(tB, vUv).rgb;
    float y = 1.0 - vUv.y;                                   // from the top
    float f = 0.1;                                           // feather, below the edge (the sheet's soft shadow)
    float k = smoothstep(wipe, wipe + f, y);                 // 0 sheet … 1 the scene below
    float up = smoothstep(wipe - 0.16, wipe, y);
    float glow = up * up * (1.0 - k);                          // warm falloff along the sheet's lower edge
    vec3 s = a + vec3(0.075, 0.053, 0.028) * glow * (1.0 - dot(a, vec3(0.333)));
    c = mix(s, b, k);
  }
  vec2 q = vUv - 0.5;
  c *= 1.0 - vignette * smoothstep(0.25, 0.95, dot(q, q) * 2.2);
  c = mix(c, fadeColor, fade);
  float g = hash(vUv * res + fract(time * 13.7) * 91.0) - 0.5;
  c += g * grain * (0.6 + 0.4 * (1.0 - dot(c, vec3(0.333))));
  gl_FragColor = vec4(c, 1.0);
}`;

export function createPost() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: {
      tA: { value: null }, tB: { value: null }, mixAB: { value: 0 }, time: { value: 0 },
      res: { value: new THREE.Vector2(1, 1) }, grain: { value: 0.045 }, vignette: { value: 0.32 },
      fringe: { value: 0 }, fadeColor: { value: new THREE.Color(0x0b0805) }, fade: { value: 0 }, wipe: { value: -1 }, bleed: { value: 0 }, bleedDim: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { mat, scene, camera, u: mat.uniforms };
}
