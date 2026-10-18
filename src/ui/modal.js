/* One shared dialog. open(node, { label }) moves focus in, traps Tab, closes on Esc/scrim. */
import { lockScroll } from '../core/scroll.js';

const el = document.getElementById('modal');
const body = el.querySelector('[data-modal-body]');
let lastFocus = null, onCloseFn = null;
el.inert = true;

export function openModal(node, { onClose } = {}) {
  lastFocus = document.activeElement; onCloseFn = onClose || null;
  body.replaceChildren(node);
  el.inert = false; el.setAttribute('aria-hidden', 'false'); el.classList.add('open');
  lockScroll(true);
  requestAnimationFrame(() => (el.querySelector('.modal__close')).focus());
}
export function closeModal() {
  if (!el.classList.contains('open')) return;
  el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); el.inert = true;
  lockScroll(false);
  onCloseFn?.(); onCloseFn = null;
  setTimeout(() => body.replaceChildren(), 360);
  lastFocus?.focus?.();
}
el.addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]')) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (!el.classList.contains('open')) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
  if (e.key === 'Tab') {
    const f = [...el.querySelectorAll('a[href],button:not([tabindex="-1"]),[tabindex="0"]')].filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
