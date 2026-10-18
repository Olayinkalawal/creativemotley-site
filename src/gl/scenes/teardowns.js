/* Photoreal teardowns (the Editions Retail moment): the view orbits a device that fills the screen, the device
   glides aside into the column layout, and comes apart beside its spec list on a pure black stage.
   Two frame streams per device, both scrubbed by scroll:
     orbit    /assets/teardown/<name>/orbit/<tier>/f_0001…f_0097  (far angle → hero angle, constant visual speed)
     explode  /assets/teardown/<name>/<tier>/f_0001…f_0145        (hero angle → fully exploded)
   orbit f_0097 and explode f_0001 are the same picture: the shader crossfades them at the junction (mixT).
   The frame is drawn contain-fit into the section's [data-td-slot] (its rect is driven by sections/_teardown.js:
   the whole viewport in the hero phase, the column rect after the hand-off), zoomed and shifted by the run's
   framing; it is never clipped to the slot, so it may bleed past it (into the render's own black).
   Phases, framing and the uv → screen mapping live in gl/lib/tdcore.js (shared with the section).
   Once the parts settle, the exploded frame becomes a depth diorama: pointer parallax and a slow push.
   Scene ids: td:camera (Method), td:mixer, td:mic, td:headphones, td:phone (Kit). One draw per scene. */
import * as THREE from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { loadTexture } from '../lib/loaders.js';
import { TD_ORBIT, TD_EXPLODE, TD_ASPECT, TD_LIVE, tdRun, tdPhases, tdOrbitFrame, tdExplodeFrame, tdFraming, tdFit, tdView } from '../lib/tdcore.js';

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = /* glsl */`
precision highp float;
uniform sampler2D mapA;   // orbit
uniform sampler2D mapB;   // explode
uniform sampler2D depth;
uniform float mixT;       // 0 orbit … 1 explode
uniform vec4 rect;        // slot in canvas px: x, y (from bottom), w, h
uniform float aspect;
uniform vec2 pointer; uniform float strength; uniform float push; uniform float zoom;
uniform float fade;
uniform vec2 shift;
float D(vec2 p){ return texture2D(depth, vec2(p.x, 1.0 - p.y)).r; }
void main(){
  vec2 q = (gl_FragCoord.xy - rect.xy) / rect.zw;            // 0..1 inside the slot (and beyond it)
  float ra = rect.z / rect.w;
  vec2 s = ra > aspect ? vec2(ra / aspect, 1.0) : vec2(1.0, aspect / ra);   // contain
  vec2 uv = (q - 0.5) * s / zoom + 0.5 + shift;
  vec2 p = uv;
  if (strength > 0.0001 || push > 0.0001) {
    for (int i = 0; i < 4; i++) { float d = D(p); p = uv + pointer * strength * (d - 0.4) - (uv - 0.5) * push * (d - 0.3); }
  }
  vec3 c = vec3(0.0);
  if (p.x > 0.0 && p.x < 1.0 && p.y > 0.0 && p.y < 1.0) {
    vec2 t = vec2(p.x, 1.0 - p.y);
    if (mixT < 0.999) c = texture2D(mapA, t).rgb;
    if (mixT > 0.001) c = mix(c, texture2D(mapB, t).rgb, mixT);
    // feather the frame edge into the void so no seam can show where the frame ends inside the screen
    vec2 e = smoothstep(vec2(0.0), vec2(0.03), p) * smoothstep(vec2(0.0), vec2(0.03), 1.0 - p);
    c *= e.x * e.y;
  }
  gl_FragColor = vec4(c * fade, 1.0);
}`;

