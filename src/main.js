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
  const stop = () => { done = true; off(); };
  const off = onLayout(() => { if (!done) jumpTo(deep); });
  for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(t, stop, { once: true, passive: true, capture: true });
  const land = () => { if (!done) jumpTo(deep); };
  land();
  document.fonts?.ready.then(land);
  if (document.readyState === 'complete') setTimeout(land, 120); else window.addEventListener('load', () => setTimeout(land, 120), { once: true });
  setTimeout(stop, 6000);
}

// the init work waits for the first frame (core/firstframe.js): the hero paints first, the rest measures after it
afterFirstPaint(() => {
  initChapters();
  initChrome();
  initHero();

  // chapter modules: src/sections/<name>.js export init(); each owns its markup partial and styles
  const sections = import.meta.glob('./sections/*.js', { eager: true });
  for (const [path, m] of Object.entries(sections)) {
    try { m.init?.(); } catch (e) { console.warn('[section] init failed', path, e); }
  }
  initReveal();
  if (deep) landDeep();

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

  // the WebGL stage loads after first paint (tier 0 or reduced motion keep the stills: html.css-stage)
  if (!(TIER > 0 && !REDUCED)) document.documentElement.classList.add('css-stage');
  if (TIER > 0 && !REDUCED) {
    const go = () => import('./gl/boot.js').then((m) => m.bootStage()).catch((e) => { document.documentElement.classList.add('css-stage'); console.warn('[stage] off', e); });
    const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 1200 }) : setTimeout(go, 200));
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  }
});
