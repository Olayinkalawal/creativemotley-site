/* Keyframe timeline: our ~2 KB stand-in for Theatre.js's sequence player.
   A sheet is JSON, one per chapter (src/gl/keys/*.json):
     { "camera": { "zoom": [{ "t": 0, "v": 1.06, "ease": [0.33, 0, 0.67, 1] }, { "t": 2.4, "v": 1.45 }], "focus": [...] } }
   - t is in viewports of the chapter's pass: 0 when the element's top enters at the bottom of the screen, one unit per
     viewport of scroll after that (the stage's pe × (height + vh) / vh, the same mapping Theatre uses);
   - v is a number or an array (interpolated per component);
   - ease is a CSS cubic-bezier [x1, y1, x2, y2] for the segment that starts at this key (CSS's convention); the
     default is linear. [1/3, 0, 2/3, 1] is exactly smoothstep. Named presets: EASE below.
   Before the first key a channel holds its first value, after the last its last: a pure function of scroll, so
   scrolling back is exact. */

export const EASE = {
  linear: [0, 0, 1, 1],
  smooth: [1 / 3, 0, 2 / 3, 1],          // smoothstep
  inOut: [0.65, 0, 0.35, 1],
  out: [0.16, 1, 0.3, 1],                // expo-ish out
  in: [0.7, 0, 0.84, 0],
};

/* CSS cubic-bezier timing function: x → y (Newton, then bisection) */
export function bezier(x1, y1, x2, y2) {
  if (x1 === y1 && x2 === y2) return (x) => x;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x;
      if (Math.abs(e) < 1e-6) return Y(t);
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 32; i++) { const v = X(t); if (Math.abs(v - x) < 1e-6) break; if (x > v) lo = t; else hi = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}

const easeFn = (e) => {
  if (!e) return null;
  const a = typeof e === 'string' ? EASE[e] : e;
  return a ? bezier(a[0], a[1], a[2], a[3]) : null;
};

/* compile a sheet's channels (sorted keys, eases resolved once) */
export function sheet(json) {
  const ch = {};
  const walk = (o, path) => {
    for (const [k, v] of Object.entries(o || {})) {
      const name = path ? `${path}.${k}` : k;
      if (Array.isArray(v) && v.length && typeof v[0] === 'object' && 't' in v[0]) {
        ch[name] = v.map((key) => ({ t: +key.t, v: key.v, e: easeFn(key.ease) })).sort((a, b) => a.t - b.t);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, name);
    }
  };
  walk(json, '');
  return {
    channels: ch,
    has: (name) => !!ch[name],
    /* value of a channel at t (numbers; arrays are written into out, or a new array) */
    at(name, t, out) { return sample(ch[name], t, out); },
    /* the time of the last key over every channel */
    get end() { let e = 0; for (const k of Object.values(ch)) e = Math.max(e, k[k.length - 1].t); return e; },
  };
}

export function sample(keys, t, out) {
  if (!keys || !keys.length) return undefined;
  if (t <= keys[0].t) return copy(keys[0].v, out);
  const last = keys[keys.length - 1];
  if (t >= last.t) return copy(last.v, out);
  let i = 1;
  while (keys[i].t < t) i++;
  const a = keys[i - 1], b = keys[i];
  const x = (t - a.t) / Math.max(1e-9, b.t - a.t);
  const k = a.e ? a.e(x) : x;
  if (typeof a.v === 'number') return a.v + (b.v - a.v) * k;
  const o = out || new Array(a.v.length);
  for (let j = 0; j < a.v.length; j++) o[j] = a.v[j] + (b.v[j] - a.v[j]) * k;
  return o;
}
const copy = (v, out) => {
  if (typeof v === 'number' || !out) return Array.isArray(v) ? v.slice() : v;
  for (let j = 0; j < v.length; j++) out[j] = v[j];
  return out;
};

/* the stage's segment → timeline time (viewports of the pass) */
export const passT = (seg, vh) => (seg.pe * (seg.height + vh)) / vh;

/* camera helper: zoom, focus [x, y], push, tilt (any channel missing keeps the value already in out) */
export function cameraAt(sh, t, out) {
  if (sh.has('camera.zoom')) out.zoom = sh.at('camera.zoom', t);
  if (sh.has('camera.focus')) sh.at('camera.focus', t, out.focus);
  if (sh.has('camera.push')) out.push = sh.at('camera.push', t);
  if (sh.has('camera.tilt')) out.tilt = sh.at('camera.tilt', t);
  return out;
}
