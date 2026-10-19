/* Photoreal teardowns (the Editions Retail moment). One scene per run (td:camera = Method, td:kit = the Kit's one
   run of four devices), one draw per frame. The choreography is gl/lib/tdcore.js (shared with sections/_teardown.js);
   this file only draws it: "device d at orbit o / explode e, framed so, over its colour key", plus the cut between
   two shots. Phase 3 can swap this renderer (real-time 3D, video) without touching the choreography.
   Frames: v3 sets (public/assets/teardown/<dev>/v3/set.json, scripts/prep_v3sets.py): each device streams a re-timed
   subset of its renders (frame maps: an orbit of 40–56 frames, explodes of 40–48), AVIF at the lg tier
   (v3/o/f_0001.avif …, v3/x/…); the sm tier and browsers without AVIF read the original WebP files through the same
   maps. Only shot 0 has an orbit stream. Streams (gl/lib/frameStream.js) start a screen or so before their shot,
   keep a few decoded frames around the playhead, and are trimmed (decoded frames) or dropped (everything) as the
   reader moves on.
   Drawing: the frame is contain-fit into the section's slot rect (the whole viewport while the orbit fills the
   screen, the column after the hand-off; the section computes it and hands it over through tdLive), zoomed and
   shifted by the shot's framing; never clipped to the slot (it bleeds into the key). The renders are on pure black, so
   a luma matte puts the device over its colour key (a radial field round the slot: data-td-key "centre edge"); a run
   without keys (Method) stays on the black stage. A cut wipes from the right edge with an ink-bled front (fbm noise)
   and a thin rim of the incoming colour; behind it, the next device sits whole in the column on its own key. Once a
   shot's parts settle its frame becomes a depth diorama: pointer parallax and a slow push.
   Desktop only: on the phone still path the sections show their stills over DOM colour keys (gl/scenes/stills.js). */
import { Scene, OrthographicCamera, ShaderMaterial, Mesh, PlaneGeometry, Vector2, Vector3, Vector4 } from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { loadTexture, avifOK } from '../lib/loaders.js';
import { TD_ASPECT, tdLive, tdRun, tdFlags, tdShots, tdDev, tdTimeline, tdState, tdOrbitFrame, tdExplodeFrame, tdIndex, tdFraming, tdFit, tdView, tdContain, tdLerpRect, tdPinTop } from '../lib/tdcore.js';

