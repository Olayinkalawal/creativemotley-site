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
/* input.last: when the reader last did anything (scrolled, pointed, touched, typed). Things that move on their own
   (the stage's ambient scenes, the footer's marquee, Process's drifting object) rest after IDLE_LIFE without input. */
export const input = { trackpad: false, last: performance.now() };
export const IDLE_LIFE = 10000;
export const idleFor = () => performance.now() - input.last;
for (const t of ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'pointermove', 'keydown', 'scroll']) {
  window.addEventListener(t, () => { input.last = performance.now(); }, { capture: true, passive: true });
}
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
/* a long jump (a rail or dropdown link to a chapter more than LONG_JUMP screens away) does not glide through every
   chapter between (1.6 s of them, each loading its art as it passed): the screen dips to the target's ground (ink, or
   paper for a paper chapter) in 0.2 s, jumps, and the dip lifts over the target */
const LONG_JUMP = 3;
let dipEl = null, dipT = 0;
function dipTo(el, done) {
  if (!dipEl) {
    dipEl = document.createElement('div');
    dipEl.setAttribute('aria-hidden', 'true');
    dipEl.style.cssText = 'position:fixed;inset:0;z-index:35;pointer-events:none;opacity:0;transition:opacity .2s cubic-bezier(.22,1,.36,1)';
    document.body.append(dipEl);
  }
  const light = el.closest('[data-theme]')?.dataset.theme === 'light' && el.querySelector(':scope > [data-opaque], :scope [data-proc-bg]');
  dipEl.style.background = light ? 'var(--paper)' : 'var(--ink)';
  clearTimeout(dipT);
  dipEl.style.transitionDuration = '.2s'; dipEl.style.opacity = '1';
  dipT = setTimeout(() => {
    done();
    requestAnimationFrame(() => requestAnimationFrame(() => { dipEl.style.transitionDuration = '.45s'; dipEl.style.opacity = '0'; }));
  }, 210);
}

/* opts.focus: move focus to the target as the scroll starts (in-page links: the next Tab and a screen reader continue
   from there); the target needs a tabindex (chapters get -1 in ui/chrome.js) */
export function scrollTo(target, opts = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  const { focus, ...o } = opts;
  if (lenis && o.duration === undefined && Math.abs(el.getBoundingClientRect().top) > window.innerHeight * LONG_JUMP) {
    view.jump = true;
    clearTimeout(jumpT); jumpT = setTimeout(() => { view.jump = false; }, 900);
    dipTo(el, () => { jumpTo(el); view.velocity = 0; o.onComplete?.(lenis); });
    if (focus) el.focus({ preventScroll: true });
    return;
  }
  if (lenis) {
    const duration = o.duration ?? 1.6;
    view.jump = true;
    clearTimeout(jumpT); jumpT = setTimeout(() => { view.jump = false; }, duration * 1000 + 400);   // in case it is cut short
    lenis.scrollTo(el, { offset: 0, duration, easing: (t) => 1 - Math.pow(1 - t, 4), ...o, onComplete: (l) => { view.jump = false; view.velocity = 0; o.onComplete?.(l); } });
  } else el.scrollIntoView({ behavior: 'auto' });
  if (focus) el.focus({ preventScroll: true });
}
/* straight to an element, no glide (a deep link landing again after the page below the fold has grown) */
export function jumpTo(el) {
  const y = Math.round(el.getBoundingClientRect().top + window.scrollY);   // where a chapter link's glide lands (Lenis measures so)
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
  view.y = y;
}
export function lockScroll(on) { if (lenis) on ? lenis.stop() : lenis.start(); document.documentElement.style.overflow = on ? 'hidden' : ''; }

/* document-space top of an element (stable under transforms of ancestors we don't use) */
export function docTop(el) { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; }

/* progress helpers, measured from layout (cached per resize by callers) */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const seg = (v, a, b) => clamp((v - a) / (b - a));
