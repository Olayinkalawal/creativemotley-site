/* Smooth scroll (Lenis) on our own requestAnimationFrame (no GSAP).
   - Mouse wheel: 0.85 s expo-out per notch (the Editions feel).
   - Trackpad (more than ~50 wheel events a second): 0.15 s, so the OS's own inertia is not smoothed twice.
   - Touch: native (no syncTouch). Reduced motion: native scroll, no Lenis.
   view.frame counts ticks: per-frame hand-offs between modules (the teardown slot rect) compare it. */
import Lenis from 'lenis';
import { REDUCED } from './env.js';

export const view = { y: window.scrollY, vw: window.innerWidth, vh: window.innerHeight, velocity: 0, time: 0, dt: 1 / 60, frame: 0, jump: false };

const expoOut = (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t));
const MOUSE = 0.85, PAD = 0.15;
export const lenis = REDUCED ? null : new Lenis({ duration: MOUSE, easing: expoOut, smoothWheel: true, syncTouch: false, wheelMultiplier: 0.95, autoRaf: false });
export const input = { trackpad: false };
if (lenis) {
  lenis.on('scroll', (e) => { view.y = e.scroll; view.velocity = e.velocity; });
  // wheel-rate detection, ahead of Lenis's own handler (capture on window): the mean interval over the last few
  // events of a burst; the device is remembered between gestures, so a new gesture starts with the right feel
  const ts = [];
  window.addEventListener('wheel', (e) => {
    const t = e.timeStamp;
    if (ts.length && t - ts[ts.length - 1] > 250) ts.length = 0;   // a new burst
    ts.push(t); if (ts.length > 6) ts.shift();
    if (e.deltaMode === 1) input.trackpad = false;                   // line-mode deltas: a mouse wheel
    else if (ts.length >= 4) {
      const rate = ((ts.length - 1) * 1000) / Math.max(1, t - ts[0]);
      if (rate > 50) input.trackpad = true;
      else if (rate < 30) input.trackpad = false;
    }
    lenis.options.duration = input.trackpad ? PAD : MOUSE;
    view.jump = false;   // the reader took over from a programmatic scroll
  }, { capture: true, passive: true });
  window.addEventListener('touchstart', () => { view.jump = false; }, { capture: true, passive: true });
  window.__lenis = lenis;   // for QA scripts (duration, scroll)
} else {
  window.addEventListener('scroll', () => { view.y = window.scrollY; }, { passive: true });
}

const frameFns = new Set();
let last = performance.now(), lastY = view.y;
function tick(now) {
  view.dt = Math.min(0.1, Math.max(0, now - last) / 1000); last = now;
  view.time += view.dt; view.frame++;
  if (lenis) {
    lenis.raf(now);
    // a native scroll (touch, keys, the scrollbar, scrollTo) leaves Lenis's last velocity standing once it stops: let it
    // die away, so a scene's velocity effects (the stage's chromatic fringe) settle before the stage goes idle
    if (view.y === lastY) view.velocity = Math.abs(view.velocity) < 0.5 ? 0 : view.velocity * Math.pow(0.7, view.dt * 60);
  } else { view.y = window.scrollY; view.velocity *= 0.9; }
  // a jump is not a scroll: a programmatic scrollTo (chapter links: view.jump) or more than half a screen in one frame
  // (a native jump, find-in-page) carries no velocity, so the stage's chromatic fringe never lands on a painting with it
  if (view.jump || Math.abs(view.y - lastY) > view.vh * 0.5) view.velocity = 0;
  lastY = view.y;
  for (const fn of frameFns) fn(view);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
/* run fn(view) every frame; returns an unsubscribe */
export function onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); }

const resizeFns = new Set();
let rz;
window.addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    view.vw = window.innerWidth; view.vh = window.innerHeight;
    for (const fn of resizeFns) fn(view);
  }, 120);
});
export function onResize(fn) { resizeFns.add(fn); return () => resizeFns.delete(fn); }

let jumpT = 0;
export function scrollTo(target, opts = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis) {
    const duration = opts.duration ?? 1.6;
    view.jump = true;
    clearTimeout(jumpT); jumpT = setTimeout(() => { view.jump = false; }, duration * 1000 + 400);   // in case it is cut short
    lenis.scrollTo(el, { offset: 0, duration, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts, onComplete: (l) => { view.jump = false; view.velocity = 0; opts.onComplete?.(l); } });
  } else el.scrollIntoView({ behavior: 'auto' });
}
export function lockScroll(on) { if (lenis) on ? lenis.stop() : lenis.start(); document.documentElement.style.overflow = on ? 'hidden' : ''; }

/* document-space top of an element (stable under transforms of ancestors we don't use) */
export function docTop(el) { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; }

/* progress helpers, measured from layout (cached per resize by callers) */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const seg = (v, a, b) => clamp((v - a) / (b - a));
