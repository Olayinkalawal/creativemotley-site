/* IV · Method, continued: the instrument.
   One pure function of scroll (runAt) drives three things that have to agree:
     - the WebGL scene (src/gl/scenes/instrument.js): the camera arrives assembled out of the dark, separates into
       seven groups along its optical axis, then holds while the steps are read;
     - the spec list: while the steps are read, the active row is at full strength (the rest step back);
     - the leader: a gold hairline from the active row to its part (desktop), or a ring on the part (phones).
   Static mode (no JS, ?tier=0, reduced motion): no pin; the list sits beside the painted still. */
import './teardown.css';
import { onFrame, clamp, smooth, seg } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { REDUCED, TIER } from '../core/env.js';

/* the seven groups, back to front along the optical axis */
export const PARTS = ['body', 'sensor', 'shutter', 'mount', 'inner', 'rings', 'front'];
/* pin-progress windows: the explode, and the reading of the seven steps */
export const WIN = { explode: [0.04, 0.44], read: [0.36, 0.97] };

export const state = {
  L: null,              // layout, measured on resize (see measure())
  y: NaN, ver: -1,
  p: 0,                 // pin progress 0..1
  pinTop: 0,            // px the pin sits below (> 0, arriving) or above (< 0, leaving) its stuck position
  arrive: 0,            // 0 → 1 as the pin rises into place
  leave: 0,             // 0 → 1 over the viewport after the pin lets go
  x: 0,                 // explode 0..1 (linear; the scene staggers and eases per group)
  reading: 0,           // 0..1, fades in as the reading of the steps starts
  readT: -1,            // continuous row position while reading: k + 0.5 = row k centred
  active: -1,           // active row (-1 before the reading starts)
  visible: false,
  rows: [],             // row k -> part index (into PARTS)
  focus: new Float32Array(PARTS.length),   // per part: how much it is the active one (0..1)
  anchor: { x: 0, y: 0, ok: false },      // the active part's anchor on screen (CSS px), set by the scene
  drawn: false,         // the instrument scene has drawn
  onGL: null, onDraw: null,
};

/* scroll y -> run state (cached per y + layout version) */
export function runAt(y) {
  const L = state.L;
  if (!L || (y === state.y && L.ver === state.ver)) return state;
  state.y = y; state.ver = L.ver;
  const g = geo(L.run);
  const span = Math.max(1, g.height - L.pinH);
  const start = g.top + L.stick;                 // the pin sticks at top: -stick (phones scroll the head away first)
  const pinTop = y < start ? start - y : (y > start + span ? start + span - y : 0);
  const p = clamp((y - start) / span);
  state.p = p; state.pinTop = pinTop;
  state.arrive = 1 - clamp(pinTop / L.vh);
  state.leave = clamp(-pinTop / L.vh);
  state.x = seg(p, WIN.explode[0], WIN.explode[1]);
  const r = seg(p, WIN.read[0], WIN.read[1]);
  state.reading = smooth(seg(p, WIN.read[0] - 0.025, WIN.read[0] + 0.01));
  state.readT = p >= WIN.read[0] ? Math.min(r * state.rows.length, state.rows.length - 0.5) : -1;
  state.active = state.readT >= 0 ? Math.min(state.rows.length - 1, Math.floor(state.readT)) : -1;
  state.focus.fill(0);
  if (state.readT >= 0) {
    for (let k = 0; k < state.rows.length; k++) {
      const d = Math.abs(state.readT - (k + 0.5));
      state.focus[state.rows[k]] = Math.max(state.focus[state.rows[k]], (1 - smooth(seg(d, 0.36, 0.62))) * state.reading);
    }
  }
  state.visible = pinTop < L.vh && pinTop > -(L.pinH - L.stick);
  return state;
}

