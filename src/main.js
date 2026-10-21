import { TIER, REDUCED } from './core/env.js';
import { onFrame, view, jumpTo } from './core/scroll.js';
import { geo, onLayout } from './core/layout.js';
import { initChapters } from './core/chapters.js';
import { initReveal } from './core/reveal.js';
import { initChrome } from './ui/chrome.js';
import { initHero } from './ui/hero.js';
import { afterFirstPaint } from './core/firstframe.js';

// a deep link (/#kit): the browser lands on the anchor while the page is parsed, before the sections above it have
// grown to their scroll lengths (the pinned runs, the showcase: ~4,800 px at 1440, which left #kit in Showcase); it lands
// again after the sections' init, the fonts, the load and each layout pass, until the reader scrolls (or 6 s)
const deep = (() => { try { return location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; } catch { return null; } })();
if (deep && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
function landDeep() {
  let done = false;
  const stop = () => { done = true; off(); clearInterval(iv); };
  const off = onLayout(() => { if (!done) jumpTo(deep); });
  // (a section that moves without the page's height changing fires no layout pass: check its top four times a second)
  const iv = setInterval(() => { if (!done && Math.abs(deep.getBoundingClientRect().top) > 1) jumpTo(deep); }, 250);
  for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(t, stop, { once: true, passive: true, capture: true });
  const land = () => { if (!done) jumpTo(deep); };
  land();
  document.fonts?.ready.then(land);
  if (document.readyState === 'complete') setTimeout(land, 120); else window.addEventListener('load', () => setTimeout(land, 120), { once: true });
  setTimeout(stop, 6000);
}

// one task at a time: the browser gets to paint, take input and run its own work between two chapters' init
const breathe = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

/* chapter modules: src/sections/<name>.js export init(); each owns its markup partial and styles. Their init runs one
   per task (a yield between two), nearest first: a chapter within about two screens of the view (an
   IntersectionObserver, rootMargin 200%) or the one a deep link targets is set up at once, the others as the reader
   comes within two screens of them. (A throttled phone spent ~0.9 s in one task running all eleven after the first
   paint.) Every chapter keeps its height through its init (the pinned runs reserve theirs in CSS), so a late init
   moves nothing on screen (reduced motion: all of them in order, see below). performance.measure('init <name>') times
   each one. */
const sections = import.meta.glob('./sections/*.js', { eager: true });
const done = new Set();
// which elements stand for a module: its chapter (#<name>); the teardown helper, the teardown blocks it drives
const holders = (name) => (name === '_teardown' ? [...document.querySelectorAll('.td[data-td]')] : [document.getElementById(name)].filter(Boolean));
// a deep link's own chapter is set up at once, before the first frame is painted, so whatever its init changes in its
// own layout (a teardown's pinned copy, its title's line masks) is never seen moving
// (with reduced motion the teardowns turn static at init, a different height: set up before the first frame too, so
// nothing above the target changes under it)
if (deep) {
  for (const [path, m] of Object.entries(sections)) {
    const name = path.slice(11, -3);
    if (typeof m.init !== 'function' || !(holders(name).some((el) => el === deep || el.contains(deep)) || (REDUCED && name === '_teardown'))) continue;
    done.add(path);
    try { m.init(); } catch (e) { console.warn('[section] init failed', path, e); }
  }
}
function initSections() {
  const queue = [];
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    while (queue.length) {
      const [path, m] = queue.shift();
      if (done.has(path)) continue;
      done.add(path);
      const t = performance.now();
      try { m.init(); } catch (e) { console.warn('[section] init failed', path, e); }
      performance.measure?.(`init ${path.slice(11, -3)}`, { start: t, end: performance.now() });
      if (queue.length) await breathe();
    }
    running = false;
  };
  const want = (entry, first) => { if (!done.has(entry[0]) && !queue.includes(entry)) first ? queue.unshift(entry) : queue.push(entry); run(); };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) for (const entry of byEl.get(e.target) || []) want(entry);
  }, { rootMargin: '200% 0px 200% 0px' }) : null;
  const byEl = new Map();
  for (const [path, m] of Object.entries(sections)) {
    if (typeof m.init !== 'function') continue;
    const name = path.slice(11, -3), entry = [path, m, name], els = holders(name);
    if (done.has(path)) continue;
    // reduced motion: every chapter, in order (the teardowns' static layout is set by their init, a different height,
    // so none may wait until the reader is near it)
    if (!io || !els.length || REDUCED) { want(entry); continue; }
    if (deep && els.some((el) => el.contains(deep) || el === deep)) want(entry, true);
    // (one element can stand for several modules: #method is the Method chapter and a teardown block)
    for (const el of els) { if (!byEl.has(el)) { byEl.set(el, []); io.observe(el); } byEl.get(el).push(entry); }
  }
}

