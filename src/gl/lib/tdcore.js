/* Teardown choreography, shared by the scene (gl/scenes/teardowns.js) and the section (sections/_teardown.js),
   so the WebGL frame, the CSS stills, the colour keys, the construction lines and the part markers all follow one
   clock. Pure functions of scroll and of the markup's data; nothing here knows how a device is drawn (frame streams
   today; real-time 3D or video in phase 3 only has to answer "show device d at orbit o / explode e, framed so").
   No three.js in here (the section bundle imports it).

   A run is one pinned block ([data-td-run]) showing a list of shots, one device each: the elements marked
   [data-td-shot] in the run's section (the Kit: console, microphone, headphones, phone), or the section itself (Method:
   the camera). Each shot's data sits on its element: data-td-dev (the device), data-td-hero / data-td-frame0 /
   data-td-frame (framing, "zoom shiftX shiftY"), data-td-box / data-td-pbox (its extent, uv), data-td-xmap (explode
   re-timing), data-td-key ("centre edge": its colour key; none = the black stage).
     shot 0   orbit      the device fills the screen while the view travels around it (the chapter title over it)
              hand-off   it glides from the whole viewport into the column; its colour key comes up
              junction   the orbit's last frame crossfades into the explode's first (the same picture)
              explode    it comes apart beside its copy, rows lighting in step
              settle     depth parallax and a slow push; the part markers draw in
     shot k   cut        a wipe in shot k's colour: the previous device and its copy leave, this one arrives whole
              explode, settle (as above)
   Times are screens of scroll since the pin's top met the viewport top (s; negative while the run arrives), from a
   plan drawn for a pin span of plan.L screens and scaled to the run's measured span (the pre-roll is not scaled),
   so the run's CSS height (--td-run, phones --td-run-m) is the only length to tune.
   Leaving: a run marked data-wipe is a sheet that scrolls off the next scene (the stage splits the two at the
   boundary, feathered; gl/stage.js), so its device rides up with its copy and never fades. A run marked
   data-td-open opens a chapter out of paper: its device is lit early, under the paper's edge. */
import { clamp, lerp, smooth, seg } from '../../core/scroll.js';
import { geo } from '../../core/layout.js';

export const TD_ORBIT = 97;     // orbit renders: source frames 1 … 97 (far angle → hero angle, constant visual speed)
export const TD_EXPLODE = 145;  // explode renders: 1 … 145 (hero angle → fully exploded)
export const TD_ASPECT = 16 / 9;

/* the plans (screens). single: one device with its orbit (Method); seq: an orbit and then cuts (the Kit). */
export const TD_PLAN = {
  single: { L: 2.3, first: { orbit: [-0.45, 0.83], hand: [0.62, 1.04], junction: [0.82, 0.86], explode: [1.04, 1.98], settle: [1.98, 2.23] } },
  seq: {
    L: 4.2,
    first: { orbit: [-0.45, 0.62], hand: [0.45, 0.85], junction: [0.6, 0.64], explode: [0.85, 1.27], settle: [1.27, 1.45] },
    cut: 0.22, whole: 0.08, explode: 0.42, settle: 0.18,
  },
};

const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/* run geometry → s (screens since the pin's top met the viewport top) and L (the pin's span, screens) */
export function tdRun(run, y, vh) {
  const g = geo(run);
  return { s: (y - g.top) / Math.max(1, vh), L: Math.max(0.01, (g.height - vh) / Math.max(1, vh)), top: g.top, height: g.height };
}
/* how a run meets its neighbours: open (lit early under the paper before it), wout (leaves as a wiping sheet) */
export function tdFlags(el) {
  return { open: el.hasAttribute('data-td-open'), wout: el.hasAttribute('data-wipe') };
}
/* the shots of a run's section, in order */
export function tdShots(section) {
  const l = [...section.querySelectorAll('[data-td-shot]')];
  return l.length ? l : [section];
}
/* the device a shot shows */
export function tdDev(shotEl, section) {
  return shotEl.dataset.tdDev || section.dataset.tdDev || (section.dataset.scene || '').split(':')[1] || '';
}

/* the run's timeline: one entry per shot, every phase as [from, to] in screens */
export function tdTimeline(n, L, plan = n > 1 ? TD_PLAN.seq : TD_PLAN.single) {
  const k = L / plan.L, sc = (t) => (t < 0 ? t : t * k), m = (a) => a.map(sc);
  const f = plan.first;
  const T = [{ orbit: m(f.orbit), hand: m(f.hand), junction: m(f.junction), explode: m(f.explode), settle: m(f.settle), cut: null }];
  let t = f.settle[1];
  for (let i = 1; i < n; i++) {
    const c = [t, t + plan.cut], e0 = c[1] + plan.whole, e = [e0, e0 + plan.explode], st = [e[1], e[1] + plan.settle];
    T.push({ cut: m(c), explode: m(e), settle: m(st), orbit: null, hand: null, junction: null });
    t = st[1];
  }
  return T;
}

/* one shot's phases at s: { orbit, hand, handLin, mix, explode, explodeLin, settle } (0 … 1) */
export function tdShotPhases(t, s, out = {}) {
  if (t.orbit) {
    const o = seg(s, t.orbit[0], t.orbit[1]);
    out.orbit = 0.72 * o + 0.28 * easeSine(o);   // the orbit renders are re-timed to constant speed: ease only the ends
    out.handLin = seg(s, t.hand[0], t.hand[1]);
    out.hand = easeIO(out.handLin);
    out.mix = smooth(seg(s, t.junction[0], t.junction[1]));
  } else { out.orbit = 1; out.hand = 1; out.handLin = 1; out.mix = 1; }
  out.explodeLin = seg(s, t.explode[0], t.explode[1]);
  out.explode = easeSine(out.explodeLin);
  out.settle = smooth(seg(s, t.settle[0], t.settle[1]));
  return out;
}

