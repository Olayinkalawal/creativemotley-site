/* Photoreal teardowns (the Editions exploded-hub moment, five times): a 145-frame render of a
   device coming apart, streamed into a texture and scrubbed by scroll on a pure black stage.
   The frame is drawn contain-fit into the section's [data-td-slot] (right of the spec list on
   desktop, above it on phones); everything outside it is black, as is the render's own void.
   Once the parts settle, the last frame becomes a depth diorama: pointer parallax and a slow push.

   Scroll → frame: the section's [data-td-run] pins; frames run over 6%–82% of the pin with an
   ease-in-out, then hold exploded. Scene ids: td:camera, td:mixer, td:mic, td:headphones, td:phone. */
import * as THREE from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { loadTexture } from '../lib/loaders.js';
import { geo } from '../../core/layout.js';
import { clamp, smooth, seg } from '../../core/scroll.js';

export const TD_COUNT = 145;
export const tdProgress = (run, y, vh) => { const g = geo(run); return clamp((y - g.top) / Math.max(1, g.height - vh)); };
export const tdFrame = (p) => smooth(seg(p, 0.06, 0.82)) * (TD_COUNT - 1);

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = /* glsl */`
precision highp float;
uniform sampler2D map; uniform sampler2D depth;
uniform vec4 rect;        // slot in canvas px: x, y (from bottom), w, h
uniform vec2 imgSize;
uniform vec2 pointer; uniform float strength; uniform float push; uniform float zoom;
uniform float fade;
uniform vec2 shift;
float D(vec2 p){ return texture2D(depth, vec2(p.x, 1.0 - p.y)).r; }
void main(){
  vec2 q = (gl_FragCoord.xy - rect.xy) / rect.zw;           // 0..1 inside the slot
  float ra = rect.z / rect.w, ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(ra / ia, 1.0) : vec2(1.0, ia / ra); // contain
  vec2 uv = (q - 0.5) * s / zoom + 0.5 + shift;
  vec2 p = uv;
  if (strength > 0.0001) {
    for (int i = 0; i < 4; i++) { float d = D(p); p = uv + pointer * strength * (d - 0.4) - (uv - 0.5) * push * (d - 0.3); }
  }
  vec3 c = vec3(0.0);
  if (p.x > 0.0 && p.x < 1.0 && p.y > 0.0 && p.y < 1.0) {
    c = texture2D(map, vec2(p.x, 1.0 - p.y)).rgb;
    // feather the frame edge into the void so no seam can show
    vec2 e = smoothstep(vec2(0.0), vec2(0.035), p) * smoothstep(vec2(0.0), vec2(0.035), 1.0 - p);
    c *= e.x * e.y;
  }
  gl_FragColor = vec4(c * fade, 1.0);
}`;

function teardown(name, stage) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: {
      map: { value: null }, depth: { value: null }, rect: { value: new THREE.Vector4(0, 0, 1, 1) },
      imgSize: { value: new THREE.Vector2(16, 9) }, pointer: { value: new THREE.Vector2() },
      strength: { value: 0 }, push: { value: 0 }, zoom: { value: 1 }, fade: { value: 1 }, shift: { value: new THREE.Vector2() },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  let stream, run, slot, section, frame = { zoom: 1.3, sx: 0, sy: 0 };
  /* framing per device: data-td-frame="zoom shiftX shiftY" (desktop) and data-td-frame-tall (portrait);
     zoom > 1 lets the render's black margins run past the slot so the device fills it */
  const readFrame = (el, tall) => {
    const v = (tall && el.dataset.tdFrameTall) || el.dataset.tdFrame;
    const [z, x, y] = v ? v.trim().split(/\s+/).map(Number) : [tall ? 1.55 : 1.3, 0, 0];
    return { zoom: z || 1, sx: x || 0, sy: y || 0 };
  };
  stage.add({
    id: `td:${name}`, scene, camera,
    post: { vignette: 0.18, grain: 0.03, fringe: 0.6 },
    async load(ctx) {
      const tier = ctx.vw * Math.min(2, ctx.dpr || 1) < 1500 ? 'sm' : 'lg';
      stream = new FrameStream({ dir: `/assets/teardown/${name}/${tier}`, count: TD_COUNT, rev: 1, ahead: 150, behind: 40, decoded: 16 });
      const [dep] = await Promise.all([loadTexture(`/assets/teardown/${name}/depth.png`), stream.first()]);
      mat.uniforms.depth.value = dep;
    },
    update(ctx, s) {
      if (s.el !== section || frame.tall !== ctx.vh > ctx.vw) {
        section = s.el; run = section.querySelector('[data-td-run]') || section; slot = section.querySelector('[data-td-slot]');
        frame = readFrame(section, ctx.vh > ctx.vw); frame.tall = ctx.vh > ctx.vw;
      }
      const p = tdProgress(run, ctx.scrollY, ctx.vh);
      stream.seek(ctx.reduced ? TD_COUNT - 1 : tdFrame(p));
      const u = mat.uniforms;
      u.map.value = stream.texture; u.imgSize.value.set(stream.size[0], stream.size[1]);
      // slot rect: canvas px, y measured from the bottom (gl_FragCoord)
      const r = slot ? slot.getBoundingClientRect() : { left: 0, top: 0, width: ctx.vw, height: ctx.vh };
      const k = ctx.dpr;
      u.rect.value.set(r.left * k, (ctx.vh - r.top - r.height) * k, Math.max(1, r.width * k), Math.max(1, r.height * k));
      const settled = ctx.reduced ? 1 : smooth(seg(p, 0.82, 0.92));
      u.strength.value = 0.016 * settled;
      u.push.value = settled * (0.02 + 0.012 * Math.sin(ctx.time * 0.35));
      u.pointer.value.copy(ctx.pointer);
      u.zoom.value = frame.zoom * (1 + 0.03 * smooth(p));
      u.shift.value.set(frame.sx, frame.sy);
      // fade up out of the black as the pin arrives, and away as it leaves
      u.fade.value = smooth(seg(s.pe, 0.02, 0.16)) * (1 - smooth(seg(s.pe, 0.9, 0.99)));
    },
  });
}

export default function register(stage) {
  for (const name of ['camera', 'mixer', 'mic', 'headphones', 'phone']) teardown(name, stage);
}
