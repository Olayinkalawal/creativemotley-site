/* Scroll → film frame, from [data-film="name"][data-frames="a-b"] ranges in the markup. No three.js here (the phone
   still path uses it too). Frames are always the film's *source* frames (0 … 569, the painted render), whatever is
   delivered: the scene maps them onto its encode (FILM_CUT below), the phone path dissolves its two stills on them.
   - plain range: the element's pin progress maps linearly onto frames a..b (holds between ranges);
   - keyed range (v3): data-film-map="s f s f …" maps screens of scroll since the element's top met the viewport top
     (s, in viewport heights) onto source frames, piecewise linear (holds before the first key and after the last),
     so a single marker can give the hand-off, the plunge through the lens and the drawing each their own pace. */
import { geo } from '../../core/layout.js';
import { clamp } from '../../core/scroll.js';

/* the v3 cut of the hero film: the source frames the encode keeps (scripts/encode-film.sh reads this line), as
   "a-b:step" spans. Frames 0–200 are the hero painting, unchanged (a short ramp), 202–344 the hand-off and the push
   into the lens (every other frame: the render has a near-duplicate every other frame there), 346–420 the lens going
   dark, the glint and the vortex (crossed in 18 frames; the near-black 387–399 is gone), 422–530 the machine drawing
   the Storytellers painting, 534–569 its settle (569 = the Storytellers plate). */
export const FILM_CUT = '0-200:40,202-344:2,346-382:4,388,394,400-420:4,422-530:2,534-566:4,569';
export function cutFrames(spec = FILM_CUT) {
  const out = [];
  for (const part of spec.split(',')) {
    const [span, step = '1'] = part.split(':');
    const [a, b = a] = span.split('-').map(Number);
    for (let i = a; i <= b; i += +step) out.push(i);
  }
  return out;
}
/* source frame (float) → index in the cut (float), piecewise linear between kept frames */
export function cutIndex(src, f) {
  if (f <= src[0]) return 0;
  const n = src.length - 1;
  if (f >= src[n]) return n;
  let lo = 0, hi = n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (src[m] <= f) lo = m; else hi = m; }
  return lo + (f - src[lo]) / (src[hi] - src[lo]);
}

export function filmRanges(name) {
  return [...document.querySelectorAll(`[data-film="${name}"][data-frames]`)].map((el) => {
    const [a, b] = el.dataset.frames.split('-').map(Number);
    const m = (el.dataset.filmMap || '').trim().split(/\s+/).map(Number);
    return { el, a, b, map: m.length >= 4 && m.every(Number.isFinite) ? m : null };
  });
}
function keyed(m, s) {
  if (s <= m[0]) return m[1];
  for (let i = 2; i < m.length; i += 2) {
    if (s <= m[i]) { const t = (s - m[i - 2]) / Math.max(1e-6, m[i] - m[i - 2]); return m[i - 1] + (m[i + 1] - m[i - 1]) * t; }
  }
  return m[m.length - 1];
}
export function frameAt(ranges, y, vh) {
  let f = ranges.length ? (ranges[0].map ? ranges[0].map[1] : ranges[0].a) : 0;
  for (const r of ranges) {
    const g = geo(r.el);
    if (y < g.top) break;
    if (r.map) f = keyed(r.map, (y - g.top) / Math.max(1, vh));
    else f = r.a + (r.b - r.a) * clamp((y - g.top) / Math.max(1, g.height - vh));
  }
  return f;
}
