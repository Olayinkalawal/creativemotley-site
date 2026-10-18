/* Teardown choreography, shared by the scene (gl/scenes/teardowns.js) and the section (sections/_teardown.js),
   so the WebGL frame, the CSS stills, the construction lines and the part markers all follow one clock.
   Pure functions of scroll; no three.js in here (the section bundle imports it).

   One run = one [data-td-run] (a pinned block). pv is its pin progress, unclamped: 0 when the run's top meets the
   viewport top, 1 when its bottom meets the viewport bottom (negative while it is still arriving).
     orbit     pv -0.45vp → 0.36   orbit frames 1 → 97 (the view travels around the device), +4% push
     hand-off  p  0.27 → 0.45      the slot glides from the whole viewport to the column rect; zoom hero → frame
     junction  p  0.355 → 0.375    orbit f_0097 crossfades into explode f_0001 (the same picture)
     explode   p  0.45 → 0.86      explode frames 1 → 145, eased
     settle    p  0.86 → 0.97      depth parallax + slow push; markers draw in
   Leaving: a run marked data-wipe is a black sheet that scrolls off the next scene (the stage splits the two at the
   boundary, feathered; gl/stage.js), so its device rides up with its copy and never fades. Arriving under such a
   sheet, a run is already lit. Otherwise a run fades in from black (and out, if it had no wipe).
   (vp = one viewport of scroll, in pv units: the run's pre-roll is measured in viewports, not in run length.) */
import { clamp, lerp, smooth, seg } from '../../core/scroll.js';
import { geo } from '../../core/layout.js';

export const TD_ORBIT = 97;
export const TD_EXPLODE = 145;
export const TD_ASPECT = 16 / 9;   // every frame, orbit and explode, and both stills
export const TD_PHASE = {
  orbit: [-0.45, 0.36],     // start in viewports before the pin (scaled by vp), end in p
  hand: [0.27, 0.45],
  junction: [0.355, 0.375],
  explode: [0.45, 0.86],
  settle: [0.86, 0.97],
};

const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/* run geometry → { pv, vp } (vp: one viewport of scroll in pv units) */
export function tdRun(run, y, vh) {
  const g = geo(run);
  const len = Math.max(1, g.height - vh);
  return { pv: (y - g.top) / len, vp: vh / len, top: g.top, height: g.height };
}

/* how a run meets its neighbours: open (it opens a chapter straight out of paper: its device is revealed by the
   paper's edge, so it is lit early), win (it arrives under a wiping run: lit as it slides in), wout (it leaves as a
   wiping sheet: never fades) */
export function tdFlags(el) {
  const prev = el.previousElementSibling;
  return { open: el.hasAttribute('data-td-open'), wout: el.hasAttribute('data-wipe'), win: !!(prev && prev.matches('[data-td][data-wipe]')) };
}
const NOFLAGS = { open: false, win: false, wout: false };
/* phase fractions for pin progress pv (unclamped) of a run whose viewport is vp pv-units long (flags: tdFlags) */
export function tdPhases(pv, vp = 0.25, fl = NOFLAGS) {
  const P = TD_PHASE;
  const p = clamp(pv);
  const o = seg(pv, P.orbit[0] * vp, P.orbit[1]);
  const fin = fl.win ? 1 : fl.open ? smooth(seg(pv, -1.0 * vp, -0.5 * vp)) : smooth(seg(pv, -0.5 * vp, -0.12 * vp));
  const fout = fl.wout ? 1 : 1 - smooth(seg(pv, 1 + 0.25 * vp, 1 + 0.48 * vp));
  return {
    p, pv,
    orbit: 0.72 * o + 0.28 * easeSine(o),       // the orbit frames are re-timed to constant speed: ease only the ends
    hand: easeIO(seg(p, P.hand[0], P.hand[1])),
    handLin: seg(p, P.hand[0], P.hand[1]),
    mix: smooth(seg(p, P.junction[0], P.junction[1])),
    explode: easeSine(seg(p, P.explode[0], P.explode[1])),
    explodeLin: seg(p, P.explode[0], P.explode[1]),
    settle: smooth(seg(p, P.settle[0], P.settle[1])),
    fade: fin * fout,
  };
}
/* the orbit plays frames a…b of the render (data-td-orbit="a-b", data-td-orbit-tall on portrait screens; 1-based,
   default all 97): a sub-range keeps one clean move where a render wobbles or runs past its own frame */
