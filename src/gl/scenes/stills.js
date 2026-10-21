/* The phone still path (STILL in core/env.js; the Editions FallbackImageScene): one painting per chapter, nothing
   streamed. This module answers every scene id, so the stage keeps its dissolves, wipes and paper cuts, and each
   section draws one still:
   - the chapter's portrait painting from public/assets/scenes/<chapter>/manifest.json (the art track's encodes:
     AVIF, WebP fallback, the smallest width that covers the canvas), when the chapter has one;
   - otherwise the section's own tier-0 plate (data-plate): the hero, Storytellers and Results paintings as a cover
     crop (centred on the section's data-cam-from-tall focus, kept inside the painting); ink (black: the teardowns,
     whose sections show their device stills over it), paper, or the umber room (the CSS plate's gradient);
   - the hero (hero3d, on a phone below core/env.js CAM3D): its painting (the portrait 'reach' crop; the desktop one on
     a phone held sideways), pushing toward the fingertip gap and dimming as the DOM's 2D camera move plays over it
     (ui/hero.js: the camera stills, the lens close-up, the iris blades); from s 0.62, while that move covers the screen,
     it draws I Storytellers' still instead (the same view of the same texture as Storytellers' own scene), so the
     iris opens onto it and the boundary with Storytellers is a cut between two identical frames.
   A slow push over each section's pass keeps a still alive while it scrolls. No depth maps, no video, no streams. */
import { Scene, OrthographicCamera, ShaderMaterial, Vector2, Vector3, DataTexture } from 'three';
import { fullscreenQuad } from '../lib/plate.js';
import { texture } from '../lib/loaders.js';
import { smooth, clamp, seg } from '../../core/scroll.js';
import { CAM3D } from '../../core/env.js';
import { HERO, heroArt } from '../../ui/hero.js';

/* the art track's manifests (scripts/art.py → public/assets/scenes/<chapter>/manifest.json), bundled at build time;
   only the phone fields are imported: phone { avif: [{ src, w, h }], webp: [...] }, phoneFocus [x, y] (the view
   centre on a phone screen), placeholder.phone (a tiny blurred WebP shown while the painting loads). A chapter
   without a manifest is simply not in the maps. */
const PHONE = import.meta.glob('/public/assets/scenes/*/manifest.json', { eager: true, import: 'phone' });
const FOCUS = import.meta.glob('/public/assets/scenes/*/manifest.json', { eager: true, import: 'phoneFocus' });
const HOLD = import.meta.glob('/public/assets/scenes/*/manifest.json', { eager: true, import: 'placeholder' });
const key = (chapter) => `/public/assets/scenes/${chapter}/manifest.json`;
const PLATES = { hero: '/assets/plates/hero.avif', storytellers: '/assets/scenes/storytellers/desktop-2048.webp', results: '/assets/scenes/results/desktop-2048.webp', method: '/assets/plates/method.webp' };
const COLORS = { ink: [0, 0, 0], paper: [0.91, 0.89, 0.831], dark: [0.043, 0.031, 0.02] };

/* the portrait encodes to try, best first: AVIF, then WebP, each the smallest width that covers the canvas */
function portraitPick(chapter, needW) {
  const ph = PHONE[key(chapter)];
  if (!ph) return null;
  const list = (fmt) => {
    const l = (Array.isArray(ph) ? ph.filter((v) => (v.src || '').endsWith(`.${fmt}`)) : ph[fmt] || [])
      .filter((v) => v && v.src && (!v.w || !v.h || v.h > v.w)).sort((a, b) => (a.w || 0) - (b.w || 0));
    return l.find((v) => (v.w || 0) >= needW * 0.92) || l[l.length - 1];
  };
  const srcs = [list('avif'), list('webp')].filter(Boolean).map((v) => v.src);
  return srcs.length ? srcs : null;
}

/* what a section shows: { kind: 'img', srcs, focus, zoom } | { kind: 'color', color } | { kind: 'umber' } */
function sourceFor(el, needW) {
  if (!el) return { kind: 'color', color: COLORS.dark };
  // the hero on a phone held sideways: the desktop painting (the CSS plate's too), centred
  if (el.closest('.hero') && window.innerWidth > window.innerHeight) return { kind: 'img', srcs: ['/assets/plates/hero.avif', '/assets/plates/hero.webp'], focus: [0.5, 0.5], zoom: 1 };
  // a region that names the umber room for itself (IX Directors' film run) keeps it, as on desktop
  if (el.dataset.scene === 'plate:umber') return { kind: 'umber' };
  const chapter = el.closest('[data-chapter]')?.id || (el.closest('.hero') ? 'hero' : el.id);
  const srcs = chapter && portraitPick(chapter, needW);
  if (srcs) {
    const f = FOCUS[key(chapter)];
    return { kind: 'img', srcs, focus: Array.isArray(f) && f.length === 2 ? f : [0.5, 0.5], zoom: 1, portrait: true, hold: HOLD[key(chapter)]?.phone || null };
  }
  const host = el.closest('[data-plate]') || el;
  const plate = host.dataset.plate;
  if (PLATES[plate]) {
    const t = (host.dataset.camFromTall || el.dataset.camFromTall || '').trim().split(/\s+/).map(Number);
    return { kind: 'img', srcs: [PLATES[plate]], focus: t.length >= 3 && t.every(Number.isFinite) ? [t[1], t[2]] : [0.5, 0.5], zoom: t[0] > 1 ? Math.min(1.5, t[0]) : 1 };
  }
  if (plate === 'umber') return { kind: 'umber' };
  return { kind: 'color', color: COLORS[plate] || COLORS.dark };
}

