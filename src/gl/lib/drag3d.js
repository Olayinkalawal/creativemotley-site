/* drag3d: drag to turn and zoom in, for every real-time 3D device on the site (the hero camera: gl/scenes/hero3d.js;
   Method's camera: gl/scenes/camera3d.js; the Kit's four devices: gl/scenes/kit3d.js). One controller per scene, made
   once its device draws (never at tier 0, on the stills, or under reduced motion: main.js does not boot the stage).

   const d = drag3d(stage, host, name, hint)   host: the section's pin (the hit region, the hint and the zoom buttons
                                    are made in it, in one .d3w layer); name: the device ('camera', 'console', …: the
                                    region's aria-label, docs/ui-strings.json); hint(box) → [x, y]: where the one-time
                                    hint goes (default: centred under the device)
   d.step(ctx, box, dy, on, rest)   per drawn frame, after the scene has posed: box = the device's screen box (css px,
                                    viewport), dy = the host's top in the viewport, on = drag allowed now, rest = a
                                    moment where the one-time hint may show
   d.az, d.el                       the offset to add to the view (degrees: setOffset)
   d.k, d.x, d.y                    the zoom (css x' = k·x + d.x: camera3d / kit3d setZoom; hero3d: k about d.cx, d.cy)
   d.ptr(v)                         the pointer parallax to use (held while dragging)
   d.due()                          true when an id pass (occlusion) should run now, so the markers keep up
   d.off()                          the scene is not drawn now (its deactivate): the layer goes
   d.name(name)                     another device (the Kit's shots); d.busy(), d.reset(), d.dispose()

   Mouse / pen: a drag on the device turns it (0.35°/px azimuth, free; 0.2°/px elevation, -12 … +18°), glides on release
   (its velocity over the last ~100 ms, decaying 0.92 per 16 ms) and eases back to the scroll's pose (1.2 s,
   easeInOutCubic) once the reader scrolls more than 8 px or after 2.5 s idle. Touch: only a clearly horizontal swipe
   turns it (touch-action pan-y: a vertical swipe scrolls the page natively). Zoom (1× … 3×, about the pointer; out about
   its own centre): ctrl/cmd + wheel (a trackpad pinch; a plain wheel still scrolls the page), Safari's gesture events, a
   two-finger pinch, a double-click / double-tap (2× there, or back), the + / − / reset buttons beside the device (shown
   while it is hovered, focused or zoomed: _teardown.css), the + and − keys; back to 1× over 0.8 s once the reader
   scrolls on or after 4 s idle. The page itself is never zoomed: only the region blocks the browser's pinch. Past 1.15×
   the section gets .d3-zoomed (its copy steps back). Keyboard: the region is focusable (role img; its label names the
   device and the keys): arrows turn it (±15° / ±8°, eased 0.35 s), 0 or Escape resets. A one-time hint (per visit:
   sessionStorage) fades in beside the device the first time one rests on screen, for 3 s, and never after a drag.
   Reduced motion (if the stage ever ran under it): no glide, no eases. Every change asks the stage for a frame
   (stage.invalidate), so the stage's idle-stop re-arms only while something moves. */
import { onFrame, input } from '../../core/scroll.js';
import { FINE } from '../../core/env.js';

const KEY = 'cm-d3-hint';
let seen = false;
try { seen = !!sessionStorage.getItem(KEY); } catch { /* storage off: once per page view */ }
const cl = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// the zoom buttons (docs/ui-strings.json; their icons are _teardown.css's): label, factor (0: reset)
const BTN = [['Zoom in', 1.5], ['Zoom out', 1 / 1.5], ['Reset view', 0]];

