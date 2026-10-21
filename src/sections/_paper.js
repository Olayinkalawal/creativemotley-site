/* Shared paper components (owner: builder A; B, D and E import them read-only).
   No `init` export on purpose: the section auto-loader imports this file but must not run anything.

     import { initPaper } from './_paper.js';      // inits every component found inside a root
     initPaper(document.querySelector('#mychapter'));
   or one at a time: initFan(el), initCloud(el), initPhotoCard(el). Each is idempotent (safe to call twice)
   and returns an unsubscribe. Styles come from ./_paper.css (imported below).

   Motion is a pure function of scroll position (via onFrame + geo), so scrolling back is exact. The pointer
   only adds a small, eased tilt on fine pointers. REDUCED: components are laid out once in their resting
   pose and never move. None of this needs WebGL.

   ── 1 · feature block (CSS only) ─────────────────────────────────────────────────────────────────
   <div class="pf" data-reveal>
     <h4 class="pf__label">Label</h4>
     <p class="pf__body">Serif body.</p>                       (add .pf--sans on .pf for a grey sans body)
     <a class="boxlink" href="…">Link text <span class="ar">↗</span></a>
   </div>

   ── 2 · notes fan: initFan(ul) ───────────────────────────────────────────────────────────────────
   <ul class="fan" data-fan>
     <li class="fan__card">
       <span class="fan__thumb" aria-hidden="true"><picture><source type="image/avif" srcset="…-240.avif 240w, …-480.avif 480w"
         sizes="(max-width: 899px) 44vw, 240px"><img src="…-480.webp" srcset="…" sizes="…" alt="" width="480" height="360"
         loading="lazy" decoding="async"></picture></span>   (a crop of the chapter's own painting: public/assets/thumbs/crops)
       <p class="fan__note">Note text</p>
     </li> …
   </ul>
   A row fanned in 3D on wide screens; below 900px two columns laid out by CSS, which JS only tilts a little
   (--fan-mode: grid). Opens as it rises into view, then drifts and turns with scroll; tilts toward the pointer.
   data-fan-spread="0.8" packs the row tighter. The thumb holds a <picture> (a crop file, AVIF + WebP).

   ── 3 · command cloud: initCloud(div) ─────────────────────────────────────────────────────────────
   <div class="cloud" data-cloud>
     <ul class="cloud__list">
       <li class="cloud__node" style="--x:60;--y:20;--z:.8;--mx:55;--my:12">/command</li>
       <li class="cloud__node cloud__card" data-theme="dark" style="--x:30;--y:46;--z:1">
         <span class="cloud__cmd">/command</span><span class="cloud__note">Note</span>
       </li>
     </ul>
     <div class="cloud__echoes" aria-hidden="true"><span class="cloud__node" style="--x:14;--y:10;--z:.25">/command</span> …</div>
   </div>
   --x/--y: centre in % of the cloud (--mx/--my on phones); --z: depth 0 (far, small, faint) … 1 (near).
   --cloud-drift on the cloud: how far nodes travel with scroll (× viewport height, default .5; a compact cloud less).
   Nearer nodes travel further with scroll; hairlines join each node to its nearest neighbours.

   ── 4 · photo card: initPhotoCard(figure) ─────────────────────────────────────────────────────────
   <figure class="pc" data-pc>
     <div class="pc__frame">
       <div class="pc__mat" aria-hidden="true"><div class="pc__paint"><picture>…<img alt="" …></picture></div></div>
       <picture><source type="image/avif" …><source type="image/webp" …><img class="pc__img" src="…" alt="…" …></picture>
     </div>
     <figcaption class="pc__cap">Caption</figcaption>
   </figure>
   --pc-ar: mat height / width (default .625), --pc-inset: photo width / mat width (default .78).
   The paint drifts with scroll inside the mat; the card tilts a little under the pointer (3D only while it tilts).
   (.pc__paint.crop with --plate/--cx/--cy/--zoom still works: a crop of a plate as a background.)

   ── 5 · dense grid (CSS only) ─────────────────────────────────────────────────────────────────────
   <dl class="dense">
     <div class="dense__row"><dt class="dense__t">Title</dt><dd class="dense__d">Grey description.</dd></div> …
   </dl>
   Two columns of rows from 1024px, one below; each row is "title | description" from 640px, stacked below.

   ── camera keys for plate scenes: bindCamKeys(el) ─────────────────────────────────────────────────
   On an element with data-scene, data-cam-from-tall / data-cam-to-tall replace data-cam-from / -to on
   portrait viewports (width < height), where a 16:9 plate is cropped to a narrow strip. */