// the init work waits for the first frame (core/firstframe.js): the hero paints first, the rest measures after it;
// then one more frame: lifting html.cv (core/firstframe.js) lays out the whole page once, in that frame's rendering step
const nextFrame = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 300); });   // (a hidden tab draws no frames)
afterFirstPaint(async () => {
  if (!(TIER > 0 && !REDUCED)) document.documentElement.classList.add('css-stage');   // (no stage: the still plates)
  await nextFrame();
  initChapters();
  initChrome();
  await breathe();
  initHero();
  initReveal();
  if (deep) landDeep();
  await breathe();
  initSections();

  // still plates under the canvas: first paint, and the whole stage when WebGL is off (a plate marked data-bg="url"
  // loads only when it is first shown, so the hidden ones cost nothing on the first load).
  // Upright screens without the stage (?tier=0, reduced motion): a data-rise chapter's painting rises with its section
  // as on the stage (base.css: the holder's own ::after, html.css-stage), and the fixed plate takes over only once the
  // holder's top reaches the top of the screen, so a title never scrolls across the whole painting.
  const plates = [...document.querySelectorAll('.plates [data-plate]')];
  const portrait = window.matchMedia('(orientation: portrait) and (max-width: 1023px)');
  const holders = [...document.querySelectorAll('main [data-plate]')];
  const cssStage = () => document.documentElement.classList.contains('css-stage');
  let lastPlate = 'hero';
  onFrame((v) => {
    if (document.documentElement.classList.contains('gl-ready')) return;
    const c = v.y + v.vh * 0.5, rise = portrait.matches && cssStage();
    let cur = 'hero';
    for (const el of holders) if (geo(el).top <= (rise && el.hasAttribute('data-rise') ? v.y + 1 : c)) cur = el.dataset.plate;
    if (cur === lastPlate) return;
    lastPlate = cur;
    for (const p of plates) {
      const on = p.dataset.plate === cur;
      // a deferred plate (data-bg instead of an inline background-image) loads the first time it is shown
      if (on && p.dataset.bg && !p.style.backgroundImage) p.style.backgroundImage = `url(${(portrait.matches && p.dataset.bgPhone) || p.dataset.bg})`;
      p.classList.toggle('is-on', on);
    }
  });

  // chapters near the viewport (~1.5 screens ahead) get .is-near once: the plate crops on their paper cards load then
  // (src/sections/_paper.css), not on the first load
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('is-near'); io.unobserve(e.target); } }, { rootMargin: '150% 0px 150% 0px' });
    document.querySelectorAll('[data-chapter]').forEach((el) => io.observe(el));
  } else document.querySelectorAll('[data-chapter]').forEach((el) => el.classList.add('is-near'));

  // the WebGL stage loads after first paint (tier 0 or reduced motion keep the stills: html.css-stage, set above)
  if (TIER > 0 && !REDUCED) {
    const go = () => import('./gl/boot.js').then((m) => m.bootStage()).catch((e) => { document.documentElement.classList.add('css-stage'); console.warn('[stage] off', e); });
    const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 1200 }) : setTimeout(go, 200));
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  }
});
