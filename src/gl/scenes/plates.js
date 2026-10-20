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
   (Method is the camera teardown now, td:camera in teardowns.js: no painted plate.) */
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
const notes = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('//') && k !== 'narrow'));
const SHEETS = {}, NARROW = {};
for (const [p, v] of Object.entries(KEYS)) {
  const ch = p.match(/([\w-]+)\.json$/)[1];
  SHEETS[ch] = sheet(notes(v));
  if (v.narrow) NARROW[ch] = sheet(notes(v.narrow));
}
const sheetFor = (chapter, ctx) => (ctx.vw / ctx.vh < NARROW_AR && NARROW[chapter]) || SHEETS[chapter];
const chapterOf = (el) => el.closest('[data-chapter]')?.id || el.id;

/* the art track's desktop encode lists, bundled at build time (only the "desktop" field of each manifest) */
const DESK = import.meta.glob('/public/assets/scenes/*/manifest.json', { eager: true, import: 'desktop' });
const DEPTH = {
  hero: '/assets/plates/hero-depth.webp', storytellers: '/assets/scenes/storytellers/depth.webp',
  creators: '/assets/scenes/creators/depth.webp', brands: '/assets/scenes/brands/depth.webp',
  results: '/assets/scenes/results/depth.webp', directors: '/assets/scenes/directors/depth.webp',
  apply: '/assets/scenes/apply/depth.webp',
};
/* the deepest zoom a chapter's keys reach (the painting must stay sharp there) */
const maxZoom = (chapter) => {
  const k = [SHEETS[chapter], NARROW[chapter]].flatMap((sh) => sh?.channels['camera.zoom'] || []);
  return k.length ? Math.max(1.15, ...k.map((x) => x.v)) : 1.15;
};
/* the sources to try, best first: the smallest encode that covers the canvas (cover fit, plus headroom for the
   camera's deepest zoom; 10% upscale allowed), AVIF before WebP */
async function paintingFor(chapter, ctx) {
  const d = DESK[`/public/assets/scenes/${chapter}/manifest.json`];
  const best = (l) => {
    l = [...(l || [])].filter((v) => v && v.src && v.w && v.h).sort((a, b) => a.w - b.w);
    if (!l.length) return null;
    const need = Math.max(ctx.w, ctx.h * (l[0].w / l[0].h)) * maxZoom(chapter) * 0.9;
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
   set near its top, stays over the same calm part of the painting all the way in. A shift of the view centre:
   at zoom z the painting moves D screens when the focus moves D / (z - 1) (the shader's uv is bottom-up). Opt-in;
   reduced motion and zooms under 1.05 never rise. Shared with gl/scenes/stills.js (the phone path). */
export function riseOf(s, ctx) {
  if (ctx.reduced || !s.el.hasAttribute('data-rise')) return 0;
  return Math.max(0, 1 - passT(s, ctx.vh));
}
function riseShift(s, ctx, zoom, img) {
  const D = riseOf(s, ctx);
  if (!D || zoom < 1.05) return 0;
  const ra = ctx.vw / ctx.vh, ia = img.x / img.y;
  return (D * (ra > ia ? ia / ra : 1)) / (zoom - 1);
}

export function plateScene({ id, image, depth, strength = 0.022, post }) {
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
      u.focus.value.set(cam.focus[0], cam.focus[1] + riseShift(s, ctx, cam.zoom, u.imgSize.value));
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
