/* VIII · Results: four counters (F99–F102).
   A counter counts once, as soon as it is in view (its hairline above 95% of the viewport): a short time-based ease-out (1.3 s),
   with the gold drawing along the hairline in step and the + fading in on the landing (the unit, M, always shows).
   So whenever the page is at rest the figure is settled, never caught mid-count. It resets (invisibly) only once
   it is below the fold again, so scrolling back down counts it again; scrolled past and back, it stays landed.
   REDUCED / tier 0 / no JS: the markup's final figures stand. */
import './results.css';
import { onFrame } from '../core/scroll.js';
import { geo } from '../core/layout.js';
import { TIER, REDUCED } from '../core/env.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);
const DUR = 1.3;

export function init() {
  const sec = document.getElementById('results');
  if (!sec || TIER === 0 || REDUCED) return;
  sec.classList.add('rx-on');

  const stats = [...sec.querySelectorAll('.rx-stat')].map((li) => {
    const digits = li.querySelector('.rx-digits');
    const n = +digits.dataset.n, L = String(n).length;
    // one slot per place of the final figure: the layout is the final figure's from the first frame;
    // places not reached yet hold a faint zero (.is-off)
    digits.textContent = '';
    const slots = Array.from({ length: L }, () => digits.appendChild(document.createElement('i')));
    return { li, n, L, slots, suf: li.querySelector('.rx-suf'), t: 0, run: false, val: -1, k: '', s: '' };
  });
  const show = (st, v) => {
    const str = String(v).padStart(st.L, '0'), lead = st.L - String(v).length;
    st.slots.forEach((el, i) => {
      if (el.textContent !== str[i]) el.textContent = str[i];
      el.classList.toggle('is-off', i < lead);
    });
  };
  const paint = (st) => {
    const e = ease(Math.min(1, st.t / DUR));
    const val = Math.round(st.n * e);
    if (val !== st.val) { show(st, val); st.val = val; }
    const k = e.toFixed(3);
    if (k !== st.k) { st.li.style.setProperty('--rx-k', k); st.k = k; }
    const s = Math.min(1, Math.max(0, (st.t - DUR * 0.8) / (DUR * 0.35))).toFixed(2);
    if (s !== st.s) { st.suf.style.opacity = s; st.s = s; }
  };
  stats.forEach(paint);

  // real time, not the frame's dt (which is capped per frame): a slow device still lands on time
  let last = performance.now();
  onFrame((v) => {
    const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    for (const st of stats) {
      const top = geo(st.li).top - v.y;
      if (!st.run && top < v.vh * 0.95) st.run = true;          // it came into view: count
      else if (st.run && top > v.vh * 1.02) { st.run = false; st.t = 0; paint(st); }   // below the fold again: reset unseen
      if (st.run && st.t < DUR * 1.15) { st.t += dt; paint(st); }
    }
  });
}
