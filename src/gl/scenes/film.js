/* The hero film (570 painted frames): the figures and the floating kit → the camera handed across
   → the lens → the vortex → the machine draws → the Storytellers painting.
   Scroll position → frame comes from [data-film="hero"][data-frames="a-b"] ranges in the markup:
   each element maps its pin progress linearly onto frames a..b (holds between ranges).
   At rest on frame 0 and at the end (frame 569, which is the Storytellers plate) the frame becomes a
   depth diorama with pointer parallax and a slow push. */
import * as THREE from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture } from '../lib/loaders.js';
import { createSparks } from '../lib/sparks.js';
import { geo } from '../../core/layout.js';
import { clamp, smooth, seg } from '../../core/scroll.js';

export function filmRanges(name) {
  return [...document.querySelectorAll(`[data-film="${name}"][data-frames]`)].map((el) => {
    const [a, b] = el.dataset.frames.split('-').map(Number);
    return { el, a, b };
  });
}
export function frameAt(ranges, y, vh) {
  let f = ranges.length ? ranges[0].a : 0;
  for (const r of ranges) {
    const g = geo(r.el);
    if (y < g.top) break;
    const p = clamp((y - g.top) / Math.max(1, g.height - vh));
    f = r.a + (r.b - r.a) * p;
  }
  return f;
}

export default function register(stage) {
  const small = () => window.innerWidth * Math.min(2, window.devicePixelRatio || 1) < 1500;
  const COUNT = 570;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  scene.add(fullscreenQuad(mat));
  let stream, depthRest, depthEnd, sparks, ranges = [];
  let push = 0;

  stage.add({
    id: 'film', scene, camera,
    async load(ctx) {
      stream = new FrameStream({ dir: `/assets/frames/hero/${small() ? 'sm' : 'lg'}`, count: COUNT, rev: 1 });
      ranges = filmRanges('hero');
      const first = stream.first();
      [depthRest, depthEnd] = await Promise.all([loadTexture('/assets/plates/hero-depth.png'), loadTexture('/assets/plates/storytellers-depth.png'), first]);
      if (ctx.tier >= 1 && !ctx.reduced) {
        sparks = createSparks(ctx.tier >= 2 ? 2600 : 900);
        sparks.u.px.value = ctx.dpr * 1.6;
        scene.add(sparks.points);
      }
    },
    resize(w, h, dpr) { mat.uniforms.res.value.set(w, h); if (sparks) { sparks.u.aspect.value = w / h; sparks.u.px.value = dpr * 1.6; } },
    update(ctx, s) {
      if (!ranges.length || !document.body.contains(ranges[0].el)) ranges = filmRanges('hero');
      const f = ctx.reduced ? 0 : frameAt(ranges, ctx.scrollY, ctx.vh);
      stream.seek(f);
      const u = mat.uniforms;
      u.map.value = stream.texture;
      u.imgSize.value.set(stream.size[0], stream.size[1]);
      // depth parallax only where the frame is the plate the depth map was computed from
      const atRest = 1 - smooth(seg(f, 0, 6));
      const atEnd = smooth(seg(f, COUNT - 7, COUNT - 1));
      if (atEnd > 0) { u.depth.value = depthEnd; u.hasDepth.value = 1; u.strength.value = 0.022 * atEnd; }
      else if (atRest > 0) { u.depth.value = depthRest; u.hasDepth.value = 1; u.strength.value = 0.02 * atRest; }
      else u.hasDepth.value = 0;
      // slow breathing push while at rest; the film carries its own camera in between
      push += ((atRest + atEnd) * (0.035 + 0.02 * Math.sin(ctx.time * 0.25)) - push) * 0.05;
      u.push.value = push;
      u.zoom.value = 1.04 + 0.02 * (atRest + atEnd);
      u.focus.value.set(0.5, 0.48);
      u.pointer.value.copy(ctx.pointer);
      u.exposure.value = 1;
      if (sparks) {
        // the vortex is frames ~384–430 (the lens's vanishing point at frame centre), dust settles by ~500
        const sp = seg(f, 384, 500);
        sparks.points.visible = sp > 0 && sp < 1;
        sparks.u.prog.value = sp; sparks.u.time.value = ctx.time;
        sparks.u.alpha.value = 1 - smooth(seg(f, 470, 500));
      }
    },
  });
}
