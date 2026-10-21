/* VI · Process: seven objects on a paper desk; the camera trucks along the row and the active one lifts toward you.
   One pure function of scroll (trackAt) drives three things that have to agree:
     - the WebGL scene (src/gl/scenes/objects.js): cut-out planes over a paper desk, contact shadows, the light;
     - a CSS-3D proxy of the very same desk (the list's images, same camera, same poses, same idle drift and wash): it
       is what you see while the pin's paper still covers the stage and until the objects scene has drawn. Where the
       stage renders well below the screen's pixel density (phones: the stage caps its dpr), it stays as the object
       layer for the whole run ("crisp" mode): WebGL then draws only the desk and the shadows, so the cut-outs stay
       as sharp as the type beside them;
     - the live caption: the active step's title + short line (F75/F76 … F93/F94) and a seven-step marker.
   The stage switches to the objects scene at a marker ~0.9 viewport into the run ([data-proc-scene]), so its
   dissolve from the posters happens under the pin's paper, and the paper clears only once that dissolve is done.
   v3 (phase 2): the caption carries each step's long line too, and the run is ≈2.8 screens. On the way out the row
   trucks on and the caption fades as the pin leaves; the desk is a sheet (data-wipe on the scene marker) whose torn
   bottom edge scrolls off chapter VII's stage (the Kit): the objects scene paints black under the edge
   (state.bottom) and the stage splits the two scenes there. The dense sheet of long lines is the static layout's.
   World units are CSS px on the plane z = 0 through the slot (the box the active object lifts into); the camera sits
   D px in front of the slot with an off-axis frustum, so the CSS perspective and the WebGL camera are one camera.
   The desk is a plane tilted back by `tau` and Zd px behind the slot plane; objects at rest lie flat on it.
   Static mode (no JS, ?tier=0, reduced motion): the list is a plain grid / list; nothing here runs. */
import './process.css';
import { onFrame, clamp, smooth, seg, idleFor, IDLE_LIFE } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { REDUCED, TIER } from '../core/env.js';
import { coverPlates } from './_paper.js';   // shared paper helper (read-only)

export const N = 7;
const HOLD = [0.3, 0.7];                                  // within each step: dwell, ease across, dwell
const LX = 0.12, LY = -0.15;                              // the key light's direction (toward the desk)
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/* how each object sits: f = width as a share of the slot (art-directed so the seven read at one visual weight),
   u/v = a little scatter along / across the desk (v in slot heights), h = resting height above the desk (slot
   widths: "slightly different depths"), rz = its turn on the desk (rad) */
const LOOK = [
  { f: 0.8, u: 0.0, v: 0.05, h: 0.012, rz: -0.075 },     // blank page
  { f: 0.92, u: 0.02, v: -0.06, h: 0.03, rz: 0.06 },     // moodboard
  { f: 0.86, u: -0.02, v: 0.06, h: 0.01, rz: -0.045 },   // storyboard
  { f: 0.66, u: 0.0, v: -0.05, h: 0.04, rz: 0.085 },     // clapperboard
  { f: 1.0, u: 0.03, v: 0.04, h: 0.055, rz: -0.06 },     // boom
  { f: 0.86, u: -0.01, v: -0.05, h: 0.022, rz: 0.045 },  // tablet
  { f: 0.76, u: 0.0, v: 0.04, h: 0.016, rz: -0.07 },     // instant photo
];

/* resolved once init() has read the objects (state.items): the objects scene waits for it before it loads (the chapter
   is set up only as the reader comes within two screens of it, src/main.js; the stage may mount the scene earlier) */
let markReady;
export const ready = new Promise((r) => { markReady = r; });

