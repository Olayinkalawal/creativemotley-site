/* The hero film (570 painted frames, 0 … 440 played): the figures and the floating kit → the camera handed across
   → the lens → the vortex → the machine draws the crowd in line (it ends on the glowing line art, frame 440; the
   School of Athens then bleeds up under it with I Storytellers' top edge).
   Delivered as video (v3): one short-GOP encode (a keyframe every 8 frames), AV1 where the browser decodes it, H.264
   everywhere else, 1920×1080 (public/assets/video/film/, scripts/encode-film.sh), scrubbed by scroll.
   v3 phase 2: the encode is a cut of the 570 frames (FILM_CUT in gl/lib/filmRanges.js: no static opening, no
   near-black lens, every other frame where the render doubles them; 106 frames since the masters, which end it on the
   line art before the render paints the old Storytellers painting); the markup and this scene still speak in source
   frames, and cutIndex() maps them onto the cut. Paths:
     1. WebCodecs on a hardware decoder (gl/lib/codecStream.js): each GOP decoded once into a cache around the
        playhead (exact frames, no per-seek re-decode); ?film=codec forces it on a software decoder too;
     2. else a <video> seeked by currentTime (gl/lib/video.js; ?film=video);
     3. else the WebP frame streams, the cut's frames only (no playable source, a decode error, or ?film=frames).
   Scroll position → source frame comes from [data-film="hero"] in the markup (the hero keys it in screens of scroll,
   data-film-map; gl/lib/filmRanges.js).
   At rest on frame 0 the frame becomes a depth diorama with pointer parallax and a slow push (the hero plate's depth
   map); the end frame (440) holds, a touch closer (zoom 1.06), through the Storytellers bleed. On load the rest frame pushes in (about 2.4 s, from the CSS
   plate's framing): the copy is DOM and never waits for it. Desktop only: phones take the still path (gl/scenes/stills.js).
   First load: frame 0 is the hero plate (public/assets/plates/hero.webp, already fetched as the first paint), so at
   rest the scene draws that and opens the film only at the first sign of scrolling (wheel, touch, a key, a click, or
   a playhead past frame 0). Opening it at load cost 1–1.7 MB of buffered film before any scroll. */
import { Scene, OrthographicCamera } from 'three';
import { FrameStream } from '../lib/frameStream.js';
import { VideoScrub } from '../lib/video.js';
import { CodecStream } from '../lib/codecStream.js';
import { plateMaterial, fullscreenQuad } from '../lib/plate.js';
import { loadTexture } from '../lib/loaders.js';
import { createSparks } from '../lib/sparks.js';
import { filmRanges, frameAt, cutFrames, cutIndex } from '../lib/filmRanges.js';
import { smooth, seg } from '../../core/scroll.js';

export { filmRanges, frameAt };

const LAST = 440, FPS = 30;              // source frames 0 … 440 (the cut's last frame: the line art)
const CUT = cutFrames();                  // the source frame of each encoded frame
const COUNT = CUT.length;
export const FILM_SOURCES = [
  { src: '/assets/video/film/hero-cut-1920-av1.mp4?v=2', type: 'video/mp4; codecs="av01.0.08M.08"' },
  { src: '/assets/video/film/hero-cut-1920-h264.mp4?v=2', type: 'video/mp4; codecs="avc1.640028"' },
];
const PUSH_MS = 2400;                     // the load push-in
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const timeout = (ms) => new Promise((r) => setTimeout(r, ms));

