/* I · Storytellers: three ways in draw hairlines that converge on "One machine" as you scroll. */
import './storytellers.css';
import { onFrame, onResize, seg, smooth } from '../core/scroll.js';
import { geo } from '../core/layout.js';
import { REDUCED } from '../core/env.js';

export function init() {
  const box = document.querySelector('[data-ways]');
  if (!box) return;
  const svg = box.querySelector('[data-ways-lines]');
  const target = box.querySelector('[data-ways-machine]');
  const names = [...box.querySelectorAll('.way__need')];
  let paths = [], dot;
  const layout = () => {
    const b = box.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const wide = window.innerWidth >= 900;
    const tx = wide ? t.left - b.left - 18 : t.left - b.left + 12;
    const ty = wide ? t.top - b.top + t.height * 0.55 : t.top - b.top - 14;
    svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    svg.innerHTML = '';
    paths = names.map((n) => {
      const r = n.getBoundingClientRect();
      const x = wide ? r.left - b.left + Math.min(r.width, 260) + 16 : r.left - b.left + 4;
      const y = wide ? r.top - b.top + r.height * 0.55 : r.bottom - b.top + 4;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const mx = wide ? (x + tx) / 2 : x;
      p.setAttribute('d', wide ? `M${x} ${y} C ${mx} ${y}, ${mx} ${ty}, ${tx} ${ty}` : `M${x} ${y} C ${x} ${(y + ty) / 2}, ${tx} ${(y + ty) / 2}, ${tx} ${ty}`);
      svg.appendChild(p);
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`;
      return { p, len };
    });
    dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', tx); dot.setAttribute('cy', ty); dot.setAttribute('r', 4); svg.appendChild(dot);
  };
  requestAnimationFrame(layout); onResize(layout); document.fonts?.ready.then(layout);
  if (window.innerWidth < 900) target.style.opacity = "1";
  onFrame((v) => {
    const g = geo(box);
    const p = REDUCED ? 1 : seg(v.y + v.vh * 0.75, g.top, g.top + g.height * 0.8);
    paths.forEach(({ p: path, len }, i) => { path.style.strokeDashoffset = String(len * (1 - smooth(seg(p, i * 0.12, 0.7 + i * 0.1)))); });
    if (dot) dot.style.opacity = String(smooth(seg(p, 0.85, 0.98)));
    target.style.opacity = String(0.25 + 0.75 * smooth(seg(p, 0.7, 0.95)));
  });
}
