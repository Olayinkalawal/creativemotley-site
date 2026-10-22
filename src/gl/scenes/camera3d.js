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
   its 3D stills, as at tier 0; ?q=… turns that off for QA, ?cam3d=1 forces the camera onto a phone below CAM3D).
   Drag to turn, zoom (gl/lib/drag3d.js): once the camera draws, a hit region over it (the module's screen box, in the
   pin) turns it (setOffset) and zooms it about the pointer (setZoom: the fitted picture scaled about a point) through the
   whole run (orbit, explode, hold), but not while it turns from the still's pose; the markers follow (an id pass every
   5° of turn and when the turn or the zoom settles, beside tdIdDue's schedule); it eases back to the scroll's pose.
   Reduced motion never reaches this scene: main.js does not boot the stage then, and the section shows the static
   layout with the 3D stills (see INTEGRATION.md). */
import { create, KEYS } from '../lib/camera3d.js';
import { tdLive, tdFlags, tdTimeline, tdState, tdRun, tdLerpRect, tdPinTop, tdIdDue, tdIntroPose, tdIntroTurn, tdStandIn, tdGiveUp, tdPointerStep, TD_INTRO_MS } from '../lib/tdcore.js';
import { fetchGLB } from '../lib/glbfetch.js';
import { drag3d } from '../lib/drag3d.js';

/* the site's art direction over the module's own keys (options and the exported KEYS only: the module and its API stay
   as the lab ships them, so its final drop-in keeps these):
   - the camera lands bigger in the column: 0.88 of the slot at the column key (the module's 0.76 read small in black;
     the hold keeps its own 0.92). method.html data-td-frame0 is the stand-in stills' size for the same key. */
KEYS.wide.column.fill = 0.88;
/* - phones: the portrait hold's travel per part (in place of the module's PORTRAIT_SCALE). p5: back toward the module's
     own scales: phase 4's tighter explode (lens 0.76, glass and iris 0.7, cards 0.74) drew the body larger (133 px at
     390) but jammed the two free elements and the iris into a figure-8 under the lens barrel and sat the shutter card
     on the body. Now the lens runs 15% further than on desktop, the glass 5%, the iris 5% less, the cards 10% less:
     outline overlap element/element 18% (was 21), iris/element 29% (45), lens over an element 0% (80), shutter on the
     body 5% (39); the body 120 px wide at 390 (137 by the same outline measure): smaller, the price of a clean line. */
const PORTRAIT = { lens: 1.15, lens_el_0: 1.15, lens_el_1: 1.15, lens_el_2: 1.15, lens_el_5: 1.15, lens_el_3: 1.05, lens_el_4: 1.05, aperture: 0.95,
  lcd: 0.9, main_pcb: 0.9, ibis_frame: 0.9, sensor: 0.9, shutter: 0.9, top_cover: 0.66, evf_module: 0.66, battery: 0.7 };
// the intro turn, the id passes' schedule, the stand-in's wait, the phone give-up and the pointer steps are tdcore's
// (shared with the Kit's devices, gl/scenes/kit3d.js)
const smooth = (x) => x * x * (3 - 2 * x);

