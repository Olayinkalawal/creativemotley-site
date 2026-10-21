/* Capabilities, read once at boot. */
const mq = (q) => window.matchMedia(q).matches;
const Q = new URLSearchParams(location.search);
export const REDUCED = mq('(prefers-reduced-motion: reduce)');
// read once at boot: Lenis, the stage, the film and the marquee are set up for it, so a change mid-visit reloads the
// page (which then sets them up for the new preference)
try { window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => location.reload()); } catch {}
export const FINE = mq('(pointer: fine)');
export const isDesktop = () => window.innerWidth >= 1024;

/* The probe opens its context on the stage's own canvas (#stage), with the stage's attributes (gl/stage.js), and keeps
   it: the stage's renderer then gets that same context back instead of creating a second one (creating a context
   blocks the main thread: ~0.45 s on a throttled phone profile). Where the stage will not boot (tier 0, reduced
   motion) the context is let go below. ?tier=0 skips the probe. */
const STAGE_GL = { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' };
let probe = null;
function glOk() {
  try {
    const c = document.getElementById('stage') || document.createElement('canvas');
    const gl = c.getContext('webgl2', STAGE_GL) || c.getContext('webgl', STAGE_GL);
    if (!gl) return null;
    probe = gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch { return null; }
}

/* Tier 0: no WebGL (still plates). 1: light (phones, software GL, few cores). 2: full.
   (Sections read TIER > 0 as "animated"; the stage's own quality is QUALITY / STILL below.) */
export const GL_RENDERER = Q.get('tier') === '0' ? null : glOk();
export const SOFTWARE_GL = GL_RENDERER !== null && /swiftshader|llvmpipe|software|basic render/i.test(GL_RENDERER);
export const TIER = (() => {
  const q = Q.get('tier');
  if (q !== null && q !== 'still') return Math.max(0, Math.min(2, +q || 0));
  if (GL_RENDERER === null) return 0;
  if (SOFTWARE_GL) return 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  const touchOnly = !FINE;
  if (cores <= 4 || mem <= 4 || (touchOnly && window.innerWidth < 900)) return 1;
  return 2;
})();

/* The phone path (TIER_STILL): touch screens under 900 px on their short side, and any narrow window. The stage
   then draws one still per chapter (portrait paintings where they exist) with the dissolve and the paper: no frame
   streams, no film, no teardown frames (the sections show their stills). ?still=1 / ?tier=still force it, ?still=0
   turns it off. */
export const STILL = (() => {
  if (Q.has('still')) return Q.get('still') !== '0';
  if (Q.get('tier') === 'still') return true;
  if (TIER === 0) return false;
  const touch = !FINE && (mq('(pointer: coarse)') || 'ontouchstart' in window);
  return (touch && Math.min(window.innerWidth, window.innerHeight) < 900) || window.innerWidth < 640;
})();
export const TIER_STILL = 'still';

/* Method's real-time camera (gl/scenes/camera3d.js). On the phone path only where the device is likely to carry it:
   at least 4 GB (navigator.deviceMemory; browsers that do not report it count as 4) and at least 6 cores. A weaker
   phone keeps the 3D stills, as at tier 0; the scene also gives up at runtime if the frame-rate governor has to step
   all the way down to "min" while it draws (?q=… turns that check off). On the phone path ?cam3d=1 / ?cam3d=0 force
   it on or off (QA: the test machine has 4 cores and software GL). Desktop always has it. */
export const CAM3D_FORCED = Q.has('cam3d') ? Q.get('cam3d') !== '0' : null;
export const CAM3D = !STILL || (CAM3D_FORCED ?? ((navigator.deviceMemory || 4) >= 4 && (navigator.hardwareConcurrency || 4) >= 6));

/* the stage's starting quality (pixel budget: longest side 1280 / 1920 / 2880 px, DPR ≤ 2); a frame-rate average
   steps it down, to a 960-px floor (gl/stage.js). ?q=min|low|medium|high forces it. */
export const QUALITY = (() => {
  const q = Q.get('q');
  if (q === 'min' || q === 'low' || q === 'medium' || q === 'high') return q;
  if (STILL) return 'high';   // one texture per pixel: the phone path starts at native resolution (the governor steps down)
  if (SOFTWARE_GL) return 'low';
  return TIER >= 2 ? 'high' : 'medium';
})();

// no stage here (tier 0, reduced motion, or the probe's context is not WebGL 2, which the stage needs): let it go
if (probe && (!(TIER > 0 && !REDUCED) || !(typeof WebGL2RenderingContext !== 'undefined' && probe instanceof WebGL2RenderingContext))) {
  probe.getExtension('WEBGL_lose_context')?.loseContext();
}
probe = null;

const root = document.documentElement;
root.dataset.tier = String(TIER);
if (STILL && TIER > 0) root.classList.add('tier-still');
