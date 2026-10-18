/* The persistent stage: one WebGL canvas fixed behind the page (the Editions "Background").
   Sections declare which scene they show with data-scene="id". Each frame the stage:
     1. finds the section under the reading line and any scene boundary inside the viewport,
     2. skips rendering entirely while an opaque paper panel ([data-opaque]) covers the screen,
     3. renders the one or two scenes involved into render targets,
     4. composites them through the post pass (ink-bleed dissolve + film finish).

   A scene module (src/gl/scenes/*.js) default-exports register(stage) and calls stage.add({
     id,                       // matches data-scene
     async load(ctx),          // fetch textures etc.; called once when its section nears the viewport
     update(ctx, seg),         // per frame while it is drawn. seg = { el, p, pe, top, height }
                               //   p  = pin progress: 0 when el's top meets the viewport top, 1 when its bottom meets the viewport bottom
                               //   pe = pass progress: 0 when el's top enters at the bottom, 1 when its bottom leaves at the top
     render(renderer, target), // draw into target (default: renderer.render(this.scene, this.camera))
     resize(w, h, dpr),
     activate(), deactivate(), // e.g. play/pause a video when the scene starts/stops being drawn
     post: { grain, vignette, fringe }   // optional finish overrides
   }) */
import * as THREE from 'three';
import { createPost } from './lib/post.js';
import { onFrame, onResize, clamp, view } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { TIER, FINE, REDUCED } from '../core/env.js';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // pass-through: everything is display-referred sRGB
    this.renderer.setClearColor(0x0b0805, 1);
    this.dprCap = TIER >= 2 ? 1.6 : 1.2;
    this.scale = 1;
    this.scenes = new Map();
    this.segs = [];
    this.opaque = [];
    this.post = createPost();
    this.rtA = this.makeRT(); this.rtB = this.makeRT();
    this.pointer = new THREE.Vector2(); this.pTarget = new THREE.Vector2();
    this.drawn = new Set();
    this.ctx = { stage: this, renderer: this.renderer, time: 0, dt: 0, vw: 1, vh: 1, w: 1, h: 1, dpr: 1, pointer: this.pointer, velocity: 0, tier: TIER, reduced: REDUCED };
    this.frameTimes = [];
    if (FINE) window.addEventListener('pointermove', (e) => this.pTarget.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), { passive: true });
    document.addEventListener('mouseleave', () => this.pTarget.set(0, 0));
    this.resize(); onResize(() => this.resize());
    this.collect(); onLayout(() => this.collect());
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.documentElement.classList.remove('gl-ready'); });
  }
  makeRT() { return new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false, type: THREE.UnsignedByteType }); }
  add(scene) { scene.loaded = false; scene.loading = null; this.scenes.set(scene.id, scene); scene.resize?.(this.ctx.w, this.ctx.h, this.ctx.dpr); }
  collect() {
    this.segs = [...document.querySelectorAll('[data-scene]')].map((el) => ({ el, id: el.dataset.scene }));
    this.opaque = [...document.querySelectorAll('[data-opaque]')];
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap) * this.scale;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    this.rtA.setSize(W, H); this.rtB.setSize(W, H);
    this.post.u.res.value.set(W, H);
    Object.assign(this.ctx, { vw: w, vh: h, w: W, h: H, dpr });
    for (const s of this.scenes.values()) s.resize?.(W, H, dpr);
  }
  ensure(id) {
    const s = this.scenes.get(id);
    if (!s || s.loaded || s.loading) return s;
    s.loading = Promise.resolve(s.load?.(this.ctx)).then(() => { s.loaded = true; }).catch((e) => { console.warn('[stage] load failed', id, e); });
    return s;
  }
  segInfo(seg, y, vh) {
    const g = geo(seg.el);
    return { el: seg.el, top: g.top, height: g.height, p: clamp((y - g.top) / Math.max(1, g.height - vh)), pe: clamp((y + vh - g.top) / Math.max(1, g.height + vh)) };
  }
  start() {
    onFrame((v) => this.frame(v));
  }
  frame(v) {
    const { y, vh } = v;
    const ctx = this.ctx;
    ctx.time = v.time; ctx.dt = v.dt; ctx.velocity = v.velocity; ctx.scrollY = y;
    const k = 1 - Math.pow(0.0015, v.dt);
    this.pointer.lerp(this.pTarget, k * 0.6);

    // preload scenes whose sections are within ~1.5 viewports
    for (const s of this.segs) { const g = geo(s.el); if (g.top < y + vh * 2.5 && g.bottom > y - vh * 1.5) this.ensure(s.id); }

    // covered by paper? then nothing to draw
    for (const el of this.opaque) { const g = geo(el); if (g.top <= y + 1 && g.bottom >= y + vh - 1) { this.setDrawn([]); return; } }

    // the section under the reading line; near a boundary between two scenes, dissolve across it
    if (!this.segs.length) return;
    const c = y + vh * 0.5, W = vh * 0.4;
    let i = 0;
    for (let j = 0; j < this.segs.length; j++) if (geo(this.segs[j].el).top <= c) i = j;
    let A = this.segs[i], B = null, mix = 0, best = W;
    for (let j = 1; j < this.segs.length; j++) {
      if (this.segs[j].id === this.segs[j - 1].id) continue;
      const d = c - geo(this.segs[j].el).top;
      if (Math.abs(d) < best) { best = Math.abs(d); A = this.segs[j - 1]; B = this.segs[j]; mix = clamp(0.5 + d / (2 * W)); }
    }
    const sa = this.scenes.get(A.id), sb = B ? this.scenes.get(B.id) : null;
    const okA = sa && sa.loaded, okB = sb && sb.loaded;
    if (!okA && !okB) { this.setDrawn([]); return; }
    let first = okA ? sa : sb, second = okA && okB && mix > 0.001 ? sb : null;
    if (!okA) mix = 0;
    if (okA && !okB && mix > 0.5) mix = 0;   // hold A until B is ready
    const segA = okA ? this.segInfo(A, y, vh) : this.segInfo(B, y, vh);
    const segB = second ? this.segInfo(B, y, vh) : null;
    this.setDrawn(second ? [first, second] : [first]);

    this.draw(first, segA, this.rtA);
    if (second) this.draw(second, segB, this.rtB);
    const u = this.post.u, pf = first.post || {};
    u.tA.value = this.rtA.texture; u.tB.value = this.rtB.texture; u.mixAB.value = second ? mix : 0;
    u.time.value = v.time;
    u.grain.value = pf.grain ?? 0.045; u.vignette.value = pf.vignette ?? 0.32;
    u.fringe.value = REDUCED ? 0 : Math.min(0.006, Math.abs(v.velocity) * 0.00012) * (pf.fringe ?? 1);
    u.fade.value = pf.fade ?? 0;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post.scene, this.post.camera);
    if (!document.documentElement.classList.contains('gl-ready')) document.documentElement.classList.add('gl-ready');
    this.adapt();
  }
  draw(s, seg, rt) {
    s.update?.(this.ctx, seg);
    this.renderer.setRenderTarget(rt);
    this.renderer.clear();
    if (s.render) s.render(this.renderer, rt, this.ctx);
    else this.renderer.render(s.scene, s.camera);
  }
  setDrawn(list) {
    const now = new Set(list);
    for (const s of this.drawn) if (!now.has(s)) s.deactivate?.();
    for (const s of now) if (!this.drawn.has(s)) s.activate?.();
    this.drawn = now;
  }
  /* dynamic resolution: if the GPU cannot hold ~50 fps, render fewer pixels */
  adapt() {
    const f = this.frameTimes; f.push(this.ctx.dt * 1000); if (f.length < 120) return;
    f.sort((a, b) => a - b);
    const med = f[f.length >> 1]; f.length = 0;
    if (med > 24 && this.scale > 0.6) { this.scale = Math.max(0.6, this.scale - 0.15); this.resize(); }
    else if (med < 17.5 && this.scale < 1) { this.scale = Math.min(1, this.scale + 0.1); this.resize(); }
  }
}