/* shared textures (the hero painting serves the film and Apply): loaded once, freed when the last user lets go */
const cache = new Map();
async function acquire(srcs) {
  for (const src of srcs) {
    let c = cache.get(src);
    if (!c) {
      c = { refs: 0, p: fetch(src).then((r) => { if (!r.ok) throw new Error(`${r.status} ${src}`); return r.blob(); })
        .then((b) => createImageBitmap(b, { colorSpaceConversion: 'none' })).then((bmp) => texture(bmp)) };
      cache.set(src, c);
    }
    try { const t = await c.p; c.refs++; return { src, tex: t }; } catch { cache.delete(src); }
  }
  return null;
}
function release(h) {
  if (!h) return;
  const c = cache.get(h.src);
  if (c && --c.refs <= 0) { cache.delete(h.src); h.tex.dispose(); h.tex.image?.close?.(); }
}

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = /* glsl */`
precision highp float;
uniform sampler2D mapA; uniform sampler2D mapB;
uniform vec2 sizeA; uniform vec2 sizeB; uniform vec3 colA; uniform vec3 colB; uniform float kindA; uniform float kindB;
uniform vec2 ctrA; uniform vec2 ctrB; uniform float zoomA; uniform float zoomB;
uniform float mixT; uniform vec2 res; uniform float dimA;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
// cover fit, zoomed about a view centre that the CPU keeps inside the image (uv y down)
vec3 layer(sampler2D m, vec2 size, vec3 col, float kind, vec2 ctr, float zoom){
  vec2 q = vec2(vUv.x, 1.0 - vUv.y);
  if (kind < 0.5) {
    float ra = res.x / res.y, ia = size.x / size.y;
    vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
    vec2 p = ctr + (q - 0.5) * s / zoom;
    return texture2D(m, clamp(p, vec2(0.001), vec2(0.999))).rgb;
  }
  if (kind < 1.5) return col;
  // the umber room: radial-gradient(120% 90% at 60% 40%, #3a2814, #0b0805 70%)
  vec2 d = (q - vec2(0.6, 0.4)) / vec2(1.2, 0.9);
  return mix(vec3(0.2275, 0.1569, 0.0784), vec3(0.0431, 0.0314, 0.0196), clamp(length(d) / 0.7, 0.0, 1.0));
}
void main(){
  vec3 a = layer(mapA, sizeA, colA, kindA, ctrA, zoomA) * dimA;
  vec3 c = a;
  if (mixT > 0.0005) {
    vec3 b = layer(mapB, sizeB, colB, kindB, ctrB, zoomB);
    float n = fbm(vUv * vec2(res.x / res.y, 1.0) * 2.4 + 3.1);
    float edge = smoothstep(mixT * 1.25 - 0.18, mixT * 1.25 + 0.02, n);
    float rim = smoothstep(0.0, 0.08, edge) * (1.0 - smoothstep(0.08, 0.22, edge));
    c = mix(b, a, edge) + vec3(0.85, 0.66, 0.38) * rim * 0.18 * (1.0 - abs(mixT - 0.5) * 2.0);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

function stillScene(id, stage) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blank = new DataTexture(new Uint8Array([11, 8, 5, 255]), 1, 1); blank.needsUpdate = true;
  const U = {
    mapA: { value: blank }, mapB: { value: blank }, sizeA: { value: new Vector2(1, 1) }, sizeB: { value: new Vector2(1, 1) },
    colA: { value: new Vector3() }, colB: { value: new Vector3() }, kindA: { value: 1 }, kindB: { value: 1 },
    ctrA: { value: new Vector2(0.5, 0.5) }, ctrB: { value: new Vector2(0.5, 0.5) }, zoomA: { value: 1 }, zoomB: { value: 1 },
    mixT: { value: 0 }, res: { value: new Vector2(1, 1) }, dimA: { value: 1 },
  };
  scene.add(fullscreenQuad(new ShaderMaterial({ vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false, uniforms: U })));
  const hero = id === 'hero3d';
  let views = new Map();   // element → { src, handle }
  let held = [], heroA = null, storyB = null, storyEl = null, token = null;
  const STORY_2D = 0.62;   // ui/hero.js's 2D move covers the screen from about 0.52 until the iris opens at 0.74
  const setLayer = (k, v, pe, rise = 0) => {
    const u = (n) => U[n + k];
    if (!v || v.src.kind !== 'img' || !v.handle) {
      u('kind').value = v?.src.kind === 'umber' ? 2 : 1;
      const c = v?.src.color || COLORS.dark; u('col').value.set(c[0], c[1], c[2]);
      return;
    }
    const t = v.handle.tex, img = t.image;
    u('kind').value = 0; u('map').value = t; u('size').value.set(img.width, img.height);
    // a slow push over the pass; the view centre stays inside the painting
    const z = v.src.zoom * (1 + 0.045 * smooth(pe));
    const ra = U.res.value.x / U.res.value.y, ia = img.width / img.height;
    const sx = (ra > ia ? 1 : ra / ia) / z, sy = (ra > ia ? ia / ra : 1) / z;
    // rise (data-rise, see gl/scenes/plates.js): the painting enters with its section, moved down by `rise` screens
    u('ctr').value.set(clamp(v.src.focus[0], sx / 2, 1 - sx / 2), clamp(v.src.focus[1], sy / 2, 1 - sy / 2) - rise * sy);
    u('zoom').value = z;
  };
  stage.add({
    id, scene, camera,
    post: { fringe: 0.35 },   // a calm finish on the paintings: a flick on a touch screen would otherwise hit the cap
    async load(ctx) {
      const els = [...document.querySelectorAll(`[data-scene="${id}"]`)];
      // the hero also holds Storytellers' still (its iris opens onto it): the same source, so the same shared texture
      const story = hero ? document.querySelector('[data-scene="plate:storytellers"]') : null;
      if (story) els.push(story);
      const W = ctx.w, tok = (token = {});
      const next = new Map();
      const keep = (h) => { if (!h) return false; if (tok !== token) { release(h); return false; } held.push(h); return true; };
      // ready as soon as each still has something to show: the painting's tiny placeholder (it upgrades in place
      // when the painting lands), or the painting itself
      await Promise.all(els.map(async (el) => {
        const src = sourceFor(el, W), view = { src, handle: null };
        next.set(el, view);
        if (src.kind !== 'img') return;
        const full = acquire(src.srcs).then((h) => { if (keep(h)) { view.handle = h; ctx.stage.invalidate(); } });
        if (src.hold) { const h = await acquire([src.hold]); if (keep(h) && !view.handle) view.handle = h; }
        else await full;
      }));
      views = next;
      if (hero) { heroA = views.get(els[0]); storyB = story ? views.get(story) : null; storyEl = story; }
    },
    dispose() {
      token = null;
      held.forEach(release); held = [];
      views = new Map(); heroA = storyB = storyEl = null;
      U.mapA.value = U.mapB.value = blank;
    },
    resize(w, h) { U.res.value.set(w, h); },
    update(ctx, s) {
      if (hero) {
        const sc = Math.max(0, (ctx.scrollY - s.top) / Math.max(1, ctx.vh));   // screens since the top (ui/hero.js)
        if (sc >= STORY_2D && storyB) {
          // under the DOM's cover: Storytellers' still, as its own scene draws it at this scroll
          const top = storyEl.getBoundingClientRect().top + ctx.scrollY, h = storyEl.offsetHeight;
          setLayer('A', storyB, clamp((ctx.scrollY + ctx.vh - top) / Math.max(1, h + ctx.vh)));
        } else {
          // the painting pushing toward the gap (1.15x) and dimming 15% as the camera moves (ui/hero.js HERO.T)
          setLayer('A', heroA, 0);
          const art = heroArt(ctx.vw, ctx.vh), k = smooth(seg(sc, HERO.T.turn[0], HERO.T.push[1]));
          if (heroA?.handle && !(window.innerWidth > window.innerHeight)) {
            const z = 1 + 0.15 * k, g = art.A.gap, c = U.ctrA.value;
            // zoom about the gap: the view centre moves toward it as the zoom grows (the gap stays put on screen)
            c.set(g[0] + (c.x - g[0]) / z, g[1] + (c.y - g[1]) / z);
            U.zoomA.value = z;
          }
          U.dimA.value = 1 - 0.15 * k;
        }
        U.mixT.value = 0;
        return;
      }
      U.dimA.value = 1;
      let v = views.get(s.el);
      if (!v) { const src = sourceFor(s.el, ctx.w); v = { src, handle: null }; }
      setLayer('A', v, s.pe, ctx.reduced || !s.el.hasAttribute('data-rise') ? 0 : Math.max(0, 1 - (s.pe * (s.height + ctx.vh)) / ctx.vh));
      U.mixT.value = 0;
    },
  });
}

export default function register(stage) {
  const ids = new Set([...document.querySelectorAll('[data-scene]')].map((el) => el.dataset.scene));
  for (const id of ids) if ((id !== 'td:camera3d' && id !== 'td:kit' && id !== 'hero3d') || !CAM3D) stillScene(id, stage);   // the hero's and Method's 3D camera and the Kit's 3D devices draw themselves where the phone can carry them (gl/boot.js)
}
