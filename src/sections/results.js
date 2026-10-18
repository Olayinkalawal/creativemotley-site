/* VIII · Results: four counters (F99–F102), each a pure function of scroll.
   A counter starts as its hairline rises past the lower part of the viewport (86%) and lands on its final figure
   when it sits comfortably in view (its top at 46% of the viewport), with a cubic ease-out; the gold draws along the
   hairline in step and the + fades in once the count is complete (the unit, M, always shows). Scrolling back counts back down exactly.
   The chapter's camera keys (on the section) switch to portrait keys on tall screens (bindCamKeys).
   REDUCED / tier 0 / no JS: the markup's final figures stand. */
import './results.css';
import { onFrame, clamp, smooth, seg } from '../core/scroll.js';
import { geo } from '../core/layout.js';
import { TIER, REDUCED } from '../core/env.js';
import { bindCamKeys } from './_paper.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);

export function init() {
  const sec = document.getElementById('results');
  if (!sec) return;
  bindCamKeys(sec);
  if (TIER === 0 || REDUCED) return;
  sec.classList.add('rx-on');

  const stats = [...sec.querySelectorAll('.rx-stat')].map((li) => {
    const digits = li.querySelector('.rx-digits');
    const n = +digits.dataset.n, L = String(n).length;
    // one slot per place of the final figure: the layout is the final figure's from the first frame;
    // places not reached yet hold a faint zero (.is-off)
    digits.textContent = '';
    const slots = Array.from({ length: L }, () => digits.appendChild(document.createElement('i')));
    return { li, n, L, slots, suf: li.querySelector('.rx-suf'), val: -1, k: '', s: '' };
  });
  const show = (st, v) => {
    const str = String(v).padStart(st.L, '0'), lead = st.L - String(v).length;
    st.slots.forEach((el, i) => {
      if (el.textContent !== str[i]) el.textContent = str[i];
      el.classList.toggle('is-off', i < lead);
    });
  };

  onFrame((v) => {
    for (const st of stats) {
      const top = geo(st.li).top - v.y;
      const p = clamp((v.vh * 0.86 - top) / (v.vh * 0.4));
      const val = Math.round(st.n * ease(p));
      if (val !== st.val) { show(st, val); st.val = val; }
      const k = ease(p).toFixed(4);
      if (k !== st.k) { st.li.style.setProperty('--rx-k', k); st.k = k; }
      const s = (val === st.n ? smooth(seg(p, 0.86, 1)) : 0).toFixed(3);
      if (s !== st.s) { st.suf.style.opacity = s; st.s = s; }
    }
  });
}
