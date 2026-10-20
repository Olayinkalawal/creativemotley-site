/* The Method chapter's real-time camera as a stage scene (drop-in: copy to src/gl/scenes/camera3d.js, and the module
   .lab/cam3d/camera3d.js to src/gl/lib/camera3d.js). Scene id: td:camera3d (method.html data-scene).
   The choreography stays the section's (sections/_teardown.js + gl/lib/tdcore.js): this scene reads the same clock
   (tdRun → tdTimeline → tdState: orbit, hand, explode, settle, fade) and the same slot rect the section computes each
   frame (live.x/y/w/h: the orbit's slot, the column .td__target after the hand-off), so the 3D camera, the copy, the
   rows and the markers move as one.
   Markers: after posing (cam.anchors() poses first, so they describe this frame, not the last one), the scene
   publishes the anchors relative to the pin (live.anchors3d, y minus the pin top it posed with) and calls the
   section's live.place3d(), which writes the marker transforms in the same frame, after the section's own pass: no
   lag behind the parts, and the pin's native scroll carries them during the ride-out. An id pass (occlusion) runs
   whenever the view settles (inside render()), and also while the reader scrolls through the end of the explode
   (every 0.025 of explode from 0.93: the module trusts a pass within 0.03 of its pose), so the markers draw in with
   the scroll instead of all at once after it stops. Until the next update() has published a pass that landed inside
   render() the scene stays ambient(), so the stage draws one more frame and the markers pick it up.
   Stand-in: load() first makes the section's two 3D stills eager and waits until the hero still has painted, so a
   jump to Method shows the still while the GLB parses and the studio bakes. The first frame drawn while that still is
   on screen starts at the still's own pose (the hero key, or the exploded key) and turns into the scroll's pose over
   0.9 s while the still dissolves (_teardown.css), instead of cutting to another angle. live.ready says the camera has
   drawn (false again once disposed: the section brings the stills back over the stage's ink until it reloads).
   Lazy: the GLB and the meshopt decoder load when the run enters the stage's mount window (stage.ensure → load);
   disposed outside it (every GPU resource freed). Idle-stop: renders on change, then adds jittered samples while
   ambient() (≤ 12 frames desktop, 4–6 phones), then the stage stops drawing.
   Phones (the still path): the phone GLB; only where core/env.js CAM3D allows it, and if the frame-rate governor
   has to step all the way down to "min" while the camera draws, the scene gives up for the session (the section keeps
   its 3D stills, as at tier 0; ?cam3d=1 / ?q=… turn that off for QA).
   Reduced motion never reaches this scene: main.js does not boot the stage then, and the section shows the static
   layout with the 3D stills (see INTEGRATION.md). */
import { create, KEYS } from '../lib/camera3d.js';
import { tdLive, tdFlags, tdTimeline, tdState, tdRun, tdLerpRect, tdPinTop } from '../lib/tdcore.js';
import { CAM3D_FORCED } from '../../core/env.js';

/* the site's art direction over the module's own keys (options and the exported KEYS only: the module and its API stay
   as the lab ships them, so its final drop-in keeps these):
   - the camera lands bigger in the column: 0.88 of the slot at the column key (the module's 0.76 read small in black;
     the hold keeps its own 0.92). method.html data-td-frame0 is the stand-in stills' size for the same key. */
KEYS.wide.column.fill = 0.88;
/* - phones: a tighter straight explode at the portrait hold (per part, on top of the module's PORTRAIT_SCALE: the lens
     and the rear cards travel about a third less, the free glass and the iris with the lens so the gap stays open; the
     covers and the battery less too), so the assembly is narrower and the fit draws the body larger (123 -> 133 px at
     390; every anchor still shows on its own part) */
const PORTRAIT = { lens: 0.76, lens_el_0: 0.76, lens_el_1: 0.76, lens_el_2: 0.76, lens_el_5: 0.76, lens_el_3: 0.7, lens_el_4: 0.7, aperture: 0.7,
  lcd: 0.74, main_pcb: 0.74, ibis_frame: 0.74, sensor: 0.74, shutter: 0.74, top_cover: 0.62, evf_module: 0.62, battery: 0.66 };
const INTRO_MS = 900;
const smooth = (x) => x * x * (3 - 2 * x);
const seg = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const qp = (v) => Math.round(v * 50) / 50;   // pointer steps of 0.02 (< 0.07° of parallax): a resting mouse stops restarting the samples

