/* [data-reveal] rises in once when it enters (optional --d delay via data-reveal="0.12"). */
import { REDUCED } from './env.js';
export function initReveal(scope = document) {
  const els = scope.querySelectorAll('[data-reveal]:not(.in)');
  if (REDUCED || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((list) => {
    for (const e of list) if (e.isIntersecting) {
      const d = parseFloat(e.target.dataset.reveal);
      if (d) e.target.style.setProperty('--d', d + 's');
      e.target.classList.add('in'); io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  els.forEach((e) => io.observe(e));
}
