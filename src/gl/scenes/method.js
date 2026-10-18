/* IV · Method: the second frame film (453 painted frames), scene "film:method".
   Scroll → frame comes from src/sections/method.js (filmFrame: the run's pin progress through a pacing curve),
   so the progress hairline and the film always agree.
   - At rest on frame 0 (the opener) the frame is a depth diorama: the depth map was computed from frame 0
     (/assets/plates/method.webp), so pointer parallax and a slow breathing push hold its silhouettes.
   - While scrubbing, depth is off: the film carries its own camera.
   - Past the last frame (the dome), the view keeps easing up into the oculus while the stage dissolves into
     Showcase, so the hand-off never stops dead. */
import * as THREE from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture } from '../lib/loaders.js';
import { geo } from '../../core/layout.js';
import { clamp, smooth, seg } from '../../core/scroll.js';
import { filmFrame, FRAMES } from '../../sections/method.js';

export default function register(stage) {
  const small = () => window.innerWidth * Math.min(2, window.devicePixelRatio || 1) < 1500;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  scene.add(fullscreenQuad(mat));
  const u = mat.uniforms;
  const findRun = () => document.querySelector('[data-film="method"][data-frames]');
  let stream = null, run = null, push = 0;

  stage.add({
    id: 'film:method', scene, camera,
    async load() {
      stream = new FrameStream({
        dir: `/assets/frames/method/${small() ? 'sm' : 'lg'}`, count: FRAMES, rev: 1,
        name: (i) => 'm_' + String(i + 1).padStart(4, '0') + '.webp',
      });
      run = findRun();
      const [depth] = await Promise.all([loadTexture('/assets/plates/method-depth.png'), stream.first()]);
      u.depth.value = depth;
    },
    resize(w, h) { u.res.value.set(w, h); },
    update(ctx, s) {
      if (!run || !document.body.contains(run)) run = findRun();
      const f = ctx.reduced || !run ? 0 : filmFrame(run, ctx.scrollY, ctx.vh);
      stream.seek(f);
      u.map.value = stream.texture;
      u.imgSize.value.set(stream.size[0], stream.size[1]);

      // depth parallax only on frame 0, the plate the depth map belongs to
      const atRest = 1 - smooth(seg(f, 0, 4));
      u.hasDepth.value = atRest > 0 ? 1 : 0;
      u.strength.value = 0.02 * atRest;
      u.pointer.value.copy(ctx.pointer);
      const k = 1 - Math.pow(0.04, ctx.dt);
      push += (atRest * (0.034 + 0.018 * Math.sin(ctx.time * 0.25)) - push) * k;
      u.push.value = push;

      // after the film: keep rising into the dome while the next chapter dissolves in (a pure function of scroll)
      let after = 0;
      if (run) { const g = geo(run); after = smooth(clamp((ctx.scrollY - (g.top + g.height - ctx.vh)) / ctx.vh)); }
      const dome = smooth(seg(f, 384, FRAMES - 1));
      u.zoom.value = 1.04 + 0.02 * atRest + 0.06 * after;
      u.focus.value.set(0.5, 0.48 + 0.2 * dome);
      u.exposure.value = 1;
    },
  });
}
