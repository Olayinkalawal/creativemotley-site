/* Scroll → film frame, from [data-film="name"][data-frames="a-b"] ranges in the markup: each element maps its pin
   progress linearly onto frames a..b (holds between ranges). No three.js here (the phone still path uses it too). */
import { geo } from '../../core/layout.js';
import { clamp } from '../../core/scroll.js';

export function filmRanges(name) {
  return [...document.querySelectorAll(`[data-film="${name}"][data-frames]`)].map((el) => {
    const [a, b] = el.dataset.frames.split('-').map(Number);
    return { el, a, b };
  });
}
export function frameAt(ranges, y, vh) {
  let f = ranges.length ? ranges[0].a : 0;
  for (const r of ranges) {
    const g = geo(r.el);
    if (y < g.top) break;
    const p = clamp((y - g.top) / Math.max(1, g.height - vh));
    f = r.a + (r.b - r.a) * p;
  }
  return f;
}
