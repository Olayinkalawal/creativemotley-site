/* Top bar, chapters dropdown, side rail and mobile menu. The index markup lives once, in the
   hero frame ([data-index-source]); the rail, the dropdown and the menu are clones of it.
   - html.scrolled: the top bar turns into an opaque ink bar once the hero has gone (transparent over the hero).
   - The dropdown shows a tiny thumbnail of each chapter's scene, fetched the first time it is about to open
     (the art pipeline's /assets/scenes/index.json; chapters without a painted scene yet use /assets/thumbs/).
   - Hovering or focusing a chapter in the rail or the dropdown announces it (a "cm:chapter-intent" event on
     document, detail = the chapter id), so the stage can start loading that chapter's scene early. */
import { onChapter, registerProbes } from '../core/chapters.js';
import { scrollTo, lockScroll, onFrame } from '../core/scroll.js';
import { geo } from '../core/layout.js';

const root = document.documentElement;
const THUMBS = {   // chapters with no painted scene in the art index yet (tiny crops of their existing art; Method and Kit:
  // the real-time 3D devices those chapters show, cut from public/assets/teardown/{camera3d,mixer3d}/still_hero.webp)
  method: '/assets/thumbs/method-3d.webp', showcase: '/assets/thumbs/showcase.webp',
  process: '/assets/thumbs/process.webp', kit: '/assets/thumbs/kit-3d.webp',
};

function thumbFor(idx, id) {
  const t = idx?.[id]?.thumb;
  const list = Array.isArray(t) ? t : [];
  const webp = list.find((x) => /\.webp$/i.test(x.src));
  const avif = list.find((x) => /\.avif$/i.test(x.src));
  return { src: webp?.src || THUMBS[id] || '', avif: avif?.src || '' };
}

export function initChrome() {
  const src = document.querySelector('[data-index-source]');
  for (const target of document.querySelectorAll('[data-index], [data-index-clone]')) {
    const list = target.tagName === 'OL' ? target : target.appendChild(document.createElement('ol'));
    list.classList.add('index');
    list.innerHTML = src.innerHTML;
    // the numerals are decoration in the copies (the names carry the meaning; "I", "II" read as letters)
    for (const n of list.querySelectorAll('.rn')) n.setAttribute('aria-hidden', 'true');
  }
  const items = [...document.querySelectorAll('.rail .index li, .chapters__panel li, .menu .index li')];
  registerProbes(document.querySelectorAll('.rail__mark, .rail .index li, .rail__legal'));
  onChapter((id) => {
    for (const li of items) {
      const on = li.dataset.for === id;
      li.classList.toggle('is-active', on);
      const a = li.querySelector('a');
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    }
  });

  // the top bar: transparent over the hero, opaque ink after it
  const hero = document.querySelector('.hero');
  const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 56;
  let scrolled = null;
  onFrame((v) => {
    const s = hero ? v.y > geo(hero).bottom - navH - 1 : v.y > 8;
    if (s !== scrolled) { root.classList.toggle('scrolled', s); scrolled = s; }
  });

  // in-page links glide with Lenis, and move focus to where they lead (a chapter is focusable by script only:
  // tabindex -1), so the next Tab continues from there and a screen reader reads on from the chapter
  for (const el of document.querySelectorAll('[data-chapter], #top')) if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 ? document.querySelector(id) : null;
    if (!target) return;
    e.preventDefault();
    closeAll(false);
    scrollTo(target, { focus: true });
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  // chapter intent (rail + dropdown): lets the stage preload a scene before the jump
  let lastIntent = '';
  const intent = (e) => {
    const li = e.target.closest?.('li[data-for]');
    if (!li || li.dataset.for === lastIntent) return;
    lastIntent = li.dataset.for;
    document.dispatchEvent(new CustomEvent('cm:chapter-intent', { detail: lastIntent }));
  };
  for (const list of document.querySelectorAll('.rail .index, .chapters__panel .index')) {
    list.addEventListener('pointerover', intent);
    list.addEventListener('focusin', intent);
  }

  // chapters dropdown, with a thumbnail slot per chapter (filled on first intent to open)
  const dd = document.querySelector('[data-chapters]');
  const ddBtn = dd?.querySelector('button');
  const panel = dd?.querySelector('.chapters__panel');
  for (const a of panel ? panel.querySelectorAll('li[data-for] a') : []) {
    const th = document.createElement('span');
    th.className = 'th'; th.setAttribute('aria-hidden', 'true');
    a.prepend(th);
  }
  let thumbs = null;
  const loadThumbs = () => {
    if (thumbs || !panel) return;
    thumbs = fetch('/assets/scenes/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((idx) => {
      for (const li of panel.querySelectorAll('li[data-for]')) {
        const { src: s, avif } = thumbFor(idx, li.dataset.for);
        const th = li.querySelector('.th');
        if (!s || !th) continue;
        const img = new Image();
        img.alt = ''; img.decoding = 'async'; img.loading = 'lazy'; img.width = 96; img.height = 54;
        img.addEventListener('load', () => img.classList.add('is-in'), { once: true });
        if (avif) {
          const pic = document.createElement('picture');
          const so = document.createElement('source');
          so.type = 'image/avif'; so.srcset = avif;
          pic.append(so, img);
          img.src = s;
          th.append(pic);
        } else { img.src = s; th.append(img); }
      }
    });
  };
  const setDD = (open) => {
    if (!dd) return;
    if (open) loadThumbs();
    dd.classList.toggle('open', open); ddBtn.setAttribute('aria-expanded', String(open));
  };
  ddBtn?.addEventListener('pointerenter', loadThumbs);
  ddBtn?.addEventListener('focus', loadThumbs);
  ddBtn?.addEventListener('click', () => setDD(!dd.classList.contains('open')));
  document.addEventListener('click', (e) => { if (dd && !dd.contains(e.target)) setDD(false); });
  // keyboard: focus that leaves the dropdown closes it; Escape inside it closes it and returns to its button
  dd?.addEventListener('focusout', (e) => { if (!e.relatedTarget || !dd.contains(e.relatedTarget)) setDD(false); });
  dd?.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !dd.classList.contains('open')) return;
    e.stopPropagation(); setDD(false); ddBtn.focus();
  });

  // mobile menu: a modal dialog while open. Everything behind it is inert (the page, the rail, the plates, the skip
  // link, the bar but its toggle), so Tab stays in the menu and its toggle; closing returns focus to the toggle
  // (a menu link moves it to its chapter instead)
  const menu = document.getElementById('menu');
  const mBtn = document.querySelector('[data-menu-toggle]');
  const label = mBtn?.querySelector('.sr-only')?.textContent.trim() || 'Menu';
  menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-modal', 'true'); menu.setAttribute('aria-label', label);
  const behind = () => [
    document.getElementById('main'), document.querySelector('.rail'), document.querySelector('.plates'), document.querySelector('.skip'),
    ...document.querySelectorAll('.nav > :not(.nav__right), .nav__right > :not([data-menu-toggle])'),
  ].filter(Boolean);
  const setMenu = (open, back = true) => {
    root.classList.toggle('menu-open', open);
    mBtn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    for (const el of behind()) el.inert = open;
    lockScroll(open);
    if (open) menu.querySelector('a')?.focus();
    else if (back) mBtn.focus({ preventScroll: true });
  };
  menu.inert = true;
  mBtn?.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  function closeAll(back = true) { if (dd) setDD(false); if (root.classList.contains('menu-open')) setMenu(false, back); }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const inDD = dd?.contains(document.activeElement);
    closeAll();
    if (inDD) ddBtn.focus();
  });
}
