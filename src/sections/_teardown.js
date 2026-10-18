/* Teardown runs, the Editions Retail choreography (markup: partials/method.html, partials/kit.html; scene:
   gl/scenes/teardowns.js; the shared clock and framing math: gl/lib/tdcore.js).
     <section class="td [td--open]" data-td [data-td-open] data-scene="td:NAME" data-td-hero… data-td-frame… data-td-box…>
       <div class="td__run" data-td-run>               pinned for --td-run (phones: --td-run-m)
         <div class="td__pin">
           <div class="td__slot" data-td-slot>         where the frame is drawn; glides from the viewport to the column rect
             <img class="td__still td__still--hero">   stills: WebGL off, or until the scene has drawn
             <img class="td__still td__still--poster">
           <div class="td__target" data-td-target>     the column rect (CSS-defined, measured)
           <div class="td__fx" data-td-fx>             construction lines, degree ticker, part markers (built here)
           <header class="td__hero">                   opener runs: kicker + giant over the orbit
           <div class="td__copy">                      .td__intro (label + head) + ol.td__specs (li[data-anchor])
   Per frame, as pure functions of scroll (so scrolling back is exact): the slot rect, the stills' framing, the
   opener (rises in through its mask, drifts up and fades), the copy (runs 2+: its hero position glides to the
   column), head lines through their masks, spec rows (stagger in with the hand-off, light in step with the
   explode), the construction lines (drawn by --k via CSS), the ticker (turns with the orbit), the part markers.
   Style writes are diffed; rects are measured on layout only (the slot's rect is computed, never read here).
   Reduced motion / no JS: .td-static, a calm static layout (hero still with the opener or head, then the
   exploded still beside the list), no pin. */
import './_teardown.css';
import { onFrame, onResize, smooth, seg } from '../core/scroll.js';
import { onLayout } from '../core/layout.js';
import { REDUCED, isDesktop } from '../core/env.js';
import { TD_LIVE, tdRun, tdPhases, tdFraming, tdFit, tdView, tdContain, tdProject, tdLerpRect } from '../gl/lib/tdcore.js';

const NS = 'http://www.w3.org/2000/svg';
const LEAD = { ne: -38, nw: -142, se: 38, sw: 142, n: -90, s: 90, e: 0, w: 180 };

/* diffed style writes */
const cache = new WeakMap();
function put(el, prop, val) {
  if (!el) return;
  let m = cache.get(el);
  if (!m) cache.set(el, (m = {}));
  if (m[prop] === val) return;
  m[prop] = val;
  if (prop.charCodeAt(0) === 45) el.style.setProperty(prop, val); else el.style[prop] = val;
}
const f3 = (v) => v.toFixed(3);
const px = (v) => `${v.toFixed(1)}px`;

/* split a heading into masked lines (kinetic copy): <span.td-ln><span.td-ln__in>words </span></span> per line.
   The heading's text (and so what a screen reader reads) is unchanged; re-split when its width changes. */
function splitLines(el) {
  const st = el._td || (el._td = { text: el.textContent.replace(/\s+/g, ' ').trim(), w: -1, lines: [] });
  const w = el.clientWidth;
  if (w === st.w && st.lines.length) return st.lines;
  st.w = w;
  el.textContent = '';
  const words = st.text.split(' ');
  const spans = words.map((t, i) => {
    const s = document.createElement('span');
    s.textContent = t;
    el.append(s);
    if (i < words.length - 1) el.append(' ');
    return s;
  });
  const groups = [];
  let top = null;
  spans.forEach((s, i) => { if (s.offsetTop !== top) { groups.push([]); top = s.offsetTop; } groups[groups.length - 1].push(words[i]); });
  el.textContent = '';
  st.lines = groups.map((g, i) => {
    const ln = document.createElement('span'); ln.className = 'td-ln';
    const inn = document.createElement('span'); inn.className = 'td-ln__in';
    inn.textContent = g.join(' ') + (i < groups.length - 1 ? ' ' : '');
    ln.append(inn); el.append(ln);
    return inn;
  });
  el.classList.add('is-split');
  return st.lines;
}

/* construction lines around the device (Da Vinci, as in the hero): the great circle and its golden inner circle,
   an arch, the golden-section verticals of the column, the device's golden rectangle and its diagonals, a horizon.
   Each element draws by CSS from the run's --k between its own --a and --b; the copy is masked out. */