export default function register(stage) {
  const id = 'td:camera3d';
  const section = document.querySelector(`[data-scene="${id}"]`);
  if (!section) return;
  const live = tdLive(id);
  live.ready = false; live.turning = false;
  let cam = null, run = null, pinH = 0, heroR = null, colR = null, fl = null, timeline = null, TL = -1, vw = 0, vh = 0, idV = -1, idPending = false;
  let first = false, intro = 0, introX = 0, gaveUp = false, dg = null;
  const ST = { ph: {}, phN: {} }, S = {}, PH = {}, ID = { e: -1, s: -1 };
  const measure = (ctx) => {
    run = section.querySelector('[data-td-run]') || section;
    const pin = section.querySelector('.td__pin'), target = section.querySelector('[data-td-target]');
    pinH = pin ? pin.clientHeight : ctx.vh;
    heroR = { x: 0, y: 0, w: pin ? pin.clientWidth : ctx.vw, h: pinH };
    colR = target ? { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight } : heroR;
    fl = tdFlags(section); TL = -1; vw = ctx.vw; vh = ctx.vh;
  };
  const sc = {
    id, device: true,
    post: { vignette: 0.16, grain: 0.03, fringe: 0.5 },
    async load(ctx) {
      // phones: the governor is already at its floor (an earlier chapter pushed it there): the stills, without fetching
      // the GLB or running the bakes on a phone that is struggling (the stage keeps the section's stills; a warning only)
      if (tdGiveUp(ctx, stage)) { gaveUp = true; section.dataset.cam3d = 'stills'; throw new Error('camera3d: the stage is at its floor'); }
      // the stand-in: both stills fetched, decoded and painted (≤ 2.5 s) before the GLB's parse and the bakes (tdcore)
      await tdStandIn([...section.querySelectorAll('img.td__still')]);
      // phones: the phone GLB and its lighter settings, plus (starting on the high level) the paint grain and 6 samples
      // and a little more exposure on the small, dark body (it read flatter than its own tier-0 still); no bloom anywhere
      // (strength 0.05 over threshold 4: invisible, and 2.7 KB of lazy JS and a full-screen pass per sample)
      const phone = !!ctx.still, hi = phone && ctx.quality === 'high';
      cam = create(ctx, { base: '/assets/models/camera/', tier: ctx.tier, reduced: ctx.reduced, mobile: phone, bloom: false, loadBuffer: fetchGLB,
        ...(phone ? { portraitScale: PORTRAIT, exposure: 1.07, freeMetalEnv: 1.05, metalDirect: 0.6, ...(hi ? { paintGrain: true, acc: 6 } : {}) } : {}) });
      cam.resize(ctx.w, ctx.h, ctx.dpr);
      await cam.load();
      first = true;
      window.__cam3d = cam; window.__live3d = live; window.__cam3dPortrait = PORTRAIT;   // for QA scripts (like the stage's window.__stage)
    },
    dispose() {
      cam?.dispose(); cam = null; live.anchors3d = null; live.ready = false; live.turning = false;
      dg?.dispose(); dg = null;
      idPending = false; idV = -1; ID.e = ID.s = -1; intro = 0; first = false;
    },
    resize(w, h, dpr) { cam?.resize(w, h, dpr); },
    deactivate() { dg?.off(); },
    update(ctx) {
      if (!cam || !cam.loaded) return;
      if (!run || ctx.vw !== vw || ctx.vh !== vh) measure(ctx);
      const r = tdRun(run, ctx.scrollY, ctx.vh);
      if (Math.abs(r.L - TL) > 1e-3) { timeline = tdTimeline(1, r.L); TL = r.L; }
      const st = tdState(r.s, timeline, r.L, fl, ST);
      // phones: the governor stepped all the way down while the camera draws: give up to the stills for this visit
      if (tdGiveUp(ctx, stage) && !gaveUp) {
        gaveUp = true;
        setTimeout(() => { stage.dispose(sc); sc.failed = true; section.dataset.cam3d = 'stills'; }, 0);
      }
      // the first frame after a load while the stand-in is on screen: start at the still's pose (the hero still before
      // a quarter of the explode, the exploded still after it: the section's dip) and turn into the scroll's (not in the
      // orbit's first three quarters: tdcore tdIntroTurn, the dissolve hands over there)
      if (first) {
        first = false;
        intro = r.s > -1.0 && r.s < r.L + 0.6 && st.fade > 0.02 && tdIntroTurn(st.ph) ? 1 : 0;
        introX = st.ph.explodeLin >= 0.25 ? 1 : 0;
      }
      let ph = st.ph;
      if (intro > 0) {
        // on the stage's clock (dt ≤ 0.1 s a frame): 0.9 s at a real frame rate; a renderer under 10 fps still shows the
        // turn in steps instead of skipping it
        const k = smooth(intro);
        intro = Math.max(0, intro - (ctx.dt || 1 / 60) / ((window.__cam3dIntroMs || TD_INTRO_MS) / 1000));
        ph = tdIntroPose(st.ph, k, introX, PH);
      }
      cam.setPhases(ph);
      // the slot rect: the section's, computed this frame (or the same rect from the same clock)
      const pinTop = tdPinTop(r, ctx.scrollY, pinH);
      let x, y, w, h;
      if (live.f === ctx.frame) { x = live.x; y = live.y; w = live.w; h = live.h; }
      else { tdLerpRect(live.orb || heroR, colR, st.ph.hand, S); x = S.x; y = S.y + pinTop; w = S.w; h = S.h; }   // live.orb: the orbit's slot, clear of the title
      cam.setLayout({ x, y, w, h }, ctx.vw, ctx.vh);
      // drag to turn and zoom (gl/lib/drag3d.js): its offset and zoom on top of the scroll's pose; the pointer parallax
      // holds while dragging
      if (!dg && live.ready) dg = drag3d(stage, section.querySelector('.td__pin'), 'camera');
      const pv = dg ? dg.ptr(ctx.pointer) : ctx.pointer;
      cam.setOffset(dg?.az || 0, dg?.el || 0); cam.setZoom(dg?.k || 1, dg?.x || 0, dg?.y || 0);
      cam.setPointer(tdPointerStep(pv.x), tdPointerStep(pv.y), 1);
      cam.setFade(st.fade);
      // the markers draw in as the parts arrive, while scrolling (see the header; tdcore tdIdDue): a pass every 0.025 of
      // explode from 0.93, one as it reaches 1, and every third of the settle; and as the reader turns or zooms it
      const due = tdIdDue(ID, st.ph.explode, st.ph.settle, intro > 0);
      if ((dg?.due() && st.ph.explode >= 0.93) || due) cam.occlusion();
      // while it turns (no id pass yet) the section keeps the stills' markers on their uv (no blink at the hand-over)
      live.turning = intro > 0;
      // posed for this frame; published relative to the pin (the section adds nothing)
      live.anchors3d = cam.anchors(pinTop); live.anchorsF = ctx.frame; live.pinTop = pinTop;
      live.place3d?.(live.anchors3d);
      idPending = false;              // this frame's anchors carry the last id pass
      // the hit region follows the camera (every phase, once it draws and has stopped turning from the still's pose); the
      // hint may show at a resting point (the orbit before the hand-off, or the hold)
      if (dg) {
        const ph0 = st.ph;
        dg.step(ctx, cam.screenBox(), pinTop, live.ready && intro <= 0 && st.fade > 0.5, st.fade > 0.9 && (ph0.hand < 0.001 || ph0.settle > 0.3));
      }
    },
    render(renderer, target) {
      if (!cam) return;
      cam.render(renderer, target);
      if (!live.ready) requestAnimationFrame(() => stage.invalidate());   // (one more frame: the next update makes the drag region)
      live.ready = true;
      // the occlusion test ran (the view settled): one more frame (ambient) so the markers take it
      const v = cam.idVersion;
      if (v !== idV) { idV = v; idPending = true; stage.invalidate(); }
    },
    ambient() { return !!cam && (cam.busy() || idPending || intro > 0); },
  };
  stage.add(sc);
}
