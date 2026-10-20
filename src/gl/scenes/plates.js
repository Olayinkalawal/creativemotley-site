/* Still-plate dioramas used as chapter scenes. Each is one painting + its depth map, moved by camera keys
   (zoom, focus, push) plus pointer parallax:
   - keys: the chapter's sheet in src/gl/keys/<chapter>.json (gl/timeline.js: per-channel keyframes in viewports of the
     section's pass, cubic-bezier eases); a chapter without a sheet falls back to the section's
     data-cam-from / data-cam-to = "zoom focusX focusY push", interpolated (smoothstep) over its pass progress (pe).
   - plate:<chapter> for every chapter painting in public/assets/scenes/<chapter>/manifest.json (the art track's
     encodes, scripts/art.py; the six chapter paintings are the 2026-10-20 masters, scripts/art-masters.json): AVIF
     where it decodes, else WebP, at the smallest width that covers the canvas at the pixel budget (2048 on a 1x
     desktop, 2880 at 2x). Depth: the plate's own map (public/assets/scenes/<chapter>/depth.webp: MiDaS via
     scripts/depth.py; Directors' is hand-layered, scripts/depth-directors.py), or the old plate's map for the hero
     (a 4K upscale of the 1920 px plate, the same composition).
     In use: plate:storytellers (I, its opener: the film's last frame dissolves into it), plate:creators (II),
     plate:brands (III), plate:results (VIII), plate:directors (IX, its opener), plate:apply (X).
   Every plate is a still now: the Results TV (a video texture over the old painting) went with that painting.
   (Method is the real-time 3D camera now, td:camera3d in camera3d.js: no painted plate.) */
import { Scene, OrthographicCamera } from 'three';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture, avifOK } from '../lib/loaders.js';
import { sheet, passT, cameraAt } from '../timeline.js';
import { smooth } from '../../core/scroll.js';

const parseCam = (s, d) => (s ? s.trim().split(/\s+/).map(Number) : d);
/* one sheet per chapter, bundled at build time: src/gl/keys/<chapter>.json (keys starting with // are notes). A sheet
   may carry a second camera, "narrow": { "camera": … }, for screens narrower than 1.45:1 (4:3, 3:2-ish windows): the
   giant title spans about half the column whatever the aspect, while a narrow screen sees less of the painting's
   width, so the title would reach further into it; the narrow camera keeps it on the same calm zone. */
const KEYS = import.meta.glob('../keys/*.json', { eager: true, import: 'default' });
const NARROW_AR = 1.45;
const notes = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('//') && k !== 'narrow' && k !== 'fit' && k !== 'sharpKeys'));
const SHEETS = {}, NARROW = {}, FIT = {}, SHARP = {};
for (const [p, v] of Object.entries(KEYS)) {
  const ch = p.match(/([\w-]+)\.json$/)[1];
  SHEETS[ch] = sheet(notes(v));
  if (v.sharpKeys) SHARP[ch] = v.sharpKeys;
  if (v.narrow) NARROW[ch] = sheet(notes(v.narrow));
  if (v.fit) {
    const c = SHEETS[ch].channels;
    FIT[ch] = { ...v.fit, base: c['camera.zoom'].slice(0, v.fit.keys).map((k) => k.v), baseFocus: (c['camera.focus'] || []).slice(0, v.fit.keys).map((k) => [...k.v]), vw: 0, vh: 0 };
  }
}
const sheetFor = (chapter, ctx) => (ctx.vw / ctx.vh < NARROW_AR && NARROW[chapter]) || SHEETS[chapter];
/* "fit" in a sheet: the rest framing (its first n keys) is fitted to the screen against the giant title, whose size
   stops growing at 12rem (about 1460 px wide) and whose column sits a fixed distance from the screen's left, so it
   covers a different share of the painting on each screen. Refitted on resize.
   - { "title": "#id", "u": U, "keys": n, "min": a } (II Creators, anchored at the painting's left edge): the zoom is
     lowered, as far as min, until the title's right edge lands at u = U and no further in (her hair starts at
     u 0.661 of the wider master: about 1.10 at 1440x900, 1.08 at 1024x768, 1.0 at 1920x1080); never above the sheet's
     own value. (III Brands used it until its wider master of 2026-10-20 made the whole room its rest frame.)
   - { "title": "#id", "mode": "ellipse", "c": [u, v], "r": [ru, rv], "limit": L, "zooms": [...], "keys": n } (VIII
     Results): the title and its dek must sit inside the oculus, an ellipse in the painting's uv (v up); "limit" is
     the worst corner's normalised distance allowed (1.25: what the 1440x900 framing gives, which reads clear of the
     balusters). Tries each zoom (at or above the sheet's) with the focus moved right as needed, and takes the least
     move (a zoom step costs half a focus step); on screens where the title reaches further out over the ring (1920
     wide: zoom 1.5 about u 0.64). */
