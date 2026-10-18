/* Capabilities, read once at boot. */
const mq = (q) => window.matchMedia(q).matches;
export const REDUCED = mq('(prefers-reduced-motion: reduce)');
export const FINE = mq('(pointer: fine)');
export const isDesktop = () => window.innerWidth >= 1024;

function glOk() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return r;
  } catch { return null; }
}

/* Tier 0: no WebGL (still plates). 1: light (phones, software GL, few cores). 2: full. */
export const GL_RENDERER = glOk();
export const TIER = (() => {
  const q = new URLSearchParams(location.search).get('tier');
  if (q !== null) return Math.max(0, Math.min(2, +q));
  if (GL_RENDERER === null) return 0;
  if (/swiftshader|llvmpipe|software|basic render/i.test(GL_RENDERER)) return 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  const touchOnly = !FINE;
  if (cores <= 4 || mem <= 4 || (touchOnly && window.innerWidth < 900)) return 1;
  return 2;
})();
document.documentElement.dataset.tier = String(TIER);
