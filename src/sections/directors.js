/* VIII · Directors: the alpha film and the names.
   - The film (two painted portraits on transparency): VP9-with-alpha WebM, or HEVC-with-alpha MP4 on WebKit
     (Safari plays WebM but not its alpha). It starts loading two and a half screens before it is reached and plays
     only while it is in view (IntersectionObserver); it fades in once it has a frame, so nothing pops.
   - The names run on a serif line behind the heads: its position is a pure function of scroll (one period of
     the repeated pair over the run's pass), so scrolling back is exact.
   - Portrait screens: the film is taller than the screen is wide; the pin pans the camera from one portrait to the other.
   REDUCED: the film shows its first frame and does not play; the names stand still (the static layout). */
import './directors.css';
import { onFrame, clamp, smooth } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { REDUCED } from '../core/env.js';

const isWebKit = () => { const ua = navigator.userAgent; return /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Android/.test(ua); };

export function init() {
  const sec = document.getElementById('directors');
  if (!sec) return;
  const run = sec.querySelector('[data-dr-run]');
  const film = sec.querySelector('[data-dr-film]');
  const video = sec.querySelector('[data-dr-video]');
  const track = sec.querySelector('[data-dr-track]');

  /* ── the film ── */
  if (isWebKit()) { const mp4 = video.querySelector('source[type^="video/mp4"]'); if (mp4) video.prepend(mp4); }
  video.muted = true;
  const ready = () => video.classList.add('is-ready');
  video.addEventListener('loadeddata', ready, { once: true });
  let loaded = false, inView = false;
  const load = () => { if (loaded) return; loaded = true; video.preload = 'auto'; video.load(); };
  const sync = () => {
    if (inView && !REDUCED) { load(); video.play().catch(() => {}); }
    else if (!video.paused) video.pause();
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) load(); }, { rootMargin: '250% 0px' }).observe(film);
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

  let lastT = '', lastF = '';
  onFrame((v) => {
    const g = geo(run);
    if (v.y + v.vh < g.top - 2 || v.y > g.bottom + 2) return;
    const pe = clamp((v.y + v.vh - g.top) / (g.height + v.vh));       // 0 entering … 1 gone
    const pin = clamp((v.y - g.top) / Math.max(1, g.height - v.vh));   // 0 pinned … 1 released
    const x = -period * (0.16 + (tall ? 1.5 : 1) * pe);
    const t = `translate3d(${x.toFixed(1)}px,0,0)`;
    if (t !== lastT) { track.style.transform = t; lastT = t; }
    // the film rises a little faster than the page as the stage arrives
    const rise = 1 - smooth(clamp((v.y + v.vh - g.top) / v.vh));
    // portrait screens: from the first portrait's centre (27% of the frame) to the second's (71%)
    let tx = 0;
    if (W > room + 1) tx = clamp(room / 2 - W * (0.27 + 0.44 * smooth(pin)), room - W, 0);
    const f = `translate3d(${tx.toFixed(1)}px,${(rise * 12).toFixed(2)}%,0)`;
    if (f !== lastF) { film.style.transform = f; lastF = f; }
  });
}
