/* VIII · Directors: the alpha film and the names.
   - The film (two painted portraits on transparency): VP9-with-alpha WebM, or HEVC-with-alpha MP4 on WebKit
     (Safari plays WebM but not its alpha). Phones (narrow, not WebKit) get the 1280px VP9 encode (data-dr-sm); it is
     the first source, so if it were missing the browser would simply fall through to the full one.
   - Loading: two and a half screens before it is reached the film gets its poster (frame 1, a transparent WebP);
     the film itself starts loading then on wide screens, but only 0.6 of a screen ahead on narrow ones, and never
     when the reader asked to save data or is on a 2G/3G connection (the poster stands). It plays only while it is
     in view (IntersectionObserver), and fades in once the poster or a frame is there, so nothing pops.
     No JS: a <noscript> still of the same frame.
   - The names run on a serif line behind the heads: its position is a pure function of scroll (one period of
     the repeated pair over the run's pass), so scrolling back is exact. It fades in as it rises from the fold.
   - Portrait screens: the film is taller than the screen is wide; the pin pans the camera from one portrait to the
     other, resting on each (the pan runs over the middle 40% of the pin).
   REDUCED: the poster only (the film is never downloaded); the names stand still (the static layout). */
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
  const run = sec.querySelector('[data-dr-run]');
  const film = sec.querySelector('[data-dr-film]');
  const video = sec.querySelector('[data-dr-video]');
  const track = sec.querySelector('[data-dr-track]');
  const band = sec.querySelector('[data-dr-band]');

  /* ── the film ── */
  const narrow = window.innerWidth < 900, webkit = isWebKit();
  if (!narrow || webkit) video.querySelector('source[data-dr-sm]')?.remove();
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
    loaded = true; video.preload = 'auto'; video.load();
  };
  const sync = () => {
    if (inView && !posterOnly) { load(); video.play().catch(() => {}); }
    else if (!video.paused) video.pause();
  };
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
  const measure = () => {
    period = units[1].offsetLeft - units[0].offsetLeft;
    tall = window.innerWidth < window.innerHeight;
    W = video.offsetWidth; room = window.innerWidth - film.offsetLeft;   // the width the film can show (right of the rail)
  };
  requestAnimationFrame(measure);
  onLayout(measure);
  document.fonts?.ready.then(measure);

  let lastT = '', lastF = '', lastO = '';
  onFrame((v) => {
    const g = geo(run);
    if (v.y + v.vh < g.top - 2 || v.y > g.bottom + 2) return;
    const pe = clamp((v.y + v.vh - g.top) / (g.height + v.vh));       // 0 entering … 1 gone
    const pin = clamp((v.y - g.top) / Math.max(1, g.height - v.vh));   // 0 pinned … 1 released
    const x = -period * (0.16 + (tall ? 1.5 : 1) * pe);
    const t = `translate3d(${x.toFixed(1)}px,0,0)`;
    if (t !== lastT) { track.style.transform = t; lastT = t; }
    // the line fades in as it rises: nothing at the chapter's anchor (where it would sit sliced by the fold),
    // whole by the time it is well inside the screen
    const o = smooth(clamp((v.y + v.vh - g.top) / (v.vh * 0.4) - 0.75)).toFixed(3);
    if (o !== lastO) { band.style.opacity = o; lastO = o; }
    // the film rises a little faster than the page as the stage arrives
    const rise = 1 - smooth(clamp((v.y + v.vh - g.top) / v.vh));
    // portrait screens: from the first head's centre (22.5% of the frame) to the second's (72.5%), resting on each
    let tx = 0;
    if (W > room + 1) tx = clamp(room / 2 - W * (0.225 + 0.5 * smooth(seg(pin, 0.3, 0.7))), room - W, 0);
    const f = `translate3d(${tx.toFixed(1)}px,${(rise * 12).toFixed(2)}%,0)`;
    if (f !== lastF) { film.style.transform = f; lastF = f; }
  });
}
