/* IV · Method: the second frame film (453 painted frames) scrubbed over one long run.
   The scene (src/gl/scenes/method.js) and the progress hairline both read filmFrame(), so they agree.
   Pacing: the run's pin progress p is not mapped to frames linearly. The film spends its frames unevenly
   (a long, nearly still stretch while the exploded camera drifts; a quick explode; a slow turn up into the dome),
   so a monotone cubic through a few knots gives each passage the scroll it deserves without any change of speed
   you can feel. Static (no JS, ?tier=0, reduced motion): no run, the chapter is the opener over the still plate. */
import './method.css';
import { onFrame, clamp, smooth, seg } from '../core/scroll.js';
import { geo } from '../core/layout.js';
import { TIER, REDUCED } from '../core/env.js';

export const FRAMES = 453;
// [pin progress, frame]: table push → rise and turn → explode → exploded drift → close and turn → up into the dome
const KNOTS = [[0, 0], [0.1, 56], [0.28, 140], [0.46, 200], [0.6, 336], [0.76, 394], [1, 452]];

/* monotone cubic (Fritsch–Carlson) through KNOTS, normalised to 0..1 */
const xs = KNOTS.map((k) => k[0]), ys = KNOTS.map((k) => k[1] / (FRAMES - 1));
const ms = (() => {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2] * 0.55;                 // ease into the final hold on the dome
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return m;
})();
export function pace(p) {
  p = clamp(p);
  let i = 0;
  while (i < xs.length - 2 && p > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], t = (p - xs[i]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * ms[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * ms[i + 1];
}

/* the run's pin progress: 0 when its top meets the viewport top, 1 when its bottom meets the viewport bottom */
export function runProgress(el, y, vh) {
  const g = geo(el);
  return clamp((y - g.top) / Math.max(1, g.height - vh));
}
/* scroll y → film frame (float), from [data-film="method"][data-frames="a-b"] */
export function filmFrame(el, y, vh) {
  const [a, b] = (el.dataset.frames || `0-${FRAMES - 1}`).split('-').map(Number);
  return a + (b - a) * pace(runProgress(el, y, vh));
}

export function init() {
  const sec = document.getElementById('method');
  if (!sec || TIER === 0 || REDUCED) return;
  sec.classList.add('mt-on');
  const run = sec.querySelector('[data-mt-run]');
  const fill = sec.querySelector('[data-mt-fill]');
  const bar = fill.closest('.mt-bar');
  let last = '';
  onFrame((v) => {
    const g = geo(run);
    if (v.y + v.vh < g.top || v.y > g.bottom) return;
    const p = runProgress(run, v.y, v.vh);
    const key = p.toFixed(4);
    if (key === last) return;
    last = key;
    fill.style.transform = `scaleX(${pace(p).toFixed(4)})`;
    bar.style.opacity = (smooth(seg(p, 0, 0.03)) * (1 - smooth(seg(p, 0.93, 1)))).toFixed(3);
  });
}