const toUV = (x, y, ctx, z, fx, fy) => {
  const ra = ctx.vw / ctx.vh, ia = 16 / 9, sx = ra > ia ? 1 : ra / ia, sy = ra > ia ? ia / ra : 1;
  const cu = (x / ctx.vw - 0.5) * sx + 0.5, cv = 1 - ((y / ctx.vh - 0.5) * sy + 0.5);
  return [fx + (cu - fx) / z, fy + (cv - fy) / z];
};
const textBox = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); };
function fitSheet(chapter, ctx) {
  const f = FIT[chapter];
  if (!f || (f.vw === ctx.vw && f.vh === ctx.vh)) return;
  const el = document.querySelector(f.title);
  if (!el) return;
  const r = textBox(el);
  if (!r.width) return;
  f.vw = ctx.vw; f.vh = ctx.vh;
  const ch = SHEETS[chapter].channels, keys = ch['camera.zoom'];
  if (f.mode === 'ellipse') {
    // the glyphs' corners (the line box less its leading), the title's and the dek's, where they sit at the opener's
    // rest (its top at the screen's top): measured from the layout (offsets), so neither the scroll position nor the
    // reveal's rise (a transform) moves them
    const op = el.closest('.opener'), dek = op?.querySelector('.dek');
    const restTop = (n, b) => {
      let y = 0;
      for (let p = n; p && p !== op; p = p.offsetParent) y += p.offsetTop;
      return y + (b.top - n.getBoundingClientRect().top);
    };
    const pts = [];
    for (const [n, k] of [[el, 0.18], [dek, 0.1]]) {
      const b = n && textBox(n);
      if (!b || !b.width) continue;
      const t0 = restTop(n, b), t = t0 + b.height * k, bo = t0 + b.height * 0.9;
      pts.push([b.left, t], [b.left, bo], [b.right, t], [b.right, bo]);
    }
    const [fx0, fy0] = f.baseFocus[0];
    const worst = (z, fx) => Math.max(...pts.map(([x, y]) => {
      const [u, v] = toUV(x, y, ctx, z, fx, fy0);
      return ((u - f.c[0]) / f.r[0]) ** 2 + ((v - f.c[1]) / f.r[1]) ** 2;
    }));
    let pick = null;
    for (const z of [f.base[0], ...f.zooms.filter((z) => z > f.base[0])]) {
      for (let fx = fx0; fx <= 0.76; fx += 0.01) {
        if (worst(z, fx) > f.limit) continue;
        const cost = (z - f.base[0]) + 2 * (fx - fx0);
        if (!pick || cost < pick.cost) pick = { z, fx, cost };
        break;
      }
    }
    pick = pick || { z: f.zooms[f.zooms.length - 1], fx: fx0 };
    (window.__fit ||= {})[chapter] = { z: +pick.z.toFixed(3), fx: +pick.fx.toFixed(3) };   // for QA scripts
    f.base.forEach((b, i) => { keys[i].v = Math.max(b, pick.z); });
    f.baseFocus.forEach((b, i) => { ch['camera.focus'][i].v = [Math.max(b[0], pick.fx), b[1]]; });
  } else {
    const ra = ctx.vw / ctx.vh, ia = 16 / 9, sx = ra > ia ? 1 : ra / ia;
    const z = ((r.right / ctx.vw - 0.5) * sx + 0.5) / f.u;
    f.base.forEach((b, i) => { keys[i].v = Math.min(b, Math.max(f.min ?? 1, z)); });
  }
}
const chapterOf = (el) => el.closest('[data-chapter]')?.id || el.id;

/* the art track's desktop encode lists, bundled at build time (only the "desktop" field of each manifest) */
const DESK = import.meta.glob('/public/assets/scenes/*/manifest.json', { eager: true, import: 'desktop' });
const DEPTH = {
  hero: '/assets/plates/hero-depth.webp', storytellers: '/assets/scenes/storytellers/depth.webp',
  creators: '/assets/scenes/creators/depth.webp', brands: '/assets/scenes/brands/depth.webp',
  results: '/assets/scenes/results/depth.webp', directors: '/assets/scenes/directors/depth.webp',
  apply: '/assets/scenes/apply/depth.webp',
};
/* the deepest zoom this screen's keys reach where the painting is seen in full (it must stay sharp there): the sheet
   for this aspect, fitted to this screen; "sharpKeys": n in a sheet counts only its first n zoom keys (VIII Results:
   its last key is the push into the sky during the hand-off to IX, under the bleed's dimming) */
const maxZoom = (chapter, ctx) => {
  fitSheet(chapter, ctx);
  const k = (sheetFor(chapter, ctx)?.channels['camera.zoom'] || []).slice(0, SHARP[chapter] || undefined);
  return k.length ? Math.max(1.15, ...k.map((x) => x.v)) : 1.15;
};
/* the sources to try, best first: the smallest encode that covers the canvas (cover fit, plus headroom for the
   camera's deepest zoom; 10% upscale allowed), AVIF before WebP */
