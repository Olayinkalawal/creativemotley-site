/* Hero (v3, 2026-10-21): the Creation in daylight, the real-time 3D camera floating in the fingertip gap, and the fly
   through its lens into I Storytellers.
   Everything runs on screens of scroll since the top (s = scrollY / innerHeight; the 190svh section's pin holds
   0 … 0.9). One clock, shared with the stage's scene (gl/scenes/hero3d.js imports HERO, heroSlot and heroLive):
     0     – 0.12   the golden frame's veil and the construction lines dissolve (scrubbed); past 0.045 its mark and index
                    fly to the rail (desktop: a 0.6 s FLIP, rows staggered 20 ms; reversed on the way back up)
     0.04  – 0.30   the camera stops its idle turn, turns lens-on, drifts from the gap to the screen's centre, grows 2.5×
     0.30  – 0.70   the push along the lens axis: the front element fills the screen, then the dark glass
     0.66  – 0.74   the iris blades come up out of the dark glass
     0.74  – 0.89   the aperture opens from the centre onto the School of Athens (already in place behind it)
     the three beats: 0.10–0.30 (the sky), 0.34–0.54 and 0.58–0.76 (over the camera, then its dark glass)
   Where it is drawn:
     '3d'  the stage's hero3d scene draws the painting, the live camera, the iris and Storytellers (desktop, and phones
           above core/env.js CAM3D); the DOM still below steps aside once the live camera has drawn at rest;
     '2d'  everywhere else (phones below the gate, ?tier=0, the moments before the GLB is in, a failed load): the
           fixed .hero__fly layer plays the same move with stills (transforms and opacity only): the camera at rest
           (cam-hero), turning lens-on (cam-front), the lens close-up (cam-lens), nine iris blades, and (without the
           stage) a Storytellers layer framed as the CSS plate it hands over to;
     reduced motion: the still at rest; no push and no iris (the stage's CSS plates cut to Storytellers).
   Per frame only diffed, quantised writes (nothing at rest). */
import { onFrame, onResize, seg, smooth, clamp, lerp, view } from '../core/scroll.js';
import { geo } from '../core/layout.js';
import { REDUCED, isDesktop } from '../core/env.js';

const root = document.documentElement;

/* ── the painting and the camera move (public/assets/scenes/hero/manifest.json: focus, phoneFocus, propCentre, faces) ── */
export const HERO = {
  // the camera's centre (uv, y down) on the line between the fingertips (his at 0.432, 0.397; hers at 0.550, 0.355), a
  // little under the gap's centre so it clears the mark by 12 px or more; its width a share of the painting's
  desktop: { aspect: 16 / 9, focus: [0.5, 0.5], gap: [0.491, 0.392], camW: 0.088 },
  // phones: the 'reach' crop of the same painting (desktop uv x 0.334 … 0.648), so the camera keeps its size to the hands
  phone: { aspect: 9 / 16, focus: [0.5, 0.376], gap: [0.5, 0.392], camW: 0.088 / 0.314 },
  faces: [[0.319, 0.336, 0.05, 0.08], [0.697, 0.207, 0.05, 0.08]],   // desktop uv centre + radii (the lines avoid them)
  crop: [0.334, 0.314],                                              // the phone crop's left edge and width (desktop uv)
  rest: { az: -35, el: 8 },                                          // the still's pose (and the live camera's at rest)
  T: { dock: 0.045, turn: [0.04, 0.3], push: [0.3, 0.7], blades: [0.66, 0.74], iris: [0.74, 0.89], end: 0.9, dark: 0.47 },
  grow: 2.5, near: 0.14,                                             // ×2.5 by the end of the turn; the push ends 0.14 off the glass
};
/* the stills (scripts/hero-cam-stills.mjs, from the module at the rest pose and lens-on; metadata written beside them):
   w, h (px); upx: world units per image px at the target's depth; t: the target (the body's centre) in image px;
   lens: the front element's centre in image px; bw: the camera's silhouette width at rest in px (cam-hero) */