export const state = {
  items: [],          // { src, aspect, w, h } (w, h: size in world px when active)
  L: null,            // layout, measured on resize (see measure())
  y: NaN, ver: -1,
  pos: 0,             // track position: k when object k is active (float)
  lift: 0,            // 0 … 1: how far the active object may rise (0 while the pin arrives / leaves)
  active: 0, pinTop: 0, visible: false,
  e: 0,               // viewports since the pin stuck (negative while it arrives)
  cover: 1,           // the pin's own paper: 1 opaque … 0 clear (scroll part; the GL hand-over multiplies in)
  cap: 0,             // caption opacity
  bottom: 0,          // screen y of the chapter's bottom (the sheet tearing off onto the Kit's black stage)
  gl: false,          // the objects scene has drawn
  crisp: false,       // set by the scene: the DOM proxy stays the object layer (stage dpr well below the screen's)
  ptr: null,          // set by the scene: the stage's eased pointer (-1..1), for the active object's lean
  onGL: null,
};

/* scroll y -> track state (cached per y + layout version) */
export function trackAt(y) {
  const L = state.L;
  if (!L || (y === state.y && L.ver === state.ver)) return state;
  state.y = y; state.ver = L.ver;
  const g = geo(L.run), gs = geo(L.sec);
  const vh = L.vh, intro = L.intro;
  const span = Math.max(1, g.height - L.pinH);
  const into = y - g.top;
  const pinTop = into < 0 ? -into : (into > span ? span - into : 0);
  const r = clamp(clamp((into - intro) / Math.max(1, span - intro)) * N - 0.5, 0, N - 1);
  const i = Math.floor(r);
  const t = seg(r - i, HOLD[0], HOLD[1]);
  const arrive = smooth(seg(into, -vh, intro));          // the row trucks in as the sheet arrives
  const leave = smooth(seg(-pinTop, 0, vh));             // and on as the pin goes
  state.pos = i + smoother(t) - 0.6 * (1 - arrive) + 0.6 * leave;
  // the first object starts to rise while the sheet is still arriving, so the pin sticks on a living desk
  state.lift = smooth(seg(into, -vh * 0.3, intro * 0.75)) * (1 - smooth(seg(-pinTop, vh * 0.04, vh * 0.55)));
  state.pinTop = pinTop;
  state.e = into / vh;
  // the pin's paper clears once the stage has finished dissolving into the objects scene (L.c0, from the marker)
  state.cover = 1 - smooth(seg(state.e, L.c0, L.c0 + 0.24));
  // the caption comes up with the first object's lift (phase 4: it waited ~0.3 screen longer, a captionless first screen)
  state.cap = smooth(seg(into, -vh * 0.3, intro * 0.75)) * (1 - smooth(seg(-pinTop, vh * 0.06, vh * 0.4)));
  state.visible = pinTop < vh && pinTop > -L.pinH;
  state.active = clamp(Math.round(state.pos), 0, N - 1);
  state.bottom = gs.bottom - y;                            // the dense sheet's torn bottom edge on screen
  return state;
}

/* the active object's idle life (WebGL and the proxy share it): it breathes a little and leans toward a fine
   pointer. Adds to the pose from place(). */
export function drift(k, o, time, ptr) {
  const a = o.a, px = ptr ? ptr.x : 0, py = ptr ? ptr.y : 0;
  o.by = Math.sin(time * 0.8 + k) * 2.5 * a;
  o.bx = -py * 0.1 * a;
  o.bry = px * 0.16 * a;
  o.brz = Math.sin(time * 0.55 + k * 1.7) * 0.006 * a;
  return o;
}

