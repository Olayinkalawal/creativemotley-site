/* IV · Method, continued: "the instrument" (scene id "instrument").
   Creative Motley's exploded hub: the camera from the Method film, rebuilt in real time and procedurally (no model
   files), on a black stage. Everything is a pure function of the run state in src/sections/teardown.js (runAt),
   plus a gentle idle float.
   Model: seven groups along the optical axis (+Z through x = y = 0), back to front:
     body    shell, leather grip, EVF hump + eyecup, knurled dials, hot shoe and a shotgun mic on a shock mount,
             rear screen (tilts out), battery (drops out of the grip), four screws (unscrew and float down),
             the copper internal chassis on its front face
     sensor  copper IBIS plate, PCB (gold pads), ceramic package, gold bond frame, blue-green iridescent die
     shutter frame, four curtain slats (they close as it separates), brass motor and gear
     mount   front cover with the throat, polished bayonet with tabs and screws, gold contact pins
     inner   rear mount, rear element, the iris (nine overlapping blades stop down), two more elements
     rings   barrel, knurled zoom and focus rings (geometry ridges), brass hairlines
     front   flared front barrel, the one red ring, brass thread ring, the big front element
   Look: MeshPhysical / MeshStandard materials lit by one PMREM studio environment (a dark room with softboxes,
   made in code) plus a warm key and a cool rim. The stage renders into linear 8-bit targets, so the materials are
   patched to tone-map and encode sRGB themselves; the scene is drawn into its own 4x MSAA target and composited
   onto the black stage (umber glow at the foot) by one full-screen pass. A floor pass under the object gives a
   warm pool with soft contact shadows (one soft blob per group).
   Framing: like the posters, an off-axis frustum puts the slot the CSS lays out (.td-slot) at the projection
   centre, and each frame the object's bounding points are fitted into the slot (so it never leaves it). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { state, runAt, PARTS, WIN } from '../../sections/teardown.js';
import { clamp, smooth, seg } from '../../core/scroll.js';

const TAU = Math.PI * 2;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* exploded offset along the axis, and where each group starts moving within the explode (front leads) */
const GROUPS = {
  body: { dz: -5.0, s: 0.03 },
  sensor: { dz: -2.8, s: 0.32 },
  shutter: { dz: -0.6, s: 0.26 },
  mount: { dz: 3.0, s: 0.18 },
  inner: { dz: 5.3, s: 0.11 },
  rings: { dz: 9.0, s: 0.06 },
  front: { dz: 11.1, s: 0.0 },
};
const DUR = 0.58;
/* the pose: assembled 3/4 → the exploded diagonal (wide slots) or a steeper fall (tall slots) */
const RIG = {
  wide: { tilt: [0.1, 0.56], yaw: [0.86, 0.74], pitch: [0.2, 0.3], orbit: 0.12, fill: [0.6, 0.97], fl: 2.3 },
  tall: { tilt: [0.16, 0.92], yaw: [0.84, 0.66], pitch: [0.2, 0.28], orbit: 0.1, fill: [0.66, 1.0], fl: 2.1 },
};

/* ── geometry helpers ─────────────────────────────────────────────────── */
function geom(pos, nor, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (idx) g.setIndex(idx);
  return g;
}
/* a turned part around +Z. strips: polylines of [r, z]; each shades smoothly, strips meet at hard edges.
   Walk each strip with the material on the right: outer walls forward, front faces inward, bores backward.
   A partial turn (a0..a1) with caps closes its ends with the strips' outline. */
function turn(strips, segs = 96, a0 = 0, a1 = TAU, caps = false) {
  let n = 0;
  for (const s of strips) n += s.length * (segs + 1);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  let v = 0;
  for (const s of strips) {
    const m = s.length, base = v;
    const pn = s.map((_, i) => {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(m - 1, i + 1)];
      const nr = b[1] - a[1], nz = a[0] - b[0], l = Math.hypot(nr, nz) || 1;
      return [nr / l, nz / l];
    });
    for (let j = 0; j <= segs; j++) {
      const ph = a0 + ((a1 - a0) * j) / segs, c = Math.cos(ph), sn = Math.sin(ph);
      for (let i = 0; i < m; i++, v++) {
        const [r, z] = s[i];
        pos[v * 3] = r * c; pos[v * 3 + 1] = r * sn; pos[v * 3 + 2] = z;
        nor[v * 3] = pn[i][0] * c; nor[v * 3 + 1] = pn[i][0] * sn; nor[v * 3 + 2] = pn[i][1];
        uv[v * 2] = j / segs; uv[v * 2 + 1] = i / (m - 1);
      }
    }
    for (let j = 0; j < segs; j++) for (let i = 0; i < m - 1; i++) {
      const a = base + j * m + i, b = a + m;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = geom(pos, nor, uv, idx);
  if (!caps) return g;
  // end caps: the profile outline, triangulated, at a0 (facing back along the turn) and a1
  const ring = [];
  for (const s of strips) for (const p of s) if (!ring.length || Math.hypot(p[0] - ring[ring.length - 1][0], p[1] - ring[ring.length - 1][1]) > 1e-6) ring.push(p);
  if (ring.length > 2 && Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) < 1e-6) ring.pop();
  const tris = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const out = [g.toNonIndexed()];
  for (const [ph, sgn] of [[a0, -1], [a1, 1]]) {
    const c = Math.cos(ph), sn = Math.sin(ph), tx = -sn * sgn, ty = c * sgn;
    const P = [], N = [], U = [];
    for (const t of tris) {
      const ord = sgn > 0 ? [t[0], t[2], t[1]] : t;
      for (const k of ord) { const [r, z] = ring[k]; P.push(r * c, r * sn, z); N.push(tx, ty, 0); U.push(0, 0); }
    }
    // orient by the actual winding
    const A = new THREE.Vector3(P[0], P[1], P[2]), B = new THREE.Vector3(P[3], P[4], P[5]), C = new THREE.Vector3(P[6], P[7], P[8]);
    const fn = B.sub(A).cross(C.sub(A));
    if (fn.x * tx + fn.y * ty < 0) for (let i = 0; i < P.length; i += 9) for (let k = 0; k < 3; k++) { const t = P[i + 3 + k]; P[i + 3 + k] = P[i + 6 + k]; P[i + 6 + k] = t; }
    out.push(geom(new Float32Array(P), new Float32Array(N), new Float32Array(U)));
  }
  return mergeGeometries(out);
}
/* a polyline split into hard-edged strips */
const hard = (...pts) => pts.slice(1).map((p, i) => [pts[i], p]);
/* a machined ring (or a disc when ri = 0): chamfered on all four edges */
function ring(ri, ro, z0, z1, ch = 0.04, segs = ro < 1.2 ? 40 : 88) {
  const c = Math.min(ch, (ro - ri) / 3, (z1 - z0) / 3);
  if (ri <= 0) return turn(hard([0, z0], [ro - c, z0], [ro, z0 + c], [ro, z1 - c], [ro - c, z1], [0, z1]), segs);
  return turn(hard([ri + c, z0], [ro - c, z0], [ro, z0 + c], [ro, z1 - c], [ro - c, z1], [ri + c, z1], [ri, z1 - c], [ri, z0 + c], [ri + c, z0]), segs);
}
/* a lens element: back surface, ground rim, front surface (sag > 0 bulges outward on that side) */
function lens(R, zb, zf, sagB, sagF, segs = 80, n = 10) {
  const back = [], front = [];
  for (let i = 0; i <= n; i++) { const r = (R * i) / n; back.push([r, zb - sagB * (1 - (r / R) ** 2)]); }
  for (let i = n; i >= 0; i--) { const r = (R * i) / n; front.push([r, zf + sagF * (1 - (r / R) ** 2)]); }
  return turn([back, [[R, zb], [R, zf]], front], segs);
}
/* a ribbed / knurled band around +Z (flat-shaded ribs that taper into both end faces) */
function ribs(R, dep, z0, z1, n, rIn, ch = 0.06, F = [0, 0.2, 0.34, 0.84]) {
  const M = n * 4;
  const ang = (j) => ((Math.floor(j / 4) + F[j % 4]) / n) * TAU;
  const rows = [[z0, () => rIn], [z0, () => R - dep], [z0 + ch, (j) => (j % 4 >= 2 ? R : R - dep)], [z1 - ch, (j) => (j % 4 >= 2 ? R : R - dep)], [z1, () => R - dep], [z1, () => rIn]];
  const P = [];
  const vtx = (j, k) => { const a = ang(j % M) + (j >= M ? TAU : 0), r = rows[k][1](j % M); return [r * Math.cos(a), r * Math.sin(a), rows[k][0]]; };
  for (let j = 0; j < M; j++) for (let k = 0; k < rows.length - 1; k++) {
    const a = vtx(j, k), b = vtx(j + 1, k), c = vtx(j, k + 1), d = vtx(j + 1, k + 1);
    P.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((P.length / 3) * 2), 2));
  return g;
}
/* rounded rectangle outline (also as a hole path) */
function rr(w, h, r, cx = 0, cy = 0, path = new THREE.Shape()) {
  r = Math.max(0.002, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3));
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0); path.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x1, y1 - r); path.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  path.lineTo(x0 + r, y1); path.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + r); path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}
const rrHole = (w, h, r, cx, cy) => rr(w, h, r, cx, cy, new THREE.Path());
const circ = (r, cx = 0, cy = 0) => { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, TAU, true); return p; };
/* a polygon with filleted corners */
function fillet(pts, rad) {
  const s = new THREE.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], r = Array.isArray(rad) ? rad[i] : rad;
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, da / 2), rb = Math.min(r, db / 2);
    const p1 = [p[0] + ((a[0] - p[0]) * ra) / da, p[1] + ((a[1] - p[1]) * ra) / da];
    const p2 = [p[0] + ((b[0] - p[0]) * rb) / db, p[1] + ((b[1] - p[1]) * rb) / db];
    if (i === 0) s.moveTo(p1[0], p1[1]); else s.lineTo(p1[0], p1[1]);
    s.quadraticCurveTo(p[0], p[1], p2[0], p2[1]);
  }
  s.closePath();
  return s;
}
/* a bevelled solid: the shape extruded along +Z, centred on z = 0, total depth d, rounded edges of radius b.
   The bevel grows the outline by b, so shapes are drawn inset by b (holes outset by b).
   The caps stay flat; walls and bevels are welded and smoothed, meeting the caps tangentially. */