export const STILLS = {
  hero: { src: '/assets/scenes/hero/cam-hero', w: 520, h: 520, upx: 0.00260127, t: [260, 260], lens: [399, 291.3], bw: 419.9 },
  front: { src: '/assets/scenes/hero/cam-front', w: 520, h: 520, upx: 0.00260127, t: [260, 260], lens: [294.6, 279] },
  lens: { src: '/assets/scenes/hero/cam-lens', w: 1600, h: 1600, upx: 0.000286497, t: [800, 800] },
  fov: 14,                                                           // the stills' vertical field (degrees)
};
export const PORTRAIT_MQ = window.matchMedia('(orientation: portrait) and (max-width: 1023px)');
/* the painting's cover fit on this screen (the CSS plate's and the stage's): the share of its width and height on
   screen (sx, sy), the view centre (cx, cy: uv, y down), its displayed size (css px) and uv -> screen */
export function heroArt(vw, vh, portrait = PORTRAIT_MQ.matches) {
  const A = portrait ? HERO.phone : HERO.desktop;
  const ra = vw / vh, ia = A.aspect;
  const sx = Math.min(1, ra / ia), sy = Math.min(1, ia / ra);
  const cx = clamp(A.focus[0], sx / 2, 1 - sx / 2), cy = clamp(A.focus[1], sy / 2, 1 - sy / 2);
  const dw = vw / sx, dh = vh / sy;
  const toScreen = (u, v) => [(u - (cx - sx / 2)) * dw, (v - (cy - sy / 2)) * dh];
  return { portrait, A, sx, sy, cx, cy, dw, dh, toScreen };
}
/* where the camera floats: its centre and its silhouette's width at rest (css px) */
export function heroSlot(vw, vh, portrait = PORTRAIT_MQ.matches) {
  const art = heroArt(vw, vh, portrait);
  const [x, y] = art.toScreen(art.A.gap[0], art.A.gap[1]);
  return { x, y, w: art.A.camW * art.dw, art };
}
/* the move as numbers (both renderers): turn 0 … 1, the push's eased progress, the iris, and the distance ratio
   dRest / dist (how much bigger the camera is than at rest) */
export function heroMove(s) {
  const T = HERO.T;
  const turn = smooth(seg(s, T.turn[0], T.turn[1]));
  const pRaw = seg(s, T.push[0], T.push[1]);
  const push = pRaw * pRaw * (3 - 2 * pRaw);
  return { s, turn, pRaw, push, blades: smooth(seg(s, T.blades[0], T.blades[1])), iris: smooth(seg(s, T.iris[0], T.iris[1])),
    toLens: smooth(seg(pRaw, 0, 0.6)) };
}
/* the push's distance (world units) from the rest distance: exponential in the eased progress, so the dolly's rate is
   even to the eye (×2.5 during the turn, then on to 0.14 off the glass) */
export function heroDist(dRest, m) {
  const d1 = dRest / (1 + (HERO.grow - 1) * m.turn);
  if (m.push <= 0) return d1;
  return Math.exp(lerp(Math.log(dRest / HERO.grow), Math.log(HERO.near), m.push));
}
/* shared with gl/scenes/hero3d.js: which renderer has the hero ('2d' | '3d'), what the 3D scene publishes (box: the
   camera's silhouette in css px; dRest), and two hooks for the drag-to-turn track: drag { az, el } (degrees, added to the
   pose) and zoom { k, at: [x, y] } (closer by k about a screen point); the scene reads them every frame (call
   window.__stage.invalidate() after a change) */
export const heroLive = { mode: '2d', s: 0, shift: [0, 0], box: null, dRest: 0, ready: false, drag: { az: 0, el: 0 }, zoom: null };

