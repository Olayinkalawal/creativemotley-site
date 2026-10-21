/* IX · Directors: the alpha film and the names.
   - The film (two painted portraits on transparency): VP9-with-alpha WebM, or HEVC-with-alpha MP4 on WebKit
     (Safari plays WebM but not its alpha). Wherever the film is drawn at most ~1400 device pixels wide (phones, 1x
     screens up to 1440 wide) the 1280px VP9 encode (data-dr-sm) is used, else the 1920px one; the small one is the
     first source, so if it were missing the browser would simply fall through to the full one.
   - Loading: two and a half screens before it is reached the film gets its poster (frame 1, a transparent WebP);
     the film itself starts loading then on wide screens, but only 0.6 of a screen ahead on narrow ones, and never
     when the reader asked to save data or is on a 2G/3G connection (the poster stands). It plays only while it is
     in view (IntersectionObserver) and faded in (it fades in with the dissolve into the room), and fades in once
     the poster or a frame is there, so nothing pops. It plays once (20 s) and holds its last frame; its Pause / Play
     button stops it at any time.
     No JS: a <noscript> still of the same frame.
   - The names run on a serif line behind the heads: its position is a pure function of scroll (one period of
     the repeated pair over the stage's pass), so scrolling back is exact. It fades in as it rises from the fold.
   - The film fades in with the stage's own dissolve from the set's painting into the umber room (the same mix the
     stage computes), so the cut-outs never stand over the set.
   - Portrait screens: the film is wider than the screen; the scroll pans the camera from one portrait to the other
     while the film rises whole across the screen (no pin there: the first portrait rises in, the second leaves).
   REDUCED: the poster only (the film is never downloaded); no running line (the static layout: the people list
   names them). */
import './directors.css';
import { onFrame, clamp, smooth, seg } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { REDUCED } from '../core/env.js';

const isWebKit = () => { const ua = navigator.userAgent; return /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Android/.test(ua); };
// the reader asked to save data, or the connection is slow: the poster is the film
const lite = () => { const c = navigator.connection; return !!c && (c.saveData === true || /(^|-)(2g|3g)$/.test(c.effectiveType || '')); };