export function tdOrbitRange(el, tall) {
  const s = (tall && el.dataset.tdOrbitTall) || el.dataset.tdOrbit;
  const [a, b] = (s || '').split('-').map(Number);
  const lo = Math.max(1, Math.min(TD_ORBIT, a || 1)), hi = Math.max(lo, Math.min(TD_ORBIT, b || TD_ORBIT));
  return [lo, hi];
}
/* playhead inside the range's own stream (0 … n−1) */
export const tdOrbitFrame = (ph, n = TD_ORBIT) => ph.orbit * (n - 1);
/* explode playhead; xmap (data-td-xmap="e f e f …", explode progress → frame fraction, piecewise linear) re-times a
   render whose camera moves mid-explode (the mic's pushes in on the capsule: crossed quickly, so the whole mic is
   back while its rows light) */
export function tdExplodeFrame(ph, xmap) {
  let e = ph.explode;
  if (xmap) {
    for (let i = 2; i < xmap.length; i += 2) {
      if (e <= xmap[i] || i === xmap.length - 2) { const t = (e - xmap[i - 2]) / Math.max(1e-6, xmap[i] - xmap[i - 2]); e = xmap[i - 1] + (xmap[i + 1] - xmap[i - 1]) * Math.max(0, Math.min(1, t)); break; }
    }
  }
  return e * (TD_EXPLODE - 1);
}

/* framing: "zoom shiftX shiftY" (shift in frame-uv units, +x samples further right, +y further up) */
const parse = (s, d) => {
  if (!s) return { ...d };
  const [z, x, y] = s.trim().split(/\s+/).map(Number);
  return { z: z || d.z, x: x || 0, y: y || 0 };
};
/* three keys: hero (the full-screen orbit), frame0 (the column, as the hand-off lands: the whole device, big) and
   frame (the column, fully exploded): the view pulls back from frame0 to frame as the parts spread */
const box = (s) => (s ? s.trim().split(/\s+/).map(Number) : null);
export function tdFraming(el, tall) {
  const d = el.dataset;
  const frame = parse((tall && d.tdFrameTall) || d.tdFrame, { z: tall ? 1.3 : 1.1, x: 0, y: 0 });
  const frame0 = parse((tall && d.tdFrame0Tall) || d.tdFrame0, frame);
  const hero = parse((tall && d.tdHeroTall) || d.tdHero, { z: tall ? 1.6 : 1.3, x: 0, y: 0 });
  const name = (d.scene || '').split(':')[1];
  // bleed: how far (fraction of the pin's width) the device may run past the viewport's side edges in the column phase
  const bleed = parseFloat((tall && d.tdBleedTall) || d.tdBleed) || 0;
  const xmap = box(d.tdXmap);
  return { hero, frame0, frame, tall, bleed, xmap: xmap && xmap.length >= 4 ? xmap : null, hbox: box(d.tdBox), pbox: box(d.tdPbox), ext: TD_EXT[name] || null, col: null };
}

/* the device's extent in the explode frames (u0 v0 u1 v1, every 4th frame, measured from the renders): the parts
   spread at the render's own pace (and the mic's and the mixer's renders push in mid-way), so the column zoom
   follows this, frame by frame, and the device never leaves the column slot (never under the copy). */