function solid(shape, d, b, curveSegments = 10, bevelSegments = 4) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.002, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments, curveSegments });
  g.translate(0, 0, -Math.max(0.002, d - 2 * b) / 2);
  const zc = Math.max(0.002, d - 2 * b) / 2 + b;
  const P = g.attributes.position.array;
  const capIdx = [], sideIdx = [];
  for (const gr of g.groups) for (let i = gr.start; i < gr.start + gr.count; i++) (gr.materialIndex === 0 ? capIdx : sideIdx).push(i);
  const cp = new Float32Array(capIdx.length * 3), cn = new Float32Array(capIdx.length * 3);
  capIdx.forEach((vi, k) => { cp[k * 3] = P[vi * 3]; cp[k * 3 + 1] = P[vi * 3 + 1]; cp[k * 3 + 2] = P[vi * 3 + 2]; cn[k * 3 + 2] = P[vi * 3 + 2] > 0 ? 1 : -1; });
  const sp = new Float32Array(sideIdx.length * 3);
  sideIdx.forEach((vi, k) => { sp[k * 3] = P[vi * 3]; sp[k * 3 + 1] = P[vi * 3 + 1]; sp[k * 3 + 2] = P[vi * 3 + 2]; });
  let sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg = mergeVertices(sg, 1e-4);
  sg.computeVertexNormals();
  const SP = sg.attributes.position, SN = sg.attributes.normal;
  for (let i = 0; i < SP.count; i++) if (Math.abs(Math.abs(SP.getZ(i)) - zc) < 1e-4) SN.setXYZ(i, 0, 0, Math.sign(SP.getZ(i)));
  sg = sg.toNonIndexed();
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  cg.setAttribute('normal', new THREE.BufferAttribute(cn, 3));
  g.dispose();
  return boxUV(mergeGeometries([cg, sg]));
}
/* box-projected UVs (world units * s), for tiling surface maps */
function boxUV(g, s = 0.34) {
  const P = g.attributes.position, N = g.attributes.normal, uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    let u, v;
    if (az >= ax && az >= ay) { u = P.getX(i); v = P.getY(i); } else if (ax >= ay) { u = P.getZ(i); v = P.getY(i); } else { u = P.getX(i); v = P.getZ(i); }
    uv[i * 2] = u * s; uv[i * 2 + 1] = v * s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
/* planar UVs over the bounding box in XY (for the PCB print) */
function planarUV(g) {
  g.computeBoundingBox();
  const b = g.boundingBox, P = g.attributes.position, uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) { uv[i * 2] = (P.getX(i) - b.min.x) / (b.max.x - b.min.x); uv[i * 2 + 1] = (P.getY(i) - b.min.y) / (b.max.y - b.min.y); }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const rbox = (w, h, d, r = 0.05, s = 2) => new RoundedBoxGeometry(w, h, d, s, r);

/* collects pieces per (object, material) and merges each bin into one mesh: few draw calls */
class Kit {
  constructor() { this.bins = new Map(); this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); }
  add(obj, mat, g, o = {}) {
    const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0], s = o.s || [1, 1, 1];
    this.m.compose(new THREE.Vector3(...p), this.q.setFromEuler(this.e.set(r[0], r[1], r[2], o.order || 'XYZ')), new THREE.Vector3(...(typeof s === 'number' ? [s, s, s] : s)));
    const gg = g.index ? g.toNonIndexed() : g.clone();
    gg.applyMatrix4(this.m);
    for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') gg.deleteAttribute(k);
    if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
    gg.clearGroups();
    const key = obj.uuid + mat.uuid;
    if (!this.bins.has(key)) this.bins.set(key, { obj, mat, list: [] });
    this.bins.get(key).list.push(gg);
  }
  build() {
    for (const { obj, mat, list } of this.bins.values()) {
      const g = mergeGeometries(list);
      for (const x of list) x.dispose();
      g.computeBoundingBox(); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.matrixAutoUpdate = false;
      if (mat.transparent) mesh.renderOrder = 2;
      obj.add(mesh);
    }
    this.bins.clear();
  }
}