const SETS = import.meta.glob('/public/assets/teardown/*/v3/set.json', { eager: true, import: 'default' });
const setOf = (dev) => SETS[`/public/assets/teardown/${dev}/v3/set.json`] || null;
const pad = (i) => String(i).padStart(4, '0');
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = /* glsl */`
precision highp float;
uniform sampler2D mapA;   // shot k: its orbit (shot 0, until the junction) …
uniform sampler2D mapB;   // … and its explode
uniform sampler2D mapN;   // the next shot, whole, during a cut
uniform sampler2D depth;
uniform float mixT;       // 0 orbit … 1 explode
uniform vec4 rect;        // slot in canvas px: x, y (from bottom), w, h
uniform float aspect;
uniform vec2 pointer; uniform float strength; uniform float push;
uniform float zoom; uniform vec2 shift; uniform float zoomN; uniform vec2 shiftN;
uniform float fade;
uniform vec2 feather;     // frame-edge feather (frame uv): long vertically on portrait screens
uniform vec3 keyA0; uniform vec3 keyA1; uniform vec3 keyN0; uniform vec3 keyN1;
uniform float keyed;      // 0: the black stage; > 0: the device over its colour key (the amount it is up)
uniform float alphaA;     // shot k's frames carry an alpha matte (v3 AVIF sets of keyed devices) …
uniform float alphaN;     // … the next shot's
uniform float cutT;       // 0 … 1: the wipe to the next shot
uniform vec2 res;
float D(vec2 p){ return texture2D(depth, vec2(p.x, 1.0 - p.y)).r; }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
vec2 frameUV(float z, vec2 sh){
  vec2 q = (gl_FragCoord.xy - rect.xy) / rect.zw;            // 0..1 inside the slot (and beyond it)
  float ra = rect.z / rect.w;
  vec2 s = ra > aspect ? vec2(ra / aspect, 1.0) : vec2(1.0, aspect / ra);   // contain
  return (q - 0.5) * s / z + 0.5 + sh;
}
// feather the frame edge into the void so no seam can show where the frame ends inside the screen
float edgeMask(vec2 p){
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0) return 0.0;
  vec2 e = smoothstep(vec2(0.0), feather, p) * smoothstep(vec2(0.0), feather, 1.0 - p);
  return e.x * e.y;
}
vec3 keyBg(vec3 c0, vec3 c1){
  vec2 d = (gl_FragCoord.xy - rect.xy - rect.zw * 0.5) / (rect.zw * vec2(0.62, 0.74) + 1.0);
  return mix(c0, c1, smoothstep(0.0, 1.0, length(d)));
}
// the device over its key: with its alpha matte (premultiplied: the renders' edges are antialiased against black;
// the matte carries a soft dark aura, a contact shadow in the key), else the renders' luma (they sit on pure black)
vec3 over(vec3 bg, vec4 c, float hasA){
  if (hasA > 0.5) return c.rgb + bg * (1.0 - c.a);
  return mix(bg, c.rgb, smoothstep(0.006, 0.028, max(c.r, max(c.g, c.b))));
}
void main(){
  vec2 uv = frameUV(zoom, shift);
  vec2 p = uv;
  if (strength > 0.0001 || push > 0.0001) {
    for (int i = 0; i < 4; i++) { float d = D(p); p = uv + pointer * strength * (d - 0.4) - (uv - 0.5) * push * (d - 0.3); }
  }
  vec4 cA = vec4(0.0);
  float em = edgeMask(p);
  if (em > 0.0) {
    vec2 t = vec2(p.x, 1.0 - p.y);
    if (mixT < 0.999) cA = texture2D(mapA, t);
    if (mixT > 0.001) cA = mix(cA, texture2D(mapB, t), mixT);
    cA *= em;
  }
  vec3 c = keyed > 0.0 ? over(keyBg(keyA0, keyA1) * keyed, cA, alphaA) : cA.rgb;
  if (cutT > 0.0) {
    // the cut: a front from the right edge to the left (the device's side first), its edge bled by ink
    vec2 sc = gl_FragCoord.xy / res;
    float n = fbm(vec2(sc.x * res.x / res.y, sc.y) * 2.6 + 7.3);
    float w = (1.0 - sc.x) * 0.84 + sc.y * 0.16 + (n - 0.5) * 0.42;
    float front = cutT * 1.56 - 0.28;
    float k = smoothstep(front + 0.012, front - 0.012, w);   // 1: the next shot
    if (k > 0.0) {
      vec2 pN = frameUV(zoomN, shiftN);
      float eN = edgeMask(pN);
      vec4 cN = eN > 0.0 ? texture2D(mapN, vec2(pN.x, 1.0 - pN.y)) * eN : vec4(0.0);
      c = mix(c, over(keyBg(keyN0, keyN1), cN, alphaN), k);
    }
    float rim = 1.0 - smoothstep(0.0, 0.045, abs(w - front));
    c += (keyN0 * 2.4 + 0.02) * rim * 0.5 * (1.0 - abs(cutT - 0.5) * 1.2);
  }
  gl_FragColor = vec4(c * fade, 1.0);
}`;

/* source tier per stream from the device pixels it will cover (a sm frame is 1080 px wide (orbit), 960 (explode));
   portrait screens accept a little upscale before paying for the lg frames */
function tiers(section, shotEls, tall) {
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  const t = section.querySelector('[data-td-target]');
  const orbitPx = tdContain(W, H).w * tdFraming(shotEls[0], tall).hero.z * dpr;
  const zmax = Math.max(...shotEls.map((el) => { const F = tdFraming(el, tall); return Math.max(F.frame0.z, F.frame.z); }));
  const colPx = tdContain(t?.offsetWidth || W, t?.offsetHeight || H).w * zmax * dpr;
  const k = tall ? 1.2 : 1.0;
  return { o: orbitPx > 1080 * k ? 'lg' : 'sm', x: colPx > 960 * k ? 'lg' : 'sm', tall };
}

