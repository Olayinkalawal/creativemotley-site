/* One shared dialog. openModal(node, { onClose, from, onOpen, beforeClose, during }) moves focus in, traps Tab (iframes included;
   focus that escapes the dialog, e.g. Shift+Tab out of an embedded player, is brought back), closes on Esc/scrim.
   onOpen runs once the dialog has opened (after the morph), e.g. to create a player only then; during runs as the
   dialog is shown (inside the morph's update, after the page behind was captured), e.g. to move the page behind it;
   html.modal-open is set while it is open (the section that owns the content styles the page behind); beforeClose runs before
   the closing morph captures the page, e.g. to remove that player so the morph shrinks the still art, not the video.
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
let isOpen = false, lastFocus = null, onCloseFn = null, beforeCloseFn = null, source = null, openedWith = '', clearT = 0;
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
// the update may wait (briefly) for the new picture to decode, so the morph never lands on an empty frame
const ready = (n) => (n?.decode ? Promise.race([n.decode().catch(() => {}), new Promise((r) => setTimeout(r, 300))]) : null);
function morph(update, done) {
  el.classList.add('vt');
  const t = document.startViewTransition(update);
  t.finished.finally(() => { el.classList.remove('vt'); done?.(); });
}
const FOCUSABLE = 'a[href],button:not([tabindex="-1"]),iframe,[tabindex="0"]';
const focusables = () => [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null && !n.disabled);

export function openModal(node, { onClose, from, onOpen, beforeClose, during } = {}) {
  clearTimeout(clearT);
  lastFocus = document.activeElement; onCloseFn = onClose || null; beforeCloseFn = beforeClose || null;
  // isOpen: a close that starts during the opening morph (Esc pressed early) skips that morph and resolves its
  // promise while .open is still on; without the check the player would be created inside a closing dialog
  const opened = () => { if (isOpen && el.classList.contains('open') && body.contains(node)) onOpen?.(node); };
  const recent = performance.now() - lastClickT < 1200 ? lastClick : null;
  source = pictureIn(from || recent);
  if (!canMorph || !usable(source)) source = null;
  const show = () => {
    isOpen = true;
    body.replaceChildren(node);
    el.inert = false; el.setAttribute('aria-hidden', 'false'); el.classList.add('open');
    document.documentElement.classList.add('modal-open');
    try { during?.(); } catch (e) { console.warn('[modal]', e); }
    const target = pictureIn(body.firstElementChild);
    openedWith = mediaKey(target);
    if (source) { source.style.viewTransitionName = ''; if (target) target.style.viewTransitionName = VT; }
    requestAnimationFrame(() => el.querySelector('.modal__close').focus({ preventScroll: true }));
  };
  lockScroll(true);
  if (source) { source.style.viewTransitionName = VT; morph(() => { show(); return ready(pictureIn(body.firstElementChild)); }, opened); }
  else { show(); requestAnimationFrame(opened); }
}

export function closeModal() {
  if (!el.classList.contains('open')) return;
  isOpen = false;
  beforeCloseFn?.(); beforeCloseFn = null;
  const target = body.querySelector('[style*="view-transition-name"]') || pictureIn(body.firstElementChild);
  const back = !!source && usable(source) && !!target && mediaKey(target) === openedWith;
  const hide = () => {
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); el.inert = true;
    document.documentElement.classList.remove('modal-open');
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
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
// focus that leaves the open dialog (Shift+Tab out of an embedded player, a click on the page behind) comes back
document.addEventListener('focusin', (e) => {
  if (!isOpen || el.contains(e.target)) return;
  (focusables()[0] || el.querySelector('.modal__close'))?.focus({ preventScroll: true });
});
