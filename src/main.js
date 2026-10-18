import { TIER, REDUCED } from './core/env.js';
import { onFrame, view } from './core/scroll.js';
import { geo } from './core/layout.js';
import { initChapters } from './core/chapters.js';
import { initReveal } from './core/reveal.js';
import { initChrome } from './ui/chrome.js';
import { initHero } from './ui/hero.js';

initChapters();
initChrome();
initHero();

// chapter modules: src/sections/<name>.js export init(); each owns its markup partial and styles
const sections = import.meta.glob('./sections/*.js', { eager: true });
for (const [path, m] of Object.entries(sections)) {
  try { m.init?.(); } catch (e) { console.warn('[section] init failed', path, e); }
}
initReveal();

// still plates under the canvas: first paint, and the whole stage when WebGL is off
const plates = [...document.querySelectorAll('.plates [data-plate]')];
const holders = [...document.querySelectorAll('main [data-plate]')];
let lastPlate = 'hero';
onFrame((v) => {
  if (document.documentElement.classList.contains('gl-ready')) return;
  const c = v.y + v.vh * 0.5;
  let cur = 'hero';
  for (const el of holders) if (geo(el).top <= c) cur = el.dataset.plate;
  if (cur === lastPlate) return;
  lastPlate = cur;
  for (const p of plates) p.classList.toggle('is-on', p.dataset.plate === cur);
});

// the WebGL stage loads after first paint (tier 0 or reduced motion keep the stills)
if (TIER > 0 && !REDUCED) {
  const go = () => import('./gl/boot.js').then((m) => m.bootStage()).catch((e) => console.warn('[stage] off', e));
  const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 1200 }) : setTimeout(go, 200));
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
