/* X · Apply: the "Contact ✦" marquee runs on its own (a CSS animation, paused when nobody can see it or nobody is
   there, and with its own Pause button); the stickers are real links you can drag
   (pointer events, a little inertia, clamped to the field). A press that doesn't move follows the link. */
import './apply.css';
import { onFrame, clamp, idleFor, IDLE_LIFE } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { REDUCED } from '../core/env.js';
import { landPlate } from './_paper.js';

export function init() {
  // WebGL off: the CSS plate cuts to the keys' landing frame once the title has left (apply.css, html.is-landed-apply)
  landPlate(document.querySelector('#apply .opener'), 'apply', 1.3);
  const foot = document.querySelector('.contact');
  if (!foot) return;
  const track = foot.querySelector('[data-ct-track]');
  const field = foot.querySelector('[data-ct-field]');
  const root = document.documentElement;
  // the marquee: a CSS animation (apply.css: one transform, composited; its duration set here from the track's width,
  // ~36 px a second) that runs only while it can be seen and someone is there: on screen, the tab visible, input within
  // the last 10 s, and not paused with its button (phase 4: JS moved it every frame, idle or not)
  const toggle = foot.querySelector('[data-ct-toggle]');
  let paused = false, running = null, over = null, onScreen = false;
  const setDur = () => { const w = track.scrollWidth / 2; if (w > 0) track.style.setProperty('--ct-dur', `${(w / 36).toFixed(1)}s`); };
  const sync = () => {
    const run = onScreen && !paused && !REDUCED && !document.hidden && idleFor() < IDLE_LIFE;
    if (run !== running) { foot.classList.toggle('is-running', run); running = run; }
  };
  if (!REDUCED && toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => { paused = !paused; toggle.textContent = paused ? 'Play' : 'Pause'; sync(); });
  }
  requestAnimationFrame(setDur);
  onLayout(setDur);
  document.fonts?.ready.then(setDur);
  document.addEventListener('visibilitychange', sync);
  onFrame((v) => {
    const g = geo(foot);
    onScreen = v.y + v.vh > g.top && v.y < g.bottom;
    const o = v.y + v.vh - 40 > g.top;
    if (o !== over) { root.classList.toggle('ct-over', o); over = o; }
    sync();
  });

  for (const st of field.querySelectorAll('.st')) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dx = 0, dy = 0, vx = 0, vy = 0, lx = 0, ly = 0, moved = false, id = null, raf = 0;
    // touch: a press only arms the sticker; it becomes a drag after a sideways move (|dx| > |dy|, > 8 px) or a 300 ms
    // hold, so a vertical swipe that starts on a sticker scrolls the page (apply.css: touch-action pan-y on coarse
    // pointers). A mouse or pen drags at once, as before.
    let armed = null, holdT = 0, dragging = false;
    const rot = getComputedStyle(st).getPropertyValue('--rot') || '0deg';
    const place = (tilt = 0) => { st.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${rot}) rotateY(${tilt}deg)`; };
    const bounds = () => {
      const f = field.getBoundingClientRect(), r = st.getBoundingClientRect();
      return { minX: f.left - (r.left - dx), maxX: f.right - (r.right - dx), minY: f.top - (r.top - dy), maxY: f.bottom - (r.bottom - dy) };
    };
    const grab = (e) => {
      id = e.pointerId; dragging = true; armed = null; clearTimeout(holdT);
      try { st.setPointerCapture(id); } catch {}
      cancelAnimationFrame(raf); st.classList.add('is-lifted'); st.style.zIndex = String(++init.z || (init.z = 10));
    };
    st.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      moved = false; sx = e.clientX; sy = e.clientY; ox = dx; oy = dy; lx = sx; ly = sy; vx = vy = 0;
      if (e.pointerType === 'touch') {
        armed = e.pointerId;
        clearTimeout(holdT); holdT = setTimeout(() => { if (armed === e.pointerId) grab(e); }, 300);
        return;
      }
      grab(e);
    });
    st.addEventListener('pointermove', (e) => {
      if (armed === e.pointerId && !dragging) {
        const ax = Math.abs(e.clientX - sx), ay = Math.abs(e.clientY - sy);
        if (ax > 8 && ax > ay) grab(e);
        else if (ay > 8) { armed = null; clearTimeout(holdT); return; }   // a scroll: the browser has it
        else return;
      }
      if (e.pointerId !== id || !dragging) return;
      const mx = e.clientX - sx, my = e.clientY - sy;
      if (Math.hypot(mx, my) > 5) moved = true;
      const b = bounds();
      dx = clamp(ox + mx, b.minX, b.maxX); dy = clamp(oy + my, b.minY, b.maxY);
      vx = e.clientX - lx; vy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      place(clamp(vx * 1.5, -18, 18));
    });
    // a held (or sideways) touch drag owns the gesture: the page must not scroll under it
    st.addEventListener('touchmove', (e) => { if (dragging && e.cancelable) e.preventDefault(); }, { passive: false });
    const end = (e) => {
      if (armed === e.pointerId) { armed = null; clearTimeout(holdT); }
      if (e.pointerId !== id) return;
      id = null; dragging = false; st.classList.remove('is-lifted');
      if (REDUCED) { place(); return; }
      const glide = () => {
        vx *= 0.92; vy *= 0.92;
        const b = bounds();
        dx = clamp(dx + vx, b.minX, b.maxX); dy = clamp(dy + vy, b.minY, b.maxY);
        place();
        if (Math.abs(vx) + Math.abs(vy) > 0.2) raf = requestAnimationFrame(glide);
      };
      raf = requestAnimationFrame(glide);
    };
    st.addEventListener('pointerup', end);
    st.addEventListener('pointercancel', end);
    st.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } });
    st.addEventListener('dragstart', (e) => e.preventDefault());
  }
}
