/* Hero: the golden frame dissolves and its mark + index fly to the rail (desktop), the Da Vinci
   lines draw on load and fade, and the three beat lines play over the film. */
import { onFrame, onResize, seg, smooth, clamp, view } from '../core/scroll.js';
import { geo } from '../core/layout.js';
import { REDUCED, isDesktop } from '../core/env.js';

const root = document.documentElement;

function linesSVG(w, h, fr) {
  // golden-ratio construction around the centred frame: nested golden rectangles, quarter arcs,
  // the two long diagonals, a centre cross and a circle through the frame's corners
  const phi = 1.618034;
  const fw = fr.width, fh = fr.height, x0 = fr.left, y0 = fr.top, cx = x0 + fw / 2, cy = y0 + fh / 2;
  const L = [];
  L.push(`<rect class="is-strong" x="${x0}" y="${y0}" width="${fw}" height="${fh}"/>`);
  L.push(`<line x1="0" y1="0" x2="${w}" y2="${h}"/><line x1="${w}" y1="0" x2="0" y2="${h}"/>`);
  L.push(`<line x1="${cx}" y1="0" x2="${cx}" y2="${h}"/><line x1="0" y1="${y0}" x2="${w}" y2="${y0}"/><line x1="0" y1="${y0 + fh}" x2="${w}" y2="${y0 + fh}"/>`);
  L.push(`<line x1="${x0}" y1="0" x2="${x0}" y2="${h}"/><line x1="${x0 + fw}" y1="0" x2="${x0 + fw}" y2="${h}"/>`);
  const R = Math.hypot(fw, fh) / 2;
  L.push(`<circle cx="${cx}" cy="${cy}" r="${R}"/><circle cx="${cx}" cy="${cy - R}" r="${R}"/><circle cx="${cx}" cy="${cy + R}" r="${R}"/>`);
  // golden spiral of squares stepping out of the frame's upper-left and lower-right
  let s = fh / phi / phi, x = x0 - s, y = y0 - s * 0.0;
  for (let i = 0; i < 5; i++) { L.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`); x += s; s /= phi; }
  s = fh / phi / phi; x = x0 + fw; y = y0 + fh - s;
  for (let i = 0; i < 5; i++) { L.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`); s /= phi; x += s * phi - s; y += s * phi - s; }
  L.push(`<path d="M ${x0} ${y0 + fh} A ${fw} ${fw} 0 0 1 ${x0 + fw} ${y0 + fh - fw}"/>`);
  L.push(`<path d="M ${x0 + fw} ${y0} A ${fw} ${fw} 0 0 1 ${x0} ${y0 + fw}"/>`);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${L.join('')}</svg>`;
}

export function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const frame = hero.querySelector('[data-frame]');
  const lines = hero.querySelector('[data-lines]');
  const beats = [...hero.querySelectorAll('[data-beat]')];
  const draw = () => {
    const pin = hero.querySelector('.hero__pin').getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    lines.innerHTML = linesSVG(pin.width, pin.height, { left: f.left - pin.left, top: f.top - pin.top, width: f.width, height: f.height });
    if (REDUCED) return;
    for (const [i, p] of [...lines.querySelectorAll('path,line,rect,circle')].entries()) {
      const len = p.getTotalLength ? p.getTotalLength() : 2000;
      p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`;
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1800 + i * 40, delay: 200 + i * 55, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    }
  };
  draw(); onResize(draw);

  // FLIP: the frame's mark and index travel to the rail's (desktop)
  const pairs = ['mark', 'index'].map((k) => ({ from: hero.querySelector(`[data-flip-src="${k}"]`), to: document.querySelector(`.rail [data-flip="${k}"]`) }));
  let deltas = null;
  const measureFlip = () => {
    for (const p of pairs) { p.from.style.transform = ''; }
    deltas = pairs.map(({ from, to }) => {
      if (!to || !isDesktop()) return null;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      return { dx: b.left - a.left, dy: b.top - a.top, s: b.width / a.width };
    });
  };
  requestAnimationFrame(measureFlip); onResize(measureFlip);
  document.fonts?.ready.then(measureFlip);

  const beatWin = [[0.06, 0.3], [0.38, 0.58], [0.68, 0.94]];
  onFrame((v) => {
    const g = geo(hero);
    const p = clamp((v.y - g.top) / Math.max(1, g.height - v.vh));
    // frame veil + lines dissolve over the first stretch
    const out = smooth(seg(p, 0.0, 0.1));
    lines.style.opacity = String(1 - smooth(seg(p, 0, 0.06)));
    frame.style.setProperty('--veil', String(1 - out));
    frame.style.boxShadow = `inset 0 0 0 1px rgba(244,237,223,${0.7 * (1 - out)})`;
    hero.querySelector('.frame__dek').style.opacity = String(1 - smooth(seg(p, 0, 0.05)));
    frame.classList.toggle('is-out', out > 0.98);
    const docked = deltas && deltas[0] ? out > 0.97 : p > 0.1;
    root.classList.toggle('rail-docked', docked || v.y > g.bottom - v.vh);
    pairs.forEach(({ from }, i) => {
      const d = deltas && deltas[i];
      if (d) {
        const k = REDUCED ? (out > 0.5 ? 1 : 0) : out;
        from.style.transform = `translate(${d.dx * k}px, ${d.dy * k}px) scale(${1 + (d.s - 1) * k})`;
        from.style.transformOrigin = '0 0';
        from.style.opacity = String(docked ? 0 : 1);
      } else {
        from.style.transform = ''; from.style.opacity = String(1 - out);
      }
    });
    frame.querySelector('nav').style.pointerEvents = out > 0.5 ? 'none' : '';
    beats.forEach((b, i) => {
      const [a, z] = beatWin[i];
      const k = REDUCED ? (p >= a && p < z ? 1 : 0) : Math.min(smooth(seg(p, a, a + 0.06)), 1 - smooth(seg(p, z - 0.07, z)));
      b.style.opacity = String(k);
      b.style.transform = `translate(-50%, calc(-50% + ${(1 - k) * (p < (a + z) / 2 ? 24 : -24)}px))`;
    });
  });
}
