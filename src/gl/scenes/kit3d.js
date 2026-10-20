/* The Kit chapter's four real-time devices as one stage scene (td:kit; drop-in: copy to src/gl/scenes/kit3d.js, with the
   runtime .lab/kit3d/kit3d.js and its device configs .lab/kit3d/kit3d_devices.js in src/gl/lib/). It replaces the
   photoreal frame streams gl/scenes/teardowns.js drew for the Kit (that module skips td:kit), on every path: desktop and,
   with the phone GLBs, the phone still path (gl/boot.js routes td:kit here ahead of gl/scenes/stills.js).
   The choreography stays the section's (sections/_teardown.js + gl/lib/tdcore.js TD_PLAN.seq): this scene reads the same
   clock (tdRun → tdTimeline → tdState: shot k, its phases, the cut to shot k + 1, the incoming shot's phases, the fade)
   and the same slot rect the section computes each frame (live.x/y/w/h: the orbit's rect, then the column), so the
   devices, the copy, the rows and the markers move as one:
     shot 0   the console: the view orbits it full screen under the title, it glides into the column as its colour key
              comes up, comes apart (tdShotPhases' explode) and holds (settle);
     shot k   a cut: an ink-bled front from the right edge wipes in shot k's key with its device whole on it (the column
              key), which then comes apart in turn: microphone, headphones, phone.
   One renderer: the stage's. One host draw: a fullscreen pass puts shot k's device (its running mean: premultiplied,
   alpha = coverage, canvas-sized) over its colour key (data-td-key "centre edge": the same radial field teardowns.js
   drew, centred on the slot) with a matching contact shadow (the device's coverage, blurred into a small target and
   dropped a little: the soft dark aura the photoreal frames' mattes carried), and during a cut the incoming device on
   its own key behind the wipe. The devices draw through one pool of targets (kit3d.js createPool): HDR MSAA, the 8-bit
   tone-mapped target and the bloom chain are shared; each drawn device keeps only its running mean.
   Lazy per device: the shot on screen loads first (load() waits for it, so the stage keeps the section's stills until
   it draws); the next device loads when its cut is near (one load at a time); a device two or more shots away is
   disposed (every GPU resource freed); a loaded neighbour that is not drawn frees its running mean. A device that is
   not ready when its shot shows (a fast scroll, a slow machine) stands in with its 3D stills through the frame path
   (framed by the shot's data-td-frame0 / data-td-frame keys, measured on those stills), then cross-fades to live.
   Markers: after posing (dev.anchors() poses first), the scene publishes shot k's anchors relative to the pin
   (live.anchors3d, tagged with the shot) and calls the section's live.place3d(), which writes the marker transforms in
   the same frame, after the section's own pass: no lag behind the parts. The id pass (occlusion) lands inside render()
   once the view has settled; until the next update() has published it the scene stays ambient(), so the stage draws one
   more frame (the camera's rule). While a shot stands in with its stills, its markers fall back to the uv on the still.
   live.ready (the section's two-way "drawn"): true once the scene shows shot k (its device, or its stills), false again
   when disposed, so the section brings its own stills and DOM keys back over the stage's ink until the scene reloads.
   Stand-in on arrival (the camera's): load() makes the first shot's two DOM stills eager and waits until they have
   painted, then loads its device; the first frame drawn while a stand-in is on screen starts at the still's own pose
   (the hero still before a quarter of the explode, the exploded still after it) and turns into the scroll's pose over
   0.9 s while the still dissolves (_teardown.css). The markers draw in with the scroll: an id pass every 0.025 of
   explode from 0.93 (the runtime trusts a pass within 0.03 of its pose), one as it reaches 1, every third of the settle,
   and one whenever the view settles. These rules are tdcore's, shared with Method's camera (gl/scenes/camera3d.js).
   Phones (the still path, where core/env.js CAM3D allows it): the phone GLBs; if the frame-rate governor has to step all
   the way down to "min" while the Kit draws, the scene gives up for the visit (data-kit3d="stills": the section keeps
   its 3D stills; ?q=… turns that off for QA, ?cam3d=1 forces the 3D onto a phone below CAM3D, as for the camera).
   No bloom (the camera's choice: strength 0.05 over threshold 4 never shows, and it is a full-screen pass per sample).
   Idle-stop: re-renders on change, then adds jittered samples while ambient() (≤ 12 frames), then the stage stops.
   Reduced motion never reaches this scene (main.js does not boot the stage; the section shows the static layout with
   the 3D stills); if it did (ctx.reduced): no orbit, each device held exploded in the column, cuts as cross-fades. */