/* object k at track position pos -> pose o (world px; Euler XYZ in three's y-up convention) */
export function place(k, pos, lift, o) {
  const L = state.L, it = state.items[k], lk = LOOK[k];
  const d = k - pos;
  const a = lift * smooth(clamp(1 - Math.abs(d) / 0.9));          // 1 = lifted into the slot, facing you
  // resting point on the desk: desk coords (u along the row, v up the desk, h above it) -> world
  const u = (d + lk.u) * L.S, v = lk.v * L.SH, h = lk.h * L.SW;
  const py = L.ct * v + L.st * h, pz = -L.Zd - L.st * v + L.ct * h;    // y, z of the resting point
  // the lift: from the resting point at d = 0 to the slot centre (the origin), carried along with the row
  const lu = lk.u * L.S;
  o.x = u - a * lu;
  o.y = py * (1 - a);
  o.z = pz * (1 - a);
  o.rx = -L.tau * (1 - a);
  o.ry = 0;
  o.rz = lk.rz * (1 - a);
  o.a = a;
  o.d = d;
  // far along the row the objects fade out (on a phone the row reads one object at a time: neighbours fade out
  // before the screen edge would cut them to a sliver); resting ones are washed toward the paper so they recede
  o.alpha = L.phone ? 1 - smooth(clamp((Math.abs(d) - 0.3) / 0.5)) : 1 - clamp((Math.abs(d) - 2.4) / 0.8);
  o.fog = Math.min(0.3, 0.12 + 0.07 * Math.max(0, Math.abs(d) - 1)) * (1 - a);
  // height above the desk (for the shadow's blur) and where its shadow falls: the key light sits near the camera,
  // a little up and to the left, so a lifted object's shadow lands just behind it, down and to the right
  const hh = Math.max(0, o.y * L.st + (o.z + L.Zd) * L.ct);           // dot(p - P0, n)
  const t = hh / (L.ct - LY * L.st);                                  // along (LX, LY, -1) to the desk
  const qy = o.y + LY * t, qz = o.z - t;
  o.h = hh;
  o.su = o.x + LX * t;
  o.sv = qy * L.ct - (qz + L.Zd) * L.st;                              // dot(q - P0, ev)
  o.w = it.w; o.hgt = it.h;
  return o;
}

