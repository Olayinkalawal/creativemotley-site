/* Which chapter is under the reading line, which theme sits under the nav and the rail.
   - [data-chapter] sections drive the rail's active item and the dotted leader.
   - [data-theme] regions (dark | light) drive chrome colour: the innermost region under
     the nav's centre line sets html.nav-light; the one under the rail index sets html.rail-light.
   - a rail piece over a painted scene (a plate or the film, not paper) also gets .is-plate: its type takes an ink
     halo there, since a painting's light passages sit right under the dimmed names. Over a light painting (a light
     region that is not an opaque paper panel: X Apply) it gets .is-plate too, and the halo is cream. */
import { onFrame, view } from './scroll.js';
import { geo, onLayout } from './layout.js';

const root = document.documentElement;
let chapters = [], themes = [], paints = [], opaque = [];
const listeners = new Set();
export let active = null;
export function onChapter(fn) { listeners.add(fn); fn(active); return () => listeners.delete(fn); }

function collect() {
  chapters = [...document.querySelectorAll('[data-chapter]')];
  themes = [...document.querySelectorAll('[data-theme]')].map((el) => {
    let depth = 0; for (let n = el; n; n = n.parentElement) depth++;
    const r = el.getBoundingClientRect();   // horizontal extent (the page never scrolls sideways)
    return { el, depth, x0: r.left, x1: r.right, wide: r.width >= window.innerWidth * 0.9 };
  }).sort((a, b) => b.depth - a.depth);
  paints = [...document.querySelectorAll('[data-scene^="plate:"]:not([data-scene="plate:umber"]), [data-scene="hero3d"]')];
  opaque = [...document.querySelectorAll('[data-opaque]')];
}
function opaqueAt(y) {
  for (const el of opaque) { const g = geo(el); if (y >= g.top && y < g.bottom) return true; }
  return false;
}
function paintedAt(y) {
  for (const el of paints) { const g = geo(el); if (y >= g.top && y < g.bottom) return true; }
  return false;
}
/* x given: only regions covering that x count (a dark card in the column never flips a rail item over paper);
   x omitted (the nav, which spans the page): only full-width regions count */
function themeAt(y, x) {
  for (const t of themes) {
    if (x === undefined ? !t.wide : x < t.x0 || x > t.x1) continue;
    const g = geo(t.el);
    if (y >= g.top && y < g.bottom) return t.el.dataset.theme;
  }
  return 'dark';
}

/* fixed chrome pieces that flip colour on their own (rail items, legal): each gets .is-light when
   the region under its centre is light, so a torn edge passing under the rail splits it cleanly */
let probes = [];
export function registerProbes(els) {
  probes = [...els].map((el) => ({ el, x: 0, y: 0, light: null, plate: null }));
  measureProbes();
}
function measureProbes() { for (const p of probes) { const r = p.el.getBoundingClientRect(); p.x = r.left + r.width / 2; p.y = r.top + r.height / 2; } }

export function initChapters() {
  onLayout(measureProbes);
  collect();
  onLayout(collect);
  let lastNav = '', lastRail = '';
  onFrame((v) => {
    const line = v.y + v.vh * 0.45;
    let cur = null;
    for (const el of chapters) if (geo(el).top <= line) cur = el.id;
    if (cur !== active) { active = cur; for (const fn of listeners) fn(active); }
    const nav = themeAt(v.y + 28), rail = themeAt(v.y + v.vh - 150, 16);
    if (nav !== lastNav) { root.classList.toggle('nav-light', nav === 'light'); lastNav = nav; }
    if (rail !== lastRail) { root.classList.toggle('rail-light', rail === 'light'); lastRail = rail; }
    for (const p of probes) {
      const light = themeAt(v.y + p.y, p.x) === 'light';
      if (light !== p.light) { p.el.classList.toggle('is-light', light); p.light = light; }
      const plate = light ? paintedAt(v.y + p.y) && !opaqueAt(v.y + p.y) : paintedAt(v.y + p.y);
      if (plate !== p.plate) { p.el.classList.toggle('is-plate', plate); p.plate = plate; }
    }
  });
}
