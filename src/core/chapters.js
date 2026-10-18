/* Which chapter is under the reading line, which theme sits under the nav and the rail.
   - [data-chapter] sections drive the rail's active item and the dotted leader.
   - [data-theme] regions (dark | light) drive chrome colour: the innermost region under
     the nav's centre line sets html.nav-light; the one under the rail index sets html.rail-light. */
import { onFrame, view } from './scroll.js';
import { geo, onLayout } from './layout.js';

const root = document.documentElement;
let chapters = [], themes = [];
const listeners = new Set();
export let active = null;
export function onChapter(fn) { listeners.add(fn); fn(active); return () => listeners.delete(fn); }

function collect() {
  chapters = [...document.querySelectorAll('[data-chapter]')];
  themes = [...document.querySelectorAll('[data-theme]')].map((el) => {
    let depth = 0; for (let n = el; n; n = n.parentElement) depth++;
    return { el, depth };
  }).sort((a, b) => b.depth - a.depth);
}
function themeAt(y) {
  for (const t of themes) {
    const g = geo(t.el);
    if (y >= g.top && y < g.bottom) return t.el.dataset.theme;
  }
  return 'dark';
}

/* fixed chrome pieces that flip colour on their own (rail items, legal): each gets .is-light when
   the region under its centre is light, so a torn edge passing under the rail splits it cleanly */
let probes = [];
export function registerProbes(els) {
  probes = [...els].map((el) => ({ el, y: 0, light: null }));
  measureProbes();
}
function measureProbes() { for (const p of probes) { const r = p.el.getBoundingClientRect(); p.y = r.top + r.height / 2; } }

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
    const nav = themeAt(v.y + 28), rail = themeAt(v.y + v.vh - 150);
    if (nav !== lastNav) { root.classList.toggle('nav-light', nav === 'light'); lastNav = nav; }
    if (rail !== lastRail) { root.classList.toggle('rail-light', rail === 'light'); lastRail = rail; }
    for (const p of probes) {
      const light = themeAt(v.y + p.y) === 'light';
      if (light !== p.light) { p.el.classList.toggle('is-light', light); p.light = light; }
    }
  });
}