export function init() {
  const sec = document.getElementById('directors');
  if (!sec) return;
  const stage = sec.querySelector('[data-dr-stage]');
  const film = sec.querySelector('[data-dr-film]');
  const run = sec.querySelector('[data-dr-run]');
  const video = sec.querySelector('[data-dr-video]');
  const track = sec.querySelector('[data-dr-track]');
  const band = sec.querySelector('[data-dr-band]');

  /* ── the film ── */
  // the 1280 px encode wherever the film is drawn at most ~1400 device pixels wide (phones, 1x laptops up to 1440:
  // the column there is 1152 px), the 1920 px one on wider or denser screens
  const narrow = window.innerWidth < 900, webkit = isWebKit();
  const railW = window.innerWidth >= 1024 ? Math.min(288, Math.max(200, window.innerWidth * 0.2)) : 0;
  const filmPx = Math.min(window.innerWidth - railW, window.innerHeight * 0.74 * 16 / 9) * (window.devicePixelRatio || 1);
  const small = narrow || filmPx <= 1400;
  if (!small || webkit) video.querySelector('source[data-dr-sm]')?.remove();
  if (webkit) { const mp4 = video.querySelector('source[type^="video/mp4"]'); if (mp4) video.prepend(mp4); }
  const posterOnly = REDUCED || lite();
  video.muted = true;
  const ready = () => video.classList.add('is-ready');
  video.addEventListener('loadeddata', ready, { once: true });
  let loaded = false, inView = false, still = false;
  const poster = () => {
    const src = video.dataset.poster;
    if (still || !src) return;
    still = true;
    const img = new Image();
    img.onload = ready; img.src = src;
    video.poster = src;
  };
  const load = () => {
    poster();
    if (loaded || posterOnly) return;
    // load() first: it re-runs source selection over the sources as they now stand (the parser already picked a
    // candidate from the markup's order, and flipping preload first would start fetching that one)
    loaded = true; video.load(); video.preload = 'auto';
  };
  // it plays only while it can be seen: in view, and faded in (shown, below); decoding a hidden alpha film is the
  // costliest thing in the chapter
  // the reader's pause (its button, shown wherever the film can play); the film plays once, then holds its last frame
  // (phase 4: it looped for as long as it was in view)
  const toggle = sec.querySelector('[data-dr-toggle]');
  let shown = REDUCED, held = false;
  const label = () => { if (toggle) toggle.textContent = held || video.ended ? 'Play' : 'Pause'; };
  const sync = () => {
    if (inView && !posterOnly) { load(); if (shown && !held && !video.ended) video.play().catch(() => {}); else if (!video.paused) video.pause(); }
    else if (!video.paused) video.pause();
  };
  if (toggle && !posterOnly) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      if (video.ended) { video.currentTime = 0; held = false; }
      else held = !held;
      label(); sync();
    });
    video.addEventListener('ended', label);
    video.addEventListener('play', label);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) (narrow ? poster : load)(); }, { rootMargin: '250% 0px' }).observe(film);
    if (narrow) new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) load(); }, { rootMargin: '60% 0px' }).observe(film);
    new IntersectionObserver((es) => { for (const e of es) inView = e.isIntersecting; sync(); }, { threshold: 0.1 }).observe(video);
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); else sync(); });
  } else load();

  if (REDUCED) return;

  /* ── the running line and the pan ── */
  sec.classList.add('dr-on');
  const units = track.querySelectorAll('.dr-unit');
  let period = 0, tall = false, W = 0, room = 0;
  const dis = parseFloat(run?.dataset.dissolve) || 0.4;   // the stage's dissolve half-width here (viewports; its default 0.4)
  const measure = () => {
    period = units[1].offsetLeft - units[0].offsetLeft;
    tall = window.innerWidth < window.innerHeight;
    W = video.offsetWidth; room = window.innerWidth - film.offsetLeft;   // the width the film can show (right of the rail)
  };
  requestAnimationFrame(measure);
  onLayout(measure);
  document.fonts?.ready.then(measure);

  let lastT = '', lastF = '', lastO = '', lastFO = '';
  onFrame((v) => {
    const g = geo(stage);
    if (v.y + v.vh < g.top - 2 || v.y > g.bottom + 2) return;
    const pe = clamp((v.y + v.vh - g.top) / (g.height + v.vh));       // 0 entering … 1 gone
    const x = -period * (0.16 + (tall ? 1.5 : 1) * pe);
    const t = `translate3d(${x.toFixed(1)}px,0,0)`;
    if (t !== lastT) { track.style.transform = t; lastT = t; }
    // the line fades in as it rises (it sits 0.38 screen below the stage's top): nothing while the stage's top is
    // below the middle of the screen (the line would sit sliced by the fold, over the set), whole once it is at 0.2
    const o = smooth(clamp((0.5 - (g.top - v.y) / v.vh) / 0.3)).toFixed(3);
    if (o !== lastO) { band.style.opacity = o; lastO = o; }
    // the film (and the names line behind it) rides a little ahead of the page as the stage arrives, so the heads are
    // up in the room as soon as the set has dissolved, never a bare umber screen with the dek alone at its top
    // (phase 4; it used to lag 12% behind)
    const rise = 1 - smooth(clamp((v.y + v.vh - g.top) / v.vh));
    const lead = -rise * 0.3 * W;
    // portrait screens: from the first head's centre (22.5% of the frame) to the second's (72.5%), while the film is
    // whole on screen (no pin there: the stage's top from 0.3 screen down to 0.05, the film rising whole)
    let tx = 0;
    if (W > room + 1) tx = clamp(room / 2 - W * (0.225 + 0.5 * smooth(seg((v.y - g.top) / v.vh, -0.3, -0.05))), room - W, 0);
    const ly = (lead * 0.5625).toFixed(1);   // W is the film's width; its height is 9/16 of it
    const f = `translate3d(${tx.toFixed(1)}px,${ly}px,0)`;
    if (f !== lastF) { film.style.transform = f; band.style.transform = `translate3d(0,${ly}px,0)`; lastF = f; }
    // the portraits never stand over the set's painting: they fade in with the stage's own dissolve at this boundary
    // (gl/stage.js: mix = 0.5 + d / 2w around the reading line, w = data-dissolve viewports), from 0.6 to 0.9 of it
    const mix = clamp(0.5 + (0.5 * v.vh - (g.top - v.y)) / (2 * dis * v.vh));
    const fo = smooth(seg(mix, 0.6, 0.9)).toFixed(3);
    if (fo !== lastFO) {
      film.style.opacity = fo; lastFO = fo;
      if (toggle) { toggle.style.opacity = fo; toggle.style.visibility = +fo > 0.02 ? '' : 'hidden'; }   // never an invisible focus stop
    }
    const sh = +fo > 0.02;
    if (sh !== shown) { shown = sh; sync(); }
  });
}