/* the run's state at s: k (the shot on screen; during a cut, the one leaving), ph (its phases), cut (0 … 1: the wipe
   to shot k + 1), phN (the incoming shot's phases), fade (arrival × exit) */
export function tdState(s, T, L, fl, out = { ph: {}, phN: {} }) {
  let k = 0;
  for (let i = 1; i < T.length; i++) if (s >= T[i].cut[1]) k = i;
  out.k = k; out.s = s;
  const nx = T[k + 1];
  out.cut = nx ? seg(s, nx.cut[0], nx.cut[1]) : 0;
  tdShotPhases(T[k], s, out.ph);
  if (nx) tdShotPhases(nx, s, out.phN);
  const fin = fl.open ? smooth(seg(s, -1.0, -0.5)) : smooth(seg(s, -0.5, -0.12));
  const fout = fl.wout ? 1 : 1 - smooth(seg(s, L + 0.25, L + 0.48));
  out.fade = fin * fout;
  return out;
}

/* playheads, in source frames (0-based floats): the scene maps them onto whatever it streams (a frame map, a video) */
export const tdOrbitFrame = (ph) => ph.orbit * (TD_ORBIT - 1);
/* explode playhead; xmap (data-td-xmap="e f e f …", explode progress → frame fraction, piecewise linear) re-times a
   render whose parts spread unevenly (most fly in the first half of the render: played at an even pace) or whose
   camera moves mid-explode (the mic's pushes in on the capsule: crossed quickly) */
export function tdExplodeFrame(ph, xmap) {
  let e = ph.explode;
  if (xmap) {
    for (let i = 2; i < xmap.length; i += 2) {
      if (e <= xmap[i] || i === xmap.length - 2) { const t = (e - xmap[i - 2]) / Math.max(1e-6, xmap[i] - xmap[i - 2]); e = xmap[i - 1] + (xmap[i + 1] - xmap[i - 1]) * Math.max(0, Math.min(1, t)); break; }
    }
  }
  return e * (TD_EXPLODE - 1);
}
/* a source frame (0-based float) → the index (float) in a frame map (sorted source frames, 1-based as set.json has
   them), piecewise linear between kept frames */
export function tdIndex(map, f) {
  if (!map) return f;
  const g = f + 1, n = map.length - 1;
  if (g <= map[0]) return 0;
  if (g >= map[n]) return n;
  let lo = 0, hi = n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (map[m] <= g) lo = m; else hi = m; }
  return lo + (g - map[lo]) / (map[hi] - map[lo]);
}

/* framing: "zoom shiftX shiftY" (shift in frame-uv units, +x samples further right, +y further up) */
const parse = (s, d) => {
  if (!s) return { ...d };
  const [z, x, y] = s.trim().split(/\s+/).map(Number);
  return { z: z || d.z, x: x || 0, y: y || 0 };
};
const nums = (s) => (s ? s.trim().split(/\s+/).map(Number) : null);
/* a colour key "#rrggbb #rrggbb" (centre, edge) → [r, g, b, r, g, b] (0 … 1), or null (the black stage) */
export function tdKey(s) {
  const m = (s || '').match(/#[0-9a-f]{6}/gi);
  if (!m || m.length < 2) return null;
  return m.slice(0, 2).flatMap((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
}
/* three framing keys: hero (the full-screen orbit), frame0 (the column, as the device lands: whole, big) and frame
   (the column, fully exploded): the view pulls back from frame0 to frame as the parts spread */
export function tdFraming(el, tall, dev = '') {
  const d = el.dataset;
  const frame = parse((tall && d.tdFrameTall) || d.tdFrame, { z: tall ? 1.3 : 1.1, x: 0, y: 0 });
  const frame0 = parse((tall && d.tdFrame0Tall) || d.tdFrame0, frame);
  const hero = parse((tall && d.tdHeroTall) || d.tdHero, { z: tall ? 1.6 : 1.3, x: 0, y: 0 });
  // bleed: how far (fraction of the pin's width) the device may run past the viewport's side edges in the column phase
  const bleed = parseFloat((tall && d.tdBleedTall) || d.tdBleed) || 0;
  const xmap = nums(d.tdXmap);
  return { hero, frame0, frame, tall, bleed, xmap: xmap && xmap.length >= 4 ? xmap : null, hbox: nums(d.tdBox), pbox: nums(d.tdPbox), ext: TD_EXT[dev] || null, key: tdKey(d.tdKey), col: null };
}

/* the device's extent in the explode frames (u0 v0 u1 v1, every 4th frame, measured from the renders): the parts
   spread at the render's own pace (and the mic's and the mixer's renders push in mid-way), so the column zoom
   follows this, frame by frame, and the device never leaves the column slot (never under the copy). Method's camera
   is real-time 3D now (gl/scenes/camera3d.js): its stills fit by their own framing keys, so it has no table here. */
export const TD_EXT = {
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
   - the section writes the slot's viewport rect (x, y, w, h) and the frame number it was computed at (f: view.frame),
     plus the framing it fitted to the measured column (Fs, per shot), so the scene never measures the DOM in its frame;
   - the scene writes its live values (pointer, push) so DOM markers can ride the parallax. */
export const TD_LIVE = new Map();
export function tdLive(id) {
  let L = TD_LIVE.get(id);
  if (!L) TD_LIVE.set(id, (L = { px: 0, py: 0, push: 0, strength: 0, x: 0, y: 0, w: 0, h: 0, f: -1, Fs: null }));
  return L;
}
