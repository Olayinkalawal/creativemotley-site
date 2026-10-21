/* hero3d: the hero as a stage scene (2026-10-21). The Creation in daylight (gl/lib/plate.js: the same cover fit, depth
   parallax and push as the chapter plates), the real-time 3D camera (gl/lib/camera3d.js, Method's GLB: one HTTP cache)
   floating in the fingertip gap, and, as the reader scrolls, the fly through its lens into I Storytellers.
   The clock and the geometry are ui/hero.js's (HERO, heroSlot, heroMove, heroDist), so the DOM's 2D move (the stills)
   and this one agree to the pixel. heroLive says which of the two has the hero ('2d' | '3d').
   - The painting: plates/hero.avif (the first paint's file, already in the cache) on 1x screens, desktop-2880.avif on 2x
     (fetched with the GLB, at the first input); phones: the portrait 'reach' crop, as the CSS plate's srcset picks it.
     During the move it pushes toward the gap (1.15x) and dims 15%.
   - The camera: composited over the painting with alpha (camera3d opts.alpha: renderTexture() gives premultiplied rgba,
     a = coverage), in a view of our own (setView: target, dist, shift), so it turns about its body's centre at a fixed
     distance (a turntable, not a refit per angle). At rest it holds the stills' pose (HERO.rest) and turns slowly
     (±20° az, an 18 s period: at most 7°/s), easing to a stop 12 s after the last input (then it supersamples and the
     stage stops drawing); pointer parallax on top (the module's). Lit for daylight with create() options only.
     Bytes: the GLB is never fetched before an input (pointermove, wheel, touchstart, keydown, scroll); until then, and
     until it has drawn once at rest, the DOM still (cam-hero) stands in at the same pose, size and place.
   - The move (heroMove): the turn lens-on and the drift to the centre (×2.5), the push along the lens axis (the target
     moves from the body's centre to the front element's, the distance falls exponentially to 0.14), then the iris: seven
     blades in this scene's composite pass, coming up out of the dark glass and opening from the centre onto I
     Storytellers, drawn here by the stage's own plate:storytellers scene (its update + render into a target), so the
     last hero frame is the first Storytellers frame (the same texture, cover fit, keys and finish).
   - '2d' (no 3D camera here: phones below the gate never load this module; before the GLB, or after a failed load):
     the painting with the same push and dim, and Storytellers from s 0.62, while the DOM's lens still and blades cover
     the screen.
   QA: window.__hero3d (force: { s } or { dist, lens } pose overrides; bg: [r, g, b] draws a flat colour in place of the
   painting; start(): load the camera now; box(): the camera's silhouette box in css px); ?hero3d=0 keeps the 2D path,
   ?hero3d=now loads the GLB without waiting for an input. */
import { Scene, OrthographicCamera, ShaderMaterial, Vector2, WebGLRenderTarget, UnsignedByteType, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, DataTexture } from 'three';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture, avifOK } from '../lib/loaders.js';
import { fetchGLB } from '../lib/glbfetch.js';
import { create, KEYS } from '../lib/camera3d.js';
import { HERO, heroArt, heroSlot, heroMove, heroDist, heroLive, PORTRAIT_MQ } from '../../ui/hero.js';
import { CAM3D } from '../../core/env.js';
import { clamp, lerp, smooth, seg } from '../../core/scroll.js';

const DEG = Math.PI / 180;
const Q = new URLSearchParams(location.search);
/* daylight: the camera sits in the painting's light (a warm key from the upper left, like the figures; a sky fill; its
   dark paint mirrors a bright day, not a black studio). create() options only. */
const DAYLIGHT = { envSky: 0xa9c8e4, envGround: 0x55583f, env: 0.85, exposure: 1.2, lift: 0.94, key: 9, kick: 0.45, fill: 0.5, softbox: 1.9, rim: 3.0 };
const STORY_2D = 0.62;      // the 2D move: Storytellers under the DOM's lens still and blades from here
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
/* the composite over the painting (premultiplied): the camera, then the iris: seven blades (half-planes pushed out to
   the aperture's inradius R, so the hole is a heptagon, rounded a little toward a circle), a 1.5 px anti-aliased edge, a
   faint warm rim, a hairline along each blade's edge where it lies over the next; inside the aperture, Storytellers */
