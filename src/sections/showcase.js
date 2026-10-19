/* V · Showcase: seven posters on a turning arc.
   One pure function of scroll (arcAt) drives three things that have to agree:
     - the WebGL scene (src/gl/scenes/posters.js): paper planes on the arc in a lit umber room;
     - a CSS-3D proxy of the very same arc (the seven poster <button>s, same camera, same positions):
       it is what you see until the posters scene has drawn (and if WebGL never boots), then it stays
       as invisible keyboard / screen-reader targets exactly over the WebGL posters;
     - the caption: the creator name (from F64–F70) and "0N / 07" (F72's pattern).
   Static mode (no JS, ?tier=0, reduced motion): the list is a plain grid / scroll-snap row.
   The active index is exposed as state.active and as a "showcase:active" event on the section.
   Posters are <picture>s (AVIF, WebP fallback): small files for the static grid; in the animated run on desktop the
   proxy asks for the 1200-px file, the one the WebGL scene uploads, so each poster is fetched once.
   After the run: "Watch the work" (initVideos below), the XXL video cards. */
import './showcase.css';
import { onFrame, clamp, smooth, seg, lenis } from '../core/scroll.js';
import { geo, onLayout } from '../core/layout.js';
import { REDUCED, TIER, FINE, STILL } from '../core/env.js';
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
    const avif = li.querySelector('source[type="image/avif"]')?.srcset.match(/(\S+)\s+1200w/)?.[1] || null;
    return { slug: li.dataset.slug, src: img.getAttribute('src'), avif, title: img.alt, name, tag, aspect: +img.getAttribute('width') / +img.getAttribute('height') };
  });

  const animated = TIER > 0 && !REDUCED;
  initVideos(sec);
  // the animated run on desktop: the proxy shows the 1200-px poster (the WebGL texture: one fetch per poster)
  if (animated && !STILL) lis.forEach((li) => li.querySelectorAll('source, img').forEach((n) => n.setAttribute('sizes', '1200px')));
  // the modal's poster: the AVIF the page already has where the browser takes AVIF
  const big = (it) => (it.avif && lis.some((li) => li.querySelector('img').currentSrc.endsWith('.avif')) ? it.avif : it.src);
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
      const apply = () => { img.src = big(it); img.alt = it.title; img.width = 1200; img.height = Math.round(1200 / it.aspect); fig.classList.remove('is-swapping'); };
      if (first) return apply();
      // decode the next poster before swapping, so the frame never flashes empty
      const my = ++token, pre = new Image();
      fig.classList.add('is-swapping');
      pre.src = big(it);
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
      from: cards[k],
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

/* ── Watch the work: the XXL video cards (markup: src/partials/showcase.html, from docs/videos.json) ───────────
   - art: each card starts with its creator's poster composed 16:9 (no third-party request). Once Showcase is within
     about a screen, cards near the row's view ask i.ytimg.com for maxresdefault, then hqdefault; a 120×90 answer is
     YouTube's placeholder: no maxres → try hq; no hq → the id does not exist and the card is hidden. A blocked or
     failed request keeps the poster art.
   - play: the shared modal morphs from the card art (View Transitions); the youtube-nocookie iframe is created once
     the modal has opened and removed before it closes. No iframe exists until a click.
   - the row: native horizontal scroll with snap; Previous / Next and the 0N / 0M counter from 720 px. */
