/* Still-plate dioramas used as chapter scenes. Each is one painting + its depth map, moved by camera keys
   (zoom, focus, push) plus pointer parallax:
   - keys: the chapter's sheet in src/gl/keys/plates.json (gl/timeline.js: per-channel keyframes in viewports of the
     section's pass, cubic-bezier eases); a chapter without a sheet falls back to the section's
     data-cam-from / data-cam-to = "zoom focusX focusY push", interpolated (smoothstep) over its pass progress (pe).
   - plate:<chapter> for every chapter painting in public/assets/scenes/<chapter>/manifest.json (the art track's
     encodes, scripts/art.py): AVIF where it decodes, else WebP, at the smallest width that covers the canvas at the
     pixel budget (2048 on a 1x desktop, 2880 at 2x). Depth: the plate's own map (public/assets/scenes/<chapter>/
     depth.webp, MiDaS via scripts/depth.py), or the old plate's map where the painting is the same composition
     (hero, storytellers: 4K upscales of the 1920 px plates).
     In use: plate:creators (II), plate:brands (III), plate:directors (IX, its opener), plate:apply (X).
   - plate:results       (Results: the watchers; the TV plays — a video texture over the plate)
   (Method is the camera teardown now, td:camera in teardowns.js: no painted plate.) */
import { Scene, OrthographicCamera } from 'three';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture, videoTexture, avifOK } from '../lib/loaders.js';
import { sheet, passT, cameraAt } from '../timeline.js';
import KEYS from '../keys/plates.json';
import { smooth } from '../../core/scroll.js';

const parseCam = (s, d) => (s ? s.trim().split(/\s+/).map(Number) : d);
const SHEETS = Object.fromEntries(Object.entries(KEYS).filter(([k]) => !k.startsWith('//')).map(([k, v]) => [k, sheet(v)]));
const chapterOf = (el) => el.closest('[data-chapter]')?.id || el.id;

/* the art track's desktop encode lists, bundled at build time (only the "desktop" field of each manifest) */
const DESK = import.meta.glob('/public/assets/scenes/*/manifest.json', { eager: true, import: 'desktop' });
const DEPTH = {
  hero: '/assets/plates/hero-depth.webp', storytellers: '/assets/plates/storytellers-depth.webp',
  creators: '/assets/scenes/creators/depth.webp', brands: '/assets/scenes/brands/depth.webp',
  directors: '/assets/scenes/directors/depth.webp', apply: '/assets/scenes/apply/depth.webp',
};
/* the sources to try, best first: the smallest encode that covers the canvas (cover fit, plus headroom for the
   camera's zoom), AVIF before WebP */
async function paintingFor(chapter, ctx) {
  const d = DESK[`/public/assets/scenes/${chapter}/manifest.json`];
  const best = (l) => {
    l = [...(l || [])].filter((v) => v && v.src && v.w && v.h).sort((a, b) => a.w - b.w);
    if (!l.length) return null;
    const need = Math.max(ctx.w, ctx.h * (l[0].w / l[0].h)) * 1.15 * 0.9;
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

export function plateScene({ id, image, depth, video = null, strength = 0.022, post }) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  scene.add(fullscreenQuad(mat));
  let vid = null, map = null, dep = null, playing = false;
  const cam = { zoom: 1.06, focus: [0.5, 0.5], push: 0 };
  return {
    id, scene, camera, post,
    async load(ctx) {
      const srcs = typeof image === 'function' ? await image(ctx) : [image];
      [map, dep] = await Promise.all([loadFirst(srcs), depth ? loadTexture(depth) : null]);
      mat.uniforms.map.value = map; mat.uniforms.depth.value = dep; mat.uniforms.hasDepth.value = dep ? 1 : 0;
      mat.uniforms.imgSize.value.set(map.image.width, map.image.height);
      if (video && !ctx.reduced) {
        vid = videoTexture(video(ctx));
        vid.video.addEventListener('loadeddata', () => { if (!vid) return; mat.uniforms.map.value = vid.texture; mat.uniforms.imgSize.value.set(vid.video.videoWidth, vid.video.videoHeight); ctx.stage.invalidate(); }, { once: true });
        vid.video.addEventListener('playing', () => { playing = true; ctx.stage.invalidate(); });
        vid.video.addEventListener('pause', () => { playing = false; });
        vid.video.load();
      }
    },
    dispose() {
      if (vid) { vid.video.pause(); vid.video.removeAttribute('src'); vid.video.querySelectorAll('source').forEach((s) => s.remove()); vid.video.load(); vid.texture.dispose(); vid = null; playing = false; }
      map?.dispose(); dep?.dispose(); map = dep = null;
      mat.uniforms.map.value = null; mat.uniforms.depth.value = null; mat.uniforms.hasDepth.value = 0;
    },
    activate() { vid?.video.play().catch(() => {}); },
    deactivate() { vid?.video.pause(); },
    ambient() { return playing; },   // the TV keeps the stage drawing (≤ 30 fps when nothing else moves)
    resize(w, h) { mat.uniforms.res.value.set(w, h); },
    update(ctx, s) {
      const sh = SHEETS[chapterOf(s.el)];
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
      u.push.value = cam.push + (ctx.reduced ? 0 : 0.012 * Math.sin(ctx.time * 0.3));
      u.strength.value = ctx.reduced ? 0 : strength;
      u.pointer.value.copy(ctx.pointer);
    },
  };
}

export default function register(stage) {
  // one scene per chapter painting (Results keeps its own entry below: the TV video over the 1920 px plate)
  for (const path of Object.keys(DESK)) {
    const chapter = path.split('/').slice(-2)[0];
    if (chapter === 'results' || !DESK[path]) continue;
    stage.add(plateScene({ id: `plate:${chapter}`, image: (ctx) => paintingFor(chapter, ctx), depth: DEPTH[chapter] || null }));
  }
  stage.add(plateScene({
    id: 'plate:results', image: '/assets/plates/results.webp', depth: '/assets/plates/results-depth.webp',
    // the full-screen backdrop video (scripts/encode-results.sh: AV1 where it plays, H.264 otherwise; ~1/5 of the old
    // 10.6 MB); narrow windows keep the 1100-px encode
    video: (ctx) => (ctx.vw < 900 ? [{ src: '/assets/video/results-sm.mp4', type: 'video/mp4' }] : [
      { src: '/assets/video/film/results-1920-av1.mp4?v=1', type: 'video/mp4; codecs="av01.0.08M.08"' },
      { src: '/assets/video/film/results-1920-h264.mp4?v=1', type: 'video/mp4; codecs="avc1.640028"' },
    ]),
  }));
}
