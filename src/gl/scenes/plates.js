/* Still-plate dioramas used as chapter scenes. Each is one painting + its depth map, moved by a
   camera key on the section: data-cam-from / data-cam-to = "zoom focusX focusY push", interpolated
   over the section's pass progress (pe), plus pointer parallax.
   - plate:storytellers  (Creators, Brands)
   - plate:hero          (Apply: the hands, a bookend to the hero)
   - plate:results       (Results: the watchers; the TV plays — a video texture over the plate)
   (Method is the camera teardown now, td:camera in teardowns.js: no painted plate.) */
import * as THREE from 'three';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture, videoTexture } from '../lib/loaders.js';
import { smooth } from '../../core/scroll.js';

const parseCam = (s, d) => (s ? s.trim().split(/\s+/).map(Number) : d);

export function plateScene({ id, image, depth, video = null, strength = 0.022, post }) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  scene.add(fullscreenQuad(mat));
  let vid = null;
  return {
    id, scene, camera, post,
    async load(ctx) {
      const [map, dep] = await Promise.all([loadTexture(image), loadTexture(depth)]);
      mat.uniforms.map.value = map; mat.uniforms.depth.value = dep; mat.uniforms.hasDepth.value = 1;
      mat.uniforms.imgSize.value.set(map.image.width, map.image.height);
      if (video && !ctx.reduced) {
        vid = videoTexture(video(ctx));
        vid.video.addEventListener('loadeddata', () => { mat.uniforms.map.value = vid.texture; mat.uniforms.imgSize.value.set(vid.video.videoWidth, vid.video.videoHeight); }, { once: true });
        vid.video.load();
      }
    },
    activate() { vid?.video.play().catch(() => {}); },
    deactivate() { vid?.video.pause(); },
    resize(w, h) { mat.uniforms.res.value.set(w, h); },
    update(ctx, s) {
      const a = parseCam(s.el.dataset.camFrom, [1.06, 0.5, 0.5, 0]);
      const b = parseCam(s.el.dataset.camTo, a);
      const k = ctx.reduced ? 0.5 : smooth(s.pe);
      const u = mat.uniforms;
      u.zoom.value = a[0] + (b[0] - a[0]) * k;
      u.focus.value.set(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
      u.push.value = (a[3] + (b[3] - a[3]) * k) + (ctx.reduced ? 0 : 0.012 * Math.sin(ctx.time * 0.3));
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