export function init() {
  const sec = document.getElementById('instrument');
  if (!sec) return;
  const run = sec.querySelector('[data-td-run]');
  const pin = sec.querySelector('[data-td-pin]');
  const slot = sec.querySelector('[data-td-slot]');
  const list = sec.querySelector('[data-td-list]');
  const rows = [...list.children];
  state.rows = rows.map((li) => Math.max(0, PARTS.indexOf(li.dataset.part)));

  if (TIER === 0 || REDUCED) return;            // static: the still and the full list

  sec.classList.add('td-on');
  const lead = sec.querySelector('[data-td-lead]');
  const path = lead.querySelector('[data-td-lead-path]');
  const end = lead.querySelector('[data-td-lead-end]');
  const dot = lead.querySelector('[data-td-lead-dot]');
  const navH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56;

  function measure() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const stacked = vw < 820;
    // phones: the pin sticks once the head has scrolled away, so the slot starts right under the bar
    const stick = stacked ? Math.max(0, Math.round(slot.offsetTop - navH())) : 0;
    if (sec.style.getPropertyValue('--td-hh') !== `${stick}px`) sec.style.setProperty('--td-hh', `${stick}px`);
    const pr = pin.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    if (!sr.height) return;
    state.L = {
      run, ver: (state.L?.ver ?? 0) + 1, vw, vh, stacked, stick, pinH: pin.offsetHeight,
      slot: { x: sr.left - pr.left, y: sr.top - pr.top, w: sr.width, h: sr.height },
      rows: rows.map((li) => {
        const r = li.getBoundingClientRect(), t = li.querySelector('.td-spec__t').getBoundingClientRect();
        return { x: r.right - pr.left, y: t.top + t.height / 2 - pr.top, x0: r.left - pr.left };
      }),
    };
    lastY = NaN;
  }
  let lastY = NaN, lastActive = -2, lastReading = null;
  requestAnimationFrame(measure);
  onLayout(measure);

  state.onGL = () => sec.classList.add('is-gl');
  const glOn = () => state.drawn && document.documentElement.classList.contains('gl-ready');

  // per frame: the active row (works with or without WebGL: it is the reading order, not the picture)
  onFrame((v) => {
    if (!state.L) return;
    runAt(v.y);
    if (!state.visible && v.y === lastY) return;
    lastY = v.y;
    const reading = state.active >= 0;
    if (reading !== lastReading) { sec.classList.toggle('is-reading', reading); lastReading = reading; }
    if (state.active !== lastActive) {
      rows.forEach((li, k) => li.classList.toggle('is-on', k === state.active));
      lastActive = state.active;
    }
    if (!glOn()) lead.style.opacity = '0';
  });

  /* the leader, drawn by the scene right after it has projected the active part (same frame as the picture) */
  state.onDraw = () => {
    const L = state.L, a = state.anchor;
    if (!L || state.active < 0 || !a.ok || !glOn()) { lead.style.opacity = '0'; return; }
    // fade across row changes (so the line never jumps), and out as the pin lets go
    const f = state.readT - Math.floor(state.readT);
    const edge = state.active === state.rows.length - 1 ? smooth(seg(f, 0, 0.14)) : smooth(seg(Math.min(f, 1 - f), 0, 0.12));
    const o = state.reading * (state.active === 0 ? 1 : edge) * (1 - smooth(seg(state.leave, 0, 0.25)));
    lead.style.opacity = o.toFixed(3);
    if (o < 0.002) return;
    const top = -L.stick + state.pinTop;          // the pin's screen top
    const ax = a.x, ay = a.y - top;               // anchor in pin space
    end.setAttribute('cx', ax.toFixed(1)); end.setAttribute('cy', ay.toFixed(1));
    if (L.stacked) { path.setAttribute('d', ''); dot.setAttribute('cx', '-20'); return; }
    const r = L.rows[state.active];
    const x0 = r.x + 14, y0 = r.y, kx = Math.min(ax - 24, x0 + Math.max(24, (ax - x0) * 0.28));
    // a short run out of the row, then straight to the part (stopping at the ring)
    const dx = ax - kx, dy = ay - y0, len = Math.hypot(dx, dy) || 1;
    const ex = ax - (dx / len) * 6, ey = ay - (dy / len) * 6;
    path.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)}H${kx.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
    dot.setAttribute('cx', (x0 - 4).toFixed(1)); dot.setAttribute('cy', y0.toFixed(1));
  };
}