/* ── procedural textures (canvas; seeded, so every visit is the same object) ── */
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function toTex(c, { srgb = false, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function valueNoise(size, cells, rnd) {
  const g = Float32Array.from({ length: cells * cells }, rnd), out = new Float32Array(size * size);
  const at = (x, y) => g[((y + cells) % cells) * cells + ((x + cells) % cells)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * cells, fy = (y / size) * cells, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    out[y * size + x] = lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty);
  }
  return out;
}
function normalFromHeight(size, h, k) {
  const c = cnv(size, size), g = c.getContext('2d'), img = g.createImageData(size, size);
  const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (0.5 / l + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function makeTextures() {
  const rnd = rng(7);
  // fine stipple for the magnesium shell
  const S = 256, a = valueNoise(S, 64, rnd), b = valueNoise(S, 128, rnd), st = new Float32Array(S * S);
  for (let i = 0; i < st.length; i++) st[i] = a[i] * 0.6 + b[i] * 0.4;
  const stipple = toTex(normalFromHeight(S, st, 2.2), { repeat: true });
  // leatherette pebble (Worley F2 - F1: crevices between rounded pebbles)
  const pts = [], C = 16, cell = S / C;
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) pts.push([(x + rnd()) * cell, (y + rnd()) * cell]);
  const lh = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let f1 = 1e9, f2 = 1e9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const gx = (cx + ox + C) % C, gy = (cy + oy + C) % C, p = pts[gy * C + gx];
      let dx = p[0] - x, dy = p[1] - y;
      if (dx > S / 2) dx -= S; if (dx < -S / 2) dx += S; if (dy > S / 2) dy -= S; if (dy < -S / 2) dy += S;
      const d = Math.hypot(dx, dy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    lh[y * S + x] = Math.sqrt(clamp((f2 - f1) / 5.5));
  }
  const leather = toTex(normalFromHeight(S, lh, 1.6), { repeat: true });

  // PCB: solder mask, traces, gold pads and vias, silkscreen outlines (no text); a second canvas holds
  // roughness (G) and metalness (B) for the same drawing
  const W = 512, Hh = 392, pc = cnv(W, Hh), pm = cnv(W, Hh), g1 = pc.getContext('2d'), g2 = pm.getContext('2d');
  const both = (f) => { f(g1, 0); f(g2, 1); };
  g1.fillStyle = '#0c1611'; g1.fillRect(0, 0, W, Hh);
  g2.fillStyle = 'rgb(0,150,0)'; g2.fillRect(0, 0, W, Hh);
  const pr = rng(19);
  g1.strokeStyle = '#16301f'; g1.lineWidth = 2;
  for (let i = 0; i < 150; i++) {
    let x = pr() * W, y = pr() * Hh; g1.beginPath(); g1.moveTo(x, y);
    for (let k = 0; k < 4; k++) { if (k % 2) y += (pr() - 0.5) * 140; else x += (pr() - 0.5) * 180; g1.lineTo(x, y); }
    g1.stroke();
  }
  const gold = (g, m) => { g.fillStyle = m ? 'rgb(0,60,255)' : '#c99b45'; };
  // edge pads
  both((g, m) => { gold(g, m); for (let i = 0; i < 18; i++) { g.fillRect(14, 40 + i * 17, 16, 9); g.fillRect(W - 30, 40 + i * 17, 16, 9); } });
  both((g, m) => { gold(g, m); for (let i = 0; i < 24; i++) { g.fillRect(70 + i * 15.5, 16, 8, 14); g.fillRect(70 + i * 15.5, Hh - 30, 8, 14); } });
  // vias and mounting holes
  both((g, m) => {
    for (let i = 0; i < 70; i++) { const x = 40 + pr() * (W - 80), y = 40 + pr() * (Hh - 80); gold(g, m); g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); g.fillStyle = m ? 'rgb(0,200,0)' : '#050806'; g.beginPath(); g.arc(x, y, 1.4, 0, TAU); g.fill(); }
    for (const [x, y] of [[26, 22], [W - 26, 22], [26, Hh - 22], [W - 26, Hh - 22]]) { gold(g, m); g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); g.fillStyle = m ? 'rgb(0,230,0)' : '#020302'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); }
  });
  g1.strokeStyle = '#cfcabb'; g1.lineWidth = 1.5; g2.strokeStyle = 'rgb(0,180,0)'; g2.lineWidth = 1.5;
  both((g) => { for (const [x, y, w, h] of [[48, 52, 74, 46], [W - 128, Hh - 104, 80, 52], [W - 120, 50, 70, 70], [44, Hh - 112, 64, 58], [150, 54, 40, 22], [W - 196, Hh - 78, 44, 22]]) g.strokeRect(x, y, w, h); });
  const pcb = toTex(pc, { srgb: true }), pcbRM = toTex(pm);

  // the sensor die: blue-green colour filter with a fine pixel grid; gold bond pads round the edge
  const dc = cnv(384, 256), dg = dc.getContext('2d');
  const grad = dg.createLinearGradient(0, 0, 384, 256);
  grad.addColorStop(0, '#1b2f63'); grad.addColorStop(0.55, '#1c4c66'); grad.addColorStop(1, '#1f5c55');
  dg.fillStyle = grad; dg.fillRect(0, 0, 384, 256);
  dg.fillStyle = 'rgba(160,210,230,0.10)';
  for (let x = 14; x < 370; x += 3) dg.fillRect(x, 14, 1, 228);
  for (let y = 14; y < 242; y += 3) dg.fillRect(14, y, 356, 1);
  dg.strokeStyle = '#0d1520'; dg.lineWidth = 12; dg.strokeRect(6, 6, 372, 244);
  dg.fillStyle = '#c99b45';
  for (let i = 0; i < 30; i++) { dg.fillRect(18 + i * 12, 2, 6, 6); dg.fillRect(18 + i * 12, 248, 6, 6); }
  const die = toTex(dc, { srgb: true });

  // shotgun mic tube: interference slots (u around, v along)
  const mc = cnv(512, 128), mg = mc.getContext('2d');
  mg.fillStyle = '#1e1e20'; mg.fillRect(0, 0, 512, 128);
  mg.fillStyle = '#040404';
  for (let k = 0; k < 4; k++) for (let j = 0; j < 6; j++) {
    const v0 = 14 + j * 15, x = (k + 0.5) * 128 - 6;
    mg.beginPath(); mg.roundRect(x, v0, 12, 10, 5); mg.fill();
  }
  const mic = toTex(mc, { srgb: true });
  return { stipple, leather, pcb, pcbRM, die, mic };
}

