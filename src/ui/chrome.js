/* Top bar, chapters dropdown, side rail and mobile menu. The index markup lives once, in the
   hero frame ([data-index-source]); the rail, the dropdown and the menu are clones of it. */
import { onChapter, registerProbes } from '../core/chapters.js';
import { scrollTo, lockScroll } from '../core/scroll.js';

const root = document.documentElement;

export function initChrome() {
  const src = document.querySelector('[data-index-source]');
  for (const target of document.querySelectorAll('[data-index], [data-index-clone]')) {
    const list = target.tagName === 'OL' ? target : target.appendChild(document.createElement('ol'));
    list.classList.add('index');
    list.innerHTML = src.innerHTML;
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

  // in-page links glide with Lenis
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2 || !document.querySelector(id)) return;
    e.preventDefault();
    closeAll();
    scrollTo(id);
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  // chapters dropdown
  const dd = document.querySelector('[data-chapters]');
  const ddBtn = dd?.querySelector('button');
  const setDD = (open) => { dd.classList.toggle('open', open); ddBtn.setAttribute('aria-expanded', String(open)); };
  ddBtn?.addEventListener('click', () => setDD(!dd.classList.contains('open')));
  document.addEventListener('click', (e) => { if (dd && !dd.contains(e.target)) setDD(false); });

  // mobile menu
  const menu = document.getElementById('menu');
  const mBtn = document.querySelector('[data-menu-toggle]');
  const setMenu = (open) => {
    root.classList.toggle('menu-open', open);
    mBtn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    lockScroll(open);
    if (open) menu.querySelector('a')?.focus();
  };
  menu.inert = true;
  mBtn?.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  function closeAll() { if (dd) setDD(false); if (root.classList.contains('menu-open')) setMenu(false); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
}