import './_paper.css';
import { onFrame, onResize, clamp, smooth, seg } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { REDUCED, FINE, TIER } from '../core/env.js';

const LIVE = !REDUCED;
const TILT = FINE && !REDUCED;
const pass = (g, v) => clamp((v.y + v.vh - g.top) / (g.height + v.vh));          // 0 entering … 1 gone
const near = (g, v) => g.top < v.y + v.vh * 1.25 && g.bottom > v.y - v.vh * 0.25;
const once = (el) => { if (!el || el.dataset.paperReady) return false; el.dataset.paperReady = '1'; return true; };
const f1 = (n) => n.toFixed(1), f2 = (n) => n.toFixed(2);

/* one shared pointer, -1..1 across the viewport, eased per frame (fine pointers only) */
const ptr = { x: 0, y: 0, tx: 0, ty: 0, on: false };
function usePointer() {
  if (ptr.on || !TILT) return ptr;
  ptr.on = true;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    ptr.tx = (e.clientX / window.innerWidth) * 2 - 1; ptr.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { ptr.tx = 0; ptr.ty = 0; });
  onFrame((v) => { const k = 1 - Math.pow(0.004, v.dt); ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k; });
  return ptr;
}

/* ── 2 · notes fan ─────────────────────────────────────────────────────────────────────────────── */
export function initFan(root) {
  if (!once(root)) return () => {};
  const cards = [...root.children].filter((c) => c.classList.contains('fan__card'));
  const n = cards.length;
  if (!n) return () => {};
  root.classList.add('is-live');
  const spread = parseFloat(root.dataset.fanSpread) || 1;
  const p = usePointer();
  let mode = 'row', W = 0, cw = 0, ch = 0;
  const last = new Array(n).fill('');

  const measure = () => {
    mode = getComputedStyle(root).getPropertyValue('--fan-mode').trim() || 'row';
    W = root.clientWidth; cw = cards[0].offsetWidth;
    ch = Math.max(...cards.map((c) => c.offsetHeight));
    if (mode === 'stack') root.style.height = `${Math.round((n - 1) * ch * 0.58 + ch + 64)}px`;
    else if (root.style.height) root.style.height = '';
    // row: each card lies over its left neighbour (a dealt hand), so every note's first words stay visible;
    // stack: each card lies over the one below it, so every note's text stays visible
    cards.forEach((c, i) => { c.style.zIndex = String(mode === 'stack' ? n - i : i + 1); });
  };

  /* s: how open the fan is (0 bunched … 1 open); d: scroll drift (-1 … 1); px, py: pointer */
  const pose = (i, s, d, px, py) => {
    const c = i - (n - 1) / 2;
    if (mode === 'grid') {   // CSS places the cards; they settle from a slight tilt and drift apart with scroll
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      const rz = side * (1.6 + (row % 2) * 0.8) * s + d * side * 0.8;
      const y = (1 - s) * 26 - d * 10 * side;
      return `translate3d(0,${f1(y)}px,0) rotate(${f2(rz)}deg)`;
    }
    if (mode === 'stack') {
      const side = i % 2 ? 1 : -1, step = ch * 0.58;
      const x = side * Math.min(cw * 0.5, Math.max(0, (W - cw) * 0.5 - 6)) * (0.25 + 0.75 * s);
      const y = c * step * (0.72 + 0.28 * s) - d * 18 * c;
      const rz = side * 3.2 * s + d * 2.4;
      const ry = -side * 9 * s + px * 6;
      const rx = (1 - s) * 18 - d * 5 - py * 4;
      return `perspective(1000px) translate3d(${f1(x)}px,${f1(y)}px,0) rotateX(${f2(rx)}deg) rotateY(${f2(ry)}deg) rotateZ(${f2(rz)}deg)`;
    }
    // neighbours overlap only by their margins, so every note stays readable
    const gap = Math.min(cw * 0.95 * spread, (W - cw * 1.1) / Math.max(1, n - 1));
    const x = c * gap * (0.28 + 0.72 * s) + d * -14;
    const y = (1 - s) * 70 + c * c * 10 * s - d * 34 * (1 + Math.abs(c) * 0.4);
    const rz = c * 5.2 * s + d * 4.2;
    const ry = -c * 7 * s + px * 8;
    const rx = (1 - s) * 16 - d * 7 - py * 5;
    const z = -Math.abs(c) * 36 * s;
    return `perspective(1200px) translate3d(${f1(x)}px,${f1(y)}px,${f1(z)}px) rotateX(${f2(rx)}deg) rotateY(${f2(ry)}deg) rotateZ(${f2(rz)}deg)`;
  };
  const apply = (s, d, px, py) => {
    for (let i = 0; i < n; i++) { const t = pose(i, s, d, px, py); if (t !== last[i]) { cards[i].style.transform = t; last[i] = t; } }
  };

  measure();
  const offR = onResize(() => { measure(); if (!LIVE) apply(1, 0, 0, 0); });
  const offL = onLayout(measure);
  if (!LIVE) { apply(1, 0, 0, 0); return () => { offR(); offL(); }; }
  const offF = onFrame((v) => {
    const g = geo(root);
    if (!near(g, v)) return;
    const t = pass(g, v);
    apply(smooth(seg(t, 0.04, 0.36)), clamp((t - 0.5) * 2, -1, 1), p.x, p.y);
  });
  return () => { offR(); offL(); offF(); };
}