function teardown(id, stage) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const V3 = () => new Vector3();
  const mat = new ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: {
      mapA: { value: null }, mapB: { value: null }, mapN: { value: null }, depth: { value: null }, mixT: { value: 0 },
      rect: { value: new Vector4(0, 0, 1, 1) }, aspect: { value: TD_ASPECT },
      pointer: { value: new Vector2() }, strength: { value: 0 }, push: { value: 0 },
      zoom: { value: 1 }, shift: { value: new Vector2() }, zoomN: { value: 1 }, shiftN: { value: new Vector2() },
      fade: { value: 1 }, feather: { value: new Vector2(0.03, 0.03) },
      keyA0: { value: V3() }, keyA1: { value: V3() }, keyN0: { value: V3() }, keyN1: { value: V3() }, keyed: { value: 0 },
      alphaA: { value: 0 }, alphaN: { value: 0 },
      cutT: { value: 0 }, res: { value: new Vector2(1, 1) },
    },
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  const live = tdLive(id);
  const redraw = () => stage.invalidate();
  const V = {}, VN = {}, S = {}, ST = { ph: {}, phN: {} };
  let avif = false, T = { o: 'lg', x: 'lg', tall: false };
  // per shot: { dev, set, el, F, x (explode stream), dep (depth texture), depLoading }
  let shots = [], orbit = null, section = null, run = null, fl = null, tall = null, vw = 0, vh = 0, heroR = null, colR = null, pinH = 0;
  let timeline = null, timelineL = -1, lastK = -1;

  const stream = (dev, kind, tier, decoded) => {
    const set = setOf(dev), map = set?.[kind]?.src || null;
    const n = map ? map.length : (kind === 'orbit' ? 97 : 145);
    const name = (i) => `f_${pad(map ? map[i] : i + 1)}.webp`;
    if (tier === 'lg' && avif && map) {
      const fs = new FrameStream({ dir: `/assets/teardown/${dev}/v3/${kind === 'orbit' ? 'o' : 'x'}`, count: n, name: (i) => `f_${pad(i + 1)}.avif`, rev: 1, decoded, onShow: redraw });
      fs.alpha = !!set[kind].alpha;
      return fs;
    }
    const dir = kind === 'orbit' ? `/assets/teardown/${dev}/orbit/${tier}` : `/assets/teardown/${dev}/${tier}`;
    const fs = new FrameStream({ dir, count: n, name, rev: 1, decoded, onShow: redraw });
    fs.alpha = false;
    return fs;
  };
  const mapOf = (sh, kind) => sh.set?.[kind]?.src || null;
  const build = (sec) => {
    for (const sh of shots) { sh.x?.dispose(); sh.dep?.dispose(); }
    orbit?.dispose(); orbit = null;
    const els = tdShots(sec);
    T = tiers(sec, els, innerHeight > innerWidth);
    shots = els.map((el) => { const dev = tdDev(el, sec); return { el, dev, set: setOf(dev), F: null, x: null, dep: null, depLoading: false }; });
    if (mapOf(shots[0], 'orbit') || !shots[0].set) orbit = stream(shots[0].dev, 'orbit', T.o, T.tall && T.o === 'lg' ? 6 : 10);
  };

  stage.add({
    id, scene, camera, device: true,
    post: { vignette: 0.16, grain: 0.03, fringe: 0.5 },
    async load() {
      avif = await avifOK();
      const sec = document.querySelector(`[data-scene="${id}"]`);
      if (!sec) return;
      section = null;
      build(sec);
      if (orbit) await orbit.first();
      else { shots[0].x = stream(shots[0].dev, 'explode', T.x, 8); await shots[0].x.first(); }
    },
    dispose() {
      for (const sh of shots) { sh.x?.dispose(); sh.x = null; sh.dep?.dispose(); sh.dep = null; sh.depLoading = false; }
      orbit?.dispose(); orbit = null; shots = []; section = null;
      const u = mat.uniforms;
      u.mapA.value = u.mapB.value = u.mapN.value = u.depth.value = null;
    },
    deactivate() { orbit?.trim(); for (const sh of shots) sh.x?.trim(); },
    resize(w, h) { mat.uniforms.res.value.set(w, h); },
    update(ctx, s) {
      const isTall = ctx.vh > ctx.vw;
      if (!shots.length) return;
      if (s.el !== section || isTall !== tall || ctx.vw !== vw || ctx.vh !== vh) {
        if (section && isTall !== tall) build(s.el);
        section = s.el; tall = isTall; vw = ctx.vw; vh = ctx.vh;
        run = section.querySelector('[data-td-run]') || section;
        const pin = section.querySelector('.td__pin');
        const target = section.querySelector('[data-td-target]');
        pinH = pin ? pin.clientHeight : ctx.vh;
        heroR = { x: 0, y: 0, w: pin ? pin.clientWidth : ctx.vw, h: pinH };
        colR = target ? { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight } : heroR;
        for (const sh of shots) sh.F = tdFit(tdFraming(sh.el, tall, sh.dev), colR, heroR.w, heroR.h);
        fl = tdFlags(section);
        timelineL = -1;
        mat.uniforms.feather.value.set(0.03, tall ? 0.15 : 0.03);
      }
      const r = tdRun(run, ctx.scrollY, ctx.vh);
      if (Math.abs(r.L - timelineL) > 1e-3) { timeline = tdTimeline(shots.length, r.L); timelineL = r.L; }
      const st = tdState(r.s, timeline, r.L, fl, ST);
      const k = st.k, ph = st.ph, sh = shots[k], nx = shots[k + 1];
      const Fs = live.Fs && live.Fs.length === shots.length && live.Fs[0].tall === tall ? live.Fs : null;   // fitted to the measured column
      const F = Fs ? Fs[k] : sh.F;
      const reduced = ctx.reduced;
      // streams: each shot's explode starts a little over a screen before its shot (shot 0: before its hand-off), and is
      // dropped once the reader is well past it (or well before it)
      shots.forEach((x, j) => {
        const t = timeline[j], a = (t.cut ? t.cut[0] : t.hand[0]) - 1.3, z = t.settle[1] + 2.5;
        if (r.s > a - 1.2 && r.s < z && !x.x) {
          x.x = stream(x.dev, 'explode', T.x, T.tall && T.x === 'lg' ? 6 : 8);
          if (j !== k) x.x.seek(j < k ? x.x.count - 1 : 0);   // fetch (and decode) the frames it will open on
        }
        else if (x.x && (r.s < a - 2.5 || r.s > z + 1)) { x.x.dispose(); x.x = null; }
      });
      if (k !== lastK) { shots.forEach((x, j) => { if (j !== k && j !== k + 1) x.x?.trim(); }); lastK = k; }
      const u = mat.uniforms;
      const xs = sh.x;
      if (k === 0 && orbit) {
        if (ph.mix < 1 || !xs?.ready) orbit.seek(reduced ? orbit.count - 1 : tdIndex(mapOf(sh, 'orbit'), tdOrbitFrame(ph)));
        else orbit.trim();   // past the junction: the orbit's decoded frames are not needed until we scroll back
      }
      if (xs) xs.seek(reduced ? xs.count - 1 : tdIndex(mapOf(sh, 'explode'), tdExplodeFrame(ph, F.xmap)));
      const useOrbit = k === 0 && orbit;
      u.mapA.value = useOrbit ? orbit.texture : (xs ? xs.texture : null);
      u.mapB.value = xs ? xs.texture : u.mapA.value;
      u.mixT.value = useOrbit ? (xs?.ready ? ph.mix : 0) : 1;
      u.alphaA.value = (useOrbit ? orbit.alpha : xs?.alpha) ? 1 : 0;
      // slot rect (viewport px): the section JS computed it this frame (it places the stills and the markers from the
      // same numbers); if it has not (it rests while far away), the same rect from the same clock
      let x, y, w, h;
      if (live.f === ctx.frame) { x = live.x; y = live.y; w = live.w; h = live.h; }
      else { tdLerpRect(heroR, colR, k === 0 ? ph.hand : 1, S); x = S.x; y = S.y + tdPinTop(r, ctx.scrollY, pinH); w = S.w; h = S.h; }
      const dk = ctx.dpr;
      u.rect.value.set(x * dk, (ctx.vh - y - h) * dk, Math.max(1, w * dk), Math.max(1, h * dk));
      tdView(F, ph, V);
      u.zoom.value = V.zoom;
      u.shift.value.set(V.sx, V.sy);
      // the colour key: shot 0's comes up with its hand-off (the orbit plays on the black stage, under the title)
      const key = F.key;
      u.keyed.value = key ? (k === 0 ? ph.hand : 1) : 0;
      if (key) { u.keyA0.value.set(key[0], key[1], key[2]); u.keyA1.value.set(key[3], key[4], key[5]); }
      // the cut
      const cut = nx && nx.x?.ready ? easeIO(st.cut) : 0;
      u.cutT.value = cut;
      if (cut > 0) {
        const FN = Fs ? Fs[k + 1] : nx.F;
        nx.x.seek(0);
        u.mapN.value = nx.x.texture;
        u.alphaN.value = nx.x.alpha ? 1 : 0;
        tdView(FN, st.phN, VN);
        u.zoomN.value = VN.zoom; u.shiftN.value.set(VN.sx, VN.sy);
        const kn = FN.key || [0, 0, 0, 0, 0, 0];
        u.keyN0.value.set(kn[0], kn[1], kn[2]); u.keyN1.value.set(kn[3], kn[4], kn[5]);
        if (!key) u.keyed.value = 0;
      }
      // the settled diorama: depth parallax under the pointer and a slow breathing push (its depth map loads as the
      // shot starts to come apart)
      if (!sh.dep && !sh.depLoading && ph.explode > 0) {
        sh.depLoading = true;
        loadTexture(`/assets/teardown/${sh.dev}/depth.webp`).then((t) => { if (shots.includes(sh)) { sh.dep = t; redraw(); } else t.dispose(); }).catch(() => {});
      }
      const settle = reduced || !sh.dep ? 0 : ph.settle * (1 - st.cut);
      u.depth.value = sh.dep;
      u.strength.value = 0.014 * settle;
      u.push.value = settle * (0.018 + 0.01 * Math.sin(ctx.time * 0.35));
      u.pointer.value.copy(ctx.pointer);
      u.fade.value = st.fade;
      live.px = ctx.pointer.x; live.py = ctx.pointer.y; live.push = u.push.value; live.strength = u.strength.value;
    },
  });
}

export default function register(stage) {
  const ids = new Set([...document.querySelectorAll('[data-scene^="td:"]')].map((el) => el.dataset.scene));
  for (const id of ids) teardown(id, stage);
}