import { Scene, OrthographicCamera, ShaderMaterial, Mesh, PlaneGeometry, Vector2, Vector3, Vector4, WebGLRenderTarget, UnsignedByteType, LinearFilter } from 'three';
import { create, createPool } from '../lib/kit3d.js';
import { DEVICES } from '../lib/kit3d_devices.js';
import { loadTexture } from '../lib/loaders.js';
import { TD_ASPECT, tdLive, tdRun, tdFlags, tdShots, tdDev, tdTimeline, tdState, tdFraming, tdFit, tdView, tdLerpRect, tdPinTop,
  tdIdDue, tdIntroPose, tdStandIn, tdGiveUp, tdPointerStep, TD_INTRO_MS } from '../lib/tdcore.js';

const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);
const seg = (x, a, b) => clamp01((x - a) / (b - a));
const PREFETCH = 1.1;          // screens before its cut: the next device starts loading
const STILL_AHEAD = 0.12;      // screens before its cut: a device that is not ready yet fetches its hero still (the exploded
                               // one only once its explode starts without it): the stand-in fetches only what it shows
const FADE_MS = 350;           // the stand-in still → the live device (a cross-fade, on the stage's clock), while the device
                               // turns from the still's pose into the scroll's (TD_INTRO_MS). The intro turn, the id passes' schedule, the
                               // stand-in's wait, the phone give-up and the pointer steps are tdcore's, shared with Method's
                               // camera (gl/scenes/camera3d.js)
