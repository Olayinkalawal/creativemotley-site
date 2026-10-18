/* The umber stage, scene "plate:umber": a dark warm room drawn by one full-screen shader (no textures).
   It sits under VII · Results' counters and VIII · Directors.
   - a soft warm pool of light on ink, with a little plaster in the dark;
   - slow dust motes, three depths of them (two on tier 1), brightest where they cross the pool, rising slowly
     and drifting with scroll (nearer motes travel further, so the room has depth);
   - the light is keyed per region: any element with data-umber="dx y r lights dust" sets the pool for the
     region from its top down (dx: pool centre x offset from the column centre, in viewport widths; y: 0 bottom
     … 1 top; r: radius in viewport heights; lights: 0..1; dust: 0..1). Keys are blended across each region's
     top as it passes the middle of the viewport: a pure function of scroll, so scrolling back is exact. */
import * as THREE from 'three';
import { fullscreenQuad } from '../lib/plate.js';
import { geo } from '../../core/layout.js';
import { smooth, seg } from '../../core/scroll.js';

const vert = /* glsl */`void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = /* glsl */`
precision highp float;
uniform vec2 res;
uniform float time;
uniform vec2 pool;       // uv, y up
uniform float radius;    // in viewport heights
uniform float lights;
uniform float dust;
uniform float layers;
uniform float scroll;    // scroll in viewport heights
uniform vec2 pointer;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  float asp = res.x / res.y;
  vec2 sp = vec2(uv.x * asp, uv.y);                       // square units, 1 = viewport height
  vec2 pc = vec2((pool.x + pointer.x * 0.012) * asp, pool.y + pointer.y * 0.01);
  vec2 q = (sp - pc) / vec2(radius * 1.3, radius);
  float d2 = dot(q, q);
  float g = exp(-d2 * 1.7);                                // the pool
  float halo = exp(-d2 * 0.45);                            // its wide, faint spill
  vec3 c = vec3(0.043, 0.031, 0.020);                      // ink
  c += vec3(0.085, 0.056, 0.030) * halo * lights;
  c += vec3(0.20, 0.135, 0.07) * g * lights;
  float n = noise(sp * 3.2 + 7.0) * 0.6 + noise(sp * 11.0 + 3.0) * 0.4;
  c *= 0.9 + 0.2 * n;                                      // plaster
  c *= 1.0 - 0.3 * smoothstep(0.4, 0.0, uv.y) * (1.0 - g); // the floor falls off into shadow

  // dust: one mote per occupied cell, kept clear of the cell edges so no neighbour lookups are needed
  vec3 mote = vec3(0.96, 0.8, 0.54);
  for (int i = 0; i < 3; i++) {
    float L = float(i);
    if (L >= layers) break;
    float cells = 5.0 + L * 4.0;                          // near (big, few) → far (small, many)
    float depth = 1.0 - L * 0.32;
    vec2 p = sp * cells;
    p.y -= time * (0.05 + 0.03 * depth) * cells * 0.16 + scroll * depth * 0.55 * cells;
    p.x += sin(time * 0.05 + L * 2.1) * 0.6 + time * 0.012 * cells * (L - 1.0);
    vec2 cell = floor(p), f = fract(p);
    float h = hash(cell + L * 31.7);
    if (h > 0.3 - L * 0.06) continue;                      // sparse: fewer motes far away too
    vec2 at = 0.25 + 0.5 * vec2(hash(cell + 3.1 + L), hash(cell + 9.7 - L));
    at += 0.12 * vec2(sin(time * 0.3 + h * 40.0), cos(time * 0.23 + h * 23.0));
    float r = mix(0.035, 0.07, hash(cell + 5.3)) * (1.25 - L * 0.25);
    float d = length(f - at);
    float a = 1.0 - smoothstep(r * 0.15, r, d);
    float tw = 0.55 + 0.45 * sin(time * (0.6 + h) + h * 60.0);
    vec2 wp = sp - (f - at) / cells;                       // the mote's own screen position, for the light it sits in
    vec2 wq = (wp - pc) / vec2(radius * 1.4, radius * 1.15);
    float lit = 0.12 + 0.88 * exp(-dot(wq, wq) * 0.9);
    c += mote * a * tw * lit * dust * (0.1 + 0.07 * depth);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const parse = (s) => s.trim().split(/\s+/).map(Number);

export default function register(stage) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: {
      res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, pool: { value: new THREE.Vector2(0.6, 0.5) },
      radius: { value: 0.6 }, lights: { value: 1 }, dust: { value: 1 }, layers: { value: 3 }, scroll: { value: 0 },
      pointer: { value: new THREE.Vector2() },
    },
  });
  scene.add(fullscreenQuad(mat));
  const u = mat.uniforms;
  let keys = [];
  const collect = () => { keys = [...document.querySelectorAll('[data-umber]')].map((el) => ({ el, k: parse(el.dataset.umber) })); };
  const key = [0, 0.5, 0.6, 1, 1];

  stage.add({
    id: 'plate:umber', scene, camera,
    post: { grain: 0.05, vignette: 0.4 },
    load(ctx) { collect(); u.layers.value = ctx.tier >= 2 ? 3 : 2; },
    resize(w, h) { u.res.value.set(w, h); },
    update(ctx) {
      if (!keys.length || !document.body.contains(keys[0].el)) collect();
      const line = ctx.scrollY + ctx.vh * 0.5, band = ctx.vh * 0.45;
      if (keys.length) {
        for (let j = 0; j < 5; j++) key[j] = keys[0].k[j] ?? key[j];
        for (let i = 1; i < keys.length; i++) {
          const t = smooth(seg(line, geo(keys[i].el).top - band, geo(keys[i].el).top + band));
          if (t <= 0) break;
          for (let j = 0; j < 5; j++) key[j] += ((keys[i].k[j] ?? key[j]) - key[j]) * t;
        }
      }
      // the column's centre: right of the rail on desktop, the middle on phones
      const railW = ctx.vw >= 1024 ? Math.min(288, Math.max(200, ctx.vw * 0.2)) : 0;
      const cx = (railW + ctx.vw) / 2 / ctx.vw;
      u.pool.value.set(cx + key[0], key[1]);
      u.radius.value = key[2];
      u.lights.value = key[3] * (1 + 0.035 * Math.sin(ctx.time * 0.45));
      u.dust.value = key[4];
      u.time.value = ctx.time;
      u.scroll.value = ctx.scrollY / ctx.vh;
      u.pointer.value.copy(ctx.pointer);
    },
  });
}
