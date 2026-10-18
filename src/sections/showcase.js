/* V · Showcase: seven posters on a turning arc.
   One pure function of scroll (arcAt) drives three things that have to agree:
     - the WebGL scene (src/gl/scenes/posters.js): paper planes on the arc in a lit umber room;
     - a CSS-3D proxy of the very same arc (the seven poster <button>s, same camera, same positions):
       it is what you see until the posters scene has drawn (and if WebGL never boots), then it stays
       as invisible keyboard / screen-reader targets exactly over the WebGL posters;
     - the caption: the creator name (from F64–F70) and "0N / 07" (F72's pattern).
   Static mode (no JS, ?tier=0, reduced motion): the list is a plain grid / scroll-snap row.
   The active index is exposed as state.active and as a "showcase:active" event on the section. */
import './showcase.css';
import { onFrame, clamp, smooth, seg, lenis } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { REDUCED, TIER, FINE } from '../core/env.js';
import { openModal } from '../ui/modal.js';

export const N = 7;
const HOLD = [0.17, 0.83];                    // within each step: hold, ease across, hold
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const pad = (n) => String(n).padStart(2, '0');

export const state = {
  items: [],          // { slug, src, title, name, tag, aspect }
  L: null,            // layout, measured on resize (see measure())
  y: NaN, ver: -1,
  pos: 0,             // arc position: k when poster k is centred (float)
  active: 0, flex: 0, lights: 1, pinTop: 0, visible: false,
  ptr: { x: 0, y: 0, inside: false }, hover: -1,
  gl: false,          // the posters scene has drawn
  pick: null,         // set by the scene: (clientX, clientY) -> poster index | -1
  onGL: null,
};

/* scroll y -> arc state (cached per y + layout version) */
export function arcAt(y) {
  const L = state.L;
  if (!L || (y === state.y && L.ver === state.ver)) return state;
  state.y = y; state.ver = L.ver;
  const g = geo(L.run);
  const span = Math.max(1, g.height - L.pinH);
  const pinTop = y < g.top ? g.top - y : (y > g.top + span ? g.top + span - y : 0);
  const r = clamp(clamp((y - g.top) / span) * N - 0.5, 0, N - 1);
  const i = Math.floor(r);
  const t = seg(r - i, HOLD[0], HOLD[1]);
  let pos = i + smoother(t);
  // the arc swings into place as the pin arrives and on as it leaves; the light comes up with it
  const tin = clamp(pinTop / L.vh), tout = clamp(-pinTop / L.vh);
  pos += 0.85 * (smooth(tout) - smooth(tin));
  state.pos = pos;
  state.pinTop = pinTop;
  state.flex = t > 0 && t < 1 ? (30 * t * t * (1 - t) * (1 - t)) / 1.875 : 0;
  state.lights = 1 - 0.6 * smooth(Math.max(tin, tout));
  state.visible = pinTop < L.vh && pinTop > -L.pinH;
  state.active = clamp(Math.round(pos), 0, N - 1);
  return state;
}

/* poster k on the arc at position pos -> o { d, x, z, ry, dim, alpha } (world px, slot centre = origin) */
export function place(k, pos, o) {
  const L = state.L, d = k - pos, th = d * L.A;
  o.d = d;
  o.x = L.R * Math.sin(th);
  o.z = L.R * (Math.cos(th) - 1);
  o.ry = th * L.rotK;
  o.dim = L.dimMin + (1 - L.dimMin) * Math.exp(-1.6 * d * d);
  o.alpha = 1 - smooth(seg(Math.abs(d), L.fade0, L.fade1));
  return o;
}