const SHADOW_DIV = 8;          // the contact shadow's target: 1/8 of the canvas

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = /* glsl */`
precision highp float;
uniform sampler2D mapA;   // shot k: the live device's frame (premultiplied, alpha = coverage, canvas-sized) …
uniform sampler2D stA0;   // … or its stills (the stand-in): hero
uniform sampler2D stA1;   //   and exploded
uniform sampler2D shA;    // shot k's coverage, blurred (the contact shadow)
uniform sampler2D mapN; uniform sampler2D stN0; uniform sampler2D shN;   // the next shot, whole, during a cut
uniform float liveA; uniform float liveN;     // 0 the stills … 1 the live device (a cross-fade as it lands)
uniform vec2 stW;                             // shot k's stills: the hero's weight, the exploded one's (a dip through black)
uniform vec4 rect;                            // the slot, canvas px (y up)
uniform float aspect;
uniform float zoom; uniform vec2 shift; uniform float zoomN; uniform vec2 shiftN;   // the stills' framing (tdView)
uniform vec3 keyA0; uniform vec3 keyA1; uniform vec3 keyN0; uniform vec3 keyN1;
uniform float keyed;                          // shot k's key: up with the hand-off on shot 0, else 1 (0: the black stage)
uniform vec2 shOff; uniform vec2 shTexel; uniform float shK;   // the contact shadow: drop (uv), texel, strength
uniform float cutT; uniform float xfade;      // the wipe 0 … 1; reduced motion: a cross-fade
uniform float fade;
uniform vec2 res; uniform vec2 feather;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
vec2 frameUV(float z, vec2 sh){
  vec2 q = (gl_FragCoord.xy - rect.xy) / rect.zw;
  float ra = rect.z / rect.w;
  vec2 s = ra > aspect ? vec2(ra / aspect, 1.0) : vec2(1.0, aspect / ra);   // contain
  return (q - 0.5) * s / z + 0.5 + sh;
}
float edgeMask(vec2 p){
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0) return 0.0;
  vec2 e = smoothstep(vec2(0.0), feather, p) * smoothstep(vec2(0.0), feather, 1.0 - p);
  return e.x * e.y;
}
// teardowns.js keyBg: centred on the slot, radii 0.62 w × 0.74 h, display-referred
vec3 keyBg(vec3 c0, vec3 c1){
  vec2 d = (gl_FragCoord.xy - rect.xy - rect.zw * 0.5) / (rect.zw * vec2(0.62, 0.74) + 1.0);
  return mix(c0, c1, smoothstep(0.0, 1.0, length(d)));
}
// a still (premultiplied: loaded so; the 3D stills carry an alpha matte) through the frame transform
vec4 stillAt(sampler2D a, sampler2D b, vec2 wt, float z, vec2 sh){
  vec2 p = frameUV(z, sh); float em = edgeMask(p);
  if (em <= 0.0) return vec4(0.0);
  vec2 t = vec2(p.x, 1.0 - p.y);
  vec4 c = wt.x > 0.001 ? texture2D(a, t) * wt.x : vec4(0.0);
  if (wt.y > 0.001) c += texture2D(b, t) * wt.y;
  return c * em;
}
float shadowAt(sampler2D s, vec2 uv){
  float a = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) a += texture2D(s, uv + vec2(float(i), float(j)) * shTexel * 1.5).r;
  return a / 9.0;
}
void main(){
  vec2 sc = gl_FragCoord.xy / res;
  vec3 bg = keyBg(keyA0, keyA1) * keyed;
  if (keyed > 0.0 && liveA > 0.0) bg *= 1.0 - shK * liveA * shadowAt(shA, sc + shOff);
  vec4 d = liveA > 0.001 ? texture2D(mapA, sc) * liveA : vec4(0.0);
  if (liveA < 0.999) d += stillAt(stA0, stA1, stW, zoom, shift) * (1.0 - liveA);
  vec3 c = d.rgb + bg * (1.0 - d.a);
  if (cutT > 0.0) {
    // the cut: a front from the right edge to the left (the device's side first), its edge bled by ink (teardowns.js)
    float n = fbm(vec2(sc.x * res.x / res.y, sc.y) * 2.6 + 7.3);
    float w = (1.0 - sc.x) * 0.84 + sc.y * 0.16 + (n - 0.5) * 0.42;
    float front = cutT * 1.56 - 0.28;
    float k = xfade > 0.5 ? cutT : smoothstep(front + 0.012, front - 0.012, w);   // 1: the next shot
    if (k > 0.0) {
      vec3 bgN = keyBg(keyN0, keyN1);
      if (liveN > 0.0) bgN *= 1.0 - shK * liveN * shadowAt(shN, sc + shOff);
      vec4 dN = liveN > 0.001 ? texture2D(mapN, sc) * liveN : vec4(0.0);
      if (liveN < 0.999) dN += stillAt(stN0, stN0, vec2(1.0, 0.0), zoomN, shiftN) * (1.0 - liveN);
      c = mix(c, dN.rgb + bgN * (1.0 - dN.a), k);
    }
    if (xfade < 0.5) {
      float rim = 1.0 - smoothstep(0.0, 0.045, abs(w - front));
      c += (keyN0 * 2.4 + 0.02) * rim * 0.5 * (1.0 - abs(cutT - 0.5) * 1.2);
    }
  }
  gl_FragColor = vec4(c * fade, 1.0);
}`;
/* the device's coverage, box-blurred into a small target (the contact shadow's source) */
const shFrag = /* glsl */`
uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
void main(){
  float a = 0.0;
  for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) a += texture2D(t, vUv + (vec2(float(i), float(j)) - 1.5) * px).a;
  gl_FragColor = vec4(a / 16.0, 0.0, 0.0, 1.0);
}`;