const YT = (id, q) => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
const probe = (src) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res(im.naturalWidth > 120 ? src : 'placeholder');
  im.onerror = () => res(null);
  im.src = src;
});
export function initVideos(sec) {
  const wv = sec.querySelector('[data-wv]');
  if (!wv) return;
  const scroller = wv.querySelector('[data-wv-scroller]');
  const items = [...wv.querySelectorAll('.wv__item')];
  const nav = wv.querySelector('[data-wv-nav]');
  const prev = wv.querySelector('[data-wv-prev]'), next = wv.querySelector('[data-wv-next]');
  const num = wv.querySelector('[data-wv-num]'), total = wv.querySelector('[data-wv-total]');
  const pad2 = (n) => String(n).padStart(2, '0');
  const shown = () => items.filter((li) => !li.hidden);

  /* art */
  async function art(li) {
    if (li.dataset.art) return;
    li.dataset.art = 'pending';
    const id = li.dataset.yt;
    let got = await probe(YT(id, 'maxresdefault'));
    if (got === 'placeholder' || got === null) {
      const hq = await probe(YT(id, 'hqdefault'));
      if (hq === 'placeholder' && got === 'placeholder') { li.hidden = true; li.dataset.art = 'missing'; update(true); return; }
      got = hq === 'placeholder' ? null : hq;
    }
    if (!got) { li.dataset.art = 'poster'; return; }
    const pic = li.querySelector('.wv__art'), img = pic.querySelector('img');
    pic.querySelectorAll('source').forEach((n) => n.remove());
    img.removeAttribute('srcset'); img.removeAttribute('sizes');
    img.src = got;
    li.dataset.art = 'youtube';
  }
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { art(e.target); near.unobserve(e.target); }
    }, { root: scroller, rootMargin: '0px 120% 0px 120%' });
    const gate = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      gate.disconnect();
      items.forEach((li) => near.observe(li));
    }, { rootMargin: '100% 0px 100% 0px' });
    gate.observe(wv);
  }

  /* the row */
  let step = 1, lastI = -1;
  const measure = () => {
    const a = shown();
    step = a.length > 1 ? a[1].offsetLeft - a[0].offsetLeft : (a[0]?.offsetWidth || 1);
  };
  function update(force) {
    const a = shown();
    if (force) { measure(); if (total) total.textContent = pad2(a.length); lastI = -1; }
    const max = scroller.scrollWidth - scroller.clientWidth;
    const i = scroller.scrollLeft >= max - 2 ? a.length - 1 : Math.min(a.length - 1, Math.round(scroller.scrollLeft / Math.max(1, step)));
    if (prev) prev.disabled = scroller.scrollLeft <= 2;
    if (next) next.disabled = scroller.scrollLeft >= max - 2;
    if (i === lastI && !force) return;
    lastI = i;
    if (num) num.textContent = pad2(i + 1);
  }
  let raf = 0;
  scroller.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  const go = (d) => {
    const i = Math.max(0, Math.round(scroller.scrollLeft / Math.max(1, step)) + d);
    scroller.scrollTo({ left: i * step, behavior: REDUCED ? 'auto' : 'smooth' });
  };
  prev?.addEventListener('click', () => go(-1));
  next?.addEventListener('click', () => go(1));
  if (nav) nav.hidden = false;
  onLayout(() => update(true));
  requestAnimationFrame(() => update(true));
  // a focused card is brought fully into the row's view (keyboard)
  wv.addEventListener('focusin', (e) => {
    const li = e.target.closest('.wv__item');
    if (!li) return;
    const l = li.offsetLeft - (items[0].offsetLeft || 0), sl = scroller.scrollLeft;
    if (l < sl || l + li.offsetWidth > sl + scroller.clientWidth) scroller.scrollTo({ left: l, behavior: REDUCED ? 'auto' : 'smooth' });
  });

  /* play */
  wv.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wv-play]');
    if (b) openVideo(b.closest('.wv__item'));
  });
  function openVideo(li) {
    const id = li.dataset.yt;
    const card = li.querySelector('.wv__art img');
    const t = li.querySelector('.wv__t'), by = li.querySelector('.wv__by');
    const fig = document.createElement('figure');
    fig.className = 'wvm'; fig.dataset.theme = 'dark';
    fig.innerHTML = `<div class="wvm__frame"><img class="wvm__art" alt="" decoding="async" width="1920" height="1080"></div>
      <figcaption class="wvm__cap"><p class="wvm__by"></p><h2 class="wvm__t" id="modal-title"></h2>
        <a class="boxlink wvm__yt" target="_blank" rel="noopener" data-draft="DC62">Watch on YouTube <span class="ar">↗</span></a></figcaption>`;
    fig.querySelector('.wvm__art').src = card.currentSrc || card.src;
    fig.querySelector('.wvm__by').textContent = by.textContent;
    const h = fig.querySelector('.wvm__t');
    h.textContent = t.textContent;
    if (t.dataset.draft) h.dataset.draft = t.dataset.draft;
    fig.querySelector('.wvm__yt').href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    let frame = null;
    openModal(fig, {
      from: card,
      onOpen() {
        frame = document.createElement('iframe');
        frame.className = 'wvm__player';
        frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
        frame.title = t.textContent;
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.addEventListener('load', () => frame?.classList.add('is-in'), { once: true });
        fig.querySelector('.wvm__frame').append(frame);
      },
      beforeClose() { frame?.remove(); frame = null; },
      onClose() { frame?.remove(); frame = null; },
    });
  }
}