/* ── 3 · command cloud ─────────────────────────────────────────────────────────────────────────── */
export function initCloud(root) {
  if (!once(root)) return () => {};
  const nodes = [...root.querySelectorAll('.cloud__node')];
  if (!nodes.length) return () => {};
  const NS = 'http://www.w3.org/2000/svg';
  let svg = root.querySelector('.cloud__lines');
  if (!svg) { svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'cloud__lines'); svg.setAttribute('aria-hidden', 'true'); root.prepend(svg); }
  const items = nodes.map((el) => ({ el, z: parseFloat(getComputedStyle(el).getPropertyValue('--z')) || 0.5, bx: 0, by: 0, dx: 0, dy: 0, last: '' }));
  let edges = [], vh = window.innerHeight, lastT = -1, lastP = '', amp = 0.5;

  const measure = () => {
    vh = window.innerHeight;
    amp = parseFloat(getComputedStyle(root).getPropertyValue('--cloud-drift')) || 0.5;   // scroll travel (× vh)
    // offsetLeft/Top ignore transforms; with translate:-50% -50% they are the node's centre (a node that hangs from an
    // edge instead, translate 0 -50%, has its centre half its width in)
    for (const it of items) {
      const edge = !/^-50%/.test(getComputedStyle(it.el).translate || '');
      it.bx = it.el.offsetLeft + (edge ? it.el.offsetWidth / 2 : 0); it.by = it.el.offsetTop;
    }
    const W = root.clientWidth, H = root.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // each node joins its two nearest neighbours (a sparse constellation)
    const seen = new Set(); edges = [];
    items.forEach((a, i) => {
      items.map((b, j) => ({ j, d: Math.hypot(a.bx - b.bx, a.by - b.by) })).filter((o) => o.j !== i)
        .sort((m, k) => m.d - k.d).slice(0, 2).forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
        });
    });
    svg.replaceChildren(...edges.map(() => document.createElementNS(NS, 'line')));
    lastT = -1;
    if (!LIVE) draw(0.5);
  };
  /* t = pass progress: nearer nodes travel further, so the cloud reads in depth */
  const draw = (t, px = 0, py = 0) => {
    for (const it of items) {
      const k = it.z - 0.42;
      it.dy = k * (0.5 - t) * vh * amp + py * k * -10;
      it.dx = k * (t - 0.5) * 36 + px * k * -14;
      const tr = `translate3d(${f1(it.dx)}px,${f1(it.dy)}px,0)`;
      if (tr !== it.last) { it.el.style.transform = tr; it.last = tr; }
    }
    const lines = svg.children;
    for (let e = 0; e < edges.length; e++) {
      const a = items[edges[e][0]], b = items[edges[e][1]], l = lines[e];
      l.setAttribute('x1', f1(a.bx + a.dx)); l.setAttribute('y1', f1(a.by + a.dy));
      l.setAttribute('x2', f1(b.bx + b.dx)); l.setAttribute('y2', f1(b.by + b.dy));
    }
  };

  const p = usePointer();
  requestAnimationFrame(measure);
  const offR = onResize(measure);
  const offL = onLayout(measure);
  document.fonts?.ready.then(measure);
  if (!LIVE) return () => { offR(); offL(); };
  const offF = onFrame((v) => {
    const g = geo(root);
    if (!near(g, v)) return;
    const t = pass(g, v), pk = `${f2(p.x)},${f2(p.y)}`;
    if (Math.abs(t - lastT) < 0.0004 && pk === lastP) return;
    lastT = t; lastP = pk;
    draw(t, p.x, p.y);
  });
  return () => { offR(); offL(); offF(); };
}