/* ── materials: tone-mapped and sRGB-encoded in their own shaders (the stage's targets are linear 8-bit) ── */
const TONE = /* glsl */`
uniform float uLift;
uniform float uExposure;
vec3 cmTone(vec3 c) {
  // Khronos PBR Neutral highlight roll-off (no toe: the black stage keeps its shadow detail)
  const float S = 0.78, D = 0.16;
  float pk = max(c.r, max(c.g, c.b));
  if (pk < S) return c;
  float d = 1.0 - S, np = 1.0 - d * d / (pk + d - S);
  c *= np / pk;
  return mix(c, vec3(np), 1.0 - 1.0 / (D * (pk - np) + 1.0));
}
vec3 cmEncode(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
`;
const exposure = { value: 1 };
function patch(mat, lift) {
  mat.userData.lift = lift;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLift = mat.userData.lift;
    sh.uniforms.uExposure = exposure;
    sh.fragmentShader = TONE + sh.fragmentShader
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = cmTone(gl_FragColor.rgb * uLift * uExposure);')
      .replace('#include <colorspace_fragment>', 'gl_FragColor.rgb = cmEncode(gl_FragColor.rgb);');
  };
  mat.customProgramCacheKey = () => 'cm-instrument-1';
  return mat;
}
function baseMaterials(tx) {
  const std = (o) => new THREE.MeshStandardMaterial(o), phy = (o) => new THREE.MeshPhysicalMaterial(o);
  const glass = phy({
    color: 0x0a0e0e, metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02,
    iridescence: 0.9, iridescenceIOR: 1.8, iridescenceThicknessRange: [240, 560], envMapIntensity: 1.5,
    transparent: true, opacity: 0.34, depthWrite: false,
    // reflections add in full; what lies behind is dimmed by the opacity (glass without transmission)
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  return {
    satin: phy({ color: 0x1a1a1c, roughness: 0.48, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.34, normalMap: tx.stipple, normalScale: new THREE.Vector2(0.22, 0.22) }),
    leather: std({ color: 0x141414, roughness: 0.82, normalMap: tx.leather, normalScale: new THREE.Vector2(0.85, 0.85) }),
    anod: std({ color: 0x19191b, metalness: 0.72, roughness: 0.36 }),
    rubber: std({ color: 0x111111, roughness: 0.68 }),
    plastic: std({ color: 0x242426, roughness: 0.5 }),
    cream: std({ color: 0xcdc3ab, roughness: 0.55 }),
    steel: std({ color: 0xd8d4cc, metalness: 1, roughness: 0.17 }),
    dsteel: std({ color: 0x3e3f42, metalness: 0.92, roughness: 0.32 }),
    blade: std({ color: 0x141517, metalness: 0.6, roughness: 0.42 }),
    gold: std({ color: 0xf0c066, metalness: 1, roughness: 0.2 }),
    brass: std({ color: 0xcca45c, metalness: 1, roughness: 0.27 }),
    copper: std({ color: 0xc8784a, metalness: 1, roughness: 0.3 }),
    red: std({ color: 0x8e1b20, metalness: 0.55, roughness: 0.3 }),
    pcb: std({ map: tx.pcb, roughnessMap: tx.pcbRM, metalnessMap: tx.pcbRM, roughness: 1, metalness: 1 }),
    die: phy({ map: tx.die, metalness: 0.45, roughness: 0.16, iridescence: 1, iridescenceIOR: 1.55, iridescenceThicknessRange: [260, 760], clearcoat: 1, clearcoatRoughness: 0.05 }),
    screen: phy({ color: 0x060708, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
    mic: std({ map: tx.mic, metalness: 0.5, roughness: 0.42 }),
    glass,
  };
}

/* ── the model ───────────────────────────────────────────────────────── */
function buildModel(base) {
  const root = new THREE.Group();
  const kit = new Kit();
  const G = {};
  for (const name of PARTS) { const g = new THREE.Group(); g.name = name; root.add(g); G[name] = { obj: g, lift: { value: 1 }, mats: {}, sub: {}, fit: [], e: 0 }; }
  const mat = (name, key, inst = false) => {
    const gr = G[name], k = key + (inst ? '#i' : '');
    if (!gr.mats[k]) gr.mats[k] = patch(base[key].clone(), gr.lift);
    return gr.mats[k];
  };
  const sub = (name, key, p = [0, 0, 0]) => { const o = new THREE.Group(); o.position.set(...p); G[name].obj.add(o); G[name].sub[key] = o; o.userData.base = o.position.clone(); return o; };
  const RX = -Math.PI / 2;   // turns a +Z part to stand along +Y

  /* body */
  {
    const B = G.body.obj, m = (k) => mat('body', k);
    kit.add(B, m('satin'), solid(rr(12.3, 7.1, 0.45), 5.0, 0.45), { p: [-1.2, 0, -0.7] });
    kit.add(B, m('leather'), solid(fillet([[-7.25, -1.15], [-4.85, -1.15], [-4.85, -4.35], [-7.25, -4.35]], [0.2, 0.2, 0.8, 1.2]), 7.6, 0.55, 12), { p: [0, -0.2, 0], r: [RX, 0, 0] });
    kit.add(B, m('satin'), solid(fillet([[3.3, 3.9], [3.3, 5.8], [-0.3, 5.8], [-1.6, 4.6], [-1.6, 3.9]], [0.1, 0.5, 0.45, 0.45, 0.1]), 5.6, 0.3, 10), { r: [0, Math.PI / 2, 0] });
    kit.add(B, m('leather'), rbox(4.4, 2.8, 1.4, 0.55, 4), { p: [0, 4.85, -3.95] });
    kit.add(B, m('screen'), rbox(2.9, 1.6, 0.1, 0.04), { p: [0, 4.85, -4.66] });
    kit.add(B, m('steel'), rbox(2.3, 0.16, 2.6, 0.05), { p: [0, 6.16, -1.4] });
    for (const x of [-1.02, 1.02]) kit.add(B, m('steel'), rbox(0.28, 0.24, 2.6, 0.06), { p: [x, 6.3, -1.4] });
    // dials: knurled, with polished caps
    const cap = (r, z) => turn([...hard([r + 0.05, z - 0.05], [r, z]), [[r, z], [0, z]]], 64);
    kit.add(B, m('anod'), ribs(1.2, 0.07, 0, 0.75, 64, 0.3), { p: [-5.0, 4.0, -1.2], r: [RX, 0, 0] });
    kit.add(B, m('steel'), cap(1.0, 0.78), { p: [-5.0, 4.0, -1.2], r: [RX, 0, 0] });
    kit.add(B, m('anod'), ribs(1.0, 0.06, 0, 0.6, 54, 0.3), { p: [3.4, 4.0, -1.5], r: [RX, 0, 0] });
    kit.add(B, m('steel'), cap(0.82, 0.63), { p: [3.4, 4.0, -1.5], r: [RX, 0, 0] });
    // shutter button in its collar on the grip
    kit.add(B, m('anod'), ring(0.44, 0.86, 0, 0.32, 0.05, 64), { p: [-6.05, 3.6, 3.1], r: [RX, 0, 0] });
    kit.add(B, m('steel'), turn([...hard([0.4, 0.05], [0.4, 0.42]), [[0.4, 0.42], [0.32, 0.5], [0.18, 0.54], [0, 0.555]]], 64), { p: [-6.05, 3.6, 3.1], r: [RX, 0, 0] });
    // the copper internal chassis on the front face (hidden inside the front cover until it parts)
    const ch = rr(9.1, 7.1, 0.3);
    ch.holes.push(rrHole(5.5, 4.1, 0.3, -0.4, 0), circ(0.36, 3.6, 2.9), circ(0.36, -3.9, 2.9), circ(0.36, 3.6, -2.9), circ(0.36, -3.9, -2.9));
    kit.add(B, m('copper'), solid(ch, 0.26, 0.05), { p: [0.4, 0, 1.93] });
    for (let i = 0; i < 6; i++) kit.add(B, m('copper'), rbox(0.12, 4.4, 0.55, 0.03, 1), { p: [3.55 + i * 0.24, 0, 2.3] });
    for (const [x, y] of [[-3.4, 3.0], [4.4, 3.0], [-3.4, -3.0], [4.4, -3.0]]) kit.add(B, m('brass'), ring(0, 0.22, 0, 0.5, 0.03, 32), { p: [x, y, 2.0] });
    for (const [x, y] of [[-1.9, 2.75], [2.1, 2.75], [-1.9, -2.75], [2.1, -2.75]]) kit.add(B, m('anod'), turn([[[0.2, 0], [0.18, 0.07], [0.1, 0.12], [0, 0.13]]], 24), { p: [x, y, 2.06] });
    // rear screen on its hinge
    const scr = sub('body', 'screen', [0, 2.7, -3.25]);
    kit.add(scr, m('satin'), solid(rr(8.16, 5.16, 0.23), 0.34, 0.12), { p: [-0.4, -2.7, -0.17] });
    kit.add(scr, m('screen'), rbox(7.7, 4.7, 0.04, 0.015), { p: [-0.4, -2.7, -0.36] });
    // battery in the grip
    const bat = sub('body', 'battery', [-6.05, -1.0, 2.75]);
    kit.add(bat, m('plastic'), rbox(2.3, 5.6, 2.9, 0.22, 3));
    kit.add(bat, m('gold'), rbox(0.06, 0.42, 1.6, 0.02, 1), { p: [-1.16, 2.2, 0] });
    kit.add(bat, m('satin'), rbox(2.5, 0.26, 3.1, 0.1, 2), { p: [0, -2.86, 0] });
    // the shotgun mic on a shock mount, and its cable to the side port
    const mic = sub('body', 'mic', [0, 6.24, -1.4]);
    kit.add(mic, m('anod'), rbox(1.9, 0.3, 2.3, 0.08), { p: [0, 0.15, 0] });
    kit.add(mic, m('anod'), rbox(0.55, 0.85, 0.55, 0.12), { p: [0, 0.7, 0] });
    kit.add(mic, m('anod'), rbox(0.5, 0.34, 3.9, 0.12), { p: [0, 1.05, 0] });
    for (const z of [-1.65, 1.65]) {
      kit.add(mic, m('anod'), new THREE.TorusGeometry(0.98, 0.075, 8, 44), { p: [0, 2.0, z] });
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; kit.add(mic, m('rubber'), rbox(0.06, 0.34, 0.06, 0.02, 1), { p: [Math.cos(a) * 0.78, 2.0 + Math.sin(a) * 0.78, z], r: [0, 0, a - Math.PI / 2] }); }
    }
    kit.add(mic, m('anod'), turn(hard([0, -3.0], [0.55, -3.0], [0.62, -2.93]), 48), { p: [0, 2.0, 0] });
    kit.add(mic, m('mic'), turn([[[0.62, -2.93], [0.62, 4.9]]], 64), { p: [0, 2.0, 0] });
    const grille = [];
    for (let i = 0; i <= 10; i++) grille.push([i % 2 ? 0.665 : 0.625, 4.9 + i * 0.1]);
    kit.add(mic, m('anod'), turn([grille, ...hard([0.625, 5.9], [0.58, 5.96], [0.46, 5.96])], 64), { p: [0, 2.0, 0] });
    kit.add(mic, m('rubber'), turn([[[0.46, 5.96], [0, 5.93]]], 48), { p: [0, 2.0, 0] });
    kit.add(mic, m('gold'), ring(0, 0.42, -3.75, -3.0, 0.04, 48), { p: [0, 2.0, 0] });
    const cable = new THREE.CatmullRomCurve3([[0, 2.0, -3.75], [0.15, 1.85, -4.5], [1.4, 1.1, -5.0], [3.7, -0.7, -4.1], [5.55, -2.7, -2.0], [5.6, -3.84, 0.4], [5.62, -3.84, 0.9]].map((p) => new THREE.Vector3(...p)));
    kit.add(mic, m('rubber'), new THREE.TubeGeometry(cable, 72, 0.1, 8, false));
    kit.add(mic, m('anod'), rbox(0.5, 0.42, 0.42, 0.1), { p: [5.52, -3.84, 0.9] });
    G.body.anchor = { obj: mic, p: new THREE.Vector3(0, 2.62, 5.6) };
  }

  /* sensor */
  {
    const S = G.sensor.obj, m = (k) => mat('sensor', k);
    const plate = rr(7.48, 5.88, 0.45);
    plate.holes.push(circ(0.3, 3.2, 2.4), circ(0.3, -3.2, 2.4), circ(0.3, 3.2, -2.4), circ(0.3, -3.2, -2.4));
    kit.add(S, m('copper'), solid(plate, 0.28, 0.06), { p: [0, 0, 2.15] });
    kit.add(S, m('pcb'), planarUV(solid(rr(6.74, 5.14, 0.27), 0.16, 0.03)), { p: [0, 0, 2.37] });
    kit.add(S, m('plastic'), solid(rr(4.54, 3.44, 0.12), 0.2, 0.03), { p: [0, 0, 2.55] });
    const fr = rr(4.13, 2.98, 0.08);
    fr.holes.push(rrHole(3.74, 2.54, 0.04, 0, 0));
    kit.add(S, m('gold'), solid(fr, 0.04, 0.01, 6, 2), { p: [0, 0, 2.67] });
    kit.add(S, m('die'), new THREE.PlaneGeometry(3.68, 2.48), { p: [0, 0, 2.662] });
    kit.add(S, m('glass'), rbox(4.3, 3.15, 0.06, 0.02), { p: [0, 0, 2.74] });
    for (const [x, y, w, h] of [[-2.6, 2.0, 1.1, 0.7], [2.5, -2.0, 1.1, 0.7], [-2.7, -1.95, 0.8, 0.55], [2.75, 1.85, 0.6, 0.6], [2.8, 0.25, 0.5, 0.8]]) kit.add(S, m('plastic'), rbox(w, h, 0.14, 0.04), { p: [x, y, 2.52] });
    kit.add(S, m('cream'), rbox(0.42, 2.3, 0.3, 0.05), { p: [-3.0, 0.1, 2.6] });
    for (let i = 0; i < 8; i++) kit.add(S, m('gold'), rbox(0.1, 0.14, 0.06, 0.015, 1), { p: [-2.95, -0.85 + i * 0.27, 2.78] });
    kit.add(S, m('copper'), rbox(2.2, 0.03, 1.6, 0.01, 1), { p: [0, -2.66, 1.62] });
    G.sensor.anchor = { obj: S, p: new THREE.Vector3(-1.05, 0.72, 2.76) };
  }

  /* shutter */
  {
    const H = G.shutter.obj, m = (k) => mat('shutter', k);
    const fr = rr(6.3, 5.1, 0.3);
    fr.holes.push(rrHole(4.2, 3.0, 0.15, 0, 0));
    kit.add(H, m('anod'), solid(fr, 0.34, 0.05), { p: [0, 0, 2.98] });
    kit.add(H, m('brass'), ring(0, 0.45, 2.45, 3.38, 0.05, 48), { p: [-3.62, 1.6, 0] });
    kit.add(H, m('anod'), ring(0.1, 0.47, 3.38, 3.5, 0.03, 48), { p: [-3.62, 1.6, 0] });
    for (const [x, y] of [[-2.7, 2.2], [2.7, 2.2], [-2.7, -2.2], [2.7, -2.2]]) kit.add(H, m('steel'), turn([[[0.16, 0], [0.14, 0.05], [0.08, 0.09], [0, 0.1]]], 24), { p: [x, y, 3.15] });
    const gear = sub('shutter', 'gear', [-3.62, -0.35, 3.18]);
    kit.add(gear, m('brass'), ribs(0.72, 0.14, -0.08, 0.08, 18, 0.14, 0.02, [0, 0.22, 0.36, 0.78]));
    kit.add(gear, m('steel'), ring(0, 0.16, 0.08, 0.16, 0.02, 24));
    G.shutter.anchor = { obj: H, p: new THREE.Vector3(1.5, 1.15, 3.24) };
  }

  /* mount */
  {
    const T = G.mount.obj, m = (k) => mat('mount', k);
    const slab = rr(9.05, 7.4, 0.6);
    slab.holes.push(circ(2.6 + 0.3, -0.575, 0));
    kit.add(T, m('satin'), solid(slab, 1.8, 0.3, 20), { p: [0.575, 0, 2.7] });
    kit.add(T, m('steel'), ring(2.62, 3.28, 3.6, 3.98, 0.05), {});
    kit.add(T, m('steel'), ring(2.44, 2.68, 3.56, 3.74, 0.03), {});
    for (const a of [0.2, 2.3, 4.4]) kit.add(T, m('steel'), turn(hard([2.2, 3.64], [2.5, 3.64], [2.5, 3.76], [2.2, 3.76], [2.2, 3.64]), 16, a, a + 0.8, true));
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; kit.add(T, m('steel'), turn([[[0.17, 0], [0.15, 0.06], [0.08, 0.1], [0, 0.11]]], 24), { p: [Math.cos(a) * 2.95, Math.sin(a) * 2.95, 3.98] }); }
    kit.add(T, m('plastic'), turn(hard([2.08, 3.0], [2.5, 3.0], [2.5, 3.55], [2.08, 3.55], [2.08, 3.0]), 24, 4.2, 5.25, true));
    for (let i = 0; i < 11; i++) { const a = 4.27 + (i * 0.91) / 10; kit.add(T, m('gold'), rbox(0.1, 0.16, 0.1, 0.02, 1), { p: [Math.cos(a) * 2.3, Math.sin(a) * 2.3, 3.58], r: [0, 0, a + Math.PI / 2] }); }
    kit.add(T, m('steel'), turn([...hard([0.42, 0], [0.42, 0.2]), [[0.42, 0.2], [0.36, 0.27], [0.2, 0.31], [0, 0.32]]], 48), { p: [4.2, -2.45, 3.6] });
    G.mount.anchor = { obj: T, p: new THREE.Vector3(0, 3.2, 3.98) };
  }

  /* inner elements + iris */
  {
    const I = G.inner.obj, m = (k, i) => mat('inner', k, i);
    kit.add(I, m('steel'), ring(2.3, 2.95, 3.99, 4.2, 0.04));
    for (const a of [1.2, 3.3, 5.4]) kit.add(I, m('steel'), turn(hard([2.95, 4.02], [3.18, 4.02], [3.18, 4.14], [2.95, 4.14], [2.95, 4.02]), 16, a, a + 0.75, true));
    for (let i = 0; i < 10; i++) { const a = 4.3 + (i * 0.8) / 9; kit.add(I, m('gold'), rbox(0.09, 0.15, 0.08, 0.02, 1), { p: [Math.cos(a) * 2.45, Math.sin(a) * 2.45, 3.97], r: [0, 0, a + Math.PI / 2] }); }
    kit.add(I, m('anod'), ring(2.05, 2.75, 4.2, 4.95, 0.05));
    const e0 = sub('inner', 'e0', [0, 0, 4.55]);
    kit.add(e0, m('anod'), ring(1.72, 2.05, -0.26, 0.24, 0.03));
    kit.add(e0, m('glass'), lens(1.75, -0.18, 0.18, 0.12, 0.28));
    const ir = sub('inner', 'ir', [0, 0, 5.5]);
    kit.add(ir, m('anod'), ring(2.22, 3.12, 0.0, 0.2, 0.03));
    kit.add(ir, m('anod'), ring(2.4, 3.12, -0.24, -0.14, 0.02));
    kit.add(ir, m('brass'), ring(3.12, 3.17, -0.2, 0.16, 0.01));
    const e1 = sub('inner', 'e1', [0, 0, 6.25]);
    kit.add(e1, m('anod'), ring(2.18, 2.55, -0.36, 0.36, 0.04));
    kit.add(e1, m('glass'), lens(2.2, -0.3, 0.3, 0.32, 0.32));
    const e2 = sub('inner', 'e2', [0, 0, 7.0]);
    kit.add(e2, m('anod'), ring(2.42, 2.8, -0.3, 0.32, 0.04));
    kit.add(e2, m('brass'), ring(2.8, 2.84, -0.06, 0.06, 0.01));
    kit.add(e2, m('glass'), lens(2.45, -0.2, 0.25, -0.35, 0.4));
    G.inner.anchor = { obj: ir, p: new THREE.Vector3(0, 2.62, 0.2) };
  }

  /* rings */
  {
    const R = G.rings.obj, m = (k) => mat('rings', k);
    kit.add(R, m('anod'), ring(2.85, 3.12, 7.3, 10.6, 0.04));
    kit.add(R, m('anod'), ring(3.0, 3.4, 7.3, 7.62, 0.05));
    kit.add(R, m('anod'), ring(3.0, 3.42, 10.25, 10.6, 0.05));
    kit.add(R, m('rubber'), ribs(3.44, 0.07, 7.66, 9.04, 80, 3.1, 0.07));
    kit.add(R, m('anod'), ring(3.0, 3.36, 9.04, 9.3, 0.04));
    kit.add(R, m('brass'), ring(3.36, 3.39, 9.12, 9.21, 0.01));
    kit.add(R, m('brass'), ring(3.4, 3.43, 7.43, 7.5, 0.01));
    kit.add(R, m('rubber'), ribs(3.47, 0.045, 9.3, 10.25, 128, 3.1, 0.05));
    G.rings.anchor = { obj: R, p: new THREE.Vector3(0, 3.5, 9.78) };
  }

  /* front */
  {
    const F = G.front.obj, m = (k) => mat('front', k);
    kit.add(F, m('anod'), turn(hard(
      [3.2, 10.8], [3.3, 10.92], [3.3, 11.45], [3.95, 12.45], [4.2, 12.95], [4.2, 14.18], [4.1, 14.3],
      [3.9, 14.3], [3.82, 14.22], [3.82, 13.55], [3.6, 13.55], [3.6, 12.9], [3.05, 11.5], [3.05, 10.8], [3.2, 10.8]), 128));
    kit.add(F, m('red'), turn(hard([4.2, 13.2], [4.27, 13.25], [4.27, 13.5], [4.2, 13.55]), 128));
    kit.add(F, m('brass'), turn([[[3.8, 14.16], [3.8, 13.92]]], 128));
    kit.add(F, m('rubber'), ring(2.9, 3.42, 12.92, 13.02, 0.02));
    kit.add(F, m('glass'), lens(3.22, 12.15, 12.6, -0.25, 0.3));
    kit.add(F, m('glass'), lens(3.72, 13.58, 14.0, 0.12, 0.72, 112, 12));
    G.front.anchor = { obj: F, p: new THREE.Vector3(0, 4.18, 14.24) };
  }
  kit.build();

  /* moving parts drawn as instances (one draw call each) */
  // the four screws: hex socket, pan head, threaded shank (+Z into the body, turned to stand along +Y)
  const thread = [];
  for (let i = 0; i <= 14; i++) thread.push([i % 2 ? 0.215 : 0.17, i * 0.096]);
  const screwG = mergeGeometries([
    turn([[[0, -0.13], [0.15, -0.13]], [[0.15, -0.13], [0.15, -0.26]]], 6),
    turn([...hard([0.14, -0.26], [0.36, -0.26], [0.42, -0.2], [0.42, 0], [0.2, 0]), thread, [[0.17, 1.344], [0, 1.45]]], 24),
  ].map((g) => g.toNonIndexed()));
  screwG.rotateX(RX);
  const screws = new THREE.InstancedMesh(screwG, mat('body', 'steel', true), 4);
  screws.userData.at = [[-6.4, -4.0, -2.4], [4.0, -4.0, -2.4], [4.0, -4.0, 0.9], [-3.0, -4.0, 1.0]];
  screws.frustumCulled = false;
  G.body.obj.add(screws);
  // iris blades: rounded paddles pivoting on the outer ring
  const blade = solid(rr(3.3 - 0.016, 1.0 - 0.016, 0.45, 1.25, 0), 0.026, 0.008, 8, 2);
  const blades = new THREE.InstancedMesh(blade, mat('inner', 'blade', true), 9);
  blades.frustumCulled = false;
  G.inner.sub.ir.add(blades);
  // shutter curtain slats
  const slats = new THREE.InstancedMesh(rbox(4.5, 0.95, 0.03, 0.012, 1), mat('shutter', 'dsteel', true), 4);
  slats.frustumCulled = false;
  G.shutter.obj.add(slats);

  // bounding points per group, for fitting the object into the slot (assembled geometry, local space)
  root.updateMatrixWorld(true);
  for (const name of PARTS) {
    const gr = G[name], box = new THREE.Box3();
    gr.obj.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().copy(gr.obj.matrixWorld).invert().multiply(o.matrixWorld));
      // moving sub-parts are fitted on their own
      if (o.parent !== gr.obj) return;
      box.union(b);
    });
    gr.fit.push({ obj: gr.obj, box });
    for (const o of Object.values(gr.sub)) {
      const sb = new THREE.Box3();
      o.traverse((c) => { if (c.isMesh && !c.isInstancedMesh) { c.geometry.computeBoundingBox(); sb.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrix)); } });
      if (!sb.isEmpty()) gr.fit.push({ obj: o, box: sb });
    }
  }
  return { root, G, screws, blades, slats };
}

