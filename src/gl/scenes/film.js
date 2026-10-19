/* The hero film (570 painted frames): the figures and the floating kit → the camera handed across
   → the lens → the vortex → the machine draws → the Storytellers painting.
   Delivered as video (v3): one short-GOP encode scrubbed by scroll (gl/lib/video.js): AV1 where the browser plays it,
   H.264 everywhere else, 1920×1080 (public/assets/video/film/, scripts/encode-film.sh). The WebP frame streams stay
   as the fallback (no playable source, a decode error, or ?film=frames).
   Scroll position → frame comes from [data-film="hero"][data-frames="a-b"] ranges in the markup:
   each element maps its pin progress linearly onto frames a..b (holds between ranges).
   At rest on frame 0 and at the end (frame 569, which is the Storytellers plate) the frame becomes a
   depth diorama with pointer parallax and a slow push. Desktop only: phones take the still path (gl/scenes/stills.js). */
import { Scene, OrthographicCamera } from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { VideoScrub } from '../lib/video.js';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture } from '../lib/loaders.js';
import { createSparks } from '../lib/sparks.js';
import { filmRanges, frameAt } from '../lib/filmRanges.js';
import { smooth, seg } from '../../core/scroll.js';

export { filmRanges, frameAt };

const COUNT = 570, FPS = 30;
export const FILM_SOURCES = [
  { src: '/assets/video/film/hero-1920-av1.mp4?v=1', type: 'video/mp4; codecs="av01.0.08M.08"' },
  { src: '/assets/video/film/hero-1920-h264.mp4?v=1', type: 'video/mp4; codecs="avc1.640028"' },
];
const timeout = (ms) => new Promise((r) => setTimeout(r, ms));

export default function register(stage) {
  const small = () => window.innerWidth * Math.min(2, window.devicePixelRatio || 1) < 1500;
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  scene.add(fullscreenQuad(mat));
  let src = null, depthRest = null, depthEnd = null, sparks = null, ranges = [];
  let push = 0;
  const redraw = () => stage.invalidate();

  async function open(ctx) {
    const frames = new URLSearchParams(location.search).get('film') === 'frames';
    if (!frames) {
      const v = new VideoScrub({ sources: FILM_SOURCES, fps: FPS, count: COUNT, onShow: redraw });
      if (v.ok) {
        await Promise.race([v.first, timeout(6000)]);
        if (v.ok && v.ready) return v;
        v.dispose();
      }
    }
    // fallback: the frame streams (the lg tier is 1920×1080 to f_0417, then 2400×1350: FrameStream reallocates)
    const s = new FrameStream({ dir: `/assets/frames/hero/${small() ? 'sm' : 'lg'}`, count: COUNT, rev: 2, onShow: redraw });
    await s.first();
    return s;
  }

  stage.add({
    id: 'film', scene, camera,
    async load(ctx) {
      ranges = filmRanges('hero');
      [src, depthRest, depthEnd] = await Promise.all([open(ctx), loadTexture('/assets/plates/hero-depth.png'), loadTexture('/assets/plates/storytellers-depth.png')]);
      if (ctx.tier >= 1 && !ctx.reduced && !sparks) {
        sparks = createSparks(ctx.tier >= 2 ? 2600 : 900);
        sparks.u.px.value = ctx.dpr * 1.6;
        sparks.u.aspect.value = ctx.w / ctx.h;
        scene.add(sparks.points);
      }
      stage.film = src;   // QA: seek stats (window.__stage.film.stats())
    },
    dispose() {
      src?.dispose(); src = null;
      depthRest?.dispose(); depthEnd?.dispose(); depthRest = depthEnd = null;
      mat.uniforms.map.value = null; mat.uniforms.depth.value = null;
    },
    resize(w, h, dpr) { mat.uniforms.res.value.set(w, h); if (sparks) { sparks.u.aspect.value = w / h; sparks.u.px.value = dpr * 1.6; } },
    update(ctx, s) {
      if (!src) return;
      if (!ranges.length || !document.body.contains(ranges[0].el)) ranges = filmRanges('hero');
      const f = ctx.reduced ? 0 : frameAt(ranges, ctx.scrollY, ctx.vh);
      src.seek(f);
      const u = mat.uniforms;
      u.map.value = src.texture;
      u.imgSize.value.set(src.size[0], src.size[1]);
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
