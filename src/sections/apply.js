/* X · Apply: the "Contact ✦" marquee runs with scroll; the stickers are real links you can drag
   (pointer events, a little inertia, clamped to the field). A press that doesn't move follows the link. */
import './apply.css';
import { onFrame, clamp } from '../core/scroll.js';
import { geo } from '../core/layout.js';
import { REDUCED } from '../core/env.js';

export function init() {
  const foot = document.querySelector('.contact');
  if (!foot) return;
  const track = foot.querySelector('[data-ct-track]');
  const field = foot.querySelector('[data-ct-field]');
  const root = document.documentElement;
  let x = 0;
  onFrame((v) => {
    const g = geo(foot);
    const on = v.y + v.vh > g.top && v.y < g.bottom;
    root.classList.toggle('ct-over', v.y + v.vh - 40 > g.top);
    if (!on || REDUCED) return;
    x -= (0.6 + Math.min(18, Math.abs(v.velocity) * 0.35)) * (v.dt * 60);
    const w = track.scrollWidth / 2;
    if (-x > w) x += w;
    track.style.transform = `translate3d(${x}px,0,0)`;
  });

  for (const st of field.querySelectorAll('.st')) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dx = 0, dy = 0, vx = 0, vy = 0, lx = 0, ly = 0, moved = false, id = null, raf = 0;
    const rot = getComputedStyle(st).getPropertyValue('--rot') || '0deg';
    const place = (tilt = 0) => { st.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${rot}) rotateY(${tilt}deg)`; };
    const bounds = () => {
      const f = field.getBoundingClientRect(), r = st.getBoundingClientRect();
      return { minX: f.left - (r.left - dx), maxX: f.right - (r.right - dx), minY: f.top - (r.top - dy), maxY: f.bottom - (r.bottom - dy) };
    };
    st.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      id = e.pointerId; st.setPointerCapture(id); moved = false;
      sx = e.clientX; sy = e.clientY; ox = dx; oy = dy; lx = sx; ly = sy; vx = vy = 0;
      cancelAnimationFrame(raf); st.classList.add('is-lifted'); st.style.zIndex = String(++init.z || (init.z = 10));
    });
    st.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const mx = e.clientX - sx, my = e.clientY - sy;
      if (Math.hypot(mx, my) > 5) moved = true;
      const b = bounds();
      dx = clamp(ox + mx, b.minX, b.maxX); dy = clamp(oy + my, b.minY, b.maxY);
      vx = e.clientX - lx; vy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      place(clamp(vx * 1.5, -18, 18));
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; st.classList.remove('is-lifted');
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