export const TD_EXT = {
  camera: [0.147,0.148,0.845,0.861,0.147,0.148,0.845,0.861,0.148,0.15,0.851,0.859,0.149,0.152,0.861,0.857,0.141,0.152,0.877,0.857,0.124,0.156,0.894,0.854,0.105,0.157,0.91,0.85,0.084,0.159,0.925,0.846,0.065,0.161,0.938,0.841,0.047,0.165,0.947,0.835,0.033,0.167,0.954,0.83,0.021,0.169,0.958,0.824,0.013,0.167,0.963,0.819,0.006,0.141,0.965,0.828,0.003,0.1,0.967,0.869,0.003,0.07,0.968,0.9,0.003,0.056,0.969,0.922,0.004,0.054,0.969,0.933,0.004,0.057,0.97,0.935,0.005,0.063,0.97,0.931,0.006,0.067,0.97,0.928,0.008,0.07,0.969,0.924,0.01,0.074,0.969,0.92,0.013,0.076,0.968,0.919,0.015,0.08,0.968,0.915,0.017,0.083,0.967,0.911,0.019,0.087,0.966,0.909,0.02,0.089,0.965,0.906,0.022,0.091,0.963,0.904,0.024,0.096,0.961,0.9,0.026,0.098,0.96,0.898,0.028,0.102,0.958,0.896,0.029,0.104,0.957,0.894,0.031,0.106,0.956,0.893,0.032,0.107,0.955,0.891,0.033,0.109,0.954,0.889,0.034,0.109,0.953,0.889],
  mixer: [0.108,0.183,0.907,0.85,0.108,0.183,0.907,0.848,0.11,0.181,0.906,0.85,0.113,0.176,0.903,0.854,0.117,0.17,0.9,0.859,0.12,0.161,0.896,0.867,0.124,0.148,0.891,0.878,0.127,0.133,0.884,0.891,0.13,0.117,0.877,0.907,0.133,0.096,0.87,0.924,0.138,0.078,0.861,0.941,0.141,0.057,0.852,0.956,0.145,0.037,0.843,0.969,0.15,0.02,0.834,0.98,0.154,0.006,0.825,0.987,0.161,0,0.817,0.993,0.167,0,0.809,0.996,0.173,0,0.804,0.998,0.18,0,0.799,0.996,0.186,0,0.794,0.993,0.193,0,0.79,0.989,0.199,0.002,0.785,0.985,0.204,0.013,0.782,0.981,0.208,0.022,0.778,0.978,0.214,0.03,0.777,0.972,0.217,0.037,0.774,0.97,0.22,0.041,0.772,0.967,0.223,0.044,0.77,0.965,0.224,0.048,0.769,0.961,0.225,0.05,0.768,0.959,0.226,0.05,0.768,0.959,0.226,0.052,0.767,0.957,0.226,0.052,0.767,0.957,0.226,0.052,0.767,0.957,0.226,0.052,0.767,0.957,0.226,0.052,0.767,0.957,0.226,0.052,0.767,0.957],
  mic: [0.16,0.139,0.856,0.869,0.161,0.139,0.856,0.869,0.161,0.139,0.856,0.869,0.16,0.139,0.871,0.881,0.155,0.131,0.956,0.937,0.158,0.124,1,1,0.169,0.119,1,1,0.184,0.115,1,1,0.2,0.111,1,1,0.209,0.109,1,1,0.205,0.104,1,1,0.188,0.098,1,1,0.158,0.087,1,1,0.122,0.076,1,1,0.083,0.063,1,1,0.045,0.05,1,1,0.013,0.041,1,1,0,0.031,1,1,0,0.028,1,1,0,0.024,1,1,0,0.022,1,1,0,0.022,1,1,0,0.026,1,1,0,0.03,1,1,0,0.033,1,1,0.014,0.041,1,0.998,0.029,0.044,1,0.978,0.043,0.048,0.983,0.965,0.052,0.052,0.971,0.956,0.058,0.056,0.96,0.952,0.064,0.057,0.954,0.948,0.068,0.059,0.95,0.948,0.07,0.059,0.949,0.943,0.071,0.059,0.948,0.943,0.071,0.059,0.948,0.943,0.071,0.059,0.948,0.943,0.071,0.059,0.948,0.943],
  headphones: [0.31,0.076,0.703,0.913,0.31,0.076,0.703,0.913,0.31,0.076,0.703,0.913,0.292,0.074,0.727,0.913,0.233,0.065,0.776,0.913,0.195,0.052,0.811,0.913,0.17,0.048,0.834,0.913,0.152,0.046,0.852,0.913,0.138,0.046,0.866,0.913,0.126,0.046,0.877,0.913,0.117,0.046,0.886,0.913,0.109,0.046,0.895,0.913,0.104,0.046,0.902,0.913,0.1,0.046,0.907,0.913,0.096,0.046,0.912,0.913,0.092,0.046,0.917,0.913,0.084,0.046,0.921,0.913,0.074,0.046,0.924,0.913,0.065,0.046,0.926,0.913,0.057,0.046,0.928,0.913,0.051,0.046,0.93,0.913,0.047,0.046,0.932,0.913,0.043,0.046,0.936,0.913,0.04,0.046,0.94,0.913,0.036,0.046,0.942,0.913,0.035,0.046,0.944,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913,0.033,0.046,0.946,0.913],
  phone: [0.259,0.078,0.728,0.93,0.259,0.078,0.728,0.93,0.259,0.078,0.728,0.93,0.259,0.078,0.728,0.93,0.258,0.078,0.728,0.93,0.252,0.078,0.729,0.93,0.241,0.076,0.728,0.93,0.222,0.07,0.728,0.93,0.2,0.069,0.743,0.93,0.174,0.067,0.776,0.93,0.145,0.067,0.816,0.937,0.122,0.067,0.852,0.954,0.098,0.067,0.879,0.965,0.083,0.067,0.902,0.97,0.074,0.067,0.921,0.972,0.071,0.067,0.927,0.972,0.071,0.067,0.927,0.972,0.071,0.067,0.927,0.972,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974,0.071,0.067,0.928,0.974,0.071,0.067,0.927,0.972,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.972,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.972,0.071,0.067,0.927,0.972,0.071,0.067,0.927,0.972,0.071,0.067,0.927,0.974,0.071,0.067,0.927,0.974],
};
function extAt(E, f, out) {
  const n = E.length / 4 - 1, x = Math.max(0, Math.min(n, f / 4)), i = Math.min(n - 1, Math.floor(x)), t = x - i;
  for (let k = 0; k < 4; k++) out[k] = E[i * 4 + k] + (E[(i + 1) * 4 + k] - E[i * 4 + k]) * t;
  return out;
}
/* the column slot for the fit: its size, and how far (px) the device may run past each of its edges
   (desktop: to the viewport's right and bottom edges, plus the run's bleed off the right edge, never left into the
   copy; phones: off both sides by the bleed, never down into the copy) */