export default function register(stage) {
  const id = 'td:camera3d';
  const section = document.querySelector(`[data-scene="${id}"]`);
  if (!section) return;
  const live = tdLive(id);
  live.ready = false;
  let cam = null, run = null, pinH = 0, heroR = null, colR = null, fl = null, timeline = null, TL = -1, vw = 0, vh = 0, idV = -1, idPending = false;
  let first = false, intro = 0, introT0 = 0, introX = 0, lastIdE = -1, gaveUp = false;
  const ST = { ph: {}, phN: {} }, S = {}, PH = {};
  const measure = (ctx) => {
    run = section.querySelector('[data-td-run]') || section;
    const pin = section.querySelector('.td__pin'), target = section.querySelector('[data-td-target]');
    pinH = pin ? pin.clientHeight : ctx.vh;
    heroR = { x: 0, y: 0, w: pin ? pin.clientWidth : ctx.vw, h: pinH };
    colR = target ? { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight } : heroR;
    fl = tdFlags(section); TL = -1; vw = ctx.vw; vh = ctx.vh;
  };
  // the stand-in: both stills fetched now (parked in data-src or loading="lazy" until the run is near), and the hero
  // still decoded and painted (two frames) before the GLB's parse, the studio bakes and the compile take the main
  // thread and the GPU (at most 2.5 s: a slow still never holds the camera back)
  const standIn = async () => {
    const ims = [...section.querySelectorAll('img.td__still')];
    for (const im of ims) { if (!im.getAttribute('src') && im.dataset.src) im.src = im.dataset.src; im.loading = 'eager'; }
    const h = section.querySelector('.td__still--hero');
    if (!h || !h.getAttribute('src')) return;
    await Promise.race([h.decode().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
  const sc = {
    id, device: true,
    post: { vignette: 0.16, grain: 0.03, fringe: 0.5 },
    async load(ctx) {
      await standIn();
      // phones: the phone GLB and its lighter settings, plus (starting on the high level) the paint grain and 6 samples
      // and a little more exposure on the small, dark body (it read flatter than its own tier-0 still); no bloom anywhere
      // (strength 0.05 over threshold 4: invisible, and 2.7 KB of lazy JS and a full-screen pass per sample)
      const phone = !!ctx.still, hi = phone && ctx.quality === 'high';
      cam = create(ctx, { base: '/assets/models/camera/', tier: ctx.tier, reduced: ctx.reduced, mobile: phone, bloom: false,
        ...(phone ? { portraitScale: PORTRAIT, exposure: 1.07, ...(hi ? { paintGrain: true, acc: 6 } : {}) } : {}) });
      cam.resize(ctx.w, ctx.h, ctx.dpr);
      await cam.load();
      first = true;
      window.__cam3d = cam; window.__live3d = live; window.__cam3dPortrait = PORTRAIT;   // for QA scripts (like the stage's window.__stage)
    },
    dispose() {
      cam?.dispose(); cam = null; live.anchors3d = null; live.ready = false;
      idPending = false; idV = -1; lastIdE = -1; intro = 0; first = false;
    },
    resize(w, h, dpr) { cam?.resize(w, h, dpr); },
    update(ctx) {
      if (!cam || !cam.loaded) return;
      if (!run || ctx.vw !== vw || ctx.vh !== vh) measure(ctx);
      const r = tdRun(run, ctx.scrollY, ctx.vh);
      if (Math.abs(r.L - TL) > 1e-3) { timeline = tdTimeline(1, r.L); TL = r.L; }
      const st = tdState(r.s, timeline, r.L, fl, ST);
      // phones: the governor stepped all the way down while the camera draws: give up to the stills for this visit
      if (ctx.still && CAM3D_FORCED === null && !/[?&]q=/.test(location.search) && stage.quality === 'min' && !gaveUp) {
        gaveUp = true;
        setTimeout(() => { stage.dispose(sc); sc.failed = true; section.dataset.cam3d = 'stills'; }, 0);
      }
      // the first frame after a load while the stand-in is on screen: start at the still's pose (the hero still before
      // a quarter of the explode, the exploded still after it: the section's dip) and turn into the scroll's
      if (first) {
        first = false;
        intro = r.s > -1.0 && r.s < r.L + 0.6 && st.fade > 0.02 ? 1 : 0;
        introT0 = performance.now(); introX = st.ph.explodeLin >= 0.25 ? 1 : 0;
      }
      let ph = st.ph;
      if (intro > 0) {
        intro = Math.max(0, 1 - (performance.now() - introT0) / (window.__cam3dIntroMs || INTRO_MS));   // (QA: a slow renderer can stretch it to see it)
        const k = smooth(intro);
        Object.assign(PH, st.ph);
        if (introX) PH.explode += (1 - PH.explode) * k;
        else { PH.orbit += (1 - PH.orbit) * k; PH.explode *= 1 - k; }
        ph = PH;
      }
      cam.setPhases(ph);
      // the slot rect: the section's, computed this frame (or the same rect from the same clock)
      const pinTop = tdPinTop(r, ctx.scrollY, pinH);
      let x, y, w, h;
      if (live.f === ctx.frame) { x = live.x; y = live.y; w = live.w; h = live.h; }
      else { tdLerpRect(live.orb || heroR, colR, st.ph.hand, S); x = S.x; y = S.y + pinTop; w = S.w; h = S.h; }   // live.orb: the orbit's slot, clear of the title
      cam.setLayout({ x, y, w, h }, ctx.vw, ctx.vh);
      cam.setPointer(qp(ctx.pointer.x), qp(ctx.pointer.y), 1);
      cam.setFade(st.fade);
      // the markers draw in as the parts arrive, while scrolling (see the header)
      if (st.ph.explode < 0.93 || intro > 0) lastIdE = -1;
      else if (lastIdE < 0 || Math.abs(st.ph.explode - lastIdE) >= 0.025) { cam.occlusion(); lastIdE = st.ph.explode; }
      // posed for this frame; published relative to the pin (the section adds nothing)
      live.anchors3d = cam.anchors(pinTop); live.anchorsF = ctx.frame; live.pinTop = pinTop;
      live.place3d?.(live.anchors3d);
      idPending = false;              // this frame's anchors carry the last id pass
    },
    render(renderer, target) {
      if (!cam) return;
      cam.render(renderer, target);
      live.ready = true;
      // the occlusion test ran (the view settled): one more frame (ambient) so the markers take it
      const v = cam.idVersion;
      if (v !== idV) { idV = v; idPending = true; stage.invalidate(); }
    },
    ambient() { return !!cam && (cam.busy() || idPending || intro > 0); },
  };
  stage.add(sc);
}
