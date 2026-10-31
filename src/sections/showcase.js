/* V · Showcase: the giant title and one grid of video cards, one per creator (2026-10-31: the client removed the poster
   wall; markup: src/partials/showcase.html, cards written from docs/videos.json by src/partials/showcase.videos.mjs).
   - a card is one link to the video on YouTube; with JS a plain click plays it in the shared modal instead (a
     modified or middle click is left to the link: a new tab on YouTube). No pinned run, no per-frame work: the
     chapter is static in every mode, and the umber room behind it is the WebGL stage's (gl/scenes/umber.js).
   - the art is the video's own YouTube thumbnail, self-hosted (AVIF / WebP): no third-party request until a click.
   - a hover counts only once the mouse moves over the grid (.is-pointing on the list; the next scroll drops it), so a
     reader scrolling with the pointer resting on the grid dims nothing (showcase.css).
   - the large file of a card's thumbnail is fetched and decoded ahead of a click: when a mouse rests on the card (or
     keyboard focus does) for 200 ms, or a press starts. The modal morphs from the card's picture (View Transitions)
     and opens on that large file once it is decoded, else on the very file the card shows (so the morph always lands
     on a decoded image) and asks for the large file once open. The youtube-nocookie iframe is created then, and
     removed before the modal closes. */
import './showcase.css';
import { openModal } from '../ui/modal.js';

export function init() {
  const sec = document.getElementById('showcase');
  const wv = sec?.querySelector('[data-wv]');
  if (!wv) return;
  wv.querySelectorAll('[data-wv-yt]').forEach((a) => a.setAttribute('aria-haspopup', 'dialog'));
  const list = wv.querySelector('.wv__list');
  list?.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !list.classList.contains('is-pointing')) list.classList.add('is-pointing'); }, { passive: true });
  addEventListener('scroll', () => { if (list?.classList.contains('is-pointing')) list.classList.remove('is-pointing'); }, { passive: true });
  let pending = null, dwell = 0;
  const rest = (a) => { if (a === pending) return; clearTimeout(dwell); pending = a; if (a) dwell = setTimeout(() => warmUp(a), 200); };
  wv.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') rest(e.target.closest('[data-wv-yt]')); });
  wv.addEventListener('pointerout', (e) => { if (pending && !pending.contains(e.relatedTarget)) rest(null); });
  wv.addEventListener('focusin', (e) => rest(e.target.closest('[data-wv-yt]')));
  wv.addEventListener('focusout', () => rest(null));
  wv.addEventListener('pointerdown', (e) => warmUp(e.target.closest('[data-wv-yt]')));
  wv.addEventListener('click', (e) => {
    const a = e.target.closest('[data-wv-yt]');
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const t = a.querySelector('.wv__t');
    openVideo({ id: a.dataset.wvYt, title: t.textContent, draft: t.dataset.draft, by: a.querySelector('.wv__by').textContent, art: a.querySelector('.wv__art img') });
  });
}

// the shared modal still closing: a closing morph (modal.js) ends by emptying the dialog and clearing its source's
// transition name. Until then the dialog still holds its content, or is mid-morph (#modal.vt): wait (at most 4 s), or
// the video would open empty and the next morph would meet a duplicate transition name. Content counts even while
// .open is still on: Esc during the opening morph starts the closing one, the skipped opening morph drops .vt early,
// and .open goes only when the closing morph's update runs (a card can only be pressed again once Esc has been).
const modalEl = document.getElementById('modal'), modalBody = modalEl?.querySelector('[data-modal-body]');
const closing = () => !!modalEl && (modalEl.classList.contains('vt') || modalBody?.childElementCount > 0);
function openVideo(o) {
  if (!closing()) return openVideoNow(o);
  let t = 0;
  const go = () => { mo.disconnect(); clearTimeout(t); openVideoNow(o); };
  const mo = new MutationObserver(() => { if (!closing()) go(); });
  mo.observe(modalEl, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  t = setTimeout(go, 4000);
}

// the large file of the card's thumbnail, in the format the card shows (its <source> for that type: the srcset's
// widest entry); '' when the card already shows the widest
function largest(img) {
  const cur = img.currentSrc || img.src;
  const type = /\.avif(\?|$)/.test(cur) ? 'image/avif' : 'image/webp';
  const set = img.closest('picture')?.querySelector(`source[type="${type}"]`)?.srcset || '';
  const top = set.split(',').map((s) => s.trim().split(/\s+/)).filter((p) => p[0]).sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0];
  return top && !cur.endsWith(top[0]) ? top[0] : '';
}

// the large files fetched ahead of a click: card <img> → its large file's URL once decoded ('' while it loads)
const warm = new Map();
function warmUp(a) {
  const img = a?.querySelector('.wv__art img');
  if (!img || warm.has(img) || !img.complete || !img.currentSrc) return;   // (a lazy card not loaded yet: no format known)
  const big = largest(img);
  if (!big) return;
  warm.set(img, '');
  const pre = new Image();
  pre.src = big;
  pre.decode().then(() => warm.set(img, big), () => warm.delete(img));
}

// title: the heading (a drafted title carries its draft id); by: the creator; art: the card's <img> (the morph's source)
function openVideoNow({ id, title, draft, by, art }) {
  const fig = document.createElement('figure');
  fig.className = 'wvm'; fig.dataset.theme = 'dark';
  fig.innerHTML = `<div class="wvm__frame"><img class="wvm__art" alt="" decoding="async" width="1920" height="1080"></div>
    <figcaption class="wvm__cap"><p class="wvm__by"></p><h2 class="wvm__t" id="modal-title"></h2>
      <a class="boxlink wvm__yt" target="_blank" rel="noopener" data-draft="DC62">Watch on YouTube <span class="ar" aria-hidden="true">→</span></a></figcaption>`;
  const still = fig.querySelector('.wvm__art');
  const big = largest(art), hot = !!big && warm.get(art) === big;
  still.src = hot ? big : art.currentSrc || art.src;
  fig.querySelector('.wvm__by').textContent = by;
  const h = fig.querySelector('.wvm__t');
  h.textContent = title;
  if (draft) h.dataset.draft = draft;
  fig.querySelector('.wvm__yt').href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  let frame = null;
  openModal(fig, {
    from: art,
    onOpen() {
      // the sharp still: the large file, swapped in once decoded (the morph back compares the src it opened with,
      // modal.js, so the swap keeps the img's src attribute and loads the file beside it)
      if (big && !hot) { const pre = new Image(); pre.src = big; pre.decode().then(() => { if (still.isConnected) still.srcset = `${big} 1x`; }, () => {}); }
      frame = document.createElement('iframe');
      frame.className = 'wvm__player';
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
      // the player's name: the video's title, or (?drafts=0, where the drafted titles are hidden) the creator's name
      frame.title = document.documentElement.classList.contains('no-drafts') && draft ? by : title;
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';   // (no allowfullscreen: allow wins)
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.addEventListener('load', () => frame?.classList.add('is-in'), { once: true });
      fig.querySelector('.wvm__frame').append(frame);
    },
    beforeClose() { frame?.remove(); frame = null; },
    onClose() { frame?.remove(); frame = null; },
  });
}
