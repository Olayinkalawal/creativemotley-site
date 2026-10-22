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
     moves from the body's centre to the front element's, the distance falls exponentially to 0.14), then the iris: nine
     blades in this scene's composite pass, coming up out of the dark glass and opening from the centre onto I
     Storytellers, drawn here by the stage's own plate:storytellers scene (its update + render into a target), so the
     last hero frame is the first Storytellers frame (the same texture, cover fit, keys and finish).
   - '2d' (no 3D camera here: phones below the gate never load this module; before the GLB, or after a failed load):
     the painting with the same push and dim, and Storytellers from s 0.62, while the DOM's lens still and blades cover
     the screen.
   - Drag to turn, zoom (gl/lib/drag3d.js): at rest (s < 0.06), once the live camera has the hero, a hit region over its
     silhouette's box turns it (degrees on top of the pose: heroLive.drag) and zooms it about the pointer (heroLive.zoom:
     closer by k about a screen point); the push takes over as s leaves the rest band (both ease to 0 by s 0.06). The
     idle turn holds while the camera is dragged or zoomed and comes back 2.5 s after.
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
import { drag3d } from '../lib/drag3d.js';
import { clamp, lerp, smooth, seg } from '../../core/scroll.js';

const DEG = Math.PI / 180;
const Q = new URLSearchParams(location.search);
/* daylight: the camera sits in the painting's light (a warm key from the upper left, like the figures; a sky fill; its
   dark paint mirrors a bright day, not a black studio). create() options only. p5: the key warm (the figures' light),
   a warmer ground bounce on the lower faces, exposure 1.2 -> 1.55 and lift 0.94 -> 0.88: the body's mid-tones up
   (it read as a dark, cool cut-out on the bright painting: median L 34 -> ~43 in the lab, 3x at rest); the iris
   (seen through the glass in the push) lit by its studio card at 1.0 (Method 1.5), the direct key at 10% (it drew two
   white blades and the shadow map's dotted edge across them: at 30% two still read as paper); the glass studio's key window and fill at 1.5 / 0.1 (Method: 1.9 / 0.14), a
   darker glass for the push into the lens. */
const DAYLIGHT = { envSky: 0xa9c8e4, envGround: 0x5e5a46, env: 0.85, exposure: 1.55, lift: 0.88, key: 9, keyTint: 0xfff0dc, kick: 0.45, fill: 0.5, softbox: 1.9, rim: 3.0, metalDirect: 0.1, freeMetalEnv: 1.0, win: 1.5, glassFill: 0.1 };
const STORY_2D = 0.62;      // the 2D move: Storytellers under the DOM's lens still and blades from here
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
/* the composite over the painting (premultiplied): the camera, then the iris: nine blades, as the model's (half-planes
   pushed out to the aperture's inradius R, so the hole is a nonagon, rounded a little toward a circle), a 1.5 px
   anti-aliased edge. p5: satin steel, not flat black: each blade a soft band of sheen along it (its strength and place
   its own, as a softbox catches blades shingled at slightly different tilts), a bright leading edge on the aperture, a
   hairline where a blade lies over the next and a soft contact shadow under it (each blade lies over the next: the one on
   top at a pixel is the covering blade whose predecessor does not cover it); inside the aperture, Storytellers. (Written
   compact: the string ships as it is.) */