function teardown(name, stage) {
  const id = `td:${name}`;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: {
      mapA: { value: null }, mapB: { value: null }, depth: { value: null }, mixT: { value: 0 },
      rect: { value: new THREE.Vector4(0, 0, 1, 1) }, aspect: { value: TD_ASPECT },
      pointer: { value: new THREE.Vector2() }, strength: { value: 0 }, push: { value: 0 },
      zoom: { value: 1 }, fade: { value: 1 }, shift: { value: new THREE.Vector2() },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  const live = { px: 0, py: 0, push: 0, strength: 0 };
  TD_LIVE.set(id, live);
  const V = {};
  let orbit = null, explode = null, tier = 'lg';
  let section = null, run = null, slot = null, F = null, tall = null, open = false, vw = 0, vh = 0;

  stage.add({
    id, scene, camera,
    post: { vignette: 0.16, grain: 0.03, fringe: 0.5 },
    async load(ctx) {
      // phones get the 1080/960 px tier; anything that will show more than ~1500 device px gets the full one
      tier = ctx.vw * Math.min(2, ctx.dpr || 1) >= 1500 ? 'lg' : 'sm';
      orbit = new FrameStream({ dir: `/assets/teardown/${name}/orbit/${tier}`, count: TD_ORBIT, rev: 1, ahead: TD_ORBIT, behind: TD_ORBIT, decoded: 10 });
      const [dep] = await Promise.all([loadTexture(`/assets/teardown/${name}/depth.png`), orbit.first()]);
      mat.uniforms.depth.value = dep;
    },
    deactivate() { orbit?.trim(); explode?.trim(); },
    update(ctx, s) {
      const isTall = ctx.vh > ctx.vw;
      if (s.el !== section || isTall !== tall || ctx.vw !== vw || ctx.vh !== vh) {
        section = s.el; tall = isTall; vw = ctx.vw; vh = ctx.vh;
        run = section.querySelector('[data-td-run]') || section;
        slot = section.querySelector('[data-td-slot]');
        const target = section.querySelector('[data-td-target]');
        F = tdFraming(section, tall);
        if (target) tdFit(F, { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight }, ctx.vw, ctx.vh);
        open = section.hasAttribute('data-td-open');
      }
      const r = tdRun(run, ctx.scrollY, ctx.vh);
      const ph = tdPhases(r.pv, r.vp, open);
      const reduced = ctx.reduced;
      // the explode streams once its run is within a viewport (the orbit, shown first, loads first)
      if (!explode && (r.pv > -r.vp || orbit.complete)) {
        explode = new FrameStream({ dir: `/assets/teardown/${name}/${tier}`, count: TD_EXPLODE, rev: 1, ahead: 150, behind: 40, decoded: 12 });
      }
      const u = mat.uniforms;
      if (ph.mix < 1 || !explode?.ready) orbit.seek(reduced ? TD_ORBIT - 1 : tdOrbitFrame(ph));
      else orbit.trim();   // past the junction: the orbit's decoded frames are not needed until we scroll back
      if (explode) explode.seek(reduced ? TD_EXPLODE - 1 : tdExplodeFrame(ph));
      u.mapA.value = orbit.texture;
      u.mapB.value = explode ? explode.texture : orbit.texture;
      u.mixT.value = explode?.ready ? ph.mix : 0;
      // slot rect: canvas px, y measured from the bottom (gl_FragCoord); the section JS wrote it this frame
      const b = slot ? slot.getBoundingClientRect() : { left: 0, top: 0, width: ctx.vw, height: ctx.vh };
      const k = ctx.dpr;
      u.rect.value.set(b.left * k, (ctx.vh - b.top - b.height) * k, Math.max(1, b.width * k), Math.max(1, b.height * k));
      tdView(F, ph, V);
      u.zoom.value = V.zoom;
      u.shift.value.set(V.sx, V.sy);
      // the settled diorama: depth parallax under the pointer and a slow breathing push
      const st = reduced ? 0 : ph.settle;
      u.strength.value = 0.014 * st;
      u.push.value = st * (0.018 + 0.01 * Math.sin(ctx.time * 0.35));
      u.pointer.value.copy(ctx.pointer);
      u.fade.value = ph.fade;
      live.px = ctx.pointer.x; live.py = ctx.pointer.y; live.push = u.push.value; live.strength = u.strength.value;
    },
  });
}

export default function register(stage) {
  for (const name of ['camera', 'mixer', 'mic', 'headphones', 'phone']) teardown(name, stage);
}