export default function register(stage) {
  const small = () => window.innerWidth * Math.min(2, window.devicePixelRatio || 1) < 1500;
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = plateMaterial();
  scene.add(fullscreenQuad(mat));
  let src = null, plate = null, opening = null, gen = 0, depthRest = null, sparks = null, ranges = [];
  let push = 0, t0 = 0;   // t0: the first draw (the load push-in starts there)
  const redraw = () => stage.invalidate();

  async function open(ctx) {
    const mode = new URLSearchParams(location.search).get('film');   // QA: ?film=video | frames forces a path
    if (!mode || mode === 'codec') {
      const c = await CodecStream.open({ sources: FILM_SOURCES, count: COUNT, onShow: redraw, hardware: mode !== 'codec' });
      if (c) return c;
    }
    if (mode !== 'frames') {
      const v = new VideoScrub({ sources: FILM_SOURCES, fps: FPS, count: COUNT, onShow: redraw });
      if (v.ok) {
        await Promise.race([v.first, timeout(6000)]);
        if (v.ok && v.ready) return v;
        v.dispose();
      }
    }
    // fallback: the frame streams, the cut's frames only (the lg tier is 1920×1080 to f_0417, then 2400×1350:
    // FrameStream reallocates)
    const s = new FrameStream({ dir: `/assets/frames/hero/${small() ? 'sm' : 'lg'}`, count: COUNT, name: (i) => `f_${String(CUT[i] + 1).padStart(4, '0')}.webp`, rev: 2, onShow: redraw });
    await s.first();
    return s;
  }

  const INTENT = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  const unlisten = () => INTENT.forEach((e) => window.removeEventListener(e, go));
  // open the film once (per load): the plate stands in until its first frame is ready
  function go() {
    unlisten();
    if (opening || !plate) return;
    const g = gen;
    opening = open(stage.ctx).then((s) => {
      if (g !== gen) { s?.dispose(); return; }
      src = s; stage.film = s; redraw();
    }).catch((e) => console.warn('[film] open failed', e));
  }

  // the finish (gl/lib/post.js reads it every frame): it lands with the push-in, so the first frames match the CSS
  // plate they replace (no vignette, no grain), then the film's finish settles in
  const post = { vignette: 0.32, grain: 0.045 };
  stage.add({
    id: 'film', scene, camera, post,
    async load(ctx) {
      ranges = filmRanges('hero');
      [plate, depthRest] = await Promise.all([loadTexture('/assets/plates/hero.webp'), loadTexture('/assets/plates/hero-depth.webp')]);
      if (ctx.scrollY > 0) go();
      else INTENT.forEach((e) => window.addEventListener(e, go, { passive: true }));
      if (ctx.tier >= 1 && !ctx.reduced && !sparks) {
        sparks = createSparks(ctx.tier >= 2 ? 2600 : 900);
        sparks.u.px.value = ctx.dpr * 1.6;
        sparks.u.aspect.value = ctx.w / ctx.h;
        scene.add(sparks.points);
      }
    },
    dispose() {
      gen++; unlisten(); opening = null;
      src?.dispose(); src = null; stage.film = null;   // stage.film: QA seek stats (window.__stage.film.stats())
      plate?.dispose(); plate = null;
      depthRest?.dispose(); depthRest = null;
      mat.uniforms.map.value = null; mat.uniforms.depth.value = null;
    },
    resize(w, h, dpr) { mat.uniforms.res.value.set(w, h); if (sparks) { sparks.u.aspect.value = w / h; sparks.u.px.value = dpr * 1.6; } },
    // the load push-in keeps the loop drawing (≤ 30 fps while idle) until it lands
    ambient(ctx) { return !ctx.reduced && t0 > 0 && performance.now() - t0 < PUSH_MS; },
    update(ctx, s) {
      if (!src && !plate) return;
      if (!ranges.length || !document.body.contains(ranges[0].el)) ranges = filmRanges('hero');
      const f = ctx.reduced ? 0 : frameAt(ranges, ctx.scrollY, ctx.vh);   // source frame
      if (!src && f > 0) go();
      src?.seek(cutIndex(CUT, f));
      const u = mat.uniforms;
      // the plate (= frame 0) until the film's first frame is in
      const live = src && src.ready !== false && (src.shown === undefined || src.shown >= 0);
      if (live) { u.map.value = src.texture; u.imgSize.value.set(src.size[0], src.size[1]); }
      else { u.map.value = plate; u.imgSize.value.set(plate.image.width, plate.image.height); }
      // depth parallax only where the frame is the plate the depth map was computed from (frame 0); the line-art end
      // frame has no map, so it only breathes (the zoom below)
      const atRest = 1 - smooth(seg(f, 0, 6));
      const atEnd = smooth(seg(f, LAST - 8, LAST));
      if (atRest > 0) { u.depth.value = depthRest; u.hasDepth.value = 1; u.strength.value = 0.02 * atRest; }
      else u.hasDepth.value = 0;
      // the load push-in: from the CSS plate's framing (cover, zoom 1) to the rest framing, once, from the first draw
      if (!t0) t0 = performance.now();
      const intro = ctx.reduced ? 1 : easeOut(Math.min(1, (performance.now() - t0) / PUSH_MS));
      // slow breathing push while at rest; the film carries its own camera in between
      push += ((atRest + atEnd) * (0.035 + 0.02 * Math.sin(ctx.time * 0.25)) - push) * 0.05;
      const k = atRest > 0 ? 1 - atRest * (1 - intro) : 1;   // 0 at the first frame (the CSS plate) … 1 landed
      u.push.value = push * intro;
      u.zoom.value = 1 + (0.04 + 0.02 * (atRest + atEnd)) * k;
      post.vignette = 0.32 * k; post.grain = 0.045 * k;
      u.focus.value.set(0.5, 0.48);
      u.pointer.value.copy(ctx.pointer);
      u.exposure.value = 1;
      if (sparks) {
        // the vortex is frames ~384–430 (the lens's vanishing point at frame centre); the dust has settled by the
        // line-art end frame (440), which the film holds through the Storytellers bleed
        const sp = seg(f, 384, LAST);
        sparks.points.visible = sp > 0 && sp < 1;
        sparks.u.prog.value = sp; sparks.u.time.value = ctx.time;
        sparks.u.alpha.value = 1 - smooth(seg(f, 418, LAST));
      }
    },
  });
}
