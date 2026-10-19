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
   Tiers: each stream picks its source (lg 1920/1600 px, sm 1080/960) from the device pixels it will cover
   (viewport or column × zoom × devicePixelRatio, capped at 2). The stage renders at its pixel budget (no per-scene
   resolution switch, so the canvas is never reallocated mid-run).
   Streams (gl/lib/frameStream.js) hold a ±24-frame window around the playhead: the explode is never fetched in one
   burst at the section edge; it starts (its first 25 frames) a viewport before the run and streams with the scroll.
   Desktop only: on the phone still path the sections show their stills over a black stage (gl/scenes/stills.js).
   Portrait screens: the 16:9 frame is a band across the middle, so its top and bottom edges feather long (no hard
   line where a close render runs past its own frame), and data-td-orbit-tall keeps the orbit to its clean range.
   Scene ids: td:camera (Method), td:mixer, td:mic, td:headphones, td:phone (Kit). One draw per scene. */
import { Scene, OrthographicCamera, ShaderMaterial, Mesh, PlaneGeometry, Vector2, Vector4 } from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { loadTexture } from '../lib/loaders.js';
import { TD_EXPLODE, TD_ASPECT, tdLive, tdRun, tdPhases, tdFlags, tdOrbitRange, tdOrbitFrame, tdExplodeFrame, tdFraming, tdFit, tdView, tdContain, tdLerpRect, tdPinTop } from '../lib/tdcore.js';

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
uniform vec2 feather;     // frame-edge feather (frame uv): long vertically on portrait screens
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
    vec2 e = smoothstep(vec2(0.0), feather, p) * smoothstep(vec2(0.0), feather, 1.0 - p);
    c *= e.x * e.y;
  }
  gl_FragColor = vec4(c * fade, 1.0);
}`;

/* source tier per stream from the device pixels it will cover (a sm frame is 1080 px wide (orbit), 960 (explode));
   portrait screens accept a little upscale before paying for the lg frames */
function tiers(section) {
  const W = innerWidth, H = innerHeight, tall = H > W, dpr = Math.min(2, window.devicePixelRatio || 1);
  const F = tdFraming(section, tall);
  const t = section.querySelector('[data-td-target]');
  const orbitPx = tdContain(W, H).w * F.hero.z * dpr;
  const colPx = tdContain(t?.offsetWidth || W, t?.offsetHeight || H).w * Math.max(F.frame0.z, F.frame.z) * dpr;
  const k = tall ? 1.2 : 1.0;
  return { o: orbitPx > 1080 * k ? 'lg' : 'sm', x: colPx > 960 * k ? 'lg' : 'sm', tall };
}

function teardown(name, stage) {
  const id = `td:${name}`;
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: {
      mapA: { value: null }, mapB: { value: null }, depth: { value: null }, mixT: { value: 0 },
      rect: { value: new Vector4(0, 0, 1, 1) }, aspect: { value: TD_ASPECT },
      pointer: { value: new Vector2() }, strength: { value: 0 }, push: { value: 0 },
      zoom: { value: 1 }, fade: { value: 1 }, shift: { value: new Vector2() }, feather: { value: new Vector2(0.03, 0.03) },
    },
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  const live = tdLive(id);
  const V = {}, S = {};
  let orbit = null, orbitKey = '', explode = null, dep = null, T = { o: 'lg', x: 'lg', tall: false };
  const redraw = () => stage.invalidate();
  let section = null, run = null, F = null, fl = null, tall = null, vw = 0, vh = 0, heroR = null, colR = null, pinH = 0;
  const orbitStream = (lo, hi) => {
    const key = `${lo}-${hi}`;
    if (key === orbitKey && orbit) return orbit;
    orbitKey = key;
    orbit?.dispose();
    const n = hi - lo + 1, small = T.tall && T.o === 'lg';
    return (orbit = new FrameStream({ dir: `/assets/teardown/${name}/orbit/${T.o}`, count: n, name: (i) => `f_${String(lo + i).padStart(4, '0')}.webp`, rev: 1, decoded: small ? 6 : 10, onShow: redraw }));
  };

  stage.add({
    id, scene, camera, device: true,
    post: { vignette: 0.16, grain: 0.03, fringe: 0.5 },
    async load() {
      const sec = document.querySelector(`[data-scene="${id}"]`);
      T = sec ? tiers(sec) : T;
      const [lo, hi] = sec ? tdOrbitRange(sec, T.tall) : [1, 97];
      orbitKey = ''; section = null;
      orbitStream(lo, hi);
      [dep] = await Promise.all([loadTexture(`/assets/teardown/${name}/depth.png`), orbit.first()]);
      mat.uniforms.depth.value = dep;
    },
    dispose() {
      orbit?.dispose(); explode?.dispose(); orbit = explode = null; orbitKey = '';
      dep?.dispose(); dep = null;
      mat.uniforms.mapA.value = mat.uniforms.mapB.value = mat.uniforms.depth.value = null;
    },
    deactivate() { orbit?.trim(); explode?.trim(); },
    update(ctx, s) {
      const isTall = ctx.vh > ctx.vw;
      if (s.el !== section || isTall !== tall || ctx.vw !== vw || ctx.vh !== vh) {
        section = s.el; tall = isTall; vw = ctx.vw; vh = ctx.vh;
        run = section.querySelector('[data-td-run]') || section;
        const pin = section.querySelector('.td__pin');
        const target = section.querySelector('[data-td-target]');
        pinH = pin ? pin.clientHeight : ctx.vh;
        heroR = { x: 0, y: 0, w: pin ? pin.clientWidth : ctx.vw, h: pinH };
        colR = target ? { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight } : heroR;
        F = tdFit(tdFraming(section, tall), colR, heroR.w, heroR.h);
        fl = tdFlags(section);
        const [lo, hi] = tdOrbitRange(section, tall);
        orbitStream(lo, hi);
        mat.uniforms.feather.value.set(0.03, tall ? 0.15 : 0.03);
      }
      const r = tdRun(run, ctx.scrollY, ctx.vh);
      const ph = tdPhases(r.pv, r.vp, fl);
      const Fx = (live.F && live.F.tall === tall) ? live.F : F;   // the section's framing (it fits the measured column)
      const reduced = ctx.reduced;
      // the explode starts streaming (its first 25 frames, then with the playhead) once its run is within a viewport
      if (!explode && r.pv > -r.vp) {
        const small = T.tall && T.x === 'lg';
        explode = new FrameStream({ dir: `/assets/teardown/${name}/${T.x}`, count: TD_EXPLODE, rev: 1, decoded: small ? 8 : 12, onShow: redraw });
      }
      const u = mat.uniforms;
      if (ph.mix < 1 || !explode?.ready) orbit.seek(reduced ? orbit.count - 1 : tdOrbitFrame(ph, orbit.count));
      else orbit.trim();   // past the junction: the orbit's decoded frames are not needed until we scroll back
      if (explode) explode.seek(reduced ? TD_EXPLODE - 1 : tdExplodeFrame(ph, Fx.xmap));
      u.mapA.value = orbit.texture;
      u.mapB.value = explode ? explode.texture : orbit.texture;
      u.mixT.value = explode?.ready ? ph.mix : 0;
      // slot rect (viewport px): the section JS computed it this frame (it drives the slot element from the same
      // numbers); if it has not (it rests while far away), the same rect from the same clock
      let x, y, w, h;
      if (live.f === ctx.frame) { x = live.x; y = live.y; w = live.w; h = live.h; }
      else { tdLerpRect(heroR, colR, ph.hand, S); x = S.x; y = S.y + tdPinTop(r, ctx.scrollY, pinH); w = S.w; h = S.h; }
      const k = ctx.dpr;
      u.rect.value.set(x * k, (ctx.vh - y - h) * k, Math.max(1, w * k), Math.max(1, h * k));
      tdView(Fx, ph, V);
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
