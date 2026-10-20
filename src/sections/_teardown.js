/* Teardown runs, the Editions Retail choreography (markup: partials/method.html, partials/kit.html; scene:
   gl/scenes/teardowns.js; the shared clock, timeline and framing math: gl/lib/tdcore.js).
     <section class="td [td--open] [td--seq]" data-td [data-td-open] data-wipe data-scene="td:ID" …>
       <div class="td__run" data-td-run>               pinned for --td-run (phones: --td-run-m)
         <div class="td__pin">
           <div class="td__keys">                      the colour keys as DOM (the still path; WebGL draws its own)
           <div class="td__slot" data-td-slot>         where the frame is drawn; its rect glides from the viewport to the column
             <img class="td__still td__still--hero|--poster" [data-td-still="k"]>   stills: WebGL off, phones, or until the scene draws
           <div class="td__target" data-td-target>     the column rect (CSS-defined, measured)
           <div class="td__fx" data-td-fx>             construction lines, degree ticker, part markers (built here)
           <header class="td__hero">                   the chapter title over the orbit
           <div class="td__copy" [data-td-shot]>       per shot: .td__intro (label + head) + ol.td__specs (li[data-anchor])
   One shot (Method: the section carries the device's data) or several (the Kit: each .td__copy[data-td-shot] carries
   its device's data, and shot k's stills and key carry data-td-still="k").
   Per frame, as pure functions of scroll (so scrolling back is exact), from tdcore's timeline: the slot rect, the
   stills' framing (and, across a cut, the outgoing device fading under the incoming one), the DOM keys (the incoming
   colour slides in from the right with a feathered edge), the title (rises in through its mask, drifts up and fades),
   each shot's copy (label, the head line by line, rows staggering in; out again at the next cut), rows lighting in
   step with the explode, part markers, and shot 0's construction lines (one static layer, opacity only) and ticker.
   Style writes are diffed and are transforms and opacity (plus a few custom properties on small composited
   elements); rects are measured on layout only (the slot's rect is computed, never laid out, and handed to the scene
   with the fitted framing through tdLive, so the WebGL frame and the DOM follow the same numbers).
   Reduced motion / no JS: .td-static, a calm static layout (no pin). */
import './_teardown.css';
import { onFrame, onResize, smooth, seg } from '../core/scroll.js';
import { onLayout } from '../core/layout.js';
import { REDUCED, TIER, STILL, isDesktop } from '../core/env.js';
import { coverPlates } from './_paper.js';   // shared helper (read-only): hides the fixed plates under an opaque block
import { tdLive, tdRun, tdFlags, tdShots, tdDev, tdKey, tdTimeline, tdState, tdFraming, tdFit, tdView, tdContain, tdProject, tdLerpRect, tdPinTop } from '../gl/lib/tdcore.js';

const LEAD = { ne: -38, nw: -142, se: 38, sw: 142, n: -90, s: 90, e: 0, w: 180 };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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
/* opacity plus visibility (a hidden layer is not composited at all) */
function show(el, o) {
  const v = o.toFixed(3);
  put(el, 'opacity', v);
  put(el, 'visibility', o <= 0.001 ? 'hidden' : 'visible');
}
const f3 = (v) => v.toFixed(3);
const f2 = (v) => v.toFixed(2);
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
   an arch, the golden-section verticals of the stage, the device's golden rectangle and its diagonals, a horizon.
   One static SVG layer revealed by its opacity as the run arrives (composited: no repaint), under one mask painted
   once per resize on a small canvas (alpha: the rail's edge, the top bar, a feathered hole for the title, the device
   dimmed to 45 %). Portrait screens keep only the great circle (with the ticker): on a phone the rest is a cage, and
   the arch ran across the camera's top plate and lens; there the mask also cuts a deep hole round the device, so no
   line is drawn over it. */
