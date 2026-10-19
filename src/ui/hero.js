/* Hero: the golden frame dissolves and its mark + index fly to the rail (desktop), the Da Vinci
   lines draw on load and fade, and the three beat lines play over the film.
   v3 (phase 2): everything runs on screens of scroll since the top (s = scrollY / innerHeight), the clock the film
   is keyed on (data-film-map on the section): the frame dissolves over the first 0.12 screens, each beat holds over
   its own window (data-beat="from to", in screens), all inside the 190svh section's pin.
   Per frame only diffed, quantised writes (nothing at rest; the frame's line and its veil only while they fade). */
import { onFrame, onResize, seg, smooth } from '../core/scroll.js';
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

  const last = new Map();   // diffed writes (below)
  // FLIP: the frame's mark and index travel to the rail's (desktop)
  const pairs = ['mark', 'index'].map((k) => ({ from: hero.querySelector(`[data-flip-src="${k}"]`), to: document.querySelector(`.rail [data-flip="${k}"]`) }));
  let deltas = null;
  const measureFlip = () => {
    for (const p of pairs) { p.from.style.transform = ''; }
    last.clear();
    deltas = pairs.map(({ from, to }) => {
      if (!to || !isDesktop()) return null;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      return { dx: b.left - a.left, dy: b.top - a.top, s: b.width / a.width };
    });
  };
  requestAnimationFrame(measureFlip); onResize(measureFlip);
  document.fonts?.ready.then(measureFlip);

  // each beat's window in screens (data-beat="from to"); fades take 0.05 screens at each end
  const beatWin = beats.map((b, i) => { const w = (b.dataset.beat || '').split(/\s+/).map(Number); return w.length === 2 && w.every(Number.isFinite) ? w : [0.12 + 0.28 * i, 0.36 + 0.28 * i]; });
  const dek = hero.querySelector('.frame__dek');
  const nav = frame.querySelector('nav');
  // diffed writes (v3): every value is quantised and written only when it changes, so the hero at rest writes
  // nothing per frame, and the frame's line and veil (a backdrop-filter layer) are touched only while they fade
  const put = (el, key, prop, val) => {
    if (!el || last.get(key) === val) return;
    last.set(key, val);
    if (prop.charCodeAt(0) === 45) el.style.setProperty(prop, val); else el.style[prop] = val;
  };
  const q = (v) => (Math.round(v * 100) / 100).toString();
  let lastDocked = null, lastOut = null;
  onFrame((v) => {
    const g = geo(hero);
    const s = Math.max(0, (v.y - g.top) / Math.max(1, v.vh));   // screens since the top
    // frame veil + lines dissolve over the first stretch
    const out = smooth(seg(s, 0.0, 0.12));
    put(lines, 'lines', 'opacity', q(1 - smooth(seg(s, 0, 0.07))));
    put(frame, 'veil', '--veil', q(1 - out));
    const a = Math.round(70 * (1 - out)) / 100;
    put(frame, 'line', 'boxShadow', a > 0 ? `inset 0 0 0 1px rgba(244,237,223,${a})` : 'none');
    put(dek, 'dek', 'opacity', q(1 - smooth(seg(s, 0, 0.06))));
    const isOut = out > 0.98;
    if (isOut !== lastOut) { frame.classList.toggle('is-out', isOut); lastOut = isOut; }
    const docked = (deltas && deltas[0] ? out > 0.97 : s > 0.12) || v.y > g.bottom - v.vh;
    if (docked !== lastDocked) { root.classList.toggle('rail-docked', docked); lastDocked = docked; }
    pairs.forEach(({ from }, i) => {
      const d = deltas && deltas[i];
      if (d) {
        const k = REDUCED ? (out > 0.5 ? 1 : 0) : Math.round(out * 1000) / 1000;
        put(from, `t${i}`, 'transform', k ? `translate(${(d.dx * k).toFixed(1)}px, ${(d.dy * k).toFixed(1)}px) scale(${(1 + (d.s - 1) * k).toFixed(4)})` : '');
        put(from, `o${i}`, 'transformOrigin', '0 0');
        put(from, `a${i}`, 'opacity', docked ? '0' : '1');
      } else {
        put(from, `t${i}`, 'transform', ''); put(from, `a${i}`, 'opacity', q(1 - out));
      }
    });
    put(nav, 'nav', 'pointerEvents', out > 0.5 ? 'none' : '');
    beats.forEach((b, i) => {
      const [a0, z] = beatWin[i];
      const k = REDUCED ? (s >= a0 && s < z ? 1 : 0) : Math.min(smooth(seg(s, a0, a0 + 0.05)), 1 - smooth(seg(s, z - 0.05, z)));
      const kq = Math.round(k * 1000) / 1000;
      put(b, `bo${i}`, 'opacity', String(kq));
      put(b, `bt${i}`, 'transform', `translate(-50%, calc(-50% + ${((1 - kq) * (s < (a0 + z) / 2 ? 24 : -24)).toFixed(1)}px))`);
    });
  });
}