const COMP_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tCam; uniform sampler2D tStory;
uniform float camOn; uniform float blades; uniform float iris; uniform float rot; uniform float storyOn; uniform vec2 res;
varying vec2 vUv;
void main(){
  vec4 cam = camOn > 0.5 ? texture2D(tCam, vUv) : vec4(0.0);
  if (blades <= 0.0) { gl_FragColor = cam; return; }
  vec2 p = (vUv - 0.5) * res;
  float D = 0.5 * length(res);
  float R = iris * D * 1.04;
  float best = -1e9, k0 = 0.0, seam = 0.0;
  for (int i = 0; i < 7; i++) {
    float th = rot + float(i) * 0.8975979;
    float d = dot(p, vec2(cos(th), sin(th))) - R;
    if (d > best) { best = d; k0 = float(i); }
    float d2 = dot(p, vec2(cos(th + 0.8975979), sin(th + 0.8975979))) - R;
    seam = max(seam, (1.0 - smoothstep(0.0, 1.6, abs(d))) * step(0.0, d2));
  }
  float dist = mix(best, length(p) - R * 1.04, 0.3);
  float inside = (1.0 - smoothstep(-0.75, 0.75, dist)) * step(0.0005, iris);
  vec2 q = p / D;
  float sheen = 0.5 + 0.5 * sin(k0 * 2.3 + 1.7 + q.x * 1.3 - q.y * 0.9);
  vec3 steel = vec3(0.028, 0.029, 0.033) + vec3(0.03, 0.031, 0.036) * sheen * (1.0 - 0.6 * min(1.0, length(q)));
  steel += vec3(0.15, 0.145, 0.14) * seam * 0.55;
  steel += vec3(0.85, 0.66, 0.38) * (1.0 - smoothstep(0.0, 3.0, abs(dist))) * 0.3 * step(0.0005, iris);
  vec4 outside = vec4(steel * blades + cam.rgb * (1.0 - blades), max(cam.a, blades));
  gl_FragColor = mix(outside, vec4(texture2D(tStory, vUv).rgb, 1.0), inside * storyOn);
}`;
const FLAT_FRAG = 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }';

async function loadFirst(srcs) {
  for (let i = 0; i < srcs.length; i++) {
    try { return await loadTexture(srcs[i]); } catch (e) { if (i === srcs.length - 1) throw e; }
  }
}

export default function register(stage) {
  const section = document.querySelector('[data-scene="hero3d"]');
  if (!section) return;
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  scene.add(fullscreenQuad(mat));
  const blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
  const compU = { tCam: { value: blank }, tStory: { value: blank }, camOn: { value: 0 }, blades: { value: 0 }, iris: { value: 0 }, rot: { value: 0 }, storyOn: { value: 0 }, res: { value: new Vector2(1, 1) } };
  const comp = new ShaderMaterial({ vertexShader: VERT, fragmentShader: COMP_FRAG, uniforms: compU, depthTest: false, depthWrite: false, transparent: true,
    blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor });
  const compScene = new Scene(); compScene.add(fullscreenQuad(comp));
  const flatU = { col: { value: [0, 0, 0] } };
  const flatScene = new Scene(); flatScene.add(fullscreenQuad(new ShaderMaterial({ vertexShader: VERT, fragmentShader: FLAT_FRAG, uniforms: flatU, depthTest: false, depthWrite: false })));

  // the finish: light at rest (a whisper of grain, almost no vignette), Storytellers' own by the time the iris is open
  const post = { grain: 0.025, vignette: 0.08, fringe: 0.5 };
  const POST_REST = { grain: 0.025, vignette: 0.08 }, POST_STORY = { grain: 0.045, vignette: 0.32 };

  let map = null, dep = null, mapHi = false, gen = 0, ctxRef = null;
  let cam = null, camState = 'none', camGen = 0, cal = null, model = null, rtStory = null;
  let s = 0, m = heroMove(0), lastView = '', lastOff = '', handed = false, dirtyCal = true;
  // the idle turn: its phase advances at `speed` (0 … 1), which eases toward 1 while the reader is about and to 0 after
  // 12 s without input (the camera holds its angle, supersamples, and the stage stops drawing)
  let phase = 0, speed = 0, lastInput = performance.now();
  const QA = { force: null, bg: null };

  /* ── the model's numbers (once per load): a few thousand world points, the body's centre, the front element's ── */
  function measureModel() {
    const pts = [];
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], llo = [1e9, 1e9, 1e9], lhi = [-1e9, -1e9, -1e9];
    const meshes = [];
    cam.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes?.position) meshes.push(o); });
    let total = 0; for (const o of meshes) total += o.geometry.attributes.position.count;
    const step = Math.max(1, Math.floor(total / 4000));
    const e = [];
    for (const o of meshes) {
      o.updateWorldMatrix(true, false);
      const a = o.geometry.attributes.position, w = o.matrixWorld.elements, lens = /^lens/.test(o.userData.part || '');
      for (let i = 0; i < a.count; i += step) {
        const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
        e[0] = w[0] * x + w[4] * y + w[8] * z + w[12]; e[1] = w[1] * x + w[5] * y + w[9] * z + w[13]; e[2] = w[2] * x + w[6] * y + w[10] * z + w[14];
        pts.push(e[0], e[1], e[2]);
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], e[k]); hi[k] = Math.max(hi[k], e[k]); if (lens) { llo[k] = Math.min(llo[k], e[k]); lhi[k] = Math.max(lhi[k], e[k]); } }
      }
    }
    const body = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
    const lens = llo[0] < 1e8 ? [(llo[0] + lhi[0]) / 2, (llo[1] + lhi[1]) / 2, lhi[2]] : [0.066, 0.221, 0.459];
    model = { pts: new Float32Array(pts), body, lens };
  }
  /* the silhouette's box in NDC for a view (camera3d's view mode: from target + dir(az, el)·dist, looking at target) */
  function boxNDC(az, el, fov, aspect, T, dist, shift = [0, 0]) {
    const a = az * DEG, b = el * DEG, sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
    const d = [sa * cb, sb, ca * cb], r = [ca, 0, -sa], u = [-sb * sa, cb, -sb * ca];
    const tv = Math.tan(fov * DEG / 2), th = tv * aspect, P = model.pts;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < P.length; i += 3) {
      const qx = P[i] - T[0], qy = P[i + 1] - T[1], qz = P[i + 2] - T[2];
      const z = dist - (qx * d[0] + qy * d[1] + qz * d[2]);
      if (z <= 1e-3) continue;
      const x = (qx * r[0] + qz * r[2]) / (z * th), y = (qx * u[0] + qy * u[1] + qz * u[2]) / (z * tv);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x0: x0 + shift[0], x1: x1 + shift[0], y0: y0 + shift[1], y1: y1 + shift[1] };
  }
  const keyOf = (ctx) => ((ctx.w / ctx.h) < 0.85 ? KEYS.tall : KEYS.wide).hero;   // camera3d's portrait(): the canvas aspect
  /* the rest view for this screen: the distance that makes the silhouette slot.w wide, and the shift that puts its box's
     centre on the gap */
  function calibrate(ctx) {
    const K = keyOf(ctx), aspect = ctx.w / ctx.h, slot = heroSlot(ctx.vw, ctx.vh);
    let dist = 12;
    for (let i = 0; i < 5; i++) {
      const b = boxNDC(HERO.rest.az, HERO.rest.el, K.fov, aspect, model.body, dist);
      const wPx = (b.x1 - b.x0) / 2 * ctx.vw;
      dist *= wPx / slot.w;
    }
    const b = boxNDC(HERO.rest.az, HERO.rest.el, K.fov, aspect, model.body, dist);
    const sx = slot.x / ctx.vw * 2 - 1, sy = 1 - slot.y / ctx.vh * 2;
    cal = { K, aspect, dRest: dist, shift0: [sx - (b.x0 + b.x1) / 2, sy - (b.y0 + b.y1) / 2], vw: ctx.vw, vh: ctx.vh };
    heroLive.dRest = dist;
    dirtyCal = false;
  }

  /* ── the camera: created and loaded at the first input (never in the first-load window) ─────────────────────── */
  const INPUT = ['pointermove', 'wheel', 'touchstart', 'keydown', 'scroll'];
  const onInput = () => { lastInput = performance.now(); if (camState === 'none') startCam(); };
  const arm = () => INPUT.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
  const disarm = () => INPUT.forEach((e) => window.removeEventListener(e, onInput));
  async function startCam() {
    const ctx = ctxRef;
    if (camState !== 'none' || !ctx || !CAM3D || Q.get('hero3d') === '0') return;
    camState = 'loading';
    const g = ++camGen;
    upgrade(ctx);
    try {
      const phone = !!ctx.still;
      const c = create(ctx, { base: '/assets/models/camera/', tier: ctx.tier, reduced: ctx.reduced, mobile: phone, bloom: false, loadBuffer: fetchGLB, alpha: true, ...DAYLIGHT });
      c.resize(ctx.w, ctx.h, ctx.dpr);
      await c.load();
      if (g !== camGen) { c.dispose(); return; }
      cam = c; measureModel(); calibrate(ctx);
      camState = 'ready'; lastView = ''; lastOff = '';
      window.__cam3dHero = cam;
      stage.invalidate();
    } catch (e) {
      if (g !== camGen) return;
      camState = 'failed';
      console.warn('[hero3d] the 3D camera stays a still:', e?.message || e);
    }
  }
  /* 2x screens: the 2880 encode, with the GLB (the first paint's 1920 plate until then) */
  async function upgrade(ctx) {
    if (mapHi || PORTRAIT_MQ.matches || ctx.w <= 1920 * 1.1) return;
    mapHi = true;
    const g = gen;
    try {
      const t = await loadFirst((await avifOK()) ? ['/assets/scenes/hero/desktop-2880.avif', '/assets/scenes/hero/desktop-2880.webp'] : ['/assets/scenes/hero/desktop-2880.webp']);
      if (g !== gen) { t.dispose(); return; }
      stage.renderer.initTexture(t);
      const old = map; map = t; mat.uniforms.map.value = t; mat.uniforms.imgSize.value.set(t.image.width, t.image.height); old?.dispose();
      stage.invalidate();
    } catch { /* keep the 1920 */ }
  }
  function disposeCam() {
    camGen++;
    cam?.dispose(); cam = null; camState = 'none'; cal = null; model = null; handed = false;
    heroLive.mode = '2d'; heroLive.ready = false;
  }
  /* the stage's own Storytellers scene, drawn into rt (false when it is not ready: the iris then opens on dark glass) */
  function drawStory(renderer, rt, ctx) {
    const st = stage.scenes.get('plate:storytellers');
    const sg = stage.segs.find((x) => x.id === 'plate:storytellers');
    if (!st || !st.loaded || !sg) return false;
    st.update?.(ctx, stage.segInfo(sg, ctx.scrollY, ctx.vh));
    renderer.setRenderTarget(rt); renderer.clear();
    if (st.render) st.render(renderer, rt, ctx); else renderer.render(st.scene, st.camera);
    return true;
  }

  const sc = {
    id: 'hero3d', scene, camera, post,
    async load(ctx) {
      ctxRef = ctx;
      const g = ++gen; mapHi = false;
      const portrait = PORTRAIT_MQ.matches;
      let srcs;
      if (portrait) {
        const w = [828, 1170, 1640].find((x) => x >= ctx.w * 0.92) || 1640;
        srcs = [...((await avifOK()) ? [`/assets/scenes/hero/phone-${w}.avif`] : []), `/assets/scenes/hero/phone-${w}.webp`];
      } else srcs = [...((await avifOK()) ? ['/assets/plates/hero.avif'] : []), '/assets/plates/hero.webp'];
      const [t, d] = await Promise.all([loadFirst(srcs), portrait ? null : loadTexture('/assets/plates/hero-depth.webp').catch(() => null)]);
      if (g !== gen) { t?.dispose(); d?.dispose(); return; }
      map = t; dep = d;
      const u = mat.uniforms;
      u.map.value = map; u.imgSize.value.set(map.image.width, map.image.height);
      u.depth.value = dep; u.hasDepth.value = dep ? 1 : 0;
      stage.renderer.compile(compScene, camera);
      if (camState === 'none' && CAM3D && Q.get('hero3d') !== '0') {
        if (ctx.scrollY > 0 || Q.get('hero3d') === 'now') startCam(); else arm();
      }
    },
    dispose() {
      gen++; disarm(); disposeCam();
      map?.dispose(); dep?.dispose(); map = dep = null;
      rtStory?.dispose(); rtStory = null;
      mat.uniforms.map.value = null; mat.uniforms.depth.value = null; mat.uniforms.hasDepth.value = 0;
    },
    resize(w, h, dpr) {
      mat.uniforms.res.value.set(w, h); compU.res.value.set(w, h);
      cam?.resize(w, h, dpr); rtStory?.setSize(w, h); dirtyCal = true; lastView = '';
    },
    // turning, accumulating its idle samples, or handing over from the still: the stage keeps drawing (≤ 30 fps idle)
    ambient() { return camState === 'ready' && (speed > 0.002 || cam.busy() || (!handed && s < HERO.T.turn[0])); },
    update(ctx, sg) {
      ctxRef = ctx;
      s = QA.force?.s ?? Math.max(0, (ctx.scrollY - sg.top) / Math.max(1, ctx.vh));
      m = heroMove(ctx.reduced ? 0 : s);
      const art = heroArt(ctx.vw, ctx.vh);
      const A = art.A;
      // the painting: cover fit centred where the CSS plate centres it (shift), pushing toward the gap and dimming
      const k = smooth(seg(s, HERO.T.turn[0], HERO.T.push[1]));
      const u = mat.uniforms;
      const shx = art.cx - 0.5, shy = 0.5 - art.cy;
      u.shift.value.set(shx, shy);
      u.zoom.value = 1 + 0.15 * k;
      u.focus.value.set(A.gap[0] - shx, 1 - A.gap[1] - shy);
      u.push.value = 0.03 * k;
      u.exposure.value = 1 - 0.15 * k;
      u.strength.value = ctx.reduced ? 0 : 0.018;
      u.pointer.value.copy(ctx.pointer);
      // the finish follows the iris (3D) or lands with the 2D move's switch under the DOM's cover
      const kp = heroLive.mode === '3d' ? m.iris : s >= STORY_2D ? 1 : 0;
      post.grain = QA.bg ? 0 : lerp(POST_REST.grain, POST_STORY.grain, kp); post.vignette = QA.bg ? 0 : lerp(POST_REST.vignette, POST_STORY.vignette, kp);

      if (camState !== 'ready' || !model) return;
      // the hand-over to 3D only where nothing moves (at rest, or with the hero behind the reader)
      if (heroLive.mode !== '3d' && s > HERO.T.end + 0.05) { heroLive.mode = '3d'; heroLive.ready = true; handed = true; }
      if (dirtyCal || !cal || cal.vw !== ctx.vw || cal.vh !== ctx.vh) calibrate(ctx);
      // the idle turn
      const now = performance.now(), dt = Math.min(0.1, ctx.dt || 1 / 60);
      const about = !QA.force && now - lastInput < 12000 && !document.hidden && s < HERO.T.turn[0] + 0.01;
      speed += ((about ? 1 : 0) - speed) * Math.min(1, dt * 1.5);
      if (speed < 0.002 && !about) speed = 0;
      phase += dt * speed;
      const idleAz = 20 * Math.sin(phase * 2 * Math.PI / 18);
      const drag = heroLive.drag || { az: 0, el: 0 };   // the DRAG track's offset (drag to turn), added on top
      const f = QA.force || {};
      let az = lerp(HERO.rest.az + idleAz, 0, m.turn), el = lerp(lerp(HERO.rest.el, 2, m.turn), 0, m.toLens);
      if (f.az != null) az = f.az; if (f.el != null) el = f.el;
      const K = cal.K;
      const off = [(az - K.az + drag.az).toFixed(3), (el - K.el + drag.el).toFixed(3)];
      cam.setPhases({ orbit: 1, hand: 0, explode: 0, settle: 0 });
      const ptr = ctx.reduced || f.s != null || f.dist != null ? 0 : 1 - m.turn;
      cam.setPointer(Math.round(ctx.pointer.x * 50) / 50 * ptr, Math.round(ctx.pointer.y * 50) / 50 * ptr, 1);
      if (off.join() !== lastOff) { cam.setOffset(+off[0], +off[1]); lastOff = off.join(); }
      const dist = f.dist ?? heroDist(cal.dRest, m);
      const tl = f.lens != null ? f.lens : m.toLens;
      const T = [0, 1, 2].map((i) => lerp(model.body[i], model.lens[i], tl));
      const shift = f.dist != null ? [0, 0] : [lerp(cal.shift0[0], 0, m.turn), lerp(cal.shift0[1], 0, m.turn)];
      const v = { target: T, dist, shift, near: Math.max(0.02, dist - 1.5) };
      const key = [...T, dist, ...shift].map((x) => x.toFixed(5)).join();
      if (key !== lastView) { cam.setView(v); lastView = key; }
      heroLive.box = (() => {   // the silhouette's box (css px), for the DOM (the lines' hole, the beats)
        const b = boxNDC(az, el, K.fov, cal.aspect, T, dist, shift);
        return { x0: (b.x0 + 1) / 2 * ctx.vw, x1: (b.x1 + 1) / 2 * ctx.vw, y0: (1 - b.y1) / 2 * ctx.vh, y1: (1 - b.y0) / 2 * ctx.vh };
      })();
    },
    render(renderer, target, ctx) {
      const two = heroLive.mode !== '3d';
      const ready = camState === 'ready' && !!cal;
      // past the iris (3D) or under the 2D move's cover: Storytellers, as its own scene draws it
      if ((!two && m.iris >= 0.999) || (two && s >= STORY_2D && !QA.bg)) {
        if (!drawStory(renderer, target, ctx)) { renderer.setRenderTarget(target); renderer.clear(); }
        return;
      }
      // the camera (it sets and restores targets itself): drawn in 3D, and at rest while it takes over from the still
      let tCam = null;
      if (ready && (!two || s < HERO.T.turn[0] || QA.bg)) {
        tCam = cam.renderTexture(renderer, 0, { id: false });
        if (tCam && two && s < HERO.T.turn[0] && !QA.bg) { heroLive.mode = '3d'; heroLive.ready = true; handed = true; }
      }
      let story = false;
      if (tCam && m.blades > 0) {
        if (!rtStory) rtStory = new WebGLRenderTarget(ctx.w, ctx.h, { depthBuffer: false, type: UnsignedByteType });
        story = drawStory(renderer, rtStory, ctx);
      }
      renderer.setRenderTarget(target);
      if (QA.bg) { flatU.col.value = QA.bg; renderer.render(flatScene, camera); }
      else renderer.render(scene, camera);
      if (!tCam) return;
      compU.tCam.value = tCam; compU.camOn.value = 1;
      compU.blades.value = QA.bg ? 0 : m.blades; compU.iris.value = m.iris; compU.rot.value = 30 * DEG * m.iris;
      compU.tStory.value = story ? rtStory.texture : blank; compU.storyOn.value = story ? 1 : 0;
      const ac = renderer.autoClear;
      renderer.autoClear = false; renderer.render(compScene, camera); renderer.autoClear = ac;
    },
  };
  stage.add(sc);

  window.__hero3d = {
    get cam() { return cam; }, get state() { return camState; }, get cal() { return cal; }, get model() { return model; }, get s() { return s; },
    set force(v) { QA.force = v; lastView = ''; lastOff = ''; stage.invalidate(); }, get force() { return QA.force; },
    set bg(v) { QA.bg = v; if (v) { post.grain = 0; post.vignette = 0; } stage.invalidate(); }, get bg() { return QA.bg; },
    start() { if (camState === 'none') startCam(); },
    box() { return heroLive.box; },
    post,
  };
}