const COMP_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tCam;uniform sampler2D tStory;
uniform float camOn;uniform float blades;uniform float iris;uniform float rot;uniform float storyOn;uniform vec2 res;
varying vec2 vUv;
void main(){
vec4 cam=camOn>0.5?texture2D(tCam,vUv):vec4(0.0);
if(blades<=0.0){gl_FragColor=cam;return;}
vec2 p=(vUv-0.5)*res,n0=vec2(1.0,0.0);
float D=0.5*length(res),R=iris*D*1.04,best=-1e9,top=-1e9,k0=0.0,seam=0.0,shade=0.0;
for(int i=0;i<9;i++){
float th=rot+float(i)*0.6981317;
vec2 n=vec2(cos(th),sin(th));
float d=dot(p,n)-R,d2=dot(p,vec2(cos(th+0.6981317),sin(th+0.6981317)))-R,d0=dot(p,vec2(cos(th-0.6981317),sin(th-0.6981317)))-R;
best=max(best,d);
if(d>=0.0&&d0<0.0&&d>top){top=d;k0=float(i);n0=n;}
seam=max(seam,(1.0-smoothstep(0.0,1.6,abs(d)))*step(0.0,d2));
shade=max(shade,(1.0-smoothstep(0.0,0.02*D,-d))*step(d,0.0)*step(0.0,d2));
}
if(top<-1e8)top=best;
float dist=mix(best,length(p)-R*1.04,0.3),on=step(0.0005,iris);
float inside=(1.0-smoothstep(-0.75,0.75,dist))*on;
float h=fract(sin(k0*12.9898+4.1)*43758.5453),along=dot(p,vec2(-n0.y,n0.x))/D-(h-0.5)*0.7;
float band=exp(-along*along*3.0)*exp(-max(top,0.0)/D*1.6);
vec3 steel=vec3(0.03,0.031,0.035)+vec3(0.07,0.072,0.08)*(0.45+0.55*h)*band;
steel*=1.0-0.45*shade;
steel+=vec3(0.16,0.155,0.15)*seam*0.55;
steel+=vec3(0.42,0.4,0.37)*(1.0-smoothstep(0.0,2.2,abs(dist)))*(0.4+0.6*h)*on;
vec4 outside=vec4(steel*blades+cam.rgb*(1.0-blades),max(cam.a,blades));
gl_FragColor=mix(outside,vec4(texture2D(tStory,vUv).rgb,1.0),inside*storyOn);
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
  let s = 0, m = heroMove(0), lastView = '', lastOff = '', handed = false, dirtyCal = true, pose = null;
  // the idle turn: its phase advances at `speed` (0 … 1), which eases toward 1 while the reader is about and to 0 after
  // 12 s without input (the camera holds its angle, supersamples, and the stage stops drawing)
  let phase = 0, speed = 0, lastInput = performance.now(), dg = null, heldAt = -1e9;
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
  function boxNDC(az, el, fov, aspect, T, dist, shift = [0, 0], P = model.pts) {   // (P: world points, xyz…; project() passes one)
    const a = az * DEG, b = el * DEG, sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
    const d = [sa * cb, sb, ca * cb], r = [ca, 0, -sa], u = [-sb * sa, cb, -sb * ca];
    const tv = Math.tan(fov * DEG / 2), th = tv * aspect;
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
    dg?.dispose(); dg = null; heroLive.drag = { az: 0, el: 0 }; heroLive.zoom = null;
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
      if (map && map !== t) map.dispose(); if (dep && dep !== d) dep.dispose();   // (a reload after the screen turned)
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
    deactivate() { dg?.off(); },   // not drawn: no drag region
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
      // drag to turn and zoom (gl/lib/drag3d.js), at rest only: as s leaves the rest band the push takes over (w → 0)
      if (!dg && heroLive.mode === '3d') dg = drag3d(stage, section.querySelector('.hero__pin'), 'camera', (b) => {
        // the hint: under the camera, inside the frame, clear of the dek (34 px: the pill and 6 px of air)
        const dk = section.querySelector('.frame__dek')?.getBoundingClientRect();
        return [(b.x0 + b.x1) / 2, Math.min(b.y1 + 6, dk ? dk.top - 34 : 1e9)];
      });
      const w = 1 - smooth(seg(s, 0.02, 0.06));
      if (dg) {
        heroLive.drag = { az: dg.az * w, el: dg.el * w };
        heroLive.zoom = dg.k > 1.0001 && w > 0 ? { k: 1 + (dg.k - 1) * w, at: [dg.cx, dg.cy] } : null;
        if (dg.busy() || dg.k > 1.0001) heldAt = now;
      }
      // (the idle turn holds while the camera is dragged or zoomed, and for 2.5 s after)
      const about = !QA.force && now - lastInput < 12000 && !document.hidden && s < HERO.T.turn[0] + 0.01 && now - heldAt > 2500;
      speed += ((about ? 1 : 0) - speed) * Math.min(1, dt * 1.5);
      if (speed < 0.002 && !about) speed = 0;
      phase += dt * speed;
      const idleAz = 20 * Math.sin(phase * 2 * Math.PI / 18);
      const drag = heroLive.drag || { az: 0, el: 0 };   // the DRAG track's offset (drag to turn: degrees), added on top
      const f = QA.force || {};
      let az = lerp(HERO.rest.az + idleAz, 0, m.turn), el = lerp(lerp(HERO.rest.el, 2, m.turn), 0, m.toLens);
      if (f.az != null) az = f.az; if (f.el != null) el = f.el;
      const K = cal.K;
      const off = [(az - K.az + drag.az).toFixed(3), (el - K.el + drag.el).toFixed(3)];
      cam.setPhases({ orbit: 1, hand: 0, explode: 0, settle: 0 });
      const ptr = ctx.reduced || f.s != null || f.dist != null ? 0 : 1 - m.turn;
      const pv = dg ? dg.ptr(ctx.pointer) : ctx.pointer;
      cam.setPointer(Math.round(pv.x * 50) / 50 * ptr, Math.round(pv.y * 50) / 50 * ptr, 1);
      if (off.join() !== lastOff) { cam.setOffset(+off[0], +off[1]); lastOff = off.join(); }
      let dist = f.dist ?? heroDist(cal.dRest, m);
      const tl = f.lens != null ? f.lens : m.toLens;
      const T = [0, 1, 2].map((i) => lerp(model.body[i], model.lens[i], tl));
      let shift = f.dist != null ? [0, 0] : [lerp(cal.shift0[0], 0, m.turn), lerp(cal.shift0[1], 0, m.turn)];
      // the DRAG track's zoom (heroLive.zoom = { k, at: [x, y] css px }): closer by k, about that screen point
      const z = heroLive.zoom;
      if (z && z.k > 1.0001) {
        const P = [z.at[0] / ctx.vw * 2 - 1, 1 - z.at[1] / ctx.vh * 2];
        dist /= z.k; shift = [P[0] + (shift[0] - P[0]) * z.k, P[1] + (shift[1] - P[1]) * z.k];
      }
      const v = { target: T, dist, shift, near: Math.max(0.02, dist - 1.5), ...(f.fov ? { fov: f.fov } : {}) };
      const key = [...T, dist, ...shift, f.fov || 0].map((x) => x.toFixed(5)).join();
      if (key !== lastView) { cam.setView(v); lastView = key; }
      // p5: the front element's reflection fades as the view passes through the glass, the inner elements' dim from
      // earlier (push 0.45: from s 0.48 they never stack up while the lens fills the screen), and the model's iris goes
      // dark as the composite's blades come up (its lit blades ghosted through them, at another angle)
      cam.setGlassEnv(1 - smooth(seg(m.push, 0.55, 0.8)), 1 - 0.7 * smooth(seg(m.push, 0.45, 0.93)), 1 - smooth(seg(m.blades, 0, 0.6)));
      pose = { az: az + drag.az, el: el + drag.el, fov: f.fov || K.fov, aspect: cal.aspect, T, dist, shift, vw: ctx.vw, vh: ctx.vh };   // (turned as dragged)
      const b = boxNDC(pose.az, pose.el, pose.fov, cal.aspect, T, dist, shift);   // the silhouette's box (css px), for the DOM (the lines' hole, the beats)
      heroLive.box = { x0: (b.x0 + 1) / 2 * ctx.vw, x1: (b.x1 + 1) / 2 * ctx.vw, y0: (1 - b.y1) / 2 * ctx.vh, y1: (1 - b.y0) / 2 * ctx.vh };
      // the hit region over the camera's silhouette (in the pin: at rest its top is the viewport's); the hint once it rests
      if (dg) dg.step(ctx, heroLive.box, sg.top - ctx.scrollY + clamp(ctx.scrollY - sg.top, 0, Math.max(0, sg.height - ctx.vh)),
        heroLive.mode === '3d' && s < 0.06 && !QA.force, s < 0.02);
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
        // (one more frame: the next update makes the drag region, even if nothing else moves; and the camera's running
        // mean starts again there: a GLB that lands after the stage's idle cut-off drew only a few frames, and on phones
        // the first of them kept a faint, larger copy of the camera in its fitted framing: phase 4 verify)
        if (tCam && two && s < HERO.T.turn[0] && !QA.bg) { heroLive.mode = '3d'; heroLive.ready = true; handed = true; requestAnimationFrame(() => { cam?.invalidate?.(); stage.invalidate(); }); }
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
  // a screen turned between portrait and landscape: the other painting (the reach crop or the wide one)
  PORTRAIT_MQ.addEventListener?.('change', () => { if (map && ctxRef) sc.load(ctxRef).then(() => { dirtyCal = true; stage.invalidate(); }); });

  window.__hero3d = {
    get cam() { return cam; }, get state() { return camState; }, get cal() { return cal; }, get model() { return model; }, get s() { return s; },
    set force(v) { QA.force = v; lastView = ''; lastOff = ''; stage.invalidate(); }, get force() { return QA.force; },
    set bg(v) { QA.bg = v; if (v) { post.grain = 0; post.vignette = 0; } stage.invalidate(); }, get bg() { return QA.bg; },
    start() { if (camState === 'none') startCam(); },
    box() { return heroLive.box; },
    /* a world point → css px in the current view (scripts/hero-cam-stills.mjs: where the front element lands) */
    project(P) {
      if (!pose) return null;
      const b = boxNDC(pose.az, pose.el, pose.fov, pose.aspect, pose.T, pose.dist, pose.shift, P);
      return [(b.x0 + 1) / 2 * pose.vw, (1 - b.y0) / 2 * pose.vh];
    },
    get pose() { return pose; },
    post,
  };
}
