/* One shared dialog. openModal(node, { onClose, from }) moves focus in, traps Tab, closes on Esc/scrim.
   Opening morphs from the clicked element (View Transitions): the element's picture grows into the modal's first
   picture, and the rest cross-fades. `from` names the source explicitly; otherwise it is the button or link the
   reader just clicked (when it is card-sized). No View Transitions, reduced motion, or no source: a plain fade.
   Closing morphs back to the source while the modal still shows what it opened with; otherwise it fades. */
import { lockScroll } from '../core/scroll.js';
import { REDUCED } from '../core/env.js';

const el = document.getElementById('modal');
const body = el.querySelector('[data-modal-body]');
const VT = 'cm-modal';
const canMorph = !REDUCED && typeof document.startViewTransition === 'function';
let lastFocus = null, onCloseFn = null, source = null, openedWith = '', clearT = 0;
let lastClick = null, lastClickT = 0;
el.inert = true;

// the element a click came from (capture phase, so it is known before any handler opens the modal)
document.addEventListener('click', (e) => {
  lastClick = e.target instanceof Element ? e.target.closest('button, a, [data-modal-from]') : null;
  lastClickT = performance.now();
}, true);

const pictureIn = (n) => (n ? (n.matches?.('img, video, picture') ? n : n.querySelector('img, video')) || n : null);
const mediaKey = (n) => (n && (n.currentSrc || n.getAttribute?.('src'))) || '';
function usable(n) {   // rendered, and no bigger than a card (a click on a whole stage is not a source)
  if (!n || !n.isConnected) return false;
  const r = n.getBoundingClientRect();
  return r.width > 8 && r.height > 8 && r.width * r.height < innerWidth * innerHeight * 0.6
    && r.bottom > 0 && r.top < innerHeight;
}
function morph(update, done) {
  el.classList.add('vt');
  const t = document.startViewTransition(update);
  t.finished.finally(() => { el.classList.remove('vt'); done?.(); });
}

export function openModal(node, { onClose, from } = {}) {
  clearTimeout(clearT);
  lastFocus = document.activeElement; onCloseFn = onClose || null;
  const recent = performance.now() - lastClickT < 1200 ? lastClick : null;
  source = pictureIn(from || recent);
  if (!canMorph || !usable(source)) source = null;
  const show = () => {
    body.replaceChildren(node);
    el.inert = false; el.setAttribute('aria-hidden', 'false'); el.classList.add('open');
    const target = pictureIn(body.firstElementChild);
    openedWith = mediaKey(target);
    if (source) { source.style.viewTransitionName = ''; if (target) target.style.viewTransitionName = VT; }
  };
  lockScroll(true);
  if (source) { source.style.viewTransitionName = VT; morph(show); }
  else show();
  requestAnimationFrame(() => el.querySelector('.modal__close').focus());
}

export function closeModal() {
  if (!el.classList.contains('open')) return;
  const target = body.querySelector('[style*="view-transition-name"]') || pictureIn(body.firstElementChild);
  const back = !!source && usable(source) && !!target && mediaKey(target) === openedWith;
  const hide = () => {
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); el.inert = true;
    if (target) target.style.viewTransitionName = '';
    if (back) source.style.viewTransitionName = VT;
  };
  const finish = () => {
    if (source) source.style.viewTransitionName = '';
    source = null;
  };
  if (back) { target.style.viewTransitionName = VT; morph(hide, () => { finish(); body.replaceChildren(); }); }
  else { hide(); finish(); clearT = setTimeout(() => body.replaceChildren(), 360); }
  lockScroll(false);
  onCloseFn?.(); onCloseFn = null;
  lastFocus?.focus?.({ preventScroll: true });
}

el.addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]')) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (!el.classList.contains('open')) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
  if (e.key === 'Tab') {
    const f = [...el.querySelectorAll('a[href],button:not([tabindex="-1"]),[tabindex="0"]')].filter((n) => n.offsetParent !== null && !n.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