function linesSVG(W, H, D, M, x0, id, tall) {
  const phi = 1.618034;
  const cx = (D.x0 + D.x1) / 2, cy = (D.y0 + D.y1) / 2, w = D.x1 - D.x0, h = D.y1 - D.y0;
  const R = Math.hypot(w, h) * (tall ? 0.5 : 0.43);
  const L = [];
  const add = (tag, at, a, b, cls) => L.push(`<${tag} ${at} pathLength="1" style="--a:${a};--b:${b}"${cls ? ` class="${cls}"` : ''}/>`);
  const r = (v) => v.toFixed(1);
  add('circle', `cx="${r(cx)}" cy="${r(cy)}" r="${r(R)}"`, 0, 0.5, 'is-strong');
  add('circle', `cx="${r(cx)}" cy="${r(cy)}" r="${r(R / phi)}"`, 0.14, 0.56);
  // the arch: the top of a larger circle centred below the device
  const R2 = R * 1.32, ay = cy + R * 0.86, a0 = (-162 * Math.PI) / 180, a1 = (-18 * Math.PI) / 180;
  add('path', `d="M ${r(cx + R2 * Math.cos(a0))} ${r(ay + R2 * Math.sin(a0))} A ${r(R2)} ${r(R2)} 0 0 1 ${r(cx + R2 * Math.cos(a1))} ${r(ay + R2 * Math.sin(a1))}"`, 0.22, 0.74);
  // golden-section verticals of the stage (right of the rail on desktop) and a golden horizontal
  const S = W - x0;
  add('line', `x1="${r(x0 + S / (phi * phi))}" y1="0" x2="${r(x0 + S / (phi * phi))}" y2="${r(H)}"`, 0.04, 0.42);
  add('line', `x1="${r(x0 + S / phi)}" y1="${r(H)}" x2="${r(x0 + S / phi)}" y2="0"`, 0.1, 0.48);
  add('line', `x1="${r(x0)}" y1="${r(H / phi)}" x2="${r(W)}" y2="${r(H / phi)}"`, 0.3, 0.7);
  // the device's golden rectangle, its diagonals, and the horizon it stands on
  const gw = R * 1.02, gh = gw / phi;
  add('rect', `x="${r(cx - gw)}" y="${r(cy - gh)}" width="${r(gw * 2)}" height="${r(gh * 2)}"`, 0.26, 0.78);
  add('line', `x1="${r(cx - gw)}" y1="${r(cy + gh)}" x2="${r(cx + gw)}" y2="${r(cy - gh)}"`, 0.4, 0.86);
  add('line', `x1="${r(cx - gw)}" y1="${r(cy - gh)}" x2="${r(cx + gw)}" y2="${r(cy + gh)}"`, 0.46, 0.92);
  add('line', `x1="${r(x0)}" y1="${r(D.y1 - h * 0.06)}" x2="${r(W)}" y2="${r(D.y1 - h * 0.06)}"`, 0.34, 0.8);
  add('path', `d="M ${r(cx - 9)} ${r(cy)} H ${r(cx + 9)} M ${r(cx)} ${r(cy - 9)} V ${r(cy + 9)}"`, 0.5, 0.62, 'is-strong');
  // mask: the lines stay off the copy (a feathered hole) and fade out before the rail (desktop)
  const g0 = Math.max(0, x0 - 110) / W, g1 = Math.max(0, x0 - 30) / W;
  const top = 150 / H;   // and fade out under the top bar
  const mask = `<defs><linearGradient id="${id}g" x1="0" x2="1" y1="0" y2="0"><stop offset="${g0.toFixed(3)}" stop-color="#000"/><stop offset="${g1.toFixed(3)}" stop-color="#fff"/></linearGradient>`
    + `<linearGradient id="${id}v" x1="0" x2="0" y1="0" y2="1"><stop offset="${(top * 0.35).toFixed(3)}" stop-color="#000"/><stop offset="${top.toFixed(3)}" stop-color="#000" stop-opacity="0"/></linearGradient>`
    + `<filter id="${id}b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>`
    + `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${r(W)}" height="${r(H)}"><rect width="${r(W)}" height="${r(H)}" fill="${x0 ? `url(#${id}g)` : '#fff'}"/>`
    + `<rect width="${r(W)}" height="${r(H)}" fill="url(#${id}v)"/>`
    + (M ? `<rect x="${r(M.x - 28)}" y="${r(M.y - 22)}" width="${r(M.w + 56)}" height="${r(M.h + 44)}" rx="24" fill="#000" filter="url(#${id}b)"/>` : '')
    + `</mask></defs>`;
  return `<svg class="td__lines" viewBox="0 0 ${r(W)} ${r(H)}" width="${r(W)}" height="${r(H)}">${mask}<g mask="url(#${id}m)">${L.join('')}</g></svg>`;
}

/* the degree ticker: a turntable scale under the device (ticks every 5°, long every 30°), tilted into an ellipse */
function tickSVG() {
  const L = [];
  for (let a = 0; a < 360; a += 5) {
    const t = (a * Math.PI) / 180, long = a % 30 === 0, r0 = long ? 82 : 89;
    L.push(`<line x1="${(r0 * Math.cos(t)).toFixed(2)}" y1="${(r0 * Math.sin(t)).toFixed(2)}" x2="${(96 * Math.cos(t)).toFixed(2)}" y2="${(96 * Math.sin(t)).toFixed(2)}"${long ? ' class="is-long"' : ''}/>`);
  }
  return `<svg viewBox="-100 -100 200 200"><circle r="96"/><circle r="74" class="is-faint"/>${L.join('')}</svg>`;
}

function block(el, idx) {
  const run = el.querySelector('[data-td-run]');
  const pin = el.querySelector('.td__pin');
  const slot = el.querySelector('[data-td-slot]');
  const target = el.querySelector('[data-td-target]');
  const fx = el.querySelector('[data-td-fx]');
  const hero = el.querySelector('.td__hero');
  const copy = el.querySelector('.td__copy');
  const intro = el.querySelector('.td__intro');
  const kicker = hero?.querySelector('.kicker');
  const giant = hero?.querySelector('[data-td-lines]');
  const label = intro?.querySelector('.td__label');
  const head = intro?.querySelector('[data-td-lines]');
  const rows = [...el.querySelectorAll('.td__spec')];
  const stillH = el.querySelector('.td__still--hero');
  const stillP = el.querySelector('.td__still--poster');
  const open = el.hasAttribute('data-td-open');
  const id = el.dataset.scene;
  if (!run || !pin || !slot || !target) return;
  const box = (el.dataset.tdBox || '0.25 0.2 0.75 0.8').trim().split(/\s+/).map(Number);
  const anchors = rows.map((r) => {
    const [u, v, d, lead] = (r.dataset.anchor || '').trim().split(/\s+/);
    return r.dataset.anchor ? { u: +u, v: +v, d: +d || 0.5, lead: LEAD[lead] ?? LEAD.ne } : null;
  });

  let F, heroR, colR, desk = false, tall = false, drawn = false, parked = false, lastHot = -2;
  let giantLines = [], headLines = [], linesEl = null, tick = null, marks = [];
  const dCopy = { x: 0, y: 0 };
  const S = {}, V = {}, Q = {}, VS = {}, PH = {};

  const measure = () => {
    desk = isDesktop();
    tall = innerHeight > innerWidth;
    heroR = { x: 0, y: 0, w: pin.clientWidth, h: pin.clientHeight };
    colR = { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight };
    F = tdFit(tdFraming(el, tall), colR, heroR.w, heroR.h);
    giantLines = giant ? splitLines(giant) : [];
    headLines = head ? splitLines(head) : [];
    // runs without an opener: the intro's hero position vs its column position (FLIP), the copy glides between them
    let M = null;
    if (intro) {
      const cx = intro.offsetLeft + copy.offsetLeft, cy = intro.offsetTop + copy.offsetTop;
      if (!open) {
        el.classList.add('td-measure-hero');
        const hx = intro.offsetLeft + copy.offsetLeft, hy = intro.offsetTop + copy.offsetTop;
        el.classList.remove('td-measure-hero');
        dCopy.x = hx - cx; dCopy.y = hy - cy;
        M = { x: hx, y: hy, w: intro.offsetWidth, h: intro.offsetHeight };
      }
    }
    if (hero) M = { x: hero.offsetLeft, y: hero.offsetTop, w: hero.offsetWidth, h: hero.offsetHeight };
    // the device's box in the hero framing (orbit end), in pin px
    const Vh = { zoom: F.hero.z, sx: F.hero.x, sy: F.hero.y };
    const a = tdProject(box[0], box[1], heroR, Vh, null), b = tdProject(box[2], box[3], heroR, Vh, null);
    const D = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    // fx: lines, ticker, markers
    fx.textContent = '';
    const x0 = desk ? copy.offsetLeft : 0;   // the column's left edge (right of the rail)
    fx.insertAdjacentHTML('beforeend', linesSVG(heroR.w, heroR.h, D, M, x0, `tdl${idx}`, tall));
    linesEl = fx.lastElementChild;
    tick = document.createElement('div');
    tick.className = 'td__tick';
    tick.innerHTML = `<div class="td__tick-disc">${tickSVG()}</div><i class="td__tick-idx"></i>`;
    const tw = Math.min((D.x1 - D.x0) * 1.12, heroR.w * (desk ? 0.62 : 0.96));
    const ty = Math.min(D.y1 - (D.y1 - D.y0) * 0.05, heroR.h - tw * 0.16 - 8);
    tick.style.cssText = `width:${px(tw)};height:${px(tw * 0.3)};transform:translate(${px((D.x0 + D.x1) / 2 - tw / 2)},${px(ty - tw * 0.15)})`;
    fx.append(tick);
    marks = anchors.map((A, j) => {
      if (!A) return null;
      const m = document.createElement('div');
      m.className = 'td__mk';
      const t = (A.lead * Math.PI) / 180;
      m.style.cssText = `--ang:${A.lead}deg;--lx:${px(Math.cos(t) * 42)};--ly:${px(Math.sin(t) * 42)}`;
      m.innerHTML = `<i class="td__mk-lead"></i><i class="td__mk-dot"></i><b class="td__mk-n">${String(j + 1).padStart(2, '0')}</b>`;
      fx.append(m);
      return m;
    });
    lastHot = -2; parked = false;
  };

  // hovering a row lights its marker
  rows.forEach((r, j) => {
    const on = (v) => { marks[j]?.classList.toggle('is-hl', v); el.classList.toggle('has-hl', v && !!marks[j]); };
    r.addEventListener('pointerenter', () => on(true));
    r.addEventListener('pointerleave', () => on(false));
    r.addEventListener('focusin', () => on(true));
    r.addEventListener('focusout', () => on(false));
  });

  const frame = (v) => {
    if (!F) return;
    const r = tdRun(run, v.y, v.vh);
    // far away: write the clamped state once, then rest (every value is a pure function of p)
    if (r.pv < -1.8 * r.vp || r.pv > 1 + 1.6 * r.vp) { if (parked) return; parked = true; } else parked = false;
    const ph = tdPhases(r.pv, r.vp, open);
    const p = ph.p, vp = r.vp;
    if (!drawn && window.__stage?.drawn) {
      for (const s of window.__stage.drawn) if (s.id === id) { drawn = true; el.classList.add('is-drawn'); }
    }

    // the slot: the whole viewport → the column rect
    tdLerpRect(heroR, colR, ph.hand, S);
    put(slot, 'left', px(S.x)); put(slot, 'top', px(S.y)); put(slot, 'width', px(S.w)); put(slot, 'height', px(S.h));
    tdView(F, ph, V);

    // stills (WebGL off, or until the scene draws): the same framing as the shader; hero angle → exploded
    if (!drawn) {
      // each still at its own state: the whole device at the column's opening framing, the exploded one at the final
      const c = tdContain(S.w, S.h);
      const tf = (W) => `translate3d(${px(-W.sx * W.zoom * c.w)}, ${px(W.sy * W.zoom * c.h)}, 0) scale(${W.zoom.toFixed(4)})`;
      PH.hand = ph.hand; PH.orbit = ph.orbit; PH.settle = ph.settle;
      PH.explode = 0; put(stillH, 'transform', tf(tdView(F, PH, VS)));
      PH.explode = 1; put(stillP, 'transform', tf(tdView(F, PH, VS)));
      const k = smooth(seg(p, 0.5, 0.64));
      put(stillH, '--o', f3((1 - k) * ph.fade)); put(stillP, '--o', f3(k * ph.fade));
    }

    // the opener: rises in through its mask as the run arrives, then drifts up and fades as the orbit gets going
    if (hero) {
      const kin = smooth(seg(r.pv, -0.9 * vp, -0.4 * vp));
      giantLines.forEach((ln) => put(ln, '--k', f3(kin)));
      put(kicker, 'opacity', f3(smooth(seg(r.pv, -0.95 * vp, -0.5 * vp))));
      const up = seg(p, 0, 0.24);
      put(hero, 'transform', `translate3d(0, ${px(-up * (tall ? 0.05 : 0.11) * heroR.h)}, 0)`);
      put(hero, 'opacity', f3(1 - smooth(seg(p, 0.07, 0.21))));
    }

    // the copy
    if (open) {
      // arrives with the hand-off, in its column place: label, the head line by line, then the rows
      if (label) { const k = smooth(seg(p, 0.3, 0.37)); put(label, 'opacity', f3(k)); put(label, 'transform', `translate3d(0, ${px((1 - k) * 14)}, 0)`); }
      headLines.forEach((ln, j) => put(ln, '--k', f3(smooth(seg(p, 0.31 + 0.028 * j, 0.39 + 0.028 * j)))));
    } else if (intro) {
      // arrives with the run (label, then the head line by line), sits over the orbit, then glides to the column
      if (label) { const k = smooth(seg(r.pv, -0.75 * vp, -0.42 * vp)); put(label, 'opacity', f3(k)); put(label, 'transform', `translate3d(0, ${px((1 - k) * 14)}, 0)`); }
      headLines.forEach((ln, j) => put(ln, '--k', f3(smooth(seg(r.pv, (-0.7 + 0.07 * j) * vp, (-0.36 + 0.07 * j) * vp)))));
      const k = 1 - ph.hand;
      put(copy, 'transform', `translate3d(${px(dCopy.x * k)}, ${px(dCopy.y * k)}, 0)`);
    }
    put(el, '--td-hand', f3(ph.hand));

    // spec rows: stagger in with the hand-off, then light in step with the explode (the newest one gold)
    const n = rows.length;
    let hot = -1;
    rows.forEach((row, j) => {
      const a = 0.395 + (0.06 * j) / Math.max(1, n - 1);
      put(row, '--in', f3(smooth(seg(p, a, a + 0.05))));
      const b = 0.47 + (0.34 * j) / Math.max(1, n);
      const on = smooth(seg(p, b, b + 0.045));
      put(row, '--on', f3(on));
      if (on > 0.5) hot = j;
    });
    if (p > 0.86) hot = -1;
    if (hot !== lastHot) { rows.forEach((row, j) => row.classList.toggle('is-hot', j === hot)); lastHot = hot; }

    // construction lines and the ticker: drawn as the orbit runs, gone as the hand-off begins
    const linesOut = 1 - smooth(seg(p, 0.25, 0.33));
    if (linesEl) {
      put(linesEl, '--k', f3(seg(r.pv, -0.8 * vp, 0.24)));
      put(linesEl, 'opacity', f3(linesOut * smooth(seg(r.pv, -0.9 * vp, -0.5 * vp))));
    }
    if (tick) {
      put(tick, '--deg', `${(-150 * ph.orbit).toFixed(2)}deg`);
      put(tick, 'opacity', f3(linesOut * smooth(seg(r.pv, -0.7 * vp, -0.2 * vp))));
    }

    // part markers (desktop): on their parts in the exploded frame, through the shader's transform
    if (desk) {
      const fout = 1 - smooth(seg(r.pv, 1 + 0.02 * vp, 1 + 0.3 * vp));
      const live = drawn ? TD_LIVE.get(id) : null;
      marks.forEach((m, j) => {
        if (!m) return;
        const k = smooth(seg(p, 0.8 + 0.013 * j, 0.84 + 0.013 * j)) * fout;
        put(m, 'opacity', f3(Math.min(1, k * 1.6)));
        put(m, '--k', f3(k));
        if (k <= 0) return;
        const A = anchors[j];
        tdProject(A.u, A.v, S, V, live, A.d, Q);
        put(m, 'transform', `translate3d(${px(Q.x)}, ${px(Q.y)}, 0)`);
      });
    }
  };

  measure();
  onResize(measure);
  onLayout(() => {
    // fonts / late layout: re-measure only when something that matters moved
    if (pin.clientWidth !== heroR.w || pin.clientHeight !== heroR.h || target.offsetTop !== colR.y || target.offsetWidth !== colR.w
      || (head && head.clientWidth !== head._td?.w) || (giant && giant.clientWidth !== giant._td?.w)) measure();
  });
  document.fonts?.ready.then(() => { if (head) head._td.w = -1; if (giant) giant._td.w = -1; measure(); });
  onFrame(frame);
}

export function init() {
  const blocks = [...document.querySelectorAll('.td[data-td]')];
  blocks.forEach((el, i) => {
    el.dataset.tdReady = '';
    if (REDUCED) { el.classList.add('td-static'); return; }
    block(el, i);
  });
}
