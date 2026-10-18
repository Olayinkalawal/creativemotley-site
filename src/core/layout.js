/* Cached document geometry for scroll-driven work. Measured on boot, on resize and when
   fonts/images settle; never per frame. Elements are measured by rect + scrollY. */
import { onResize } from './scroll.js';

const entries = new Map();   // el -> { top, height }
export function measure(el) {
  const r = el.getBoundingClientRect();
  const m = { top: r.top + window.scrollY, height: r.height, bottom: r.top + window.scrollY + r.height };
  entries.set(el, m);
  return m;
}
export function geo(el) { return entries.get(el) || measure(el); }
const listeners = new Set();
export function remeasure() { for (const el of entries.keys()) measure(el); for (const fn of listeners) fn(); }
export function onLayout(fn) { listeners.add(fn); return () => listeners.delete(fn); }
onResize(remeasure);
if (document.fonts) document.fonts.ready.then(remeasure);
window.addEventListener('load', () => setTimeout(remeasure, 50));
new ResizeObserver(() => { clearTimeout(remeasure.t); remeasure.t = setTimeout(remeasure, 80); }).observe(document.body);