async function paintingFor(chapter, ctx) {
  const d = DESK[`/public/assets/scenes/${chapter}/manifest.json`];
  const best = (l) => {
    l = [...(l || [])].filter((v) => v && v.src && v.w && v.h).sort((a, b) => a.w - b.w);
    if (!l.length) return null;
    const need = Math.max(ctx.w, ctx.h * (l[0].w / l[0].h)) * maxZoom(chapter, ctx) * 0.9;
    return l.find((v) => v.w >= need) || l[l.length - 1];
  };
  const a = (await avifOK()) ? best(d.avif) : null;
  return [a, best(d.webp)].filter(Boolean).map((v) => v.src);
}
async function loadFirst(srcs) {
  for (let i = 0; i < srcs.length; i++) {
    try { return await loadTexture(srcs[i]); } catch (e) { if (i === srcs.length - 1) throw e; }
  }
}

/* data-rise on the scene element: until its top reaches the top of the screen, the painting rises with it (it enters
   like the next sheet, under the paper above), then holds still while the copy scrolls over it. So an opener's title,
   set near its top, stays over the same calm part of the painting all the way in. A translation of the view after
   the zoom (the plate shader's `shift`; its uv is bottom-up): D screens are D·k/z of the painting's height at zoom z
   (k: the share of the painting's height the cover fit shows at zoom 1). The push and the pointer parallax stay
   centred on the screen while it rises. Opt-in; reduced motion never rises. Shared with gl/scenes/stills.js (the
   phone path). */
export function riseOf(s, ctx) {
  if (ctx.reduced || !s.el.hasAttribute('data-rise')) return 0;
  return Math.max(0, 1 - passT(s, ctx.vh));
}
function riseShift(s, ctx, zoom, img) {
  const D = riseOf(s, ctx);
  if (!D) return 0;
  const ra = ctx.vw / ctx.vh, ia = img.x / img.y;
  return (D * (ra > ia ? ia / ra : 1)) / Math.max(1, zoom);
}

export function plateScene({ id, image, depth, strength = 0.022, post = { fringe: 0.5 } }) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  scene.add(fullscreenQuad(mat));
  let map = null, dep = null;
  const cam = { zoom: 1.06, focus: [0.5, 0.5], push: 0 };
  return {
    id, scene, camera, post,
    async load(ctx) {
      const srcs = typeof image === 'function' ? await image(ctx) : [image];
      [map, dep] = await Promise.all([loadFirst(srcs), depth ? loadTexture(depth) : null]);
      mat.uniforms.map.value = map; mat.uniforms.depth.value = dep; mat.uniforms.hasDepth.value = dep ? 1 : 0;
      mat.uniforms.imgSize.value.set(map.image.width, map.image.height);
    },
    dispose() {
      map?.dispose(); dep?.dispose(); map = dep = null;
      mat.uniforms.map.value = null; mat.uniforms.depth.value = null; mat.uniforms.hasDepth.value = 0;
    },
    resize(w, h) { mat.uniforms.res.value.set(w, h); },
    update(ctx, s) {
      fitSheet(chapterOf(s.el), ctx);
      const sh = sheetFor(chapterOf(s.el), ctx);
      if (sh && !ctx.reduced) cameraAt(sh, passT(s, ctx.vh), cam);
      else {
        const a = parseCam(s.el.dataset.camFrom, [1.06, 0.5, 0.5, 0]);
        const b = parseCam(s.el.dataset.camTo, a);
        const k = ctx.reduced ? 0.5 : smooth(s.pe);
        cam.zoom = a[0] + (b[0] - a[0]) * k;
        cam.focus[0] = a[1] + (b[1] - a[1]) * k; cam.focus[1] = a[2] + (b[2] - a[2]) * k;
        cam.push = a[3] + (b[3] - a[3]) * k;
      }
      const u = mat.uniforms;
      u.zoom.value = cam.zoom;
      u.focus.value.set(cam.focus[0], cam.focus[1]);
      u.shift.value.set(0, riseShift(s, ctx, cam.zoom, u.imgSize.value));
      u.push.value = cam.push + (ctx.reduced ? 0 : 0.012 * Math.sin(ctx.time * 0.3));
      u.strength.value = ctx.reduced ? 0 : strength;
      u.pointer.value.copy(ctx.pointer);
    },
  };
}

export default function register(stage) {
  // one scene per chapter painting
  for (const path of Object.keys(DESK)) {
    const chapter = path.split('/').slice(-2)[0];
    if (!DESK[path]) continue;
    stage.add(plateScene({ id: `plate:${chapter}`, image: (ctx) => paintingFor(chapter, ctx), depth: DEPTH[chapter] || null }));
  }
}