export function drag3d(stage, host, name, hintAt) {
  host.insertAdjacentHTML('beforeend', `<div class="d3w"><div class="d3" tabindex="0" role="img"></div><div class="d3__hint" aria-hidden="true"></div><div class="d3__btns">${
    BTN.map(([t]) => `<button type="button" class="d3__b" aria-label="${t}"></button>`).join('')}</div></div>`);
  const lay = host.lastElementChild, [reg, hint, bar] = lay.children, sec = host.closest('section');
  // the host's size, observed (reading it in the frame after the class and style writes forced a layout each frame)
  let W = host.clientWidth, H = host.clientHeight;
  const ro = new ResizeObserver(([e]) => { W = e.contentRect.width; H = e.contentRect.height; });
  ro.observe(host);
  const st = (e, k, v) => { if (e['_' + k] !== v) { e['_' + k] = v; e.style.setProperty(k, v); } };
  const cls = (e, c, v) => { if (e['_' + c] !== v) { e['_' + c] = v; e.classList.toggle(c, v); } };

  const d = { az: 0, el: 0, k: 1, x: 0, y: 0, cx: 0, cy: 0 };
  let on = false, box = null, dy0 = 0, reduced = false, y0 = NaN, sy = 0, lastY = NaN, last = performance.now();
  let drag = null, vA = 0, vE = 0, glide = false, tw = null, zt = null, pinch = null, tap = null, moved = 0, type = '';
  let occ = { az: 0, el: 0, k: 1, t: 0 }, occNow = false, hintOn = 0, hintY = 0, hintT = 0, restAt = 0, retT = 0, zoomT = 0, frozen = null;
  const pts = new Map();
  const now = () => performance.now();
  const kick = () => stage.invalidate();
  const busy = () => !!(drag || glide || tw || zt || pinch);
  const seenNow = () => { seen = true; hideHint(); try { sessionStorage.setItem(KEY, '1'); } catch { /* fine */ } };

  /* ── the offset: tweens (the return, the keys) and the glide; the zoom: a scale about a point ─────────────────── */
  const tween = (a1, e1, ms) => {
    glide = false; tw = { a0: d.az, e0: d.el, a1, e1, t0: now(), ms: reduced ? 1 : ms }; kick();
  };
  const back = (ms = 1200) => { clearTimeout(retT); if (d.az || d.el) { d.az = ((d.az + 180) % 360 + 360) % 360 - 180; tween(0, 0, ms); } };
  // css x' = k·x + d.x: a change to k about p keeps p where it is (x' = f·x + p·(1 − f)); its centre c: d.x = c·(1 − k)
  const centre = () => (d.k > 1.0001 ? [d.x / (1 - d.k), d.y / (1 - d.k)] : [d.cx, d.cy]);
  const scaleAbout = (k, px, py) => {
    const f = k / d.k;
    d.x = f * d.x + px * (1 - f); d.y = f * d.y + py * (1 - f); d.k = k;
    if (k <= 1.0001) d.k = 1, d.x = d.y = 0;
    else [d.cx, d.cy] = centre();
  };
  const zoomTo = (k, px, py, ms) => {
    k = cl(k, 1, 3);
    if (k < d.k) [px, py] = centre();            // out: about its own centre, so it ends where it began
    zt = { k0: d.k, k1: k, px, py, t0: now(), ms: reduced || pinch ? 1 : ms };
    kick(); idle();
  };
  const zoomBy = (f, px, py, ms = 220) => zoomTo((zt ? zt.k1 : d.k) * f, px, py, ms);
  const mid = () => (box ? [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] : [innerWidth / 2, innerHeight / 2]);
  const unzoom = (ms = 800) => { clearTimeout(zoomT); if (d.k > 1.0001 || zt) zoomTo(1, 0, 0, ms); };
  // after an interaction: back after 2.5 s (the zoom after 4 s) without another, or once the reader scrolls on
  const idle = () => {
    y0 = sy; clearTimeout(retT); clearTimeout(zoomT);
    retT = setTimeout(back, 2500); zoomT = setTimeout(unzoom, 4000);
  };
  const ended = () => { occNow = true; idle(); kick(); };

  /* ── input ─────────────────────────────────────────────────────────────────────────────────────────────── */
  const startDrag = (e, p) => {
    try { reg.setPointerCapture(e.pointerId); } catch { /* gone */ }
    drag = { id: e.pointerId, x: p.x, y: p.y, a: d.az, e: d.el, touch: e.pointerType === 'touch', h: [[e.timeStamp, d.az, d.el]] };
    tw = null; glide = false; frozen = stage.pointer.clone();
    reg.classList.add('is-drag'); clearTimeout(retT); clearTimeout(zoomT);
    seenNow();
  };
  const endDrag = (glideOn) => {
    try { reg.releasePointerCapture(drag.id); } catch { /* gone */ }
    reg.classList.remove('is-drag');
    drag = frozen = null;
    glide = glideOn && !reduced && Math.abs(vA) + Math.abs(vE) > 0.01;
    if (!glide) ended(); else kick();
  };
  const on2 = (e, t, f, o) => e.addEventListener(t, f, o);
  on2(reg, 'pointerdown', (e) => {
    if (!on || (e.pointerType === 'mouse' && e.button)) return;
    const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    pts.set(e.pointerId, p); moved = 0; type = e.pointerType;
    if (pts.size === 2) {                               // a second finger: a pinch (no turn)
      const [a, b] = pts.values();
      for (const id of pts.keys()) try { reg.setPointerCapture(id); } catch { /* gone */ }
      if (drag) endDrag(false);
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: d.k };
    } else if (type !== 'touch') { e.preventDefault(); startDrag(e, p); }   // (no focus ring on a click: the keys work once tabbed to)
  });
  on2(reg, 'pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    moved = Math.max(moved, Math.hypot(p.x - p.x0, p.y - p.y0));
    if (pinch) {
      const [a, b] = pts.values();
      if (b) zoomTo(pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2, 0);
    } else if (!drag) {                                 // touch: only a clearly horizontal swipe turns the device
      const dx = Math.abs(p.x - p.x0), dv = Math.abs(p.y - p.y0);
      if (dx > 8 && dx > dv * 1.2) { p.x0 = p.x; p.y0 = p.y; startDrag(e, p); }
      else if (dv > 10) pts.delete(e.pointerId);        // a vertical swipe: the page's
    } else if (e.pointerId === drag.id) {
      d.az = drag.a - (p.x - drag.x) * 0.35;
      if (!drag.touch) d.el = cl(drag.e + (p.y - drag.y) * 0.2, -12, 18);
      drag.h.push([e.timeStamp, d.az, d.el]); if (drag.h.length > 8) drag.h.shift();
      kick();
    }
  });
  const up = (e) => {
    const p = pts.get(e.pointerId);
    if (!pts.delete(e.pointerId)) return;
    if (pinch) { if (pts.size < 2) { pinch = null; pts.clear(); ended(); } return; }
    if (drag?.id === e.pointerId) {
      // the release velocity: over the last ~100 ms of the drag (none after a pause)
      const h = drag.h, [t1, a1, e1] = h[h.length - 1], q = h.find((x) => t1 - x[0] < 110), dt = t1 - q[0];
      vA = vE = 0;
      if (dt > 8 && e.timeStamp - t1 < 90) { vA = (a1 - q[1]) / dt; vE = (e1 - q[2]) / dt; }
      endDrag(e.type === 'pointerup');
    }
    if (e.type !== 'pointerup' || moved > 10 || type !== 'touch') return;
    // a tap (it also hovers the region: the buttons show); a second tap within 300 ms and 24 px: 2× there (or back)
    if (tap && e.timeStamp - tap.t < 300 && Math.hypot(p.x - tap.x, p.y - tap.y) < 24) { tap = null; dbl(p.x, p.y); } else tap = { x: p.x, y: p.y, t: e.timeStamp };
  };
  on2(reg, 'pointerup', up); on2(reg, 'pointercancel', up);
  const dbl = (x, y) => zoomTo(d.k > 1.05 || zt?.k1 > 1 ? 1 : 2, x, y, 450);
  on2(reg, 'dblclick', (e) => { if (on && moved < 6 && type !== 'touch') dbl(e.clientX, e.clientY); });
  // ctrl / cmd + wheel (a trackpad pinch): the device's zoom, never the page's; a plain wheel scrolls the page (Lenis)
  on2(reg, 'wheel', (e) => {
    if (!on || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); e.stopPropagation();
    zoomBy(Math.exp(cl(-e.deltaY * (e.deltaMode ? 16 : 1) * 0.01, -0.7, 0.7)), e.clientX, e.clientY, 160);   // (a coalesced burst, a notch: ≤ 2×)
  }, { passive: false });
  let g0 = 1;   // Safari (macOS trackpad, iOS): gesture events, so the page does not zoom under the device
  on2(reg, 'gesturestart', (e) => { e.preventDefault(); g0 = d.k; });
  on2(reg, 'gesturechange', (e) => { e.preventDefault(); if (on && !pts.size) zoomTo(g0 * e.scale, e.clientX, e.clientY, 0); });
  on2(reg, 'gestureend', (e) => { e.preventDefault(); ended(); });
  on2(reg, 'keydown', (e) => {
    const K = e.key, c = d.k > 1.0001 ? centre() : mid(), t = { ArrowLeft: [15, 0], ArrowRight: [-15, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[K];
    if (!on) return;
    if (t) { tween((tw ? tw.a1 : d.az) + t[0], cl((tw ? tw.e1 : d.el) + t[1], -12, 18), 350); ended(); }
    else if (K === '0' || K === 'Escape') { tween(0, 0, 350); unzoom(350); }
    else if (K === '+' || K === '=') zoomBy(1.5, ...c);
    else if (K === '-' || K === '_') zoomBy(1 / 1.5, ...c);
    else return;
    e.preventDefault(); seenNow();
  });
  [...bar.children].forEach((b, i) => on2(b, 'click', () => {
    const f = BTN[i][1];
    if (f) zoomBy(f, ...(d.k > 1.0001 ? centre() : mid()), 260); else { tween(0, 0, 500); unzoom(500); }
  }));
  const stopTick = onFrame(() => { if (busy()) kick(); });

  /* ── the one-time hint ────────────────────────────────────────────────────────────────────────────────── */
  const hideHint = () => { clearTimeout(hintT); hintOn = 0; st(hint, 'opacity', '0'); };
  const showHint = () => {
    if (seen || !on || busy() || Math.abs(scrollY - lastY) > 2) return;
    seenNow(); hintOn = 1; hintY = sy;
    hint.textContent = !FINE || input.trackpad || /Mac/.test(navigator.platform) ? 'Drag to turn · pinch to zoom' : 'Drag to turn · double-click to zoom';
    const [x, y] = hintAt ? hintAt(box) : [(box.x0 + box.x1) / 2, box.y1 + 14];
    st(hint, 'transform', `translate(${cl(x, 120, W - 120).toFixed(0)}px,${cl(y - dy0, 12, H - 44).toFixed(0)}px)`);
    st(hint, 'opacity', '1');
    hintT = setTimeout(hideHint, 3000);
  };

  /* ── per frame ───────────────────────────────────────────────────────────────────────────────────────── */
  d.step = (ctx, b, dy, allow, rest) => {
    const t = now(), dt = Math.min(100, t - last), was = on;
    last = t; reduced = ctx.reduced; sy = ctx.scrollY;
    if (!(y0 === y0)) y0 = sy;
    on = !!(allow && b);
    if (b) box = b, dy0 = dy;
    if (was && !on) { if (drag) endDrag(false); pts.clear(); pinch = null; hideHint(); back(500); unzoom(500); }
    // the glide, the tweens, the zoom's ease
    if (glide) {
      const k = Math.pow(0.92, dt / 16);
      vA *= k; vE *= k; d.az += vA * dt; d.el = cl(d.el + vE * dt, -12, 18);
      if (Math.abs(vA) + Math.abs(vE) < 0.002) { glide = false; ended(); }
    }
    if (tw) {
      const u = Math.min(1, (t - tw.t0) / tw.ms), k = ease(u);
      d.az = tw.a0 + (tw.a1 - tw.a0) * k; d.el = tw.e0 + (tw.e1 - tw.e0) * k;
      if (u >= 1) tw = null, occNow = true;
    }
    if (zt) {
      const u = Math.min(1, (t - zt.t0) / zt.ms);
      scaleAbout(zt.k0 + (zt.k1 - zt.k0) * (zt.ms < 300 ? 1 - Math.pow(1 - u, 3) : ease(u)), zt.px, zt.py);
      if (u >= 1) zt = null, occNow = !pinch;
    }
    // the reader scrolled on (more than 8 px since the last interaction): back to the scroll's pose, and to 1×
    if (!drag && !pinch && Math.abs(sy - y0) > 8) { y0 = sy; back(); unzoom(); }
    // the layer: the hit region over the device (padded, inside the host), the buttons beside it
    cls(lay, 'is-on', on);
    cls(lay, 'is-z', on && d.k > 1.02);
    cls(sec, 'd3-zoomed', d.k > 1.15);
    if (on) {
      const bw = FINE ? 34 : 40, bh = bw * 3 + 12;
      const x0 = cl(b.x0 - 10, 0, W), x1 = cl(b.x1 + 10, 0, W), y1 = cl(b.y0 - 10 - dy, 0, H), y2 = cl(b.y1 + 10 - dy, 0, H);
      st(reg, 'transform', `translate(${x0.toFixed(0)}px,${y1.toFixed(0)}px)`);
      st(reg, 'width', `${Math.max(48, Math.round((x1 - x0) / 4) * 4)}px`); st(reg, 'height', `${Math.max(48, Math.round((y2 - y1) / 4) * 4)}px`);
      const bx = b.x1 + 14 + bw > W - 12 ? Math.min(b.x1, W) - bw - 12 : b.x1 + 14;
      st(bar, 'transform', `translate(${cl(bx, 12, W - bw - 12).toFixed(0)}px,${cl(Math.min(b.y1 - dy, H) - bh, 12, H - bh - 12).toFixed(0)}px)`);
    }
    // the hint: once, the first time a device rests on screen (where the scene says it may; not scrolled for 0.75 s)
    if (!seen && on && rest && !busy()) {
      if (sy !== lastY || !restAt) { restAt = t; clearTimeout(hintT); hintT = setTimeout(showHint, 750); }
    } else if (restAt) { restAt = 0; if (!hintOn) clearTimeout(hintT); }
    lastY = sy;
    if (hintOn && (!on || Math.abs(sy - hintY) > 8)) hideHint();
  };
  d.ptr = (p) => frozen || p;
  d.due = () => {
    const t = now();
    if (occNow || (busy() && t - occ.t >= 150 && (Math.abs(d.az - occ.az) >= 5 || Math.abs(d.el - occ.el) >= 3.5 || Math.abs(d.k / occ.k - 1) > 0.12))) {
      occNow = false; occ = { az: d.az, el: d.el, k: d.k, t };
      return true;
    }
  };
  d.busy = busy;
  d.name = (n) => reg.setAttribute('aria-label', `3D ${n}: drag or use the arrow keys to turn, + and − to zoom`);
  d.off = () => d.step({ scrollY: sy, reduced }, null, dy0);
  d.reset = () => { if (drag) endDrag(false); tw = zt = pinch = null; glide = false; d.az = d.el = d.x = d.y = 0; d.k = 1; clearTimeout(retT); clearTimeout(zoomT); };
  d.dispose = () => { d.reset(); stopTick(); ro.disconnect(); hideHint(); lay.remove(); sec?.classList.remove('d3-zoomed'); };
  d.name(name);
  reg.__d3 = d;   // for QA scripts (like window.__stage)
  return d;
}
