/* The persistent stage: one WebGL canvas fixed behind the page (the Editions "Background").
   Sections declare which scene they show with data-scene="id". Each frame the stage:
     1. finds the section under the reading line and any scene boundary inside the viewport,
     2. skips rendering entirely while an opaque paper panel ([data-opaque]) covers the screen,
     3. renders the one or two scenes involved into render targets,
     4. composites them through the post pass (ink-bleed dissolve + film finish).

   Lifecycle (v3, the Editions pipeline):
     - scene modules are factories, each its own dynamic chunk (gl/boot.js): a module is imported the first time one
       of its ids comes into the mount window;
     - the mount window is the active scene run ±1 (a run = consecutive sections showing the same scene), plus the
       chapter under a hovered chapter link (rail, dropdown, menu, hero index); scenes outside it are disposed after a
       short grace (their textures and streams freed; programs kept, so a return needs no recompile);
     - the next run loads when the current one becomes active (and has stayed active for a moment, so a long
       programmatic scroll does not load everything it flies past);
     - after load, each scene's programs are compiled with compileAsync and its textures uploaded at idle, before
       its first draw;
     - dirty-checked render loop: it draws only while something changes (scroll, pointer, a scene that asks with
       stage.invalidate(), a stream frame landing) and stops ~300 ms after the last change. Scenes that are alive on
       their own (ambient(ctx) → true: dust, a playing video) keep drawing at 30 fps while idle;
     - one canvas size per quality level, from a pixel budget (longest side 1280 / 1920 / 2880 px, DPR ≤ 2; phones
       on the still path 1280 / 1920 / 2560, DPR ≤ 3; a 960-px floor for software rasterisers). A frame-rate average
       steps the level down below 45 fps; "low" (and the floor) cap the stage at 30 fps. A level change is applied
       only between scenes (paper covering, a scene change, or idle), never mid-scene.

   A scene module (src/gl/scenes/*.js) default-exports register(stage) and calls stage.add({
     id,                       // matches data-scene
     async load(ctx),          // fetch textures etc.; called when its section enters the mount window
     dispose(ctx),             // free what load() made (textures, streams); load() runs again on return
     update(ctx, seg),         // per frame while it is drawn. seg = { el, p, pe, top, height }
                               //   p  = pin progress: 0 when el's top meets the viewport top, 1 when its bottom meets the viewport bottom
                               //   pe = pass progress: 0 when el's top enters at the bottom, 1 when its bottom leaves at the top
     render(renderer, target), // draw into target (default: renderer.render(this.scene, this.camera))
     resize(w, h, dpr),
     activate(), deactivate(), // e.g. play/pause a video when the scene starts/stops being drawn
     ambient(ctx),             // optional: true while it moves on its own (keeps the loop drawing, at ≤ 30 fps idle)
     post: { grain, vignette, fringe },  // optional finish overrides
   })
   Scenes ask for a redraw with ctx.stage.invalidate() (a texture or stream frame that landed between scrolls).
   Boundaries: where the scene changes, the two dissolve through ink-bleed noise around the reading line. A section
   marked data-wipe is a sheet instead (the black teardown stage): while its bottom edge is in the viewport both scenes
   draw, split at that edge (feathered, with a faint warm edge light), so the sheet and its device scroll off the
   next scene the way the DOM above it does. */
import { WebGLRenderer, WebGLRenderTarget, Vector2, LinearSRGBColorSpace, UnsignedByteType } from 'three';
import { createPost } from './lib/post.js';
import { onFrame, onResize, clamp } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { TIER, FINE, REDUCED, STILL, QUALITY } from '../core/env.js';

const LEVELS = ['min', 'low', 'medium', 'high'];
const BUDGET = STILL ? { min: 960, low: 1280, medium: 1920, high: 2560 } : { min: 960, low: 1280, medium: 1920, high: 2880 };
const MAX_DPR = STILL ? 3 : 2;
const IDLE_MS = 300;
const idle = (timeout = 400) => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout }) : setTimeout(r, 16)));