function lineLayers(W, H, D, rail, tall, id) {
  const phi = 1.618034;
  const cx = (D.x0 + D.x1) / 2, cy = (D.y0 + D.y1) / 2, w = D.x1 - D.x0, h = D.y1 - D.y0;
  const R = Math.hypot(w, h) * (tall ? 0.5 : 0.43);
  const r = (v) => v.toFixed(1);
  const L = [[], [], []];
  const add = (layer, tag, at, cls) => L[layer].push(`<${tag} ${at}${cls ? ` class="${cls}"` : ''}/>`);
  add(0, 'circle', `cx="${r(cx)}" cy="${r(cy)}" r="${r(R)}"`, 'is-strong');
  if (!tall) {
    const R2 = R * 1.32, ay = cy + R * 0.86, a0 = (-162 * Math.PI) / 180, a1 = (-18 * Math.PI) / 180;
    add(1, 'path', `d="M ${r(cx + R2 * Math.cos(a0))} ${r(ay + R2 * Math.sin(a0))} A ${r(R2)} ${r(R2)} 0 0 1 ${r(cx + R2 * Math.cos(a1))} ${r(ay + R2 * Math.sin(a1))}"`);
    add(0, 'circle', `cx="${r(cx)}" cy="${r(cy)}" r="${r(R / phi)}"`);
    const S = W - rail;
    add(0, 'line', `x1="${r(rail + S / (phi * phi))}" y1="0" x2="${r(rail + S / (phi * phi))}" y2="${r(H)}"`);
    add(0, 'line', `x1="${r(rail + S / phi)}" y1="${r(H)}" x2="${r(rail + S / phi)}" y2="0"`);
    add(1, 'line', `x1="${r(rail)}" y1="${r(H / phi)}" x2="${r(W)}" y2="${r(H / phi)}"`);
    const gw = R * 1.02, gh = gw / phi;
    add(1, 'rect', `x="${r(cx - gw)}" y="${r(cy - gh)}" width="${r(gw * 2)}" height="${r(gh * 2)}"`);
    add(1, 'line', `x1="${r(rail)}" y1="${r(D.y1 - h * 0.06)}" x2="${r(W)}" y2="${r(D.y1 - h * 0.06)}"`);
    add(2, 'line', `x1="${r(cx - gw)}" y1="${r(cy + gh)}" x2="${r(cx + gw)}" y2="${r(cy - gh)}"`);
    add(2, 'line', `x1="${r(cx - gw)}" y1="${r(cy - gh)}" x2="${r(cx + gw)}" y2="${r(cy + gh)}"`);
  }
  // one layer (the lines masked by the shared mask image: an SVG <mask>, rasterised with the layer once, then only its
  // opacity changes). v3 phase 2: one layer, not three staggered ones: each was a full-screen quad for the compositor
  return [L.flat()].map((l, i) => `<svg class="td__lines" viewBox="0 0 ${r(W)} ${r(H)}" width="${r(W)}" height="${r(H)}">`
    + `<defs><mask id="${id}${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="${r(W)}" height="${r(H)}"><image width="${r(W)}" height="${r(H)}" preserveAspectRatio="none"/></mask></defs>`
    + `<g mask="url(#${id}${i})">${l.join('')}</g></svg>`);
}

/* the lines' mask (white = lines show), painted once on a half-resolution canvas: built in alpha, shapes blurred with
   the shadow trick (shadowBlur = 2σ, in device px), then flattened to white-on-black for an SVG luminance mask */
function lineMask(W, H, D, M, rail, tall) {
  const s = 0.5, c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(W * s)); c.height = Math.max(1, Math.ceil(H * s));
  const g = c.getContext('2d');
  if (rail) { const lg = g.createLinearGradient((rail + 8) * s, 0, (rail + 68) * s, 0); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, '#000'); g.fillStyle = lg; }
  else g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-out';
  const top = 150 * s, tg = g.createLinearGradient(0, 0, 0, top);
  tg.addColorStop(0, '#000'); tg.addColorStop(0.35, '#000'); tg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = tg; g.fillRect(0, 0, c.width, top);
  const soft = (x, y, w, h, rad, sigma, alpha) => {
    const BIG = 4 * (c.width + c.height);
    g.save();
    g.globalAlpha = alpha; g.fillStyle = '#000';
    g.shadowColor = '#000'; g.shadowBlur = 2 * sigma * s; g.shadowOffsetX = BIG;
    g.beginPath();
    if (g.roundRect) g.roundRect(x * s - BIG, y * s, w * s, h * s, rad * s); else g.rect(x * s - BIG, y * s, w * s, h * s);
    g.fill();
    g.restore();
  };
  const w = D.x1 - D.x0, h = D.y1 - D.y0;
  if (!tall) soft(D.x0 + w * 0.06, D.y0 + h * 0.06, w * 0.88, h * 0.88, Math.min(w, h) * 0.2, Math.max(18, Math.min(w, h) * 0.1), 0.55);
  else soft(D.x0 - w * 0.04, D.y0 - h * 0.15, w * 1.08, h * 1.3, Math.min(w, h) * 0.2, Math.max(18, Math.min(w, h) * 0.1), 0.9);
  if (M) soft(M.x - 28, M.y - 22, M.w + 56, M.h + 44, 24, 22, 1);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  return c;
}

/* the degree ticker: a turntable scale under the device (ticks every 5°, long every 30°), tilted into an ellipse,
   front arc only; drawn on a small canvas only when its angle changes */