/* ── 4 · photo card ────────────────────────────────────────────────────────────────────────────── */
export function initPhotoCard(fig) {
  if (!once(fig)) return () => {};
  const frame = fig.querySelector('.pc__frame'), paint = fig.querySelector('.pc__paint'), img = fig.querySelector('.pc__img');
  if (!frame) return () => {};
  if (!LIVE) return () => {};
  const s = { x: 0, y: 0, tx: 0, ty: 0 };
  let lastF = '', lastP = '', lastI = '';
  if (TILT) {
    frame.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      const r = frame.getBoundingClientRect();
      s.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); s.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    });
    frame.addEventListener('pointerleave', () => { s.tx = 0; s.ty = 0; });
  }
  return onFrame((v) => {
    const g = geo(fig);
    if (!near(g, v)) return;
    const k = 1 - Math.pow(0.006, v.dt);
    s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k;
    const t = pass(g, v);
    // the 3D tilt (and its 3D rendering context, costly to composite while scrolling) only while the pointer leans on
    // the card; at rest the card is flat and only the paint and the photo drift (2D)
    const tilt = Math.abs(s.x) > 0.004 || Math.abs(s.y) > 0.004;
    const tf = tilt ? `perspective(1600px) rotateX(${f2(-s.y * 2.6)}deg) rotateY(${f2(s.x * 3.4)}deg)` : 'none';
    const tp = `translate3d(${f1(-s.x * 10)}px,${f2((0.5 - t) * 9)}%,0)`;
    const ti = tilt ? `translate3d(${f1(s.x * 5)}px,${f1(s.y * 5 + (0.5 - t) * -14)}px,${f1(28 + Math.hypot(s.x, s.y) * 10)}px)` : `translate3d(0,${f1((0.5 - t) * -14)}px,0)`;
    if (tf !== lastF) { frame.style.transform = tf; frame.classList.toggle('is-tilt', tilt); lastF = tf; }
    if (paint && tp !== lastP) { paint.style.transform = tp; lastP = tp; }
    if (img && ti !== lastI) { img.style.transform = ti; lastI = ti; }
  });
}

/* With WebGL off (tier 0, reduced motion) the fixed CSS plate under the page is composited every scrolled frame, even
   while an opaque sheet covers the whole screen (≈ 4 ms a frame here). coverPlates(paper) hides the plates layer while
   that sheet covers the viewport (html.is-papered); with the stage running the plates are hidden anyway. */
let papered = 0;
export function coverPlates(paper) {
  if (!paper || (TIER > 0 && !REDUCED)) return () => {};
  let on = false;
  return onFrame((v) => {
    const g = geo(paper);
    const c = g.top <= v.y - 24 && g.bottom >= v.y + v.vh;
    if (c === on) return;
    on = c; papered += c ? 1 : -1;
    document.documentElement.classList.toggle('is-papered', papered > 0);
  });
}

/* With WebGL off, the chapter's CSS plate cannot move like the stage's camera; landPlate(opener, name) cuts it once from
   the title's frame to the landing frame (html.is-landed-<name>, the frames are CSS in the chapter's stylesheet) when
   the opener's title has left the screen (t > at, in viewports of the opener's pass) and back above it. */
export function landPlate(opener, name, at = 1.36) {
  if (!opener || (TIER > 0 && !REDUCED)) return () => {};
  let on = false;
  const cls = `is-landed-${name}`;
  return onFrame((v) => {
    const g = geo(opener);
    const c = (v.y + v.vh - g.top) / v.vh > at;
    if (c === on) return;
    on = c; document.documentElement.classList.toggle(cls, c);
  });
}

/* every component inside a root */
export function initPaper(root = document) {
  if (!root) return;
  root.querySelectorAll('[data-fan]').forEach(initFan);
  root.querySelectorAll('[data-cloud]').forEach(initCloud);
  root.querySelectorAll('[data-pc]').forEach(initPhotoCard);
}

/* portrait viewports get their own camera keys (see header) */
export function bindCamKeys(el) {
  if (!el || !el.dataset.camFromTall) return;
  const wide = [el.dataset.camFrom, el.dataset.camTo];
  const tall = [el.dataset.camFromTall, el.dataset.camToTall || el.dataset.camFromTall];
  const pick = () => {
    const [a, b] = window.innerWidth < window.innerHeight ? tall : wide;
    if (el.dataset.camFrom !== a) el.dataset.camFrom = a;
    if (el.dataset.camTo !== b) el.dataset.camTo = b;
  };
  pick(); onResize(pick);
}