export function init() {
  const sec = document.getElementById('process');
  if (!sec) return;
  const run = sec.querySelector('[data-proc-run]');
  const pin = sec.querySelector('[data-proc-pin]');
  const list = sec.querySelector('[data-proc-list]');
  const lis = [...list.children];
  state.items = lis.map((li) => {
    const img = li.querySelector('img');
    return { src: img.getAttribute('src'), aspect: +img.getAttribute('height') / +img.getAttribute('width'), w: 1, h: 1 };
  });
  markReady();
  if (!(TIER > 0 && !REDUCED)) { coverPlates(sec); return; }   // static: the calm grid (the plate is hidden while it covers)

  /* ── animated: the pinned run ─────────────────────────────────────────── */
  sec.classList.add('proc-on');
  // v3: the dense sheet is the static layout's; here it stays only for screen readers (the live caption carries the
  // long lines), so it no longer covers the stage, and the desk itself is the sheet that tears off onto the Kit
  sec.querySelector('.proc-more')?.removeAttribute('data-opaque');
  const slot = sec.querySelector('[data-proc-slot]');
  const bg = sec.querySelector('[data-proc-bg]');
  const scn = sec.querySelector('[data-proc-scene]');
  const capEl = sec.querySelector('[data-proc-cap]');
  const caps = [...sec.querySelectorAll('[data-proc-items] > *')];
  const ticks = sec.querySelector('[data-proc-ticks]');
  const objs = lis.map((li) => li.querySelector('.proc-step__obj'));
  // each cut-out fades in once its image has arrived (a reader can land deep in the run before they have)
  const imgs = objs.map((ob) => ob.querySelector('img'));
  imgs.forEach((im) => {
    const done = () => im.classList.add('is-in');
    if (im.complete) done(); else { im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true }); }
  });
  const rail = document.querySelector('.rail');
  const o = {};
  let lastY = NaN, lastVer = -1, lastK = -1, lastCrisp = null, lastCover = '', lastList = '', lastCap = [], lastMark = '';
  const lastT = [], lastZ = [], lastL = [], lastF = [], lastA = [];
  let shown = false, glK = 0, glFrom = 0;                                  // the one-time hand-over from the proxy to WebGL
  let srcOn = false;                                                       // the wash's masks: set once the run is near

  function measure() {
    const pr = pin.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    if (!sr.height) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const SW = sr.width, SH = sr.height;
    const cx = sr.left - pr.left + SW / 2, cy = sr.top - pr.top + SH / 2;
    const phone = vw < 720;
    const tau = phone ? 0.52 : 0.6;
    const shrink = phone ? 0.64 : 0.6;                     // a resting object's scale against the lifted one
    const D = pr.height * (phone ? 1.9 : 1.75);
    const Zd = D * (1 / shrink - 1);
    // neighbours: on a phone they fade out before the screen edge (see place()); on wide screens the row reads three across
    const sp = phone ? SW * 0.5 + SW * 0.42 * shrink + 26 : SW * 0.5 + SW * 0.44 * shrink + Math.min(80, vw * 0.045);
    const railW = rail ? rail.offsetWidth : 0;
    const edge = phone ? [0, 6, vw - 6, vw]
      : railW ? [railW * 0.55, railW + 36, vw - 70, vw - 2]
      : [0, vw * 0.06, vw * 0.94, vw];
    // the stage's dissolve into this scene ends when the marker is 0.1 viewport above the reading line (the stage
    // dissolves over ±0.4 viewport around the centre): e = (marker - 0.1 vh) / vh; the paper clears just after
    const c0 = (scn ? scn.offsetTop : vh * 0.92) / vh - 0.1 + 0.02;
    state.L = {
      run, sec, ver: (state.L?.ver ?? 0) + 1, vw, vh, pinH: pr.height, cx, cy, SW, SH, phone,
      D, Zd, tau, st: Math.sin(tau), ct: Math.cos(tau), S: sp / shrink, shrink, edge, c0,
      intro: parseFloat(getComputedStyle(run).getPropertyValue('--proc-intro')) / 100 * pr.height || vh * 0.4,
    };
    state.items.forEach((it, k) => {
      it.w = Math.min(SW * LOOK[k].f, (SH * 0.98) / it.aspect);
      it.h = it.w * it.aspect;
    });
    list.style.perspective = `${D}px`;
    list.style.perspectiveOrigin = `${cx}px ${cy}px`;
    list.style.setProperty('--l0', `${edge[0]}px`); list.style.setProperty('--l1', `${edge[1]}px`);
    list.style.setProperty('--r0', `${edge[2]}px`); list.style.setProperty('--r1', `${edge[3]}px`);
    lis.forEach((li, k) => {
      const it = state.items[k];
      li.style.width = `${it.w}px`; li.style.height = `${it.h}px`;
      li.style.left = `${cx - it.w / 2}px`; li.style.top = `${cy - it.h / 2}px`;
    });
    lastY = NaN;
  }
  // measured at once (a chapter set up late, as the reader arrives, must not show its proxy unplaced for a frame), and
  // again after the next layout
  measure();
  requestAnimationFrame(measure);
  onLayout(measure);

  const glOn = () => state.gl && document.documentElement.classList.contains('gl-ready');
  state.onGL = () => sec.classList.add('is-gl');
  const f2 = (n) => n.toFixed(2), f4 = (n) => n.toFixed(4);

  onFrame((v) => {
    if (!state.L) return;
    if (!srcOn) {   // the wash masks its paper with the cut-out itself; CSS masks load even unseen, so only when near
      const g = geo(run);
      if (g.top - v.y < 2 * v.vh && g.bottom - v.y > -v.vh) {
        objs.forEach((ob, k) => ob.style.setProperty('--src', `url("${state.items[k].src}")`));
        imgs.forEach((im) => { im.loading = 'eager'; });
        sec.classList.add('has-src'); srcOn = true;
      }
    }
    trackAt(v.y);
    // the hand-over: once WebGL has drawn the desk, the pin's paper and the proxy clear together (scroll-driven),
    // and if WebGL arrives mid-run, they ease out once over half a second. In crisp mode only the paper (and the
    // proxy's own CSS shadows) clear: the proxy stays as the object layer over the WebGL desk and shadows.
    const on = glOn();
    if (on && glK < 1) { const now = performance.now(); if (!glFrom) glFrom = now; glK = Math.min(1, (now - glFrom) / 500); }
    if (!on) { glK = 0; glFrom = 0; }
    const crisp = on && state.crisp;
    const moved = v.y !== lastY || state.ver !== lastVer || glK !== lastK || crisp !== lastCrisp;
    if (!state.visible) { lastY = v.y; lastVer = state.ver; lastK = glK; lastCrisp = crisp; return; }
    const cover = 1 - glK * (1 - state.cover);
    const proxy = crisp || cover > 0.002;
    // between scroll changes only the active object's idle drift moves, and only while the proxy is the one drawn
    if (!moved && !(proxy && state.lift > 0 && idleFor() < IDLE_LIFE)) return;   // (the drift rests after 10 s idle)
    lastY = v.y; lastVer = state.ver; lastK = glK; lastCrisp = crisp;

    const cs = f2(cover);
    if (cs !== lastCover) { bg.style.opacity = cs; lastCover = cs; }
    const ls = `${crisp ? '1.00' : cs}|${crisp ? cs : '1.00'}|${crisp && cover <= 0.002}`;
    if (ls !== lastList) {
      lastList = ls;
      list.style.opacity = crisp ? '1' : cs;
      list.style.setProperty('--sh', crisp ? cs : '1');                   // the proxy's CSS shadows give way to WebGL's
      sec.classList.toggle('is-crisp', crisp && cover <= 0.002);
    }
    for (let k = 0; proxy && k < N; k++) {
      place(k, state.pos, state.lift, o);
      drift(k, o, v.time, state.ptr);
      // CSS is y-down: translate y and the X / Z turns flip sign; Y turns do not
      const t = `translate3d(${f2(o.x)}px,${f2(-(o.y + o.by))}px,${f2(o.z)}px) rotateX(${f4(-(o.rx + o.bx))}rad) rotateY(${f4(o.ry + o.bry)}rad) rotateZ(${f4(-(o.rz + o.brz))}rad)`;
      if (t !== lastT[k]) { lastT[k] = t; lis[k].style.transform = t; }
      const z = String(10 + Math.round(o.a * 50) + Math.round(o.z / 20));
      if (z !== lastZ[k]) { lastZ[k] = z; lis[k].style.zIndex = z; }
      const l = f2(o.a), f = f2(o.fog), al = f2(o.alpha);
      if (l !== lastL[k]) { lastL[k] = l; objs[k].style.setProperty('--lift', l); }
      if (f !== lastF[k]) { lastF[k] = f; objs[k].style.setProperty('--fog', f); }
      if (al !== lastA[k]) { lastA[k] = al; lis[k].style.opacity = al; }
    }
    if (!shown) { sec.classList.add('is-measured'); shown = true; }
    // the caption: each step's title + long line crossfades with its neighbour's in the middle of the ease (out over
    // |dk| 0.38 → 0.62, in over 0.62 → 0.38), so the nearest step always shows at 0.5 or more: no dead zone between
    // steps. The two part vertically as they cross (±34 px), and the ease spends little time there
    for (let k = 0; k < N; k++) {
      const dk = state.pos - k;
      const a = state.cap * (1 - smooth(seg(Math.abs(dk), 0.38, 0.62)));
      const s = `${f2(a)}|${f2(clamp(dk, -1, 1))}`;
      if (s !== lastCap[k]) {
        lastCap[k] = s;
        caps[k].style.opacity = f2(a);
        caps[k].style.transform = `translate3d(0,${f2(-clamp(dk, -1, 1) * 34)}px,0)`;
        caps[k].style.visibility = a > 0.002 ? 'visible' : 'hidden';
      }
    }
    const mark = `${f4(clamp(state.pos / (N - 1)))}|${f2(state.cap)}`;
    if (mark !== lastMark) {
      ticks.style.setProperty('--at', f4(clamp(state.pos / (N - 1))));
      capEl.style.setProperty('--cap', f2(state.cap));
      lastMark = mark;
    }
  });
}
