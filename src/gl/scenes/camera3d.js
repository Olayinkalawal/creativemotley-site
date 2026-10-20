/* The Method chapter's real-time camera as a stage scene (drop-in: copy to src/gl/scenes/camera3d.js, and the module
   .lab/cam3d/camera3d.js to src/gl/lib/camera3d.js). Scene id: td:camera3d (method.html data-scene).
   The choreography stays the section's (sections/_teardown.js + gl/lib/tdcore.js): this scene reads the same clock
   (tdRun → tdTimeline → tdState: orbit, hand, explode, settle, fade) and the same slot rect the section computes each
   frame (live.x/y/w/h: the whole pin during the orbit, the column .td__target after the hand-off), so the 3D camera,
   the copy, the rows and the markers move as one.
   Markers: after posing (cam.anchors() poses first, so they describe this frame, not the last one), the scene
   publishes the anchors relative to the pin (live.anchors3d, y minus the pin top it posed with) and calls the
   section's live.place3d(), which writes the marker transforms in the same frame, after the section's own pass: no
   lag behind the parts, and the pin's native scroll carries them during the ride-out. The id pass (occlusion) lands
   inside render() once the view has settled; until the next update() has published its result the scene stays
   ambient(), so the stage draws one more frame and the markers pick it up (a stage.invalidate() from inside render()
   would be cleared by the same frame, and a marker whose test is stale stays hidden).
   Lazy: the GLB and the meshopt decoder load when the run enters the stage's mount window (stage.ensure → load);
   disposed outside it (every GPU resource freed). Idle-stop: renders on change, then adds jittered samples while
   ambient() (≤ 12 frames), then the stage stops drawing.
   Reduced motion never reaches this scene: main.js does not boot the stage then, and the section shows the static
   layout with the 3D stills (see INTEGRATION.md). */
import { create } from '../lib/camera3d.js';
import { tdLive, tdFlags, tdTimeline, tdState, tdRun, tdLerpRect, tdPinTop } from '../lib/tdcore.js';

export default function register(stage) {
  const id = 'td:camera3d';
  const section = document.querySelector(`[data-scene="${id}"]`);
  if (!section) return;
  const live = tdLive(id);
  let cam = null, run = null, pinH = 0, heroR = null, colR = null, fl = null, timeline = null, TL = -1, vw = 0, vh = 0, idV = -1, idPending = false;
  const ST = { ph: {}, phN: {} }, S = {};
  const measure = (ctx) => {
    run = section.querySelector('[data-td-run]') || section;
    const pin = section.querySelector('.td__pin'), target = section.querySelector('[data-td-target]');
    pinH = pin ? pin.clientHeight : ctx.vh;
    heroR = { x: 0, y: 0, w: pin ? pin.clientWidth : ctx.vw, h: pinH };
    colR = target ? { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight } : heroR;
    fl = tdFlags(section); TL = -1; vw = ctx.vw; vh = ctx.vh;
  };
  stage.add({
    id, device: true,
    post: { vignette: 0.16, grain: 0.03, fringe: 0.5 },
    async load(ctx) {
      // the phone GLB and its lighter settings on the still path only; a short desktop window keeps the desktop model
      cam = create(ctx, { base: '/assets/models/camera/', tier: ctx.tier, reduced: ctx.reduced, mobile: !!ctx.still });
      cam.resize(ctx.w, ctx.h, ctx.dpr);
      await cam.load();
      window.__cam3d = cam; window.__live3d = live;     // for QA scripts (like the stage's window.__stage)
    },
    dispose() { cam?.dispose(); cam = null; live.anchors3d = null; idPending = false; idV = -1; },
    resize(w, h, dpr) { cam?.resize(w, h, dpr); },
    update(ctx) {
      if (!cam || !cam.loaded) return;
      if (!run || ctx.vw !== vw || ctx.vh !== vh) measure(ctx);
      const r = tdRun(run, ctx.scrollY, ctx.vh);
      if (Math.abs(r.L - TL) > 1e-3) { timeline = tdTimeline(1, r.L); TL = r.L; }
      const st = tdState(r.s, timeline, r.L, fl, ST);
      cam.setPhases(st.ph);
      // the slot rect: the section's, computed this frame (or the same rect from the same clock)
      const pinTop = tdPinTop(r, ctx.scrollY, pinH);
      let x, y, w, h;
      if (live.f === ctx.frame) { x = live.x; y = live.y; w = live.w; h = live.h; }
      else { tdLerpRect(live.orb || heroR, colR, st.ph.hand, S); x = S.x; y = S.y + pinTop; w = S.w; h = S.h; }   // live.orb: the orbit's slot, clear of the title
      cam.setLayout({ x, y, w, h }, ctx.vw, ctx.vh);
      cam.setPointer(ctx.pointer.x, ctx.pointer.y, 1);
      cam.setFade(st.fade);
      // posed for this frame; published relative to the pin (the section adds nothing)
      live.anchors3d = cam.anchors(pinTop); live.anchorsF = ctx.frame; live.pinTop = pinTop;
      live.place3d?.(live.anchors3d);
      idPending = false;              // this frame's anchors carry the last id pass
    },
    render(renderer, target) {
      if (!cam) return;
      cam.render(renderer, target);
      // the occlusion test ran (the view settled): one more frame (ambient) so the markers take it
      const v = cam.idVersion;
      if (v !== idV) { idV = v; idPending = true; stage.invalidate(); }
    },
    ambient() { return !!cam && (cam.busy() || idPending); },
  });
}