export function tdFit(F, col, pinW, pinH) {
  const bl = F.bleed * pinW;
  F.col = {
    w: col.w, h: col.h, l: F.tall ? bl : 0, t: 0,
    r: F.tall ? 2 + bl : Math.max(0, pinW - (col.x + col.w) - 4) + bl,
    b: F.tall ? 0 : Math.max(0, pinH - (col.y + col.h) - 6),
  };
  return F;
}
const EB = [0, 0, 1, 1];
function fitZoom(F, f, sx, sy) {
  const C = F.col, e = F.ext ? extAt(F.ext, f, EB) : null;
  if (!C || !e) return Infinity;
  const c = tdContain(C.w, C.h);
  let z = Infinity;
  const lim = (room, reach, size) => { if (reach > 1e-4) z = Math.min(z, room / (reach * size)); };
  lim(C.w / 2 + C.l, 0.5 + sx - e[0], c.w);     // left
  lim(C.w / 2 + C.r, e[2] - 0.5 - sx, c.w);     // right
  lim(C.h / 2 + C.t, 0.5 - sy - e[1], c.h);     // top
  lim(C.h / 2 + C.b, e[3] - 0.5 + sy, c.h);     // bottom
  return z;
}
/* the frame transform at a phase: zoom + shift, exactly what the shader and the CSS stills use */
export function tdView(F, ph, out = {}) {
  const zh = F.hero.z * (1 + 0.04 * ph.orbit);
  const k = ph.explode;
  const fx = lerp(F.frame0.x, F.frame.x, k), fy = lerp(F.frame0.y, F.frame.y, k);
  // the column zoom: eased from frame0 to frame (plus the settle's slow push), but never more than the fit
  const fz = Math.min(lerp(F.frame0.z, F.frame.z, k) * (1 + 0.022 * ph.settle), fitZoom(F, tdExplodeFrame(ph, F.xmap), fx, fy));
  out.zoom = lerp(zh, fz, ph.hand);
  out.sx = lerp(F.hero.x, fx, ph.hand);
  out.sy = lerp(F.hero.y, fy, ph.hand);
  return out;
}
/* contain-fit size of the frame inside a w×h rect (before zoom) */
export function tdContain(w, h, aspect = TD_ASPECT) {
  return w / h > aspect ? { w: h * aspect, h } : { w, h: w / aspect };
}
/* frame uv (u right, v down, 0..1) → px inside the slot's parent, through the shader's transform
   (rect, contain, zoom, shift); d/push/pointer/strength: the settle's depth parallax, approximately */
export function tdProject(u, v, R, V, live, d = 0.5, out = {}) {
  const c = tdContain(R.w, R.h);
  let du = 0, dv = 0;
  if (live && (live.push || live.strength)) {
    // the shader samples p = uv + pointer·strength·(d−0.4) − (uv−0.5)·push·(d−0.3); a point moves by minus that
    du = -live.px * live.strength * (d - 0.4) + (u - 0.5) * live.push * (d - 0.3);
    dv = live.py * live.strength * (d - 0.4) + (v - 0.5) * live.push * (d - 0.3);
  }
  const z = V.zoom;
  out.x = R.x + R.w / 2 + (u + du - 0.5 - V.sx) * z * c.w;
  out.y = R.y + R.h / 2 + (v + dv - 0.5 + V.sy) * z * c.h;
  return out;
}
/* rect lerp (x, y, w, h) */
export function tdLerpRect(a, b, k, out = {}) {
  out.x = lerp(a.x, b.x, k); out.y = lerp(a.y, b.y, k); out.w = lerp(a.w, b.w, k); out.h = lerp(a.h, b.h, k);
  return out;
}

/* the sticky pin's top in the viewport (it rides in with the run, holds at 0, then rides out) */
export function tdPinTop(r, y, pinH) { return r.top - y + clamp(y - r.top, 0, Math.max(0, r.height - pinH)); }

/* per scene id, shared between the section and the scene each frame:
   - the section writes the slot's viewport rect (x, y, w, h) and the clock it was computed at (t), so the scene never
     measures the DOM in its frame;
   - the scene writes its live values (pointer, push) so DOM markers can ride the parallax. */
export const TD_LIVE = new Map();
export function tdLive(id) {
  let L = TD_LIVE.get(id);
  if (!L) TD_LIVE.set(id, (L = { px: 0, py: 0, push: 0, strength: 0, x: 0, y: 0, w: 0, h: 0, t: -1 }));
  return L;
}