/* ── environment: a dark room with softboxes, prefiltered once ───────── */
function studio(renderer) {
  const s = new THREE.Scene();
  const disp = [];
  const add = (geo, color, pos) => {
    const mtl = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const me = new THREE.Mesh(geo, mtl); me.position.set(...pos); me.lookAt(0, 0, 0); s.add(me); disp.push(geo, mtl);
  };
  const box = new THREE.BoxGeometry(34, 20, 34), bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.006, 0.005, 0.004), side: THREE.BackSide });
  s.add(new THREE.Mesh(box, bm)); disp.push(box, bm);
  const c = (r, g, b, k) => new THREE.Color(r * k, g * k, b * k);
  add(new THREE.PlaneGeometry(10, 5.5), c(1, 0.84, 0.66, 5.2), [-9, 7, 7]);        // warm key softbox, upper left front
  add(new THREE.PlaneGeometry(1.6, 12), c(0.7, 0.82, 1, 6.5), [11, 1.5, -7]);      // cool strip, back right (rims)
  add(new THREE.PlaneGeometry(1.3, 9), c(1, 0.88, 0.74, 3.2), [-12, 0.5, -5]);     // warm strip, back left
  add(new THREE.PlaneGeometry(16, 7), c(1, 0.95, 0.9, 1.1), [0, 9.8, 1]);          // soft top
  add(new THREE.PlaneGeometry(2.4, 2.4), c(1, 0.78, 0.48, 8), [6, -2.5, 12]);      // low warm kicker, front right (glints)
  add(new THREE.PlaneGeometry(26, 26), c(0.34, 0.21, 0.1, 0.45), [0, -9.8, 0]);    // umber floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.025);
  pm.dispose();
  for (const d of disp) d.dispose();
  return rt.texture;
}