export function init() {
  const sec = document.getElementById('showcase');
  if (!sec) return;
  const run = sec.querySelector('[data-sc-run]');
  const pin = sec.querySelector('[data-sc-pin]');
  const list = sec.querySelector('[data-sc-list]');
  const lis = [...list.children];
  const cards = lis.map((li) => li.querySelector('[data-sc-card]'));
  state.items = lis.map((li) => {
    const img = li.querySelector('img');
    const [name, tag] = img.alt.split(' — ');
    return { slug: li.dataset.slug, src: img.getAttribute('src'), title: img.alt, name, tag, aspect: +img.getAttribute('width') / +img.getAttribute('height') };
  });

  const animated = TIER > 0 && !REDUCED;
  let quiet = false;

  /* ── modal: the large poster, its full title, Previous / Next ─────────── */
  function openPoster(k) {
    let cur = k;
    const fig = document.createElement('figure');
    fig.className = 'scm'; fig.dataset.theme = 'dark';
    fig.innerHTML = `<div class="scm__art"><img class="scm__img" alt="" decoding="async"></div>
      <figcaption class="scm__cap">
        <p class="scm__n"><b></b><span> / 07</span></p>
        <h2 class="scm__title" id="modal-title"><span class="scm__nm"></span> <span class="scm__tag"></span></h2>
        <div class="scm__nav"><button class="scm__btn" type="button" data-prev>Previous</button><button class="scm__btn" type="button" data-next>Next</button></div>
      </figcaption>`;
    const img = fig.querySelector('.scm__img'), num = fig.querySelector('.scm__n b');
    const nm = fig.querySelector('.scm__nm'), tag = fig.querySelector('.scm__tag');
    const prev = fig.querySelector('[data-prev]'), next = fig.querySelector('[data-next]');
    let token = 0;
    const show = (n, first) => {
      cur = n;
      const it = state.items[n];
      num.textContent = pad(n + 1); nm.textContent = it.name; tag.textContent = `— ${it.tag}`;
      prev.disabled = n === 0; next.disabled = n === N - 1;
      if (document.activeElement === prev && prev.disabled) next.focus();
      if (document.activeElement === next && next.disabled) prev.focus();
      const apply = () => { img.src = it.src; img.alt = it.title; img.width = 1200; img.height = Math.round(1200 / it.aspect); fig.classList.remove('is-swapping'); };
      if (first) return apply();
      // decode the next poster before swapping, so the frame never flashes empty
      const my = ++token, pre = new Image();
      fig.classList.add('is-swapping');
      pre.src = it.src;
      pre.decode().catch(() => {}).then(() => { if (my === token) apply(); });
    };
    prev.addEventListener('click', () => cur > 0 && show(cur - 1));
    next.addEventListener('click', () => cur < N - 1 && show(cur + 1));
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' && cur > 0) { e.preventDefault(); show(cur - 1); }
      if (e.key === 'ArrowRight' && cur < N - 1) { e.preventDefault(); show(cur + 1); }
    };
    document.addEventListener('keydown', onKey);
    show(k, true);
    const fromCard = cards.includes(document.activeElement);
    sec.classList.add('is-modal');
    openModal(fig, {
      onClose() {
        document.removeEventListener('keydown', onKey);
        sec.classList.remove('is-modal');
        if (!animated) return;
        // the arc turns to the poster you were last looking at
        quiet = true;
        if (cur !== state.active) goTo(cur);
        setTimeout(() => { if (fromCard) cards[cur].focus({ preventScroll: true }); quiet = false; }, 0);
      },
    });
  }

  if (!animated) {
    cards.forEach((b, k) => b.addEventListener('click', () => openPoster(k)));
    return;
  }

  /* ── animated: the pinned run ─────────────────────────────────────────── */
  sec.classList.add('sc-on');
  const slot = sec.querySelector('[data-sc-slot]');
  const names = [...sec.querySelectorAll('[data-sc-names] > span')];
  const numEl = sec.querySelector('[data-sc-num]');
  const dot = sec.querySelector('[data-sc-dot]');
  const capEl = sec.querySelector('[data-sc-cap]');
  const rule = dot.parentElement;
  const rail = document.querySelector('.rail');
  const o = { d: 0, x: 0, z: 0, ry: 0, dim: 1, alpha: 1 };
  let ruleW = 0, lastY = NaN, lastActive = -1, lastHover = false, lastProxy = true;

  function measure() {
    const pr = pin.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    if (!sr.height) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const H = sr.height;
    const cx = sr.left - pr.left + sr.width / 2, cy = sr.top - pr.top + H / 2;
    const phone = vw < 720;
    const wide = H * 0.8;                                   // the widest poster (4:5)
    // arc length between neighbours and arc radius: gentle on desktop; in portrait a tighter turn, so the
    // neighbours show as slivers at the edges and never cut through the centred poster, even mid-turn
    const s = wide * (phone ? 1.0 : 1.12);
    const R = s * (phone ? 1.65 : 2.45);
    const railW = rail ? rail.offsetWidth : 0;              // 0 below 1024 px (display: none)
    const edge = phone ? [0, 10, vw - 10, vw]
      : railW ? [railW * 0.45, railW + 64, vw - 280, vw - 4]
      : [0, vw * 0.09, vw * 0.91, vw];
    state.L = {
      run, ver: (state.L?.ver ?? 0) + 1, vw, vh, pinH: pr.height, cx, cy, H, phone,
      D: pr.height * (phone ? 1.9 : 1.8),
      s, R, A: s / R, rotK: phone ? 1.05 : 0.92,
      gap: H * 0.045, dimMin: phone ? 0.3 : 0.2,
      fade0: phone ? 1.15 : 1.45, fade1: phone ? 1.9 : 2.45,
      edge,
    };
    const L = state.L;
    list.style.perspective = `${L.D}px`;
    list.style.perspectiveOrigin = `${cx}px ${cy}px`;
    list.style.setProperty('--l0', `${edge[0]}px`); list.style.setProperty('--l1', `${edge[1]}px`);
    list.style.setProperty('--r0', `${edge[2]}px`); list.style.setProperty('--r1', `${edge[3]}px`);
    lis.forEach((li, k) => {
      const w = H * state.items[k].aspect;
      li.style.width = `${w}px`; li.style.height = `${H}px`;
      li.style.left = `${cx - w / 2}px`; li.style.top = `${cy - H / 2}px`;
    });
    ruleW = rule.clientWidth;
    lastY = NaN;
  }
  requestAnimationFrame(measure);
  onLayout(measure);

  function goTo(k) {
    const L = state.L;
    if (!L) return;
    const g = geo(run);
    const y = g.top + ((k + 0.5) / N) * Math.max(1, g.height - L.pinH);
    if (lenis) lenis.scrollTo(y, { duration: Math.min(2.2, 0.9 + 0.28 * Math.abs(k - state.pos)), easing: (t) => 1 - Math.pow(1 - t, 3) });
    else window.scrollTo(0, y);
  }
  const glOn = () => state.gl && document.documentElement.classList.contains('gl-ready');
  const activate = (k, keyboard) => {
    if (keyboard || (k === state.active && Math.abs(state.pos - k) < 0.3)) openPoster(k);
    else goTo(k);
  };

  // keyboard / screen reader / pre-WebGL pointer: the real buttons
  cards.forEach((b, k) => {
    b.addEventListener('focus', () => { lastY = NaN; if (!quiet && b.matches(':focus-visible') && k !== state.active) goTo(k); });
    b.addEventListener('click', (e) => { e.stopPropagation(); activate(k, e.detail === 0); });
  });
  // WebGL: the buttons let the pointer through and the scene ray-casts the click
  pin.addEventListener('click', (e) => {
    if (!glOn() || !state.pick) return;
    const k = state.pick(e.clientX, e.clientY);
    if (k >= 0) activate(k, false);
  });
  if (FINE) {
    pin.addEventListener('pointermove', (e) => { state.ptr.x = e.clientX; state.ptr.y = e.clientY; state.ptr.inside = true; });
    pin.addEventListener('pointerleave', () => { state.ptr.inside = false; });
  }
  state.onGL = () => sec.classList.add('is-gl');

  // per frame: the proxy follows the arc, the caption follows the active poster
  onFrame((v) => {
    if (!state.L) return;
    arcAt(v.y);
    const hover = state.ptr.inside && state.hover >= 0 && glOn();
    if (hover !== lastHover) { pin.classList.toggle('is-hover', hover); lastHover = hover; }
    // while WebGL draws, the proxy only has to be in place for a focused button's ring
    const proxy = !glOn() || list.contains(document.activeElement);
    if (!state.visible || (v.y === lastY && proxy === lastProxy)) return;
    lastY = v.y; lastProxy = proxy;
    const { pos, lights } = state;
    for (let k = 0; proxy && k < N; k++) {
      place(k, pos, o);
      const li = lis[k];
      li.style.transform = `translate3d(${o.x.toFixed(2)}px,0,${o.z.toFixed(2)}px) rotateY(${o.ry.toFixed(4)}rad)`;
      li.style.opacity = o.alpha.toFixed(3);
      li.style.zIndex = String(100 - Math.round(Math.abs(o.d) * 10));
      li.style.setProperty('--shade', (1 - o.dim * lights).toFixed(3));
    }
    dot.style.transform = `translate3d(${(clamp(pos / (N - 1)) * ruleW).toFixed(1)}px,0,0)`;
    // the caption leaves with the posters (the stage dissolves them into the next chapter as the pin goes)
    capEl.style.opacity = (1 - smooth(seg(-state.pinTop / state.L.vh, 0.18, 0.5))).toFixed(3);
    const a = state.active;
    if (a !== lastActive) {
      names.forEach((n, k) => { n.classList.toggle('is-on', k === a); n.classList.toggle('is-before', k < a); n.classList.toggle('is-after', k > a); });
      numEl.textContent = pad(a + 1);
      lastActive = a;
      sec.dispatchEvent(new CustomEvent('showcase:active', { detail: { index: a, name: state.items[a].name } }));
    }
  });
}