export default function register(stage) {
  const id = 'td:kit';
  const section = document.querySelector(`[data-scene="${id}"]`);
  if (!section) return;
  const live = tdLive(id);
  live.ready = false;
  const scene = new Scene(), camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const V3 = () => new Vector3();
  const mat = new ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: {
      mapA: { value: null }, stA0: { value: null }, stA1: { value: null }, shA: { value: null },
      mapN: { value: null }, stN0: { value: null }, shN: { value: null },
      liveA: { value: 0 }, liveN: { value: 0 }, stW: { value: new Vector2(1, 0) },
      rect: { value: new Vector4(0, 0, 1, 1) }, aspect: { value: TD_ASPECT },
      zoom: { value: 1 }, shift: { value: new Vector2() }, zoomN: { value: 1 }, shiftN: { value: new Vector2() },
      keyA0: { value: V3() }, keyA1: { value: V3() }, keyN0: { value: V3() }, keyN1: { value: V3() }, keyed: { value: 0 },
      shOff: { value: new Vector2(0, -0.006) }, shTexel: { value: new Vector2(1 / 160, 1 / 90) }, shK: { value: 0.55 },
      cutT: { value: 0 }, xfade: { value: 0 }, fade: { value: 1 },
      res: { value: new Vector2(1, 1) }, feather: { value: new Vector2(0.03, 0.03) },
    },
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad);
  const shMat = new ShaderMaterial({ vertexShader: vert, fragmentShader: shFrag, depthTest: false, depthWrite: false, uniforms: { t: { value: null }, px: { value: new Vector2() } } });
  const shQuad = new Mesh(new PlaneGeometry(2, 2), shMat); shQuad.frustumCulled = false;
  const shScene = new Scene(); shScene.add(shQuad);
  const shRT = [null, null];       // the contact shadow's small targets: shot k, the incoming shot
  const live3 = (window.__kit3d ||= {});   // for QA scripts (like the stage's window.__stage): dev id → device
  window.__liveKit = live;

  let ctxRef = null, pool = null, shots = [], loading = null, disposed = true, gaveUp = false;
  let run = null, pinH = 0, heroR = null, colR = null, fl = null, timeline = null, TL = -1, vw = 0, vh = 0, tall = false;
  let A = null, N = null, lastA = null, idV = -1, idPending = false, moving = false;
  const ST = { ph: {}, phN: {} }, S = {}, VS = {}, VN = {}, PA = {}, PN = {};
  const RPH = { orbit: 1, hand: 1, explode: 1, settle: 1, handLin: 1, mix: 1, explodeLin: 1 };   // reduced: the exploded hold

  const build = () => {
    const els = tdShots(section), slot = section.querySelector('[data-td-slot]');
    const img = (c, j) => slot?.querySelector(`.${c}[data-td-still="${j}"]`) || null;
    const src = (im) => (im ? im.dataset.src || im.getAttribute('src') : null);
    shots = els.map((el, j) => {
      const dev = tdDev(el, section), D = DEVICES[dev] || null, ih = img('td__still--hero', j), ix = img('td__still--poster', j);
      return { el, j, dev, D, F: null, d: null, tok: null, failed: !D, imgs: [ih, ix].filter(Boolean), srcH: src(ih), srcX: src(ix),
        stH: null, stX: null, stLoading: 0, held: false, liveAt: -1, pend: null, intro: 0, introX: 0, fadeK: 1, ID: { e: -1, s: -1 } };
    });
  };
  const measure = (ctx) => {
    run = section.querySelector('[data-td-run]') || section;
    const pin = section.querySelector('.td__pin'), target = section.querySelector('[data-td-target]');
    pinH = pin ? pin.clientHeight : ctx.vh;
    heroR = { x: 0, y: 0, w: pin ? pin.clientWidth : ctx.vw, h: pinH };
    colR = target ? { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight } : heroR;
    tall = ctx.vh > ctx.vw;
    for (const x of shots) x.F = tdFit(tdFraming(x.el, tall, x.dev), colR, heroR.w, heroR.h);
    fl = tdFlags(section); TL = -1; vw = ctx.vw; vh = ctx.vh;
    mat.uniforms.feather.value.set(0.03, tall ? 0.15 : 0.03);
  };
  const shotNow = (ctx) => {
    const r = tdRun(run, ctx.scrollY, ctx.vh);
    if (Math.abs(r.L - TL) > 1e-3) { timeline = tdTimeline(shots.length, r.L); TL = r.L; }
    return { r, st: tdState(r.s, timeline, r.L, fl, ST) };
  };

  /* a device: created and loaded on demand, one at a time; disposed when it is two or more shots away */
  const loadDevice = (x) => {
    if (x.d || x.tok || x.failed || disposed) return Promise.resolve();
    const c = ctxRef, tok = (x.tok = {});
    loading = x;
    const d = create(c, { config: x.D.config, base: x.D.base, tier: c.tier, reduced: c.reduced, mobile: !!c.still, pool, bloom: false });
    d.resize(c.w, c.h, c.dpr);
    return d.load().then(() => {
      if (x.tok !== tok || disposed) { d.dispose(); return; }
      d.resize(c.w, c.h, c.dpr);       // the canvas may have changed while it loaded
      x.d = d; x.liveAt = -1; live3[x.dev] = d;
      stage.invalidate();
    }, (e) => {
      d.dispose();
      if (x.tok === tok) { x.failed = true; x.tok = null; }
      throw e;
    }).finally(() => { if (loading === x) loading = null; });
  };
  const dropDevice = (x) => {
    x.tok = null;
    if (x.d) { if (live3[x.dev] === x.d) delete live3[x.dev]; x.d.dispose(); x.d = null; }
    x.held = false; x.liveAt = -1; x.ID.e = x.ID.s = -1;
  };
  const dropStills = (x) => { x.stH?.dispose(); x.stX?.dispose(); x.stH = x.stX = null; x.stLoading = 0; };
  /* the stand-in's stills, one at a time as they are shown: 1 the hero (whole), 2 the exploded */
  const needStill = (x, which) => {
    const key = which === 1 ? 'stH' : 'stX', src = which === 1 ? x.srcH : x.srcX;
    if (x[key] || (x.stLoading & which) || !src) return;
    x.stLoading |= which;
    loadTexture(src, { premultiply: true }).then((t) => {
      if (!shots.includes(x) || !(x.stLoading & which)) { t.dispose(); return; }
      x[key] = t; x.stLoading &= ~which; stage.invalidate();
    }).catch(() => { x.stLoading &= ~which; });
  };
  /* per frame: what to keep, load and drop around shot k */
  const manage = (s, k, ph) => {
    shots.forEach((x, j) => {
      if (Math.abs(j - k) >= 2) { if (x.d || x.tok) dropDevice(x); if (x.stH || x.stX || x.stLoading) dropStills(x); }
    });
    const nx = shots[k + 1], T1 = timeline[k + 1];
    if (!loading && !disposed) {
      // the shot on screen first, then the next once its cut is near
      const order = [shots[k]];
      if (nx && s > T1.cut[0] - PREFETCH) order.push(nx);
      const x = order.find((q) => !q.d && !q.tok && !q.failed);
      if (x) loadDevice(x).catch((e) => console.warn('[kit3d] device failed', x.dev, e));
    }
    // a device that is not ready when its shot shows stands in with its stills (the one it shows: the section's dip)
    if (!shots[k].d) needStill(shots[k], ph.explodeLin < 0.25 ? 1 : 2);
    if (nx && !nx.d && s > T1.cut[0] - STILL_AHEAD) needStill(nx, 1);
  };
  /* a device as it goes live: if a stand-in was on screen (the DOM's stills on arrival, or this scene's), it starts at
     that still's pose and turns into the scroll's; over this scene's stills it also cross-fades. Both run on the stage's
     clock, as the camera's intro does (ctx.dt ≤ 0.1 s a frame: a renderer under 10 fps still shows the turn in steps
     instead of skipping it) */
  const goLive = (x, ph) => {
    x.liveAt = 1;
    x.intro = x.pend ? 1 : 0; x.introX = ph.explodeLin >= 0.25 ? 1 : 0; x.fadeK = x.pend === 'gl' ? 0 : 1;
    x.pend = null;
  };
  /* this frame's pose (the still's, turning into the scroll's), then the clock moves on */
  const posed = (x, ph, out, dt) => {
    if (x.intro <= 0) return ph;
    const k = smooth(x.intro);
    x.intro = Math.max(0, x.intro - dt / ((window.__kitIntroMs || TD_INTRO_MS) / 1000));
    return tdIntroPose(ph, k, x.introX, out);
  };
  /* this frame's share of the live device over the scene's stand-in stills, then the clock moves on */
  const fadeK = (x, dt) => { const f = x.fadeK; x.fadeK = Math.min(1, f + dt / (FADE_MS / 1000)); return f; };
  const shadow = (i, tex, w, h) => {
    const sw = Math.max(16, Math.round(w / SHADOW_DIV)), sh = Math.max(16, Math.round(h / SHADOW_DIV));
    if (!shRT[i]) shRT[i] = new WebGLRenderTarget(sw, sh, { type: UnsignedByteType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    else if (shRT[i].width !== sw || shRT[i].height !== sh) shRT[i].setSize(sw, sh);
    shMat.uniforms.t.value = tex; shMat.uniforms.px.value.set(5 / w, 5 / h);
    return shRT[i];
  };

  const sc = {
    id, scene, camera, device: true,
    post: { vignette: 0.16, grain: 0.03, fringe: 0.5 },
    async load(ctx) {
      ctxRef = ctx; disposed = false;
      pool = createPool();
      build(); measure(ctx);
      // the shot the reader will meet first (from above: the console; from below: the phone): its stills stand in (the
      // section's), then its device; load() waits for it, so the stage keeps the section's stills until it draws (and
      // fails, keeping them, without half-float targets)
      const { r, st } = shotNow(ctx);
      const x = shots[st.k];
      if (x.failed) throw new Error(`kit3d: no device for ${x.dev}`);
      await tdStandIn(x.imgs);                               // its two stills, decoded and painted (≤ 2.5 s; the camera's)
      ctx.renderer.compile(shScene, camera);                 // the contact shadow's pass (the stage compiles the host quad)
      await loadDevice(x);
      if (r.s > -1.0 && r.s < r.L + 0.6) x.pend = 'dom';     // the section's still is on screen: turn from its pose
    },
    dispose() {
      disposed = true;
      for (const x of shots) { dropDevice(x); dropStills(x); }
      shots = []; loading = null; A = N = lastA = null; idPending = false; idV = -1; moving = false;
      live.anchors3d = null; live.ready = false;
      pool?.dispose(); pool = null;
      shRT.forEach((t, i) => { t?.dispose(); shRT[i] = null; });
      const u = mat.uniforms;
      u.mapA.value = u.stA0.value = u.stA1.value = u.shA.value = u.mapN.value = u.stN0.value = u.shN.value = null;
      run = null;
    },
    deactivate() { for (const x of shots) if (x.d && x.held) { x.d.release(); x.held = false; } },   // not drawn: free the running means
    resize(w, h, dpr) { mat.uniforms.res.value.set(w, h); mat.uniforms.shTexel.value.set(SHADOW_DIV / w, SHADOW_DIV / h); for (const x of shots) x.d?.resize(w, h, dpr); },
    update(ctx) {
      if (!shots.length) return;
      if (!run || ctx.vw !== vw || ctx.vh !== vh) measure(ctx);
      const { r, st } = shotNow(ctx);
      const k = st.k, sh = shots[k], nx = shots[k + 1], reduced = ctx.reduced;
      // phones: the governor stepped all the way down while the Kit draws: give up to the stills for this visit
      if (tdGiveUp(ctx, stage) && !gaveUp) {
        gaveUp = true;
        setTimeout(() => { stage.dispose(sc); sc.failed = true; section.dataset.kit3d = 'stills'; }, 0);
      }
      const ph = reduced ? RPH : st.ph, phN = reduced ? RPH : st.phN;
      manage(r.s, k, ph);
      const dt = ctx.dt || 1 / 60;
      const Fs = live.Fs && live.Fs.length === shots.length && live.Fs[0].tall === tall ? live.Fs : null;   // fitted to the measured column
      const F = Fs ? Fs[k] : sh.F;
      // the slot rect: the section's, computed this frame (or the same rect from the same clock)
      const pinTop = tdPinTop(r, ctx.scrollY, pinH);
      let x, y, w, h;
      if (live.f === ctx.frame && !reduced) { x = live.x; y = live.y; w = live.w; h = live.h; }
      else { tdLerpRect(live.orb || heroR, colR, reduced ? 1 : (k === 0 ? ph.hand : 1), S); x = S.x; y = S.y + pinTop; w = S.w; h = S.h; }
      const lay = { x, y, w, h };
      const u = mat.uniforms, dk = ctx.dpr, px = tdPointerStep(ctx.pointer.x), py = tdPointerStep(ctx.pointer.y);
      u.rect.value.set(x * dk, (ctx.vh - y - h) * dk, Math.max(1, w * dk), Math.max(1, h * dk));
      // shot k: its device posed from the clock, over its key (or its stills, the stand-in)
      A = sh.d && sh.d.loaded ? sh.d : null;
      if (A && sh.liveAt < 0) goLive(sh, ph);
      const la = A ? fadeK(sh, dt) : 0;
      u.liveA.value = la;
      let turning = false;
      if (A) {
        const P = posed(sh, ph, PA, dt); turning = P !== ph;
        A.setPhases(P); A.setLayout(lay, ctx.vw, ctx.vh); A.setPointer(px, py, 1);
        // the markers draw in with the scroll (tdcore tdIdDue, the camera's schedule): an id pass every 0.025 of explode
        // from 0.93, one as it reaches 1, every third of the settle (and one whenever the view settles, inside render())
        if (tdIdDue(sh.ID, ph.explode, ph.settle, P !== ph)) A.occlusion();
        const a3 = A.anchors(pinTop); a3.shot = k;   // posed for this frame, pin-relative (the section adds nothing)
        live.anchors3d = a3; live.anchorsF = ctx.frame; live.pinTop = pinTop;
        live.place3d?.(a3);
        if (A !== lastA) { lastA = A; idV = A.idVersion; }
        idPending = false;              // this frame's anchors carry the last id pass
      } else { live.anchors3d = null; if (st.fade > 0.02) sh.pend = 'gl'; }
      if (la < 1) {
        // the stand-in: its stills through the frame path (tdView: the shot's framing keys, measured on the stills); the
        // two stills are two angles of one device, so the hero dips to black before the exploded one (the section's)
        tdView(F, ph, VS);
        u.zoom.value = VS.zoom; u.shift.value.set(VS.sx, VS.sy);
        u.stA0.value = sh.stH || sh.stX; u.stA1.value = sh.stX || sh.stH;
        const e = reduced ? 1 : ph.explodeLin;
        u.stW.value.set(sh.stH ? 1 - smooth(seg(e, 0.16, 0.25)) : 0, sh.stX ? smooth(seg(e, 0.25, 0.36)) : 0);
      }
      const key = F.key;
      u.keyed.value = key ? (k === 0 && !reduced ? ph.hand : 1) : 0;
      if (key) { u.keyA0.value.set(key[0], key[1], key[2]); u.keyA1.value.set(key[3], key[4], key[5]); }
      // the cut: the incoming shot, whole on its key in the column (the same rect: the slot is the column by now)
      N = null;
      const cut = nx && st.cut > 0 && (nx.d?.loaded || nx.stH) ? (reduced ? smooth(st.cut) : easeIO(st.cut)) : 0;
      u.cutT.value = cut; u.xfade.value = reduced ? 1 : 0;
      let ln = 0;
      if (cut > 0) {
        const FN = Fs ? Fs[k + 1] : nx.F;
        N = nx.d?.loaded ? nx.d : null;
        if (N && nx.liveAt < 0) goLive(nx, phN);
        ln = N ? fadeK(nx, dt) : 0;
        u.liveN.value = ln;
        if (N) { const P = posed(nx, phN, PN, dt); turning ||= P !== phN; N.setPhases(P); N.setLayout(lay, ctx.vw, ctx.vh); N.setPointer(px, py, 1); }
        else nx.pend = 'gl';
        if (ln < 1) { tdView(FN, phN, VN); u.zoomN.value = VN.zoom; u.shiftN.value.set(VN.sx, VN.sy); u.stN0.value = nx.stH; }
        const kn = FN.key || [0, 0, 0, 0, 0, 0];
        u.keyN0.value.set(kn[0], kn[1], kn[2]); u.keyN1.value.set(kn[3], kn[4], kn[5]);
        if (!key) u.keyed.value = 0;
      } else u.liveN.value = 0;
      // still turning or cross-fading this frame: one more (the stage keeps drawing while ambient())
      moving = turning || !!(A && la < 1) || !!(N && ln < 1);
      u.fade.value = st.fade;
      live.px = ctx.pointer.x; live.py = ctx.pointer.y; live.push = 0; live.strength = 0;
      // a loaded neighbour that is not drawn frees its running mean
      for (const q of shots) if (q.d && q.held && q.d !== A && q.d !== N) { q.d.release(); q.held = false; }
    },
    render(renderer, target) {
      const u = mat.uniforms, cw = u.res.value.x, chh = u.res.value.y;
      // the devices draw into their own running means first (re-render on change, else one idle supersample), then
      // their coverage into the contact shadow's small targets
      if (A) {
        const t = A.renderTexture(renderer); const x = shots.find((q) => q.d === A); if (x) x.held = true;
        u.mapA.value = t;
        if (u.keyed.value > 0) { const rt = shadow(0, t, cw, chh); renderer.setRenderTarget(rt); renderer.render(shScene, camera); u.shA.value = rt.texture; }
      }
      if (N) {
        const t = N.renderTexture(renderer, 0, { id: false }); const x = shots.find((q) => q.d === N); if (x) x.held = true;
        u.mapN.value = t;
        const rt = shadow(1, t, cw, chh); renderer.setRenderTarget(rt); renderer.render(shScene, camera); u.shN.value = rt.texture;
      }
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      // the section's stills go once this scene shows shot k (its device, or its own stand-in)
      live.ready = !!A || !!(u.stA0.value && u.stW.value.x + u.stW.value.y > 0);
      // the occlusion test landed (the view settled): one more frame (ambient) so the markers take it
      if (A) { const v = A.idVersion; if (v !== idV) { idV = v; idPending = true; stage.invalidate(); } }
    },
    ambient() { return !!(A?.busy() || N?.busy() || idPending || moving); },
  };
  stage.add(sc);
}