const TILT = Math.cos((73 * Math.PI) / 180);
function drawTick(cv, deg) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, k = cv._k || 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, u = W / 200;
  const ring = (r, col) => { g.strokeStyle = col; g.beginPath(); g.ellipse(cx, cy, r * u, r * u * TILT, 0, 0, Math.PI * 2); g.stroke(); };
  g.lineWidth = k;
  ring(96, 'rgba(201,165,92,0.58)');
  ring(74, 'rgba(201,165,92,0.22)');
  const th = (deg * Math.PI) / 180;
  for (const long of [false, true]) {
    g.strokeStyle = long ? 'rgba(217,188,133,0.78)' : 'rgba(201,165,92,0.58)';
    g.beginPath();
    for (let a = 0; a < 360; a += 5) {
      if ((a % 30 === 0) !== long) continue;
      const t = (a * Math.PI) / 180 + th, c = Math.cos(t), s = Math.sin(t), r0 = long ? 82 : 89;
      g.moveTo(cx + r0 * c * u, cy + r0 * s * u * TILT); g.lineTo(cx + 96 * c * u, cy + 96 * s * u * TILT);
    }
    g.stroke();
  }
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0.3, 'rgba(0,0,0,0)'); fade.addColorStop(0.7, '#000');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
}

function block(el, idx) {
  const run = el.querySelector('[data-td-run]');
  const pin = el.querySelector('.td__pin');
  const slot = el.querySelector('[data-td-slot]');
  const target = el.querySelector('[data-td-target]');
  const fx = el.querySelector('[data-td-fx]');
  const hero = el.querySelector('.td__hero');
  const giant = hero?.querySelector('[data-td-lines]');
  const fl = tdFlags(el);
  const id = el.dataset.scene;
  const live = tdLive(id);
  const rail = document.querySelector('.rail');
  if (!run || !pin || !slot || !target) return;
  const shotEls = tdShots(el);
  const multi = shotEls[0] !== el;
  const shots = shotEls.map((sEl, j) => {
    const copy = multi ? sEl : el.querySelector('.td__copy');
    const intro = copy?.querySelector('.td__intro');
    const rows = copy ? [...copy.querySelectorAll('.td__spec')] : [];
    const q = (c) => (multi ? slot.querySelector(`.${c}[data-td-still="${j}"]`) : slot.querySelector(`.${c}`));
    return {
      el: sEl, dev: tdDev(sEl, el), copy, intro, rows,
      label: intro?.querySelector('.td__label'), head: intro?.querySelector('[data-td-lines]'),
      stillH: q('td__still--hero'), stillP: q('td__still--poster'),
      keyEl: el.querySelector(`.td__key[data-td-still="${j}"]`) || (!multi ? el.querySelector('.td__key') : null),
      box: (sEl.dataset.tdBox || '0.25 0.2 0.75 0.8').trim().split(/\s+/).map(Number),
      anchors: rows.map((r) => {
        const [u, v, d, lead] = (r.dataset.anchor || '').trim().split(/\s+/);
        return r.dataset.anchor ? { u: +u, v: +v, d: +d || 0.5, lead: LEAD[lead] ?? LEAD.ne } : null;
      }),
      F: null, headLines: [], marks: [], lastHot: -2,
    };
  });

  // with the WebGL stage (desktop), the stills are only a stand-in until the scene draws: they load only if the run is
  // near and the scene has not drawn yet (src parked in data-src; without JS the markup's src stands)
  const lazy = TIER > 0 && !STILL ? [...slot.querySelectorAll('img.td__still[src]')] : [];
  for (const im of lazy) { im.dataset.src = im.getAttribute('src'); im.removeAttribute('src'); }
  let heroR, orbR, colR, desk = false, tall = false, drawn = false, parked = false, copyTop = 0, mk = false, mkAll = false, gate = 0;
  // rows placed by a real-time scene (data-anchor3d: Method) also get markers on tablets (all of them, numbered) and
  // phones (the lit row's only, named); the frame-stream runs (the Kit) keep theirs desktop-only
  const has3d = shots.some((x) => x.rows.some((r) => r.dataset.anchor3d));
  const heroStill = shots[0].stillH;
  let giantLines = [], lineEls = [], tick = null, disc = null, timeline = null, TL = -1;
  let maskURL = '', maskVer = 0, masked = false;
  const S = {}, V = {}, Q = {}, VS = {}, PH = {}, ST = { ph: {}, phN: {} };

  const copyTopOf = (x) => { const f = x.intro || x.rows[0]; return f && x.copy ? f.offsetTop + x.copy.offsetTop : 0; };
  const copyTopNow = () => Math.min(...shots.map(copyTopOf).filter((v) => v > 0), Infinity);
  const measure = () => {
    desk = isDesktop();
    tall = innerHeight > innerWidth;
    mkAll = desk || (has3d && tall && innerWidth >= 768);
    mk = mkAll || has3d;
    el.classList.toggle('td--mk', mk);
    heroR = { x: 0, y: 0, w: pin.clientWidth, h: pin.clientHeight };
    giantLines = giant ? splitLines(giant) : [];
    for (const x of shots) x.headLines = x.head ? splitLines(x.head) : [];
    // the orbit's slot: the whole pin, unless the device would run under the title's letters (landscape: the title sits
    // over the top of the screen while the view turns round the device). data-td-orbit-fill is the largest share of its
    // slot the 3D device fills while the title shows (camera3d.js KEYS.wide.start.fill): when that device, centred,
    // would start above the letters' bottom, the slot becomes the tallest rect whose device starts just under the
    // letters and ends 12 px above the screen's bottom edge. Beside the rail (desktop) the rect also moves right, so a
    // device that wide clears the chapter index and keeps 12 px from the right edge (the photoreal frames' hero shift
    // did the same). The stills, the lines and the hand-off follow the same rect.
    orbR = { ...heroR };
    const ofill = tall ? 0 : parseFloat(el.dataset.tdOrbitFill) || 0;
    const railR = desk && rail ? rail.offsetWidth : 0;   // the lines are gone under the rail
    if (ofill > 0 && railR) {
      const m = (heroR.w * (1 - ofill)) / 2;
      orbR.x = Math.max(0, Math.min(railR - 4 - m, m - 12));
    }
    const titleBase = () => {   // the title's last baseline (no descenders), pin px
      let gy = giant.offsetHeight - 0.21 * (parseFloat(getComputedStyle(giant).lineHeight) || giant.offsetHeight);
      for (let n = giant; n && n !== pin; n = n.offsetParent) gy += n.offsetTop;
      return gy;
    };
    if (ofill > 0 && giant) {
      const t = titleBase() + Math.max(12, heroR.h * 0.015);
      if (t > (heroR.h * (1 - ofill)) / 2) {
        orbR.h = Math.min(heroR.h, (heroR.h - 12 - t) / ofill);
        orbR.y = t - (orbR.h * (1 - ofill)) / 2;
      }
    }
    // portrait (phones, tablets): data-td-orbit-tall="k" gives the orbit a slot from 16 px under the title's letters to
    // 24 px above the bottom edge, k × the screen wide (centred), so the camera (84-86 % of its slot, camera3d.js
    // KEYS.tall) crosses the screen with a deliberate bleed off both sides, as the photoreal orbit did, instead of a
    // small camera over a band of black (without it: the whole pin, as for the Kit)
    const otall = tall && giant ? parseFloat(el.dataset.tdOrbitTall) || 0 : 0;
    if (otall > 0) {
      const t = titleBase() + 16;
      orbR = { x: (-(otall - 1) / 2) * heroR.w, y: t, w: otall * heroR.w, h: Math.max(heroR.h * 0.4, heroR.h - t - 24) };
    }
    live.orb = orbR;
    // portrait: the column slot runs from under the bar down to just above the copy (the tallest of the shots'), so
    // the device sits in the middle of the free black, not high above a gap (and never under the copy: the floor is
    // only for screens too short for the list; Method's twelve rows leave 226 px at 360×780)
    target.style.height = '';
    copyTop = copyTopNow();
    if (tall && Number.isFinite(copyTop)) target.style.height = px(Math.max(heroR.h * 0.27, copyTop - 18 - target.offsetTop));
    colR = { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight };
    for (const x of shots) x.F = tdFit(tdFraming(x.el, tall, x.dev), colR, heroR.w, heroR.h);
    // a list whose lines show as a caption (Method on short screens and phones: method.css) keeps its last lit row
    const capMode = window.matchMedia('(min-width: 1024px) and (max-height: 1180px), (max-width: 1023px)').matches;
    for (const x of shots) x.keepHot = capMode && !!x.copy?.querySelector('.td__specs--lines');
    live.Fs = shots.map((x) => x.F);
    TL = -1;
    // the DOM keys (the still path): a radial field round the column (a cut slides it in from the right, its
    // feathered edge leading)
    const cx = colR.x + colR.w / 2, cy = colR.y + colR.h / 2;
    for (const x of shots) {
      if (!x.keyEl) continue;
      const st = x.keyEl.style;
      st.setProperty('--kx', px(cx)); st.setProperty('--ky', px(cy));
      st.setProperty('--krx', px(colR.w * 0.7)); st.setProperty('--kry', px(colR.h * 0.8));
    }
    // the title's box (the lines' mask leaves a hole for it), and shot 0's device box in the hero framing
    const M = hero ? { x: hero.offsetLeft, y: hero.offsetTop, w: hero.offsetWidth, h: hero.offsetHeight } : null;
    const F0 = shots[0].F, b0 = shots[0].box;
    const Vh = { zoom: F0.hero.z, sx: F0.hero.x, sy: F0.hero.y };
    const a = tdProject(b0[0], b0[1], orbR, Vh, null), b = tdProject(b0[2], b0[3], orbR, Vh, null);
    const D = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    // fx: lines (static layers under a painted mask), ticker, markers
    fx.textContent = '';
    fx.insertAdjacentHTML('beforeend', lineLayers(heroR.w, heroR.h, D, railR, tall, `tdm${idx}-`).join(''));
    lineEls = [...fx.querySelectorAll('.td__lines')];
    lineEls.forEach((ln) => put(ln, 'opacity', '0'));
    const mask = lineMask(heroR.w, heroR.h, D, M, railR, tall), ver = ++maskVer;
    mask.toBlob((bl) => {
      if (!bl || ver !== maskVer) return;
      if (maskURL) URL.revokeObjectURL(maskURL);
      maskURL = URL.createObjectURL(bl);
      for (const ln of lineEls) ln.querySelector('mask image')?.setAttribute('href', maskURL);
      masked = true;
    }, 'image/png');
    masked = false;
    tick = document.createElement('div');
    tick.className = 'td__tick';
    tick.innerHTML = `<canvas class="td__tick-disc"></canvas><i class="td__tick-idx"></i>`;
    disc = tick.firstElementChild;
    const tw = Math.min((D.x1 - D.x0) * 1.12, heroR.w * (desk ? 0.62 : 0.96));
    const ty = Math.min(D.y1 - (D.y1 - D.y0) * 0.05, heroR.h - tw * 0.16 - 8);
    tick.style.cssText = `width:${px(tw)};height:${px(tw * 0.3)};transform:translate(${px((D.x0 + D.x1) / 2 - tw / 2)},${px(ty - tw * 0.15)})`;
    const dk = Math.min(2, window.devicePixelRatio || 1);
    disc.width = Math.round(tw * dk); disc.height = Math.round(tw * 0.3 * dk); disc._k = dk; disc._deg = NaN;
    fx.append(tick);
    for (const x of shots) {
      x.marks = x.anchors.map((A, j) => {
        if (!A) return null;
        const m = document.createElement('div');
        m.className = 'td__mk';
        const t = (A.lead * Math.PI) / 180;
        m.style.cssText = `--ang:${A.lead}deg;--lx:${px(Math.cos(t) * 42)};--ly:${px(Math.sin(t) * 42)}`;
        // the row's number where every marker shows (desktop, tablets: the rows are numbered too, method.css); its name
        // on phones, where only the lit row's marker shows
        const lab = mkAll ? String(j + 1).padStart(2, '0') : (x.rows[j].querySelector('b')?.textContent || '');
        if (!mkAll) m.classList.add('td__mk--name');
        m.innerHTML = `<i class="td__mk-lead"></i><i class="td__mk-dot"></i><b class="td__mk-n">${lab}</b>`;
        fx.append(m);
        return m;
      });
      x.lastHot = -2;
    }
    parked = false;
  };

  // hovering a row lights it and its marker (pointer only: the rows are plain list items and the markers are
  // aria-hidden decoration, so they add no tab stops)
  for (const x of shots) {
    x.rows.forEach((r, j) => {
      const on = (v) => { r.classList.toggle('is-hl', v); x.marks[j]?.classList.toggle('is-hl', v); el.classList.toggle('has-hl', v && !!x.marks[j]); };
      r.addEventListener('pointerenter', () => on(true));
      r.addEventListener('pointerleave', () => on(false));
    });
  }

  /* a named marker (phones): its label up and towards the middle of the screen, so a long name never runs off an edge */
  const side = (m, x) => {
    if (mkAll) return;
    const r = x > heroR.w / 2, ang = r ? -142 : -38;
    if (m._ang === ang) return;
    m._ang = ang;
    const t = (ang * Math.PI) / 180;
    m.style.setProperty('--ang', `${ang}deg`); m.style.setProperty('--lx', px(Math.cos(t) * 30)); m.style.setProperty('--ly', px(Math.sin(t) * 30));
    m.classList.toggle('is-r', r);
  };

  /* a still at a framing: contain-fit in the pin, moved by one transform onto where it would sit in the slot rect */
  const stillTf = (F, W) => {
    const c = tdContain(S.w, S.h), c0 = tdContain(heroR.w, heroR.h);
    tdView(F, W, VS);
    const x = S.x + S.w / 2 - VS.sx * VS.zoom * c.w - heroR.w / 2, y = S.y + S.h / 2 + VS.sy * VS.zoom * c.h - heroR.h / 2;
    return `translate3d(${px(x)}, ${px(y)}, 0) scale(${((VS.zoom * c.w) / c0.w).toFixed(4)})`;
  };

  const frame = (v) => {
    if (!heroR) return;
    const r = tdRun(run, v.y, v.vh), s = r.s;
    let flip = false;
    if ('ready' in live) {
      // a scene that says whether it has drawn (td:camera3d): two-way, so the stills come back the moment it is disposed
      // (the reader left the mount window) and stand in again until it has reloaded, instead of a black chapter
      if (!!live.ready !== drawn) {
        drawn = !!live.ready; el.classList.toggle('is-drawn', drawn); flip = true;
        // back on: decode them now (usually while the reader is away), so they paint the moment the chapter returns
        if (!drawn) for (const x of shots) for (const im of [x.stillH, x.stillP]) if (im?.getAttribute('src')) im.decode().catch(() => {});
      }
    } else if (!drawn && window.__stage?.drawn) {
      for (const sc of window.__stage.drawn) if (sc.id === id && sc.device) { drawn = true; el.classList.add('is-drawn'); }
    }
    // far away: write the clamped state once (again after a flip), then rest (every value is a pure function of s)
    if (s < -2.0 || s > r.L + 1.8) { if (parked && !flip) return; parked = true; } else parked = false;
    if (Math.abs(r.L - TL) > 1e-3) { timeline = tdTimeline(shots.length, r.L); TL = r.L; }
    const st = tdState(s, timeline, r.L, fl, ST);
    const k = st.k, ph = st.ph, sh = shots[k], T0 = timeline[0];
    const cut = easeIO(st.cut);
    const hand = k === 0 ? ph.hand : 1;

    // the slot: the orbit's rect (the viewport, clear of the title) → the column rect (computed, never laid out); the
    // scene gets the same rect
    tdLerpRect(orbR, colR, hand, S);
    tdView(sh.F, ph, V);
    live.x = S.x; live.y = S.y + tdPinTop(r, v.y, heroR.h); live.w = S.w; live.h = S.h; live.f = v.frame;

    // stills and keys (WebGL off, the phone still path, or until the scene draws)
    if (!drawn) {
      // the src a screen and a half ahead of the pin (a parked img never paints, _teardown.css: no broken-image box)
      if (lazy.length && s > -1.6) { for (const im of lazy) im.src = im.dataset.src; lazy.length = 0; }
      shots.forEach((x, j) => {
        let oh = 0, op = 0, ko = 0, kx = 0;
        if (j === k) {
          const out = 1 - smooth(seg(cut, 0.3, 0.7));
          if (x.dev === 'camera3d') {
            // the 3D stills are two angles of one camera (hero az -38, exploded -62; phones -26 / -50): a dissolve hung
            // the parts half-transparent over a whole camera, so the hero still dips to black before the exploded one
            oh = (1 - smooth(seg(ph.explodeLin, 0.16, 0.25))) * out; op = smooth(seg(ph.explodeLin, 0.25, 0.36)) * out;
          } else { const xk = smooth(seg(ph.explodeLin, 0.2, 0.4)); oh = (1 - xk) * out; op = xk * out; }
          ko = x.F.key ? hand : 0;
        } else if (j === k + 1 && cut > 0) {
          oh = smooth(seg(cut, 0.45, 0.85));
          ko = 1; kx = (1 - cut) * heroR.w * 1.16;
        }
        if (oh > 0) { PH.hand = 1; PH.orbit = 1; PH.settle = 0; PH.explode = 0; if (j === 0 && k === 0) { PH.hand = ph.hand; PH.orbit = ph.orbit; } put(x.stillH, 'transform', stillTf(x.F, PH)); }
        if (op > 0) { PH.hand = hand; PH.orbit = j === 0 ? ph.orbit : 1; PH.settle = ph.settle; PH.explode = 1; put(x.stillP, 'transform', stillTf(x.F, PH)); }
        show(x.stillH, oh * st.fade); show(x.stillP, op * st.fade);
        if (x.keyEl) { show(x.keyEl, ko); if (ko > 0) put(x.keyEl, 'transform', `translate3d(${px(kx)}, 0, 0)`); }
      });
    }

    // the title: rises in through its mask as the run arrives, then drifts up and fades before the hand-off
    if (hero) {
      const h0 = T0.hand[0];
      const kin = smooth(seg(s, -0.9, -0.4));
      giantLines.forEach((ln) => put(ln, '--k', f3(kin)));
      put(hero, 'transform', `translate3d(0, ${px(-seg(s, 0, h0) * (tall ? 0.05 : 0.11) * heroR.h)}, 0)`);
      show(hero, 1 - smooth(seg(s, h0 - 0.4, h0 - 0.1)));
    }

    // each shot's copy: in with its hand-off (shot 0) or its cut (the rest), out at the next cut
    shots.forEach((x, j) => {
      const t = timeline[j], nxt = timeline[j + 1];
      let a0, a1;   // the arrival window
      // (portrait, one shot: the camera glides down through the copy's band, so the head starts later)
      if (j === 0) { a0 = t.hand[0] + (tall && !multi ? 0.55 : 0.36) * (t.hand[1] - t.hand[0]); a1 = t.hand[1]; }
      else { a0 = t.cut[0] + 0.45 * (t.cut[1] - t.cut[0]); a1 = t.explode[0]; }
      const out = nxt ? smooth(seg(s, nxt.cut[0], nxt.cut[0] + 0.45 * (nxt.cut[1] - nxt.cut[0]))) : 0;
      const vis = s >= a0 - 0.05 && out < 1;
      if (!multi) put(x.copy, 'visibility', 'visible');
      else {
        show(x.copy, vis ? 1 - out : 0);
        put(x.copy, 'transform', out > 0 ? `translate3d(0, ${px(-out * 18)}, 0)` : 'none');
      }
      if (!vis && multi) return;
      const span = a1 - a0;
      if (x.label) { const kl = smooth(seg(s, a0, a0 + 0.5 * span)); put(x.label, 'opacity', f3(kl)); put(x.label, 'transform', `translate3d(0, ${px((1 - kl) * 14)}, 0)`); }
      x.headLines.forEach((ln, i) => put(ln, '--k', f3(smooth(seg(s, a0 + (0.15 + 0.2 * i) * span, a0 + (0.75 + 0.2 * i) * span)))));
      // spec rows: stagger in with the arrival, then light in step with the explode (the newest one gold)
      const n = x.rows.length, ex = timeline[j].explode, es = ex[1] - ex[0];
      let hot = -1;
      x.rows.forEach((row, i) => {
        const b0 = a0 + (0.45 + (0.5 * i) / Math.max(1, n - 1)) * span;
        put(row, '--in', f3(smooth(seg(s, b0, b0 + 0.45 * span))));
        const b = ex[0] + (0.02 + (0.83 * i) / Math.max(1, n)) * es;
        const on = smooth(seg(s, b, b + 0.11 * es));
        put(row, '--on', f3(on));
        if (on > 0.5) hot = i;
      });
      if (!x.keepHot && s > timeline[j].settle[0] + 0.3 * (timeline[j].settle[1] - timeline[j].settle[0])) hot = -1;
      if (hot !== x.lastHot) { x.rows.forEach((row, i) => { row.classList.toggle('is-hot', i === hot); x.marks[i]?.classList.toggle('is-hot', i === hot); }); x.lastHot = hot; }
    });
    put(el, '--td-hand', f3(hand));

    // shot 0's construction lines and ticker: the lines come up as the run arrives and the orbit gets going, gone as
    // the hand-off begins (opacity only: composited, nothing is redrawn)
    const h0 = T0.hand[0];
    const linesOut = 1 - smooth(seg(s, h0 - 0.05, h0 + 0.14));
    // nothing to frame yet (a jump before the scene has drawn and before the stand-in still has arrived): no lines, no
    // ticker round an empty stage; they ease in (0.3 s) once either shows
    const ready = drawn || !heroStill || (heroStill.complete && heroStill.naturalWidth > 0);
    gate += ((ready ? 1 : 0) - gate) * Math.min(1, (v.dt || 0.016) * 6);
    if (gate > 0.995) gate = 1; else if (gate < 0.005) gate = 0;
    const lin = masked ? linesOut * smooth(seg(s, -0.8, 0.1)) * gate : 0;
    lineEls.forEach((ln) => { const v2 = f2(lin); put(ln, 'opacity', v2); put(ln, 'visibility', v2 === '0.00' ? 'hidden' : 'visible'); });
    if (tick) {
      // the scale turns with the orbit, redrawn in 0.5° steps and at most every other frame (each redraw re-uploads the
      // canvas: at 30 Hz a turntable scale reads the same and costs half)
      const deg = Math.round(-150 * (k === 0 ? ph.orbit : 1) * 2) / 2;
      if (deg !== disc._deg && tick.style.opacity !== '0.00' && v.frame - (disc._at || -9) >= 2) { disc._deg = deg; disc._at = v.frame; drawTick(disc, deg); }
      const to = f2(linesOut * smooth(seg(s, -0.7, -0.2)) * gate);
      put(tick, 'opacity', to); put(tick, 'visibility', to === '0.00' ? 'hidden' : 'visible');
    }

    // part markers (desktop; tablets and phones for rows with data-anchor3d: all of them on tablets, the lit row's
    // only on phones): the current shot's, on their parts in the exploded frame, through the shader's transform.
    // Rows with data-anchor3d (td:camera3d): the section sets each marker's fade here and the scene places it, right
    // after it poses this frame (live.place3d below), from its anchors relative to the pin: no lag behind the parts.
    if (mk) {
      const fout = fl.wout ? 1 : 1 - smooth(seg(s, r.L + 0.25, r.L + 0.48));
      const lv = drawn ? live : null;
      const A3 = drawn && live.anchors3d ? live.anchors3d : null;
      shots.forEach((x, j) => {
        const ex = timeline[j].explode, es = ex[1] - ex[0];
        const step = Math.min(0.032, 0.26 / Math.max(1, x.marks.length - 1));   // a long list (Method's twelve) staggers tighter: all in by the hold
        x.marks.forEach((m, i) => {
          if (!m) return;
          let kk = j === k ? smooth(seg(s, ex[0] + (0.85 + step * i) * es, ex[0] + (0.95 + step * i) * es)) * fout * (1 - smooth(seg(cut, 0, 0.3))) : 0;
          if (!mkAll) kk = i === x.lastHot && j === k ? smooth(seg(s, ex[0] + 0.85 * es, ex[0] + 0.95 * es)) * fout : 0;   // phones: one, no stagger
          const id3 = A3 ? x.rows[i]?.dataset.anchor3d : null;
          if (id3) { m._kk = kk; m._id3 = id3; return; }
          m._id3 = null;
          put(m, 'opacity', f3(Math.min(1, kk * 1.6)));
          put(m, 'visibility', kk > 0 ? 'visible' : 'hidden');
          put(m, '--k', f3(kk));
          if (kk <= 0) return;
          const A = x.anchors[i];
          tdProject(A.u, A.v, S, V, lv, A.d, Q);
          side(m, Q.x);
          put(m, 'transform', `translate3d(${px(Q.x)}, ${px(Q.y)}, 0)`);
        });
      });
      live.place3d?.(live.anchors3d);
    }
  };

  // td:camera3d: the scene calls this right after it poses (anchors in pin px; visible = revealed x facing x not covered)
  live.place3d = (A) => {
    if (!A || !mk) return;
    for (const x of shots) x.marks.forEach((m) => {
      if (!m || !m._id3) return;
      const a = A.find((q) => q.id === m._id3);
      const kk = (m._kk || 0) * (a ? a.visible : 0);
      put(m, 'opacity', f3(Math.min(1, kk * 1.6)));
      put(m, 'visibility', kk > 0 ? 'visible' : 'hidden');
      put(m, '--k', f3(kk));
      if (kk <= 0) return;
      if (!mkAll) side(m, a.x);
      else if (a.lead && m._ang !== a.lead.angle) {      // the 3D anchor's own leader direction (labels spread round the parts)
        m._ang = a.lead.angle;
        m.style.setProperty('--ang', `${a.lead.angle}deg`); m.style.setProperty('--lx', px(a.lead.dx * 42)); m.style.setProperty('--ly', px(a.lead.dy * 42));
      }
      put(m, 'transform', `translate3d(${px(a.x)}, ${px(a.y)}, 0)`);
    });
  };

  measure();
  onResize(measure);
  onLayout(() => {
    // fonts / late layout: re-measure only when something that matters moved
    if (pin.clientWidth !== heroR.w || pin.clientHeight !== heroR.h || target.offsetTop !== colR.y || target.offsetWidth !== colR.w
      || (tall && copyTopNow() !== copyTop)
      || shots.some((x) => x.head && x.head.clientWidth !== x.head._td?.w) || (giant && giant.clientWidth !== giant._td?.w)) measure();
  });
  document.fonts?.ready.then(() => { for (const x of shots) if (x.head) x.head._td.w = -1; if (giant) giant._td.w = -1; measure(); });
  onFrame(frame);
  // WebGL off: the fixed plate under the run is not composited while the run (its own black) covers the screen
  coverPlates(el);
}

/* each shot's colour key onto its DOM layer (--k0 centre, --k1 edge): the still path and the static layout use it */
function keys(el) {
  const shotEls = tdShots(el);
  shotEls.forEach((sEl, j) => {
    const key = tdKey(sEl.dataset.tdKey), k = el.querySelector(`.td__key[data-td-still="${j}"]`);
    if (!key || !k) return;
    const c = (o) => `rgb(${Math.round(key[o] * 255)},${Math.round(key[o + 1] * 255)},${Math.round(key[o + 2] * 255)})`;
    k.style.setProperty('--k0', c(0)); k.style.setProperty('--k1', c(3));
  });
}

export function init() {
  const blocks = [...document.querySelectorAll('.td[data-td]')];
  blocks.forEach((el, i) => {
    el.dataset.tdReady = '';
    keys(el);
    if (REDUCED) { el.classList.add('td-static'); return; }
    block(el, i);
  });
}