export class Stage {
  constructor(canvas, factories = []) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;   // pass-through: everything is display-referred sRGB
    this.renderer.setClearColor(0x0b0805, 1);
    this.still = STILL;
    this.level = Math.max(0, LEVELS.indexOf(QUALITY));
    this.quality = LEVELS[this.level];
    this.factories = factories;
    this.scenes = new Map();
    this.segs = []; this.runs = []; this.opaque = [];
    this.post = createPost();
    this.renderer.compile(this.post.scene, this.post.camera);   // the finishing pass, once, before the first frame
    this.rtA = this.makeRT(); this.rtB = this.makeRT();
    this.pointer = new Vector2(); this.pTarget = new Vector2();
    this.drawn = new Set();
    this.ctx = { stage: this, renderer: this.renderer, time: 0, dt: 0, frame: 0, vw: 1, vh: 1, w: 1, h: 1, dpr: 1, pointer: this.pointer, velocity: 0, tier: TIER, still: STILL, quality: this.quality, reduced: REDUCED, scrollY: 0 };
    // loop state
    this.clock = 0; this.dirty = true; this.lastActive = 0; this.lastY = NaN; this.lastRender = 0; this.lastFrameNo = -9; this.drawing = false; this.primary = null;
    this.renders = 0; this.fps = 60; this.sinceStep = 0; this.stepAt = 0; this.pendingLevel = -1;
    this.activeRun = -1; this.runSince = 0; this.mountedRun = -2; this.hover = null; this.nextGC = 0;
    if (FINE) window.addEventListener('pointermove', (e) => this.pTarget.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), { passive: true });
    document.addEventListener('mouseleave', () => this.pTarget.set(0, 0));
    this.resize(); onResize(() => { this.resize(); this.invalidate(); });
    this.collect(); onLayout(() => { this.collect(); this.invalidate(); });
    this.watchHover();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.documentElement.classList.remove('gl-ready'); });
  }
  makeRT() { return new WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false, type: UnsignedByteType }); }
  invalidate() { this.dirty = true; }

  /* ── registry ─────────────────────────────────────────────────────────────────────────────────── */
  add(scene) {
    scene.loaded = false; scene.loading = null; scene.compiled = false;
    this.scenes.set(scene.id, scene);
    scene.resize?.(this.ctx.w, this.ctx.h, this.ctx.dpr);
  }
  factoryFor(id) { return this.factories.find((f) => f.match(id)); }
  /* a scene id is known once registered, or while a factory that may register it has not been imported yet */
  known(id) { if (this.scenes.has(id)) return true; const f = this.factoryFor(id); return !!f && !f.done; }
  importFor(id) {
    const f = this.factoryFor(id);
    if (!f || f.promise) return;
    f.promise = f.load().then((m) => { m.default?.(this); })
      .catch((e) => console.warn('[stage] scene module failed', id, e))
      .finally(() => { f.done = true; this.collect(); this.invalidate(); });
  }
  collect() {
    // only regions whose scene is known and that have height: an empty or unbuilt slot must not turn a dissolve into hold-then-cut
    this.segs = [...document.querySelectorAll('[data-scene]')]
      .filter((el) => this.known(el.dataset.scene) && el.getBoundingClientRect().height > 0)
      .map((el) => ({ el, id: el.dataset.scene, dissolve: parseFloat(el.dataset.dissolve) || 0, wipe: el.hasAttribute('data-wipe'), run: 0 }));
    this.runs = [];
    for (const s of this.segs) {
      const r = this.runs[this.runs.length - 1];
      if (!r || r.id !== s.id) this.runs.push({ id: s.id, segs: [s] }); else r.segs.push(s);
      s.run = this.runs.length - 1;
    }
    this.opaque = [...document.querySelectorAll('[data-opaque]')];
    this.mountedRun = -2;
  }

  /* ── lifecycle: load → compile/upload at idle → draw; dispose outside the window ─────────────── */
  ensure(id) {
    const s = this.scenes.get(id);
    if (!s) { this.importFor(id); return null; }
    s.disposeAt = 0;
    if (s.loaded || s.loading || s.failed) return s;
    const gen = (s.gen = (s.gen || 0) + 1);
    s.loading = Promise.resolve(s.load?.(this.ctx))
      .then(() => this.prepare(s))
      .then(() => { if (s.gen !== gen) return; s.loaded = true; s.loading = null; this.invalidate(); })
      .catch((e) => { console.warn('[stage] load failed', id, e); s.loading = null; s.failed = true; });
    return s;
  }
  async prepare(s) {
    await idle();
    const r = this.renderer;
    if (s.scene && !s.compiled) {
      const prev = r.getRenderTarget();
      r.setRenderTarget(this.rtA);                // compile for the target the scene draws into
      // compileAsync where the driver compiles in parallel (KHR_parallel_shader_compile); otherwise a plain compile,
      // still here at idle rather than inside the first frame that draws the scene
      const par = r.compileAsync && r.extensions.has('KHR_parallel_shader_compile');
      const p = par ? r.compileAsync(s.scene, s.camera) : Promise.resolve(r.compile(s.scene, s.camera));
      r.setRenderTarget(prev);
      await p;
      s.compiled = true;
    }
    // upload its textures now rather than on the first draw (one texture per idle slice)
    if (s.scene) {
      const texs = new Set();
      s.scene.traverse((o) => {
        const u = o.material?.uniforms;
        if (u) for (const k in u) { const t = u[k].value; if (t && t.isTexture && !t.isVideoTexture && !t.isRenderTargetTexture && t.image && t.version > 0) texs.add(t); }
      });
      for (const t of texs) { await idle(200); r.initTexture(t); }
    }
  }
  dispose(s) {
    s.gen = (s.gen || 0) + 1;
    try { s.dispose?.(this.ctx); } catch (e) { console.warn('[stage] dispose failed', s.id, e); }
    s.loaded = false; s.loading = null; s.disposeAt = 0;
  }
  /* the mount window: the active run ±1, plus a hovered chapter's first scene */
  mount(now) {
    const want = new Set();
    const i = this.activeRun;
    for (let k = i - 1; k <= i + 1; k++) if (this.runs[k]) want.add(this.runs[k].id);
    if (this.hover && now < this.hover.until) want.add(this.hover.id);
    for (const id of want) this.ensure(id);
    for (const s of this.scenes.values()) {
      if (want.has(s.id) || this.drawn.has(s) || !s.loaded || !s.dispose) { if (want.has(s.id)) s.disposeAt = 0; continue; }
      if (!s.disposeAt) s.disposeAt = now + 2500;
      else if (now > s.disposeAt) this.dispose(s);
    }
  }
  watchHover() {
    const want = (ch) => {
      if (!ch) return;
      const seg = this.segs.find((s) => ch === s.el || ch.contains(s.el));
      if (!seg) return;
      this.hover = { id: seg.id, until: performance.now() + 6000 };
      this.ensure(seg.id);
    };
    const on = (e) => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a || !a.closest('.rail, .chapters, .menu, .index, .nav')) return;
      want(document.getElementById(a.getAttribute('href').slice(1)));
    };
    document.addEventListener('pointerover', on, { passive: true });
    document.addEventListener('focusin', on);
    // the chrome's announcement (ui/chrome.js: rail and dropdown hover or focus; detail = the chapter id)
    document.addEventListener('cm:chapter-intent', (e) => want(document.getElementById(String(e.detail || '').replace(/^#/, ''))));
  }

  /* ── size: one canvas per quality level ──────────────────────────────────────────────────────── */
  dprFor(level) {
    const n = BUDGET[LEVELS[level]], L = Math.max(window.innerWidth, window.innerHeight);
    return Math.max(0.5, Math.min(window.devicePixelRatio || 1, MAX_DPR, n / L));
  }
  resize() {
    const dpr = this.dprFor(this.level);
    const w = window.innerWidth, h = window.innerHeight;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (W === this.ctx.w && H === this.ctx.h && w === this.ctx.vw && h === this.ctx.vh) return;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.rtA.setSize(W, H); this.rtB.setSize(W, H);
    this.post.u.res.value.set(W, H);
    Object.assign(this.ctx, { vw: w, vh: h, w: W, h: H, dpr });
    for (const s of this.scenes.values()) s.resize?.(W, H, dpr);
  }
  /* frame-rate governor: an average over consecutive drawn frames; below 45 fps, one level down (applied later).
     The capped levels (low, min: 30 fps) step down only when they cannot hold even ~24 fps; "min" (960 px) is the
     floor for machines that cannot draw "low" at all (a software rasteriser, an old integrated GPU).
     It only ever steps down (no oscillation). The two frames after a step are not counted (they pay for its
     reallocation); a decision needs 20 counted frames, or, on a renderer too slow to give 20 (a few fps), 8 over 3 s. */
  govern(dt, floor, now) {
    const f = 1 / Math.max(1e-3, dt);
    const n = this.sinceStep++;
    if (n < 2) return;
    this.fps = n === 2 ? f : this.fps + (f - this.fps) * 0.05;
    const enough = n > 22 || (n > 10 && now - this.stepAt > 3000);
    if (enough && now - this.stepAt > 2000 && this.fps < floor && this.level > 0 && this.pendingLevel < 0) {
      this.pendingLevel = this.level - 1;
      this.applyNow = this.fps < 15;   // already unusable: a one-frame reallocation is the lesser evil, apply it now
    }
  }
  applyLevel() {
    if (this.pendingLevel < 0) return;
    this.level = this.pendingLevel; this.pendingLevel = -1;
    this.quality = this.ctx.quality = LEVELS[this.level];
    this.sinceStep = 0; this.stepAt = performance.now();
    this.resize();
    this.dirty = true;   // a resize clears the canvas: draw again
  }

  segInfo(seg, y, vh) {
    const g = geo(seg.el);
    return { el: seg.el, top: g.top, height: g.height, p: clamp((y - g.top) / Math.max(1, g.height - vh)), pe: clamp((y + vh - g.top) / Math.max(1, g.height + vh)) };
  }
  start() { onFrame((v) => this.frame(v)); }
  frame(v) {
    const now = performance.now();
    const { y, vh } = v;
    const ctx = this.ctx;
    const k = 1 - Math.pow(0.0015, v.dt);
    this.pointer.lerp(this.pTarget, k * 0.6);
    const pMoving = this.pointer.distanceToSquared(this.pTarget) > 1e-7;
    if (y !== this.lastY || pMoving || this.dirty) this.lastActive = now;
    this.lastY = y;
    ctx.scrollY = y; ctx.velocity = v.velocity; ctx.frame = v.frame;

    if (!this.segs.length) return;
    // the active run (under the reading line) and the mount window around it, once it has held for a moment
    let c = y + vh * 0.5;
    let ai = 0;
    for (let j = 0; j < this.segs.length; j++) if (geo(this.segs[j].el).top <= c) ai = j;
    const run = this.segs[ai].run;
    if (run !== this.activeRun) { this.activeRun = run; this.runSince = now; }
    if (this.mountedRun !== run && (now - this.runSince > 150 || this.mountedRun === -2)) { this.mountedRun = run; this.mount(now); this.nextGC = now + 1000; }
    else if (now > this.nextGC) { this.mount(now); this.nextGC = now + 1000; }

    // covered by paper? then nothing to draw (a good moment for a quality change)
    for (const el of this.opaque) { const g = geo(el); if (g.top <= y + 1 && g.bottom >= y + vh - 1) { this.setDrawn([]); this.applyLevel(); return; } }

    // the section under the reading line; near a boundary between two scenes, dissolve across it
    let cut = false;
    const W = vh * 0.4;
    // paper over the reading line: read the uncovered strip instead (the larger one), with no dissolve, so the
    // scene that shows under a torn edge is the one whose section is actually there
    for (const el of this.opaque) {
      const g = geo(el);
      if (g.top <= c && g.bottom >= c) {
        const above = g.top - y, below = y + vh - g.bottom;
        c = above > below ? y + above * 0.5 : g.bottom + below * 0.5; cut = true; break;
      }
    }
    let i = 0;
    for (let j = 0; j < this.segs.length; j++) if (geo(this.segs[j].el).top <= c) i = j;
    let A = this.segs[i], B = null, mix = 0, best = Infinity, wipe = -1;
    // a wiping sheet's bottom edge in the viewport: the sheet above it, the next scene below it
    for (let j = 1; j < this.segs.length && !cut; j++) {
      const a = this.segs[j - 1];
      if (!a.wipe || a.id === this.segs[j].id) continue;
      const t = geo(this.segs[j].el).top - y;
      if (t > 0 && t < vh) { A = a; B = this.segs[j]; wipe = t / vh; mix = 1; break; }
    }
    for (let j = 1; j < this.segs.length && !cut && wipe < 0; j++) {
      if (this.segs[j].id === this.segs[j - 1].id) continue;
      // a boundary right under a paper sheet's bottom edge is a cut (the outgoing scene is hidden by the paper)
      const t = geo(this.segs[j].el).top;
      if (this.opaque.some((el) => Math.abs(geo(el).bottom - t) < vh * 0.12)) continue;
      const w = this.segs[j].dissolve ? vh * this.segs[j].dissolve : W;
      const d = c - geo(this.segs[j].el).top;
      if (Math.abs(d) < w && Math.abs(d) < best) { best = Math.abs(d); A = this.segs[j - 1]; B = this.segs[j]; mix = clamp(0.5 + d / (2 * w)); }
    }
    const sa = this.scenes.get(A.id), sb = B ? this.scenes.get(B.id) : null;
    const okA = sa && sa.loaded, okB = sb && sb.loaded;
    if (!okA && !okB) {
      // nothing here is ready (a jump far down the page, before its scene has loaded): ink, not a stale painting
      this.setDrawn([]);
      if (this.primary !== 'blank') { this.primary = 'blank'; this.renderer.setRenderTarget(null); this.renderer.clear(); }
      return;
    }
    let first = okA ? sa : sb, second = okA && okB && mix > 0.001 ? sb : null;
    if (!okA) { mix = 0; wipe = -1; }
    if (okA && !okB && mix > 0.5) { mix = 0; wipe = -1; }   // hold A until B is ready
    const list = second ? [first, second] : [first];
    if (this.setDrawn(list)) { this.applyLevel(); this.lastActive = now; }   // a scene change: a quality step may land here

    // dirty check: draw while something changes, then stop; ambient scenes keep drawing at ≤ 30 fps
    const active = now - this.lastActive < IDLE_MS;
    const ambient = list.some((s) => s.ambient?.(ctx));
    if (!active && !ambient) { if (this.drawing) { this.drawing = false; this.applyLevel(); } return; }
    const capped = this.level <= 1;
    const cap = capped || !active ? 30 : 0;
    if (cap && now - this.lastRender < 1000 / cap - 4) return;

    const dt = this.lastRender ? Math.min(1, (now - this.lastRender) / 1000) : 1 / 60;
    // govern on consecutive active frames only (not across an idle stop, not the ≤ 30 fps ambient frames): the last
    // draw was on the previous tick (two ticks back when capped at 30 fps on a 60 Hz display)
    if (active && this.lastWasActive && v.frame - this.lastFrameNo <= (capped ? 3 : 1)) this.govern(dt, capped ? 24 : 45, now);
    this.lastWasActive = active;
    this.clock += Math.min(dt, 1 / 20);   // the scenes' clock runs only while drawing (no jump after an idle stop)
    if (this.applyNow) { this.applyNow = false; this.applyLevel(); }
    ctx.time = this.clock; ctx.dt = Math.min(dt, 0.1);

    const segA = okA ? this.segInfo(A, y, vh) : this.segInfo(B, y, vh);
    const segB = second ? this.segInfo(B, y, vh) : null;
    this.draw(first, segA, this.rtA);
    if (second) this.draw(second, segB, this.rtB);
    const u = this.post.u, pf = first.post || {};
    u.tA.value = this.rtA.texture; u.tB.value = this.rtB.texture;
    u.mixAB.value = second && wipe < 0 ? mix : 0;
    u.wipe.value = second ? wipe : -1;
    u.time.value = this.clock;
    u.grain.value = pf.grain ?? 0.045; u.vignette.value = pf.vignette ?? 0.32;
    u.fringe.value = REDUCED ? 0 : Math.min(0.006, Math.abs(v.velocity) * 0.00012) * (pf.fringe ?? 1);
    u.fade.value = pf.fade ?? 0;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post.scene, this.post.camera);
    this.dirty = false; this.lastRender = now; this.lastFrameNo = v.frame; this.drawing = true; this.renders++;
    if (!document.documentElement.classList.contains('gl-ready')) document.documentElement.classList.add('gl-ready');
  }
  draw(s, seg, rt) {
    s.update?.(this.ctx, seg);
    this.renderer.setRenderTarget(rt);
    this.renderer.clear();
    if (s.render) s.render(this.renderer, rt, this.ctx);
    else this.renderer.render(s.scene, s.camera);
  }
  /* returns true when the primary scene changed */
  setDrawn(list) {
    const now = new Set(list);
    const changed = list[0] !== this.primary;
    this.primary = list[0];
    for (const s of this.drawn) if (!now.has(s)) s.deactivate?.();
    for (const s of now) if (!this.drawn.has(s)) s.activate?.();
    this.drawn = now;
    return changed && list.length > 0;
  }
}
