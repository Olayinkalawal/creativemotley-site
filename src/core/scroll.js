/* Smooth scroll (Lenis) on the GSAP ticker, with ScrollTrigger kept in sync.
   Reduced motion: native scroll, no Lenis. */
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { REDUCED } from './env.js';

gsap.registerPlugin(ScrollTrigger);

export const view = { y: window.scrollY, vw: window.innerWidth, vh: window.innerHeight, velocity: 0, time: 0, dt: 1 / 60 };

export const lenis = REDUCED ? null : new Lenis({ lerp: 0.11, smoothWheel: true, syncTouch: false, wheelMultiplier: 0.95 });
if (lenis) {
  lenis.on('scroll', (e) => { view.y = e.scroll; view.velocity = e.velocity; ScrollTrigger.update(); });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
} else {
  window.addEventListener('scroll', () => { view.y = window.scrollY; }, { passive: true });
}

const frameFns = new Set();
let last = performance.now();
gsap.ticker.add(() => {
  const now = performance.now();
  view.dt = Math.min(0.1, (now - last) / 1000); last = now;
  view.time += view.dt;
  if (!lenis) { view.y = window.scrollY; view.velocity *= 0.9; }
  for (const fn of frameFns) fn(view);
});
/* run fn(view) every frame; returns an unsubscribe */
export function onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); }

const resizeFns = new Set();
let rz;
window.addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    view.vw = window.innerWidth; view.vh = window.innerHeight;
    for (const fn of resizeFns) fn(view);
    ScrollTrigger.refresh();
  }, 120);
});
export function onResize(fn) { resizeFns.add(fn); return () => resizeFns.delete(fn); }

export function scrollTo(target, opts = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
  else el.scrollIntoView({ behavior: 'auto' });
}
export function lockScroll(on) { if (lenis) on ? lenis.stop() : lenis.start(); document.documentElement.style.overflow = on ? 'hidden' : ''; }

/* document-space top of an element (stable under transforms of ancestors we don't use) */
export function docTop(el) { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; }

/* progress helpers, measured from layout (cached per resize by callers) */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const seg = (v, a, b) => clamp((v - a) / (b - a));
export { gsap, ScrollTrigger };
