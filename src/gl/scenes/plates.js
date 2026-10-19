/* Still-plate dioramas used as chapter scenes. Each is one painting + its depth map, moved by camera keys
   (zoom, focus, push) plus pointer parallax:
   - keys: the chapter's sheet in src/gl/keys/plates.json (gl/timeline.js: per-channel keyframes in viewports of the
     section's pass, cubic-bezier eases); a chapter without a sheet falls back to the section's
     data-cam-from / data-cam-to = "zoom focusX focusY push", interpolated (smoothstep) over its pass progress (pe).
   - plate:storytellers  (Creators, Brands)
   - plate:hero          (Apply: the hands, a bookend to the hero)
   - plate:results       (Results: the watchers; the TV plays — a video texture over the plate)
   (Method is the camera teardown now, td:camera in teardowns.js: no painted plate.) */
import { Scene, OrthographicCamera } from 'three';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture, videoTexture } from '../lib/loaders.js';
import { sheet, passT, cameraAt } from '../timeline.js';
import KEYS from '../keys/plates.json';
import { smooth } from '../../core/scroll.js';

const parseCam = (s, d) => (s ? s.trim().split(/\s+/).map(Number) : d);
const SHEETS = Object.fromEntries(Object.entries(KEYS).filter(([k]) => !k.startsWith('//')).map(([k, v]) => [k, sheet(v)]));
const chapterOf = (el) => el.closest('[data-chapter]')?.id || el.id;

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
      [map, dep] = await Promise.all([loadTexture(image), loadTexture(depth)]);
      mat.uniforms.map.value = map; mat.uniforms.depth.value = dep; mat.uniforms.hasDepth.value = 1;
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
  stage.add(plateScene({ id: 'plate:storytellers', image: '/assets/plates/storytellers.webp', depth: '/assets/plates/storytellers-depth.png' }));
  stage.add(plateScene({ id: 'plate:hero', image: '/assets/plates/hero.webp', depth: '/assets/plates/hero-depth.png' }));
  stage.add(plateScene({
    id: 'plate:results', image: '/assets/plates/results.webp', depth: '/assets/plates/results-depth.png',
    video: (ctx) => [{ src: ctx.vw < 900 ? '/assets/video/results-sm.mp4' : '/assets/video/results.mp4', type: 'video/mp4' }],
  }));
}
