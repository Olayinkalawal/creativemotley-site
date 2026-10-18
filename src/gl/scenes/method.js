/* IV · Method: the second frame film (453 painted frames), scene "film:method".
   Scroll → frame comes from src/sections/method.js (filmFrame: the run's pin progress through a pacing curve),
   so the progress hairline and the film always agree.
   - At rest on frames 0–24 (the opener; the film barely moves there) the frame is a depth diorama: the depth map was
     computed from frame 0 (/assets/plates/method.webp), so pointer parallax and a slow push hold its silhouettes.
     The diorama relaxes into the film over those frames (~100px of scroll), as a pure function of scroll.
   - While scrubbing, depth is off: the film carries its own camera.
   - Past the last frame (the dome), the view keeps easing up into the oculus while the stage dissolves into the
     next chapter, so the hand-off never stops dead.
   - Narrow screens: a 16:9 film cover-fitted to a portrait screen shows a quarter of its width, so the view pans
     to follow the subject (PAN: frame → the subject's centre in the frame). Landscape keeps the centre.
   - Frame tier by need: the cover-fitted frame's on-screen size in device pixels (a phone shows the full frame
     height, so it needs the large tier as much as a desktop does). */
import * as THREE from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture } from '../lib/loaders.js';
import { geo } from '../../core/layout.js';
import { clamp, smooth, seg } from '../../core/scroll.js';
import { filmFrame, FRAMES } from '../../sections/method.js';

const ASPECT = 1800 / 1012;   // both tiers: lg 1800×1012, sm 1100×618
// [frame, subject centre x in the frame]: the camera on the table → rising → exploded (body … lens) → closing → the dome
const PAN = [[0, 0.41], [56, 0.41], [100, 0.47], [140, 0.5], [170, 0.34], [200, 0.38], [260, 0.56], [336, 0.6], [370, 0.52], [394, 0.5], [420, 0.58], [452, 0.61]];
/* monotone cubic (Fritsch–Carlson) through [x, y] knots: no overshoot, no stop at a knot the path runs through */
function monotone(K) {
  const n = K.length, xs = K.map((k) => k[0]), ys = K.map((k) => k[1]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (!d[i]) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    x = clamp(x, xs[0], xs[n - 1]);
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const panAt = monotone(PAN);

export default function register(stage) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  // a horizontal pan of the cover window (the shared plate shader only zooms about a focus point)
  const PAN_AT = 'vec2 uv = cover(vUv);';
  if (mat.fragmentShader.includes(PAN_AT)) {
    mat.fragmentShader = mat.fragmentShader.replace('varying vec2 vUv;', 'varying vec2 vUv;\nuniform float panX;').replace(PAN_AT, PAN_AT + '\n  uv.x += panX;');
    mat.uniforms.panX = { value: 0 };
  }
  scene.add(fullscreenQuad(mat));
  const u = mat.uniforms;
  const findRun = () => document.querySelector('[data-film="method"][data-frames]');
  let stream = null, run = null;

  stage.add({
    id: 'film:method', scene, camera,
    async load(ctx) {
      // the frame is cover-fitted: on screen it is at least the viewport's width and its height × 16:9
      const dpr = Math.min(window.devicePixelRatio || 1, ctx.stage?.dprCap ?? 1.6);
      const need = Math.max(window.innerWidth, window.innerHeight * ASPECT) * dpr;
      stream = new FrameStream({
        dir: `/assets/frames/method/${need > 1300 ? 'lg' : 'sm'}`, count: FRAMES, rev: 1,
        name: (i) => 'm_' + String(i + 1).padStart(4, '0') + '.webp',
      });
      run = findRun();
      // arriving mid-run (a jump, a deep link, a restored scroll): fetch and show the reader's frame first
      const f0 = run && !ctx.reduced ? filmFrame(run, window.scrollY, window.innerHeight) : 0;
      const first = stream.first();
      if (f0 > 0.5) stream.seek(f0);
      const [depth] = await Promise.all([loadTexture('/assets/plates/method-depth.png'), first]);
      u.depth.value = depth;
    },
    resize(w, h) { u.res.value.set(w, h); },
    update(ctx, s) {
      if (!run || !document.body.contains(run)) run = findRun();
      const f = ctx.reduced || !run ? 0 : filmFrame(run, ctx.scrollY, ctx.vh);
      stream.seek(f);
      u.map.value = stream.texture;
      u.imgSize.value.set(stream.size[0], stream.size[1]);

      // depth parallax on the opening frames (the film is nearly still there), relaxing over ~100px of scroll
      const atRest = 1 - smooth(seg(f, 0, 24));
      u.hasDepth.value = atRest > 0 ? 1 : 0;
      u.strength.value = 0.02 * atRest;
      u.pointer.value.copy(ctx.pointer);
      u.push.value = atRest * (0.034 + 0.012 * Math.sin(ctx.time * 0.25));

      // after the film: keep rising into the dome while the next chapter dissolves in (a pure function of scroll)
      let after = 0;
      if (run) { const g = geo(run); after = smooth(clamp((ctx.scrollY - (g.top + g.height - ctx.vh)) / ctx.vh)); }
      const dome = smooth(seg(f, 384, FRAMES - 1));
      const zoom = 1.04 + 0.02 * atRest + 0.06 * after;
      u.zoom.value = zoom;

      // narrow screens follow the subject; the window never leaves the frame
      let cx = 0.5;
      if (u.panX) {
        const ra = ctx.w / ctx.h, wide = Math.min(1, ra / ASPECT) / zoom;   // visible width, as a fraction of the frame
        const k = smooth(clamp((0.75 - wide) / 0.4));
        const half = wide / 2 + 0.01;
        cx = clamp(0.5 + (panAt(f) - 0.5) * k, half, 1 - half);
        u.panX.value = cx - 0.5;
      }
      u.focus.value.set(cx, 0.48 + 0.2 * dome);
      u.exposure.value = 1;
    },
  });
}