/* ── passes: the floor (warm pool + soft contact shadows) and the composite onto the black stage ── */
function floorPass() {
  const B = Array.from({ length: 7 }, () => new THREE.Vector4());
  const mtl = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { B: { value: B }, pool: { value: new THREE.Vector3(0, 0, 10) }, tint: { value: new THREE.Color(0.2, 0.135, 0.072) }, lights: { value: 1 } },
    vertexShader: /* glsl */`varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec4 B[7]; uniform vec3 pool; uniform vec3 tint; uniform float lights;
      varying vec3 vW;
      void main() {
        vec2 q = (vW.xz - pool.xy) / pool.z;
        float glow = exp(-dot(q, q) * 1.15);
        float sh = 0.0;
        for (int k = 0; k < 7; k++) { vec2 d = (vW.xz - B[k].xy) / B[k].z; sh += B[k].w * exp(-dot(d, d)); }
        float a = glow * lights * (1.0 - clamp(sh, 0.0, 0.92));
        gl_FragColor = vec4(tint, a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mtl);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, u: mtl.uniforms, B };
}
function compositePass() {
  const mtl = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tScene: { value: null }, res: { value: new THREE.Vector2(1, 1) }, glow: { value: 0.6 }, foot: { value: 0.5 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D tScene; uniform vec2 res; uniform float glow; uniform float foot;
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        vec4 s = texture2D(tScene, vUv);
        vec3 ink = vec3(0.02, 0.016, 0.012);
        // the umber glow at the foot of the stage: a low band, warmest under the object
        float band = 1.0 - smoothstep(0.0, 0.3, vUv.y);
        vec2 q = vec2((vUv.x - foot) * res.x / res.y, vUv.y + 0.12);
        float pool = exp(-dot(q, q) * 2.6);
        vec3 bg = ink + vec3(0.17, 0.11, 0.055) * glow * (band * band * 0.5 + pool * 0.42);
        vec3 c = bg * (1.0 - s.a) + s.rgb;
        c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mtl);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), u: mtl.uniforms };
}

export default function register(stage) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 600);
  const comp = compositePass();
  const floor = floorPass();
  scene.add(floor.mesh);
  const key = new THREE.DirectionalLight(0xffe0bc, 2.4);
  key.position.set(-7, 10, 8);
  const rim = new THREE.DirectionalLight(0xc2d6ff, 3.2);
  rim.position.set(9, 4, -10);
  scene.add(key, rim, key.target, rim.target);
  let M = null, rt = null, size = [1, 1];
  const cc = new THREE.Color();
  // per-frame scratch (no allocations in update)
  const V = new THREE.Vector3(), T = new THREE.Vector3(), Rt = new THREE.Vector3(), Up = new THREE.Vector3(), Fw = new THREE.Vector3();
  const corner = new THREE.Vector3(), Dir = new THREE.Vector3(), mtx = new THREE.Matrix4(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const pts = [], box = new THREE.Box3();
  for (let i = 0; i < 160; i++) pts.push(new THREE.Vector3());

  function project(cx, cy, vw, vh, fpx) {
    // off-axis frustum: the camera's principal ray lands on the slot centre (cx, cy), focal length fpx CSS px
    const k = camera.near / fpx;
    camera.projectionMatrix.makePerspective(-cx * k, (vw - cx) * k, cy * k, -(vh - cy) * k, camera.near, camera.far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  stage.add({
    id: 'instrument', scene, camera,
    post: { grain: 0.04, vignette: 0.26 },
    async load(ctx) {
      const R = ctx.renderer;
      const tx = makeTextures();
      const aniso = Math.min(8, R.capabilities.getMaxAnisotropy());
      for (const t of Object.values(tx)) t.anisotropy = aniso;
      scene.environment = studio(R);
      M = buildModel(baseMaterials(tx));
      scene.add(M.root);
      rt = new THREE.WebGLRenderTarget(size[0], size[1], { samples: 4, type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false });
      // a first pose, then compile every program and draw once off screen, so the first visible frame never hitches
      camera.position.set(-30, 12, 30); camera.lookAt(0, 0, 5); camera.updateMatrixWorld();
      project(size[0] / 2, size[1] / 2, size[0], size[1], size[1]);
      // compile every program up front (in parallel where the GPU can; SwiftShader cannot, so no warning there)
      if (R.extensions.has('KHR_parallel_shader_compile')) await R.compileAsync(scene, camera);
      else R.compile(scene, camera);
      draw(R);
      R.setRenderTarget(null);
      state.drawn = true;
      state.onGL?.();
      window.__td = { state, stats: () => ({ ...stats }) };
    },
    resize(w, h, dpr) {
      size = [w, h];
      rt?.setSize(w, h);
      comp.u.res.value.set(w, h);
    },
    update(ctx) { if (M && state.L) pose(ctx); },
    render(renderer, target) {
      draw(renderer);
      comp.u.tScene.value = rt.texture;
      renderer.setRenderTarget(target);
      renderer.render(comp.scene, comp.camera);
    },
  });

  const stats = { triangles: 0, calls: 0 };
  function draw(R) {
    R.getClearColor(cc);
    const ca = R.getClearAlpha();
    R.setRenderTarget(rt);
    R.setClearColor(0x000000, 0);
    R.clear(true, true, false);
    R.render(scene, camera);
    stats.triangles = R.info.render.triangles; stats.calls = R.info.render.calls;
    R.setClearColor(cc, ca);
  }

  /* everything below is a function of the run state (scroll) and the layout; the idle float is added last */
  function pose(ctx) {
    const L = state.L, s = runAt(ctx.scrollY), G = M.G;
    const rig = L.stacked ? RIG.tall : RIG.wide;
    const X = smooth(s.x), a = smooth(s.arrive);

    // groups along the axis, with their own moving parts
    for (const name of PARTS) {
      const gr = G[name], c = GROUPS[name];
      gr.e = easeIO(seg(s.x, c.s, c.s + DUR));
      gr.obj.position.set(0, 0, c.dz * gr.e);
      gr.obj.rotation.set(0, 0, 0);
    }
    const eb = G.body.e, sb = G.body.sub;
    sb.battery.position.copy(sb.battery.userData.base).setY(sb.battery.userData.base.y - 7.2 * easeIO(seg(eb, 0.25, 1)));
    sb.mic.position.copy(sb.mic.userData.base).setY(sb.mic.userData.base.y + 1.7 * easeIO(seg(eb, 0.12, 0.85)));
    sb.screen.rotation.x = 0.55 * easeIO(seg(eb, 0.3, 1));
    for (let k = 0; k < 4; k++) {
      const at = M.screws.userData.at[k], t = easeIO(seg(eb, 0.1 + 0.08 * k, 0.78 + 0.05 * k)), drop = (2.5 + 0.55 * k) * t;
      e.set(0, -drop * 2.4, 0); q.setFromEuler(e);
      mtx.compose(V.set(at[0], at[1] - drop, at[2]), q, one);
      M.screws.setMatrixAt(k, mtx);
    }
    M.screws.instanceMatrix.needsUpdate = true;
    // the shutter curtain closes as it separates; the gear turns with it
    const es = G.shutter.e;
    let cl = 0;
    for (let k = 0; k < 4; k++) {
      const t = easeIO(seg(es, 0.15 + 0.1 * k, 0.65 + 0.08 * k));
      cl += t / 4;
      mtx.compose(V.set(0, lerp(2.05 - 0.05 * k, 1.12 - 0.76 * k, t), 3.19 + 0.012 * k), q.identity(), one);
      M.slats.setMatrixAt(k, mtx);
    }
    M.slats.instanceMatrix.needsUpdate = true;
    G.shutter.sub.gear.rotation.z = -cl * 4.2;
    // the inner group spreads, and the iris stops down
    const ei = G.inner.e, si = G.inner.sub;
    si.e0.position.z = si.e0.userData.base.z - 0.7 * ei;
    si.e1.position.z = si.e1.userData.base.z + 0.9 * ei;
    si.e2.position.z = si.e2.userData.base.z + 1.8 * ei;
    const rho = lerp(2.05, 0.58, easeIO(seg(ei, 0.12, 1))), W = 1.0, Rp = 2.52;
    const psi = Math.acos(clamp((rho + W / 2) / Rp, -1, 1));
    for (let k = 0; k < 9; k++) {
      // blade k: round the axis to its pivot on the outer ring, then swung in about the pivot by psi
      mtx.makeRotationZ((k / 9) * TAU).multiply(mA.makeTranslation(Rp, 0, -0.1 + 0.009 * k)).multiply(mB.makeRotationZ(Math.PI / 2 + psi));
      M.blades.setMatrixAt(k, mtx);
    }
    M.blades.instanceMatrix.needsUpdate = true;

    // the pose: a classic 3/4 that tips into the exploded diagonal
    M.root.rotation.set(lerp(rig.tilt[0], rig.tilt[1], X), 0, 0);
    M.root.updateMatrixWorld(true);

    // camera direction (world): yaw from the front toward the grip side, pitch from above
    const read = smooth(seg(s.p, WIN.read[0], 1));
    const th = lerp(rig.yaw[0], rig.yaw[1], X) + rig.orbit * read + 0.42 * (1 - a) * (1 - a) - 0.06 * s.leave;
    const ph = lerp(rig.pitch[0], rig.pitch[1], X);
    const dir = Dir.set(-Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph));
    Fw.copy(dir).negate();
    Rt.crossVectors(Fw, Up.set(0, 1, 0)).normalize();
    Up.crossVectors(Rt, Fw).normalize();

    // bounding points of every group (and its moving parts), at the un-floated pose
    let n = 0;
    box.makeEmpty();
    for (const name of PARTS) {
      for (const f of G[name].fit) {
        const b = f.box, mw = f.obj.matrixWorld;
        for (let i = 0; i < 8; i++) {
          corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(mw);
          if (n < pts.length) pts[n++].copy(corner);
          box.expandByPoint(corner);
        }
      }
    }
    box.getCenter(T);

    // fit: distance and lateral offset so the projected points fill the slot (a pure function of scroll + layout)
    const sl = L.slot, fpx = rig.fl * Math.max(sl.h, sl.w * 0.8);
    const fill = lerp(rig.fill[0], rig.fill[1], X) * (0.9 + 0.1 * a);
    let d = 60, ox = 0, oy = 0;
    for (let it = 0; it < 5; it++) {
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (let i = 0; i < n; i++) {
        const P = pts[i], rx = P.x - T.x, ry = P.y - T.y, rz = P.z - T.z;
        const z = d + rx * Fw.x + ry * Fw.y + rz * Fw.z;
        const u = (rx * Rt.x + ry * Rt.y + rz * Rt.z - ox) / z, v = (rx * Up.x + ry * Up.y + rz * Up.z - oy) / z;
        if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
      }
      ox += ((u0 + u1) / 2) * d; oy += ((v0 + v1) / 2) * d;
      d *= Math.max((u1 - u0) / ((fill * sl.w) / fpx), (v1 - v0) / ((fill * sl.h) / fpx));
    }
    d *= 1 + 0.12 * (1 - a);                         // arriving: a touch further away, out of the dark

    // pointer: the view leans a little (after the fit, so the object never breathes in and out)
    const pth = th + ctx.pointer.x * 0.05, pph = ph - ctx.pointer.y * 0.035;
    dir.set(-Math.sin(pth) * Math.cos(pph), Math.sin(pph), Math.cos(pth) * Math.cos(pph));
    const look = corner.copy(T).addScaledVector(Rt, ox).addScaledVector(Up, oy);
    camera.position.copy(look).addScaledVector(dir, d);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    const top = -L.stick + s.pinTop;
    project(sl.x + sl.w / 2, top + sl.y + sl.h / 2, ctx.vw, ctx.vh, fpx);

    // the floor: under the lowest point, a warm pool with one soft shadow per group
    const fy = box.min.y - 1.6;
    floor.mesh.position.set(T.x, fy, T.z);
    floor.mesh.updateMatrixWorld();
    floor.u.pool.value.set(T.x, T.z, Math.max(9, (box.max.z - box.min.z) * 0.55));
    floor.u.lights.value = 0.9 * a;
    PARTS.forEach((name, k) => {
      const f = G[name].fit[0], c = f.box.getCenter(V).applyMatrix4(f.obj.matrixWorld), h = Math.max(0, c.y - fy);
      const r = name === 'body' ? 6.2 : 3.6;
      floor.B[k].set(c.x, c.z, r + h * 0.35, 0.62 * Math.exp(-h * 0.07));
    });

    // the idle float (exploded only) and the reading highlight
    const t = ctx.time;
    PARTS.forEach((name, k) => {
      const gr = G[name], f = state.focus[k];
      gr.obj.position.y += Math.sin(t * 0.55 + k * 1.7) * 0.07 * X;
      gr.obj.rotation.z = Math.sin(t * 0.4 + k) * 0.006 * X;
      gr.lift.value = 1 - 0.16 * s.reading * (1 - f) + 0.22 * f;
    });
    M.root.updateMatrixWorld(true);

    // lights come up as it arrives
    key.intensity = 2.4 * (0.12 + 0.88 * a);
    rim.intensity = 3.2 * (0.3 + 0.7 * a);
    scene.environmentIntensity = 0.12 + 0.88 * a;
    comp.u.glow.value = (0.55 + 0.45 * s.leave) * (0.4 + 0.6 * a);
    comp.u.foot.value = (sl.x + sl.w / 2) / ctx.vw;

    // the active part's anchor, for the leader
    const an = state.anchor;
    if (s.active >= 0) {
      const gr = G[PARTS[state.rows[s.active]]];
      V.copy(gr.anchor.p).applyMatrix4(gr.anchor.obj.matrixWorld).project(camera);
      an.x = ((V.x + 1) / 2) * ctx.vw; an.y = ((1 - V.y) / 2) * ctx.vh; an.ok = V.z < 1;
    } else an.ok = false;
    state.onDraw?.();
  }
}
