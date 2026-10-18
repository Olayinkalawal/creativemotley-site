/* Teardown blocks (markup in the chapter partials; scene in gl/scenes/teardowns.js):
   <section class="td" data-scene="td:NAME" data-plate="ink" data-theme="dark">
     <div class="td__run" data-td-run>
       <div class="td__pin"><div class="td__slot" data-td-slot aria-hidden="true"><img class="td__still" …></div></div>
       <div class="td__copy"> label / head / dek / boxlink / <ol class="td__specs"><li class="td__spec">…</li></ol> </div>
     </div>
   </section>
   Spec rows light up in step with the explode (desktop); the still hides once WebGL draws the scene. */
import './_teardown.css';
import { onFrame, smooth, seg } from '../core/scroll.js';
import { REDUCED, isDesktop } from '../core/env.js';
import { tdProgress } from '../gl/scenes/teardowns.js';

export function init() {
  const blocks = [...document.querySelectorAll('.td')];
  if (!blocks.length) return;
  for (const b of blocks) {
    b.dataset.tdReady = '';
    const run = b.querySelector('[data-td-run]');
    const rows = [...b.querySelectorAll('.td__spec')];
    let lastHot = -1;
    onFrame((v) => {
      const p = tdProgress(run, v.y, v.vh);
      // the stage reports what it drew; once this block's scene has drawn, the still steps aside
      if (!b.classList.contains('is-drawn') && window.__stage?.drawn) {
        for (const s of window.__stage.drawn) if (s.id === b.dataset.scene) b.classList.add('is-drawn');
      }
      if (!rows.length || !isDesktop() || REDUCED) return;
      const n = rows.length;
      let hot = -1;
      rows.forEach((r, i) => {
        const a = 0.08 + (i / n) * 0.7;
        const on = smooth(seg(p, a, a + 0.08));
        r.style.setProperty('--on', on.toFixed(3));
        if (on > 0.5) hot = i;
      });
      if (p > 0.84) hot = -1;
      if (hot !== lastHot) { rows.forEach((r, i) => r.classList.toggle('is-hot', i === hot)); lastHot = hot; }
    });
  }
}
