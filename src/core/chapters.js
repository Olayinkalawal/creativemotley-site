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

/* fixed chrome pieces that flip colour on their own (rail items, legal): each samples the region under its own box,
   at its top and its bottom line (phase 4: one probe at its centre).
   - the mark (a three-line lockup) flips only when both lines agree; while a boundary runs through it, it keeps its
     colour and takes .is-plate, whose halo holds on either ground (half the lockup vanished at sheet edges);
   - every other piece turns light as soon as any of its box is over a light region (ink with the cream halo over the
     Results oculus, the Venus sky), with the halo while it straddles the boundary. */
let probes = [];
export function registerProbes(els) {
  probes = [...els].map((el) => ({ el, mark: el.classList.contains('rail__mark'), x: 0, y: 0, y0: 0, y1: 0, light: null, plate: null }));
  measureProbes();
}
let waiting = false;
function measureProbes() {
  // a probe caught mid-animation (the hero's FLIP flies the mark and index rows to the rail: transforms) would keep
  // the animated position until the next layout pass: measure again once its animations have finished
  const anims = !waiting && document.getAnimations ? document.getAnimations().filter((a) => {
    const t = a.effect?.target;
    return t instanceof Element && probes.some((p) => p.el === t || t.contains(p.el));
  }) : [];
  if (anims.length) { waiting = true; Promise.allSettled(anims.map((a) => a.finished)).then(() => { waiting = false; measureProbes(); }); }
  for (const p of probes) {
    const r = p.el.getBoundingClientRect();
    p.x = r.left + r.width / 2; p.y = r.top + r.height / 2;
    p.y0 = r.top + Math.min(4, r.height * 0.2); p.y1 = r.bottom - Math.min(4, r.height * 0.2);
  }
}

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
      const l0 = themeAt(v.y + p.y0, p.x) === 'light', l1 = themeAt(v.y + p.y1, p.x) === 'light';
      const split = l0 !== l1;
      const light = p.mark ? (split ? p.light ?? l0 : l0) : l0 || l1;
      if (light !== p.light) { p.el.classList.toggle('is-light', light); p.light = light; }
      const plate = split || (light ? paintedAt(v.y + p.y) && !opaqueAt(v.y + p.y) : paintedAt(v.y + p.y));
      if (plate !== p.plate) { p.el.classList.toggle('is-plate', plate); p.plate = plate; }
    }
  });
}
