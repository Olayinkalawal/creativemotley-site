/* Teardown choreography, shared by the scenes (gl/scenes/camera3d.js, kit3d.js) and the section (sections/_teardown.js),
   so the WebGL frame, the CSS stills, the colour keys, the construction lines and the part markers all follow one
   clock. Pure functions of scroll and of the markup's data; nothing here knows how a device is drawn (real-time 3D today:
   gl/scenes/camera3d.js, gl/scenes/kit3d.js, which also share the rules at the end of this file; the photoreal frame
   streams of gl/scenes/teardowns.js before: each only has to answer "show device d at orbit o / explode e, framed so").
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

/* how far along from the orbit's start key to its hero key the real-time views are at orbit o (the runtimes' pace over
   the orbit with this file's re-timing inverted: gl/lib/camera3d.js, kit3d.js) */
const pace = (u) => (0.5 * u + 0.5 * (1 - Math.cos(Math.PI * u)) / Math.PI) / (0.5 + 1 / Math.PI);
export function tdOrbitPace(y) {
  if (y <= 0 || y >= 1) return clamp(y);
  let o = y;
  for (let i = 0; i < 3; i++) { const f = 0.72 * o + 0.28 * easeSine(o) - y, df = 0.72 + 0.14 * Math.PI * Math.sin(Math.PI * o); o = clamp(o - f / df); }
  return pace(o);
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
  // startK: the 3D view's fill at the orbit's start key over its fill at the hero key (data-td-hero-start, -tall), so the
  // hero still shrinks with the 3D over the orbit and a stand-in on a jump into it is the size the device draws at
  const startK = parseFloat((tall && d.tdHeroStartTall) || d.tdHeroStart) || 0;
  // bleed: how far (fraction of the pin's width) the device may run past the viewport's side edges in the column phase
  const bleed = parseFloat((tall && d.tdBleedTall) || d.tdBleed) || 0;
  const xmap = nums(d.tdXmap);
  return { hero, frame0, frame, tall, bleed, startK, xmap: xmap && xmap.length >= 4 ? xmap : null, hbox: nums(d.tdBox), pbox: nums(d.tdPbox), ext: TD_EXT[dev] || null, key: tdKey(d.tdKey), col: null };
}

/* the device's extent in the explode frames (u0 v0 u1 v1, every 4th frame, measured from the renders): for a run drawn
   from photoreal frame streams (gl/scenes/teardowns.js), whose parts spread at the render's own pace, so the column
   zoom follows it frame by frame and the device never leaves the column slot. No run streams frames today: Method's
   camera and the Kit's four devices are real-time 3D (gl/scenes/camera3d.js, gl/scenes/kit3d.js), and their stills fit
   by their own framing keys, so the table is empty (the Kit's four photoreal tables went with their frame sets). */
export const TD_EXT = {};
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
  const zh = F.hero.z * (F.startK ? lerp(F.startK, 1, tdOrbitPace(ph.orbit)) : 1) * (1 + 0.04 * ph.orbit);
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

/* ── the real-time teardown scenes' shared rules (gl/scenes/camera3d.js: Method's camera; gl/scenes/kit3d.js: the Kit's
   four devices), so both behave alike ───────────────────────────────────────────────────────────────────────────── */
/* the markers draw in with the scroll, not all at once after it stops: an id pass (occlusion) every 0.025 of explode from
   0.93 (the runtimes trust a pass within 0.03 of their pose), one as the explode reaches 1 (parts still moving at 0.975
   cover anchors they leave), and every third of the settle (its push and drift). M: { e, s } per device; hold (the
   intro turn): no pass yet. True when a pass is due now. */
export function tdIdDue(M, e, sl, hold) {
  if (e < 0.93 || hold) { M.e = -1; M.s = -1; return false; }
  if (M.e < 0 || Math.abs(e - M.e) >= 0.025 || (e > 0.999 && M.e <= 0.999) || Math.abs(sl - M.s) >= 0.34) { M.e = e; M.s = sl; return true; }
  return false;
}
/* the intro: the first frame a device draws while its stand-in still is on screen starts at that still's pose (the hero
   key, or the exploded key: toEx) and turns into the scroll's pose as k (1 → 0, eased) runs down. Not in the first three
   quarters of an orbit (tdIntroTurn false): the hero still shows the orbit's end, so a turn from there would spin the
   device half round on a jump into the orbit (the chapter index lands at s = 0); the stills' dissolve hands over at the
   scroll's pose instead, the still sized like the view (tdView's startK) */
export const tdIntroTurn = (ph) => !(ph.orbit < 0.75);
export function tdIntroPose(ph, k, toEx, out) {
  Object.assign(out, ph);
  if (toEx) out.explode += (1 - out.explode) * k;
  else { out.orbit += (1 - out.orbit) * k; out.explode *= 1 - k; }
  return out;
}
export const TD_INTRO_MS = 900;
/* the stand-in: the given stills fetched now (parked in data-src, or loading="lazy", until the run is near), decoded and
   painted (two frames) before a GLB's parse, the studio bakes and the compile take the main thread and the GPU (at most
   2.5 s: a slow still never holds the device back) */
export async function tdStandIn(ims) {
  for (const im of ims) { if (!im.getAttribute('src') && im.dataset.src) im.src = im.dataset.src; im.loading = 'eager'; }
  const dec = ims.filter((im) => im.getAttribute('src')).map((im) => im.decode().catch(() => {}));
  if (!dec.length) return;
  await Promise.race([Promise.all(dec), new Promise((r) => setTimeout(r, 2500))]);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}
/* phones (the still path): the frame-rate governor stepped all the way down to "min" while a real-time device draws, so
   the scene gives up to its 3D stills for this visit (?q=… forces a quality for QA: no give-up) */
const QA_Q = typeof location !== 'undefined' && /[?&]q=/.test(location.search);
export const tdGiveUp = (ctx, stage) => !!ctx.still && !QA_Q && stage.quality === 'min';
/* pointer steps of 0.02 (< 0.07° of parallax): a resting mouse stops restarting the idle samples */
export const tdPointerStep = (v) => Math.round(v * 50) / 50;

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