function linesSVG(w, h, fr) {
  // golden-ratio construction around the centred frame: nested golden rectangles, quarter arcs,
  // the two long diagonals, a centre cross and a circle through the frame's corners
  const phi = 1.618034;
  const fw = fr.width, fh = fr.height, x0 = fr.left, y0 = fr.top, cx = x0 + fw / 2, cy = y0 + fh / 2;
  const L = [];
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

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';   // --ease-out

export function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const pin = hero.querySelector('.hero__pin');
  const frame = hero.querySelector('[data-frame]');
  const lines = hero.querySelector('[data-lines]');
  const beatsBox = hero.querySelector('.beats');
  const beats = [...hero.querySelectorAll('[data-beat]')];
  const dek = hero.querySelector('.frame__dek');
  const nav = frame.querySelector('nav');
  const fly = hero.querySelector('[data-fly]');
  const camBox = fly?.querySelector('[data-fly-cam]');
  const lensEl = fly?.querySelector('[data-fly-lens]');
  const irisEl = fly?.querySelector('[data-fly-iris]');
  const blades = irisEl ? [...irisEl.children] : [];
  const storyEl = fly?.querySelector('[data-fly-story]');
  const cssStage = () => root.classList.contains('css-stage');
  const heroPlate = document.querySelector('.plates [data-plate="hero"]');
  const storyPlate = document.querySelector('.plates [data-plate="storytellers"]');

  /* ── geometry: the slot, the stills' boxes, the lines' masks (on resize) ─────────────────────────────────────── */
  let slot = heroSlot(innerWidth, innerHeight), fovR = STILLS.fov, dRest = 1, ppu0 = 1, beatBox = [];
  const place = () => {
    const vw = innerWidth, vh = innerHeight;
    slot = heroSlot(vw, vh);
    // the 2D move's camera: px per world unit at rest (the still's silhouette spans slot.w), and the rest distance that
    // gives it for this screen's field (the 3D scene derives the same from its own fit)
    fovR = (slot.art.portrait ? 16 : 14) * Math.PI / 180;
    ppu0 = slot.w / (STILLS.hero.bw * STILLS.hero.upx);
    dRest = (vh / 2) / (ppu0 * Math.tan(fovR / 2));
    // the construction lines keep off the two faces and the camera (soft holes in their mask)
    const holes = [];
    if (!slot.art.portrait) for (const [u, v, ru, rv] of HERO.faces) { const [x, y] = slot.art.toScreen(u, v); holes.push([x, y, ru * slot.art.dw, rv * slot.art.dh]); }
    holes.push([slot.x, slot.y, slot.w * 0.9, slot.w * 0.75]);
    const m = holes.map(([x, y, rx, ry]) => `radial-gradient(${rx.toFixed(0)}px ${ry.toFixed(0)}px at ${x.toFixed(0)}px ${y.toFixed(0)}px, transparent 45%, #000 100%)`).join(', ');
    lines.style.setProperty('--holes', m);
    // each beat's line box (css px, the pin's frame: it is pinned at the viewport's top while the beats play), before its
    // fade's offset: the beats turn cream where the camera's dark body reaches them (below)
    beatBox = beats.map((b) => ({ x0: b.offsetLeft - b.offsetWidth / 2, x1: b.offsetLeft + b.offsetWidth / 2, y0: b.offsetTop - b.offsetHeight / 2, y1: b.offsetTop + b.offsetHeight / 2 }));
    last.clear();
  };

  /* ── the construction lines: drawn in on load, then settle to 40% (ink at 0.16 → about 0.06 over the faces' zone) ── */
  const draw = () => {
    const p = pin.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    lines.innerHTML = linesSVG(p.width, p.height, { left: f.left - p.left, top: f.top - p.top, width: f.width, height: f.height });
    if (REDUCED) { lines.classList.add('is-rest'); return; }
    for (const [i, el] of [...lines.querySelectorAll('path,line,rect,circle')].entries()) {
      const len = el.getTotalLength ? el.getTotalLength() : 2000;
      el.style.strokeDasharray = `${len}`; el.style.strokeDashoffset = `${len}`;
      el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1800 + i * 40, delay: 200 + i * 55, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    }
    setTimeout(() => lines.classList.add('is-rest'), 3000);
  };
  const last = new Map();   // diffed writes (below)
  place(); draw();
  onResize(() => { place(); draw(); measureFlip(); });

  /* ── the camera stills: inserted after the first paint (this runs after it), low priority, decoded off the main
     thread, in a fixed box (the swap to the live camera moves nothing) ─────────────────────────────────────────── */
  const pick = (base) => `${base}.avif`;
  let avif = true;
  const still = (key, cls) => {
    const S = STILLS[key];
    const im = new Image();
    im.alt = ''; im.decoding = 'async'; im.fetchPriority = 'low'; im.width = S.w; im.height = S.h;
    im.className = `fly__still fly__still--${cls}`;
    im.addEventListener('error', () => { if (avif) { avif = false; im.src = `${S.src}.webp`; } }, { once: true });
    im.src = avif ? pick(S.src) : `${S.src}.webp`;
    return im;
  };
  let heroStill = null, frontStill = null, lensLoaded = false, storyLoaded = false;
  /* the first paint's still is drawn into a canvas (not shown as an <img>): a canvas is never a Largest Contentful Paint
     candidate, so the LCP stays the frame's dek (the copy), not a 40 KB still that lands after it. Its backing store is
     sized for twice its rest size on this screen (the turn grows it 2.5x while it fades). */
  if (camBox) {
    const S = STILLS.hero, cv = document.createElement('canvas');
    cv.className = 'fly__still fly__still--hero';
    cv.style.width = `${S.w}px`; cv.style.height = `${S.h}px`;
    camBox.append(cv);
    heroStill = cv;
    const im = still('hero', 'hero');
    const paint = () => {
      const k = Math.min(1, (slot.w / S.bw) * Math.min(3, window.devicePixelRatio || 1) * 2);
      cv.width = Math.round(S.w * k); cv.height = Math.round(S.h * k);
      const g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, 0, 0, cv.width, cv.height);
    };
    im.addEventListener('load', () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(paint));
    onResize(() => { if (im.complete && im.naturalWidth) paint(); });
  }
  const lazyFront = () => { if (!frontStill && camBox) { frontStill = still('front', 'front'); frontStill.style.opacity = '0'; camBox.append(frontStill); } };
  const lazyLens = () => {
    if (lensLoaded || !lensEl) return;
    lensLoaded = true;
    lensEl.addEventListener('error', () => { lensEl.src = `${STILLS.lens.src}.webp`; }, { once: true });
    lensEl.src = `${STILLS.lens.src}.avif`;
  };
  const lazyStory = () => {
    if (storyLoaded || !storyEl) return;
    storyLoaded = true;
    storyEl.style.backgroundImage = `url(${PORTRAIT_MQ.matches ? '/assets/scenes/storytellers/phone-828.webp' : '/assets/scenes/storytellers/desktop-2048.webp'})`;
  };

  /* ── FLIP: the frame's mark and index rows fly to the rail's (desktop), as a 0.6 s animation once past s 0.045 ── */
  const heroMark = hero.querySelector('[data-flip-src="mark"]');
  const railMark = document.querySelector('.rail [data-flip="mark"]');
  const heroRows = [...hero.querySelectorAll('[data-flip-src="index"] li')];
  const railIndex = document.querySelector('.rail [data-flip="index"]');
  let rows = null, markD = null;
  const anims = new Set();
  const cancelAll = () => { for (const a of anims) a.cancel(); anims.clear(); };
  function measureFlip() {
    rows = null; markD = null;
    if (!isDesktop() || !railMark || !railIndex) return;
    cancelAll();
    const railRows = [...railIndex.querySelectorAll('li')];
    const r = (el) => el?.getBoundingClientRect();
    const a = r(heroMark), b = r(railMark);
    if (a && b && a.width) markD = { dx: a.left - b.left, dy: a.top - b.top, s: a.width / b.width };
    rows = heroRows.map((li, i) => {
      const rl = railRows[i];
      if (!rl) return null;
      return ['.nm', '.rn'].map((q) => {
        const h = li.querySelector(q), t = rl.querySelector(q);
        const ha = r(h), tb = r(t);
        return h && t && ha && tb ? { h, t, dx: ha.left - tb.left, dy: ha.top - tb.top } : null;
      }).filter(Boolean);
    });
  }
  requestAnimationFrame(measureFlip);
  document.fonts?.ready.then(measureFlip);
  const play = (el, kf, i = 0) => {
    const an = el.animate(kf, { duration: 600, delay: i * 20, easing: EASE, fill: 'backwards' });
    anims.add(an); an.finished.then(() => anims.delete(an), () => anims.delete(an));
  };
  // to the rail: the rail's copies start where the hero's are and land on their own (the hero's hide at once)
  const flyToRail = () => {
    if (!rows || REDUCED) return;
    cancelAll();
    if (markD) play(railMark, [{ transform: `translate(${markD.dx}px, ${markD.dy}px) scale(${(0.7 * markD.s).toFixed(4)})`, opacity: 1 }, { transform: 'scale(0.7)', opacity: 1 }]);
    rows.forEach((pairs, i) => pairs?.forEach(({ t, dx, dy }) => play(t, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], i + 1)));
  };
  // and back: the hero's copies start on the rail's and land home
  const flyHome = () => {
    if (!rows || REDUCED) return;
    cancelAll();
    if (markD) play(heroMark, [{ transform: `translate(${-markD.dx}px, ${-markD.dy}px) scale(${(1 / markD.s).toFixed(4)})` }, { transform: 'none' }]);
    rows.forEach((pairs, i) => pairs?.forEach(({ h, dx, dy }) => play(h, [{ transform: `translate(${-dx}px, ${-dy}px)` }, { transform: 'none' }], i + 1)));
  };

  // each beat's window in screens (data-beat="from to"); fades take 0.05 screens at each end
  const beatWin = beats.map((b, i) => { const w = (b.dataset.beat || '').split(/\s+/).map(Number); return w.length === 2 && w.every(Number.isFinite) ? w : [0.1 + 0.24 * i, 0.3 + 0.24 * i]; });
  // diffed writes: every value is quantised and written only when it changes, so the hero at rest writes nothing per
  // frame, and the frame's line and veil are touched only while they fade
  const put = (el, key, prop, val) => {
    if (!el || last.get(key) === val) return;
    last.set(key, val);
    if (prop.charCodeAt(0) === 45) el.style.setProperty(prop, val); else el.style[prop] = val;
  };
  const q = (v) => (Math.round(v * 100) / 100).toString();
  const px = (v) => `${v.toFixed(1)}px`;
  let lastDocked = null, lastOut = null, lastInert = null, lastDark = null, lastMode = null, lastTheme = null, lastS = 0;
  const railParts = [railMark, railIndex].filter(Boolean);
  for (const el of railParts) el.inert = true;

  onFrame((v) => {
    const g = geo(hero);
    const vh = v.vh, vw = v.vw;
    const s = Math.max(0, (v.y - g.top) / Math.max(1, vh));   // screens since the top
    heroLive.s = s;
    const T = HERO.T;
    // frame veil and lines dissolve over the first stretch (scrubbed)
    const out = smooth(seg(s, 0.0, 0.12));
    put(lines, 'lines', 'opacity', q(1 - smooth(seg(s, 0, 0.07))));
    put(frame, 'veil', '--veil', q(1 - out));
    put(frame, 'line', '--line-a', q(0.85 * (1 - out)));
    put(dek, 'dek', 'opacity', q(1 - smooth(seg(s, 0, 0.06))));
    const isOut = out > 0.98;
    if (isOut !== lastOut) { frame.classList.toggle('is-out', isOut); lastOut = isOut; }

    // the dock: past s 0.045 (or once the hero is behind the reader) the mark and index belong to the rail
    const desk = !!rows && isDesktop();
    const docked = s > T.dock || v.y > g.bottom - vh;
    if (docked !== lastDocked) {
      const jump = view.jump || Math.abs(s - lastS) > 0.5 || lastDocked === null;
      root.classList.toggle('rail-docked', docked);
      frame.classList.toggle('is-docked', docked && desk);
      if (desk && !jump && s < 0.6) (docked ? flyToRail : flyHome)();
      for (const el of railParts) el.inert = !docked;
      lastDocked = docked;
    }
    // phones and narrow windows: no rail; the mark and index fade with the veil. On desktop the inline value is
    // cleared, so .frame.is-docked hides them (a frame drawn before measureFlip had run, or a window widened past
    // 1024, left an inline opacity of 1 that kept the frame's copies on screen beside the rail's: phase 4 verify)
    const fadeTo = desk ? '' : q(1 - out);
    put(heroMark, 'mo', 'opacity', fadeTo);
    put(frame.querySelector('[data-flip-src="index"]'), 'io', 'opacity', fadeTo);
    const inert = out > 0.5 || (docked && desk);
    if (inert !== lastInert) { nav.inert = inert; if (inert) nav.setAttribute('aria-hidden', 'true'); else nav.removeAttribute('aria-hidden'); lastInert = inert; }

    // the beats: ink with a cream halo over the bright painting; cream with an ink halo once the camera's dark body
    // and glass are behind them (a class; their colour eases over 0.3 s). p5: by geometry, not at a fixed s: the
    // camera's top crossed beat 2 at s 0.433 (1440) / 0.446 (390), and the switch came at 0.47 (ink over the dark
    // camera between). In 3D: once the camera's silhouette box (heroLive.box) reaches the showing line above its
    // descent (the lowest fifth of the line box: no glyph ink there) and spans it; in 2D: from s 0.43
    const mode = heroLive.mode;
    const ib = beatWin.findIndex(([a0, z]) => s >= a0 && s < z), L = beatBox[ib], bx = heroLive.box;
    const over = ib >= 0 && (mode === '3d' && bx && L ? bx.y0 < L.y1 - 0.2 * (L.y1 - L.y0) && bx.x0 < L.x1 && bx.x1 > L.x0 : s > 0.43);
    // (reduced motion: no push, the painting stays behind them until Storytellers; past the hero, Storytellers' own theme)
    const dark = REDUCED ? s > T.end : s > T.dark || over;
    if (dark !== lastDark) { beatsBox.classList.toggle('is-dark', dark); lastDark = dark; }
    // the chrome reads the hero's theme (core/chapters.js): light over the painting, dark over the dark glass (its own
    // test: the header is still over the sky when the camera reaches beat 2)
    const theme = (REDUCED ? s > T.end : s > T.dark) ? 'dark' : 'light';
    if (theme !== lastTheme) { hero.dataset.theme = theme; lastTheme = theme; }
    beats.forEach((b, i) => {
      const [a0, z] = beatWin[i];
      const k = REDUCED ? (s >= a0 && s < z ? 1 : 0) : Math.min(smooth(seg(s, a0, a0 + 0.05)), 1 - smooth(seg(s, z - 0.05, z)));
      const kq = Math.round(k * 1000) / 1000;
      put(b, `bo${i}`, 'opacity', String(kq));
      put(b, `bt${i}`, 'transform', `translate(-50%, calc(-50% + ${((1 - kq) * (s < (a0 + z) / 2 ? 18 : -18)).toFixed(1)}px))`);
    });

    // ── the fly layer (the 2D move; in '3d' it only holds the still until the live camera has drawn) ──
    if (!fly) { lastS = s; return; }
    const two = mode !== '3d';
    if (mode !== lastMode) { fly.dataset.mode = mode; lastMode = mode; }
    // visible while the hero (or its hand-off) is on screen: without the stage, until the Storytellers plate has come up
    const storyUp = cssStage() ? (storyPlate?.classList.contains('is-on') && heroPlate && !heroPlate.classList.contains('is-on') && s > 1.5) : s >= T.end;
    const onHero = REDUCED ? (!cssStage() || !heroPlate || heroPlate.classList.contains('is-on')) && s < 1.6 : !storyUp && s < 2.2;
    put(fly, 'fly', 'visibility', onHero ? 'visible' : 'hidden');
    if (!onHero) { lastS = s; return; }
    const m = heroMove(REDUCED ? 0 : s);
    // the 2D camera: the target point (the body's centre, then the front element's) at the screen point (slot → centre)
    const cx = vw / 2, cy = vh / 2;
    const dist = heroDist(dRest, m);
    const ppu = (vh / 2) / (dist * Math.tan(fovR / 2));                   // px per world unit now
    const sh = heroLive.shift;                                              // the painting's parallax at the hands (3D scene)
    const tx = lerp(slot.x + (two ? 0 : sh[0]), cx, m.turn), ty = lerp(slot.y + (two ? 0 : sh[1]), cy, m.turn);
    // the stills: each placed so its target (body centre → lens centre, as the push moves on) lands on (tx, ty)
    const placeStill = (el, S, key) => {
      if (!el) return;
      const k = ppu * S.upx;                                                // css px per image px
      const ix = lerp(S.t[0], S.lens?.[0] ?? S.t[0], m.toLens), iy = lerp(S.t[1], S.lens?.[1] ?? S.t[1], m.toLens);
      put(el, `${key}t`, 'transform', `translate(${px(tx - ix * k)}, ${px(ty - iy * k)}) scale(${(k).toFixed(5)})`);
    };
    if (two && !REDUCED) {
      if (m.turn > 0.01) lazyFront();
      if (s > 0.3) lazyLens();
      if (s > 0.55 && cssStage()) lazyStory();
    }
    placeStill(heroStill, STILLS.hero, 'h');
    placeStill(frontStill, STILLS.front, 'f');
    // each layer fades in over the one before it, which stays opaque underneath until it is covered (no see-through):
    // the turn: the lens-on still over the three-quarter one; the push: the lens close-up over the camera once the front
    // element nears the screen's size (the 3D's dist ~1.6 … 1.08); the blades over the close-up
    const kF = smooth(seg(m.turn, 0.35, 0.65));
    // (the close-up covers the screen once dist <= dCover: its 1600 px at this field and distance span the longer side)
    const dCover = (vh / 2) * STILLS.lens.upx * STILLS.lens.w / (Math.tan(fovR / 2) * Math.max(vw, vh));
    const kL = two ? smooth(seg(dist, dCover * 1.5, dCover)) : 0;
    const camOn = mode === '3d' ? (heroLive.ready ? 0 : 1) : kL < 1 ? 1 : 0;
    put(heroStill, 'ho', 'opacity', q((kF < 1 ? 1 : 0) * camOn));
    put(frontStill, 'fo', 'opacity', q(kF * camOn));
    if (lensEl) {
      put(lensEl, 'lo', 'opacity', q(two && m.iris <= 0 ? kL : 0));
      if (two && kL > 0) {
        const L = STILLS.lens, k = ppu * L.upx;
        put(lensEl, 'lt', 'transform', `translate(${px(cx - L.t[0] * k)}, ${px(cy - L.t[1] * k)}) scale(${k.toFixed(5)})`);
      }
    }
    // the iris: nine blades (half-planes, as the model's), each pushed out to the aperture's inradius, turning 30° as it
    // opens
    const irisOn = two && m.blades > 0;
    put(irisEl, 'io2', 'opacity', q(irisOn ? m.blades : 0));
    if (irisOn) {
      const D = Math.hypot(vw, vh) / 2, R = m.iris * D * 1.04, rot = 30 * m.iris;
      blades.forEach((b, i) => put(b, `bl${i}`, 'transform', `rotate(${(rot + i * 40).toFixed(2)}deg) translate(-50%, ${px(R)})`));
    }
    // Storytellers under the iris: without the stage only (the stage draws it under the blades itself)
    if (storyEl) put(storyEl, 'so', 'opacity', two && cssStage() && m.iris > 0 ? '1' : '0');
    lastS = s;
  });
}
