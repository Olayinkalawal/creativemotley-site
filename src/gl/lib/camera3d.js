/* The real-time camera for the Method chapter (three r186): one GLB, lazy, drawn into the stage's target.

   const cam = create(ctx, { base: '/assets/models/camera/' })   ctx: the stage's ctx (renderer, tier, reduced, still)
   await cam.load()                       dynamic-imports the GLB reader (./glb.js) + the meshopt decoder, fetches camera.glb
                                          (camera_mobile.glb on the phone/still path), builds the studio, compiles every
                                          program (scene, shadow depth, bloom, post quads) and uploads every texture, so
                                          the first visible frame compiles nothing
   cam.setProgress(p)                     one scalar timeline, p in [0, 1]:
                                            orbit    [0.00, 0.40]  the view travels round the camera (az -150 -> -38), full screen
                                            hand-off [0.40, 0.52]  it glides into the column rect, turning to the column key
                                            explode  [0.52, 0.90]  it comes apart (outside in), parts in camB2's order
                                            hold     [0.90, 1.00]  settled; a slow push
   cam.setPhases({ orbit, hand, explode, settle })   the same, from the site's clock (tdcore tdShotPhases: each 0 … 1).
                                          tdcore already re-times the orbit (0.72·o + 0.28·easeSine(o)); setPhases inverts
                                          that before applying this module's own pace curve, so the orbit is eased once
   cam.setLayout({ x, y, w, h }, vw, vh)  the slot rect (CSS px, viewport) the device is framed in
   cam.setView({ az?, el?, fov?, target, dist, shift?, near? }) overrides the fitted framing: the view looks at target (world)
                                          from dist; az / el / fov left out come from the keys (with the pointer and setOffset);
                                          shift [x, y] (NDC) moves the target off the screen's centre; null returns to the fit
   cam.setPointer(x, y)                   -1 … 1 (pointer parallax: a few degrees of drift, eased)
   cam.resize(w, h, dpr)                  drawing-buffer px
   cam.pose()                             applies the current phases/layout/pointer to the scene now (no jitter); anchors()
                                          calls it itself when anything changed since the last pose
   cam.render(renderer, target)           draws into target (null = the canvas). Re-renders only when something changed;
                                          otherwise it adds one jittered sample (idle supersampling) or copies the last frame
   cam.busy()                             true while idle samples remain (the stage's ambient(): keeps drawing, then stops)
   cam.anchors(dy = 0)                    [{ id, label, part, x, y, depth, visible, lead }] in CSS px (viewport, minus dy),
                                          posed for the current state. visible = revealed × facing × not occluded: an id
                                          pass (one small extra render, read back once whenever the view settles) checks
                                          that the anchor's pixel shows its own part, nudges it onto the nearest pixel of its
                                          part when something covers it, and keeps markers >= 28 px apart
   cam.occlusion()                        runs that id pass now (tests; the viewer after a drag)
   cam.setOffset(az, el)                  degrees added to the view (drag to turn: gl/lib/drag3d.js; el clamped to -25 … 40)
   cam.setZoom(k, x, y)                   the fitted picture scaled by k about a point (css x' = k·x + x): a product-viewer zoom
   cam.screenBox()                        the camera's screen box now ({ x0, y0, x1, y1 }, css px): drag3d's hit region
   cam.dispose()                          frees every GPU resource it made (targets, PMREM, shadow map, tiles, programs' refs)
   cam.renderTexture(renderer, n = 0, { id }) (opts.alpha only) re-renders on change, else adds one jittered sample (n: that
                                          many now); returns the running mean as a texture: premultiplied rgba, a = coverage
                                          (the scene clears to transparent; the tone map runs on un-premultiplied colour), for
                                          a scene that composites the camera over its own picture (gl/scenes/hero3d.js: the
                                          hero painting). render() is unchanged (opaque, on black: Method).

   Daylight (create() options, all off by default): envSky / envGround (hex): the main studio's dome is a sky over a
   ground instead of black, so the body's dark paint mirrors a bright day (the hero, over its painting), not a black studio.

   Tiers: opts.tier 2 = desktop (PCF shadows 2048, MSAA 4 at dpr < 1.5 else 2, subtle bloom, 12 idle samples); 1 = light
   (shadows 1024, no bloom, 6 samples); opts.mobile = the phone/still path (camera_mobile.glb, no shadows, MSAA 2,
   internal scale min(0.8, 1.6/dpr), 4 samples).
   Look: procedural studio (PMREM: big upper-left key softbox, overhead strip, rim strip, a warm kicker low on camera-right,
   one broad low frontal fill), ACES, turntable lighting (the rig turns with the view so every key keeps the hero's light).
   The front element sees its own studio (black, one soft window up-left, a dim fill): a dark green bore with nested ring
   lips, the window on its upper-left third. The free elements (v7) hang square to the lens axis and see a studio fixed
   in their own frame: two thin ring lights that every face mirrors as arcs concentric with its rim; exact sphere
   normals; no veil. */
import * as THREE from 'three';

const D = Math.PI / 180;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const pace = (u) => (0.5 * u + 0.5 * (1 - Math.cos(Math.PI * u)) / Math.PI) / (0.5 + 1 / Math.PI);   // speed within 2x end to end
const seg = (x, a, b) => clamp01((x - a) / (b - a));
/* tdcore's orbit re-timing, inverted: o such that 0.72·o + 0.28·easeSine(o) = y (Newton, 3 steps) */
function untime(y) {
  if (y <= 0 || y >= 1) return clamp01(y);
  let o = y;
  for (let i = 0; i < 3; i++) { const f = 0.72 * o + 0.28 * easeSine(o) - y, df = 0.72 + 0.14 * Math.PI * Math.sin(Math.PI * o); o = clamp01(o - f / df); }
  return o;
}

export const P_RANGES = { orbit: [0, 0.40], hand: [0.40, 0.52], explode: [0.52, 0.90], hold: [0.90, 1] };
/** p (0 … 1) -> the phases (each 0 … 1) */
export function phasesAt(p) {
  return { orbit: seg(p, ...P_RANGES.orbit), hand: easeIO(seg(p, ...P_RANGES.hand)), explode: 0.5 - 0.5 * Math.cos(Math.PI * seg(p, ...P_RANGES.explode)), settle: smooth(seg(p, ...P_RANGES.hold)) };
}

// view keys: az (0 = facing the lens, -90 = grip side), el, fov, fill (subject size as a fraction of the slot rect)
export const KEYS = {
  wide: {
    start: { az: -150, el: 18, fov: 16, fill: 0.75 },
    hero: { az: -38, el: 10, fov: 14, fill: 0.70 },
    column: { az: -46, el: 13, fov: 15, fill: 0.76 },
    exploded: { az: -62, el: 34, fov: 16, fill: 0.92 },     // v7: az -48 -> -62 (camB2's side three-quarter: the mount-to-lens gap opens, the glass hangs on the axis), el 34
  },
  tall: {
    start: { az: -150, el: 18, fov: 18, fill: 0.84 },
    hero: { az: -26, el: 12, fov: 16, fill: 0.86 },
    column: { az: -30, el: 18, fov: 16, fill: 0.84 },
    exploded: { az: -50, el: 32, fov: 18, fill: 0.88 },     // v7: az -30 -> -50: the mount-to-lens gap opens on phones too
  },
};
// phones (portrait, a near-square slot, key az -50): the same straight explode, scaled per part (v7): the lens runs 15%
// further (at az -50 the barrel would cover the glass in the gap), the glass keeps its travel, the rear cards run 20%
// further back (they clear the body's top-left corner), the covers and the battery travel 20-25% less; no screws
const PORTRAIT_SCALE = { lens: 1.15, lens_el_0: 1.15, lens_el_1: 1.15, lens_el_2: 1.15, lens_el_5: 1.15, aperture: 1, lens_el_4: 1, lens_el_3: 1,
  top_cover: 0.75, evf_module: 0.75, battery: 0.8, lcd: 1.2, main_pcb: 1.2, ibis_frame: 1.2, sensor: 1.2, shutter: 1.2 };
// which part's progress reveals an anchor (a part that does not move is revealed by the one that uncovers it)
const REVEAL = { lens_mount: 'lens', body_grip: null, front_element: null, evf: null };
const LEAD = { ne: -38, nw: -142, se: 38, sw: 142, n: -90, s: 90, e: 0, w: 180 };
const SPREAD = 28;                // px: markers at least this far apart

const OUT_FRAG = /* glsl */`
uniform sampler2D tHDR; uniform float exposure; uniform float lift;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c){
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= exposure / 0.6; c = I * c; c = RRTAndODTFit(c); c = O * c; return clamp(c, 0.0, 1.0);
}
vec3 oetf(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){ gl_FragColor = vec4(pow(oetf(aces(texture2D(tHDR, vUv).rgb)), vec3(lift)), 1.0); }`;   // lift < 1: a gentle mid-tone grade (blacks and whites stay put)
/* opts.alpha: the HDR target holds premultiplied colour and coverage (cleared to transparent): un-premultiply, tone map,
   premultiply again (a tone curve on premultiplied colour would darken the silhouette's anti-aliased edge) */
const OUT_FRAG_A = OUT_FRAG.replace(/void main\(\)\{[^\n]*$/, `void main(){ vec4 t = texture2D(tHDR, vUv); float a = clamp(t.a, 0.0, 1.0);
  vec3 c = t.rgb / max(a, 1e-4); gl_FragColor = vec4(pow(oetf(aces(c)), vec3(lift)) * a, a); }`);
const BLEND_FRAG_A = 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }';   // running mean of premultiplied rgba (constant-alpha blend)
const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLEND_FRAG = 'uniform sampler2D t; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, w); }';
const COPY_FRAG = /* glsl */`
uniform sampler2D t; uniform float fade; varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main(){ vec3 c = texture2D(t, vUv).rgb * fade; c += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * fade; gl_FragColor = vec4(c, 1.0); }`;
const ID_VERT = '#include <common>\nvoid main(){\n#include <begin_vertex>\n#include <project_vertex>\n}';
const ID_FRAG = 'uniform float pid; void main(){ gl_FragColor = vec4(pid / 255.0, 0.0, 0.0, 1.0); }';

export function create(ctx = {}, opts = {}) {
  const base = opts.base ?? '/assets/models/camera/';
  const mobile = opts.mobile ?? !!ctx.still;
  const tier = opts.tier ?? ctx.tier ?? 2;
  const reduced = opts.reduced ?? ctx.reduced ?? false;
  const Q = {
    shadows: mobile ? 0 : tier >= 2 ? 2048 : 1024,
    msaa: opts.msaa ?? (mobile ? 2 : 4),           // 2 as well when dpr >= 1.5 (setSize): the idle accumulation finishes the AA
    bloom: !mobile && tier >= 2 && opts.bloom !== false,
    acc: opts.acc ?? (mobile ? 4 : tier >= 2 ? 12 : 6),
    scale: opts.scale ?? 1,                          // phones: min(0.8, 1.6 / dpr), set in setSize
    paintGrain: opts.paintGrain ?? (!mobile && tier >= 2),
  };
  const file = opts.file ?? (mobile ? 'camera_mobile.glb' : 'camera.glb');
  const alpha = !!opts.alpha;          // renderTexture(): alpha = coverage (the scene clears to transparent black)
  const scene = new THREE.Scene();
  scene.background = alpha ? null : new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(16, 16 / 9, 0.1, 80);
  let renderer = ctx.renderer || null;
  let W = 16, H = 16, vw = innerWidth, vh = innerHeight, dpr = 1;
  let model = null, loaded = false, disposed = false;
  const parts = [], screws = [], anchorDefs = [], samples = [], glassMats = [], meshes = [];
  let ph = { orbit: 0, hand: 0, explode: 0, settle: 0 };
  let rect = null;                    // slot rect, CSS px
  const ptr = new THREE.Vector2(), ptrS = new THREE.Vector2();
  let dirty = true, accN = 0, lastSig = '', posedSig = '';
  let rtHDR = null, rtLDR = null, accRT = null, idRT = null, Bloom = null, bloom = null, envs = null, lastInfo = null, tiles = null;
  let scaleNow = Q.scale, msaaNow = Q.msaa;
  const off = { az: 0, el: 0 };
  const zm = { k: 1, x: 0, y: 0 };    // setZoom: the framed rect scaled by k, then moved by (x, y) css px (drag3d's zoom)
  const lights = {};
  let exOverride = null;              // art direction: { part: { ex: [mm…], rot: [deg…] } } (lab tuning only)

  // ---------------------------------------------------------------- post (fullscreen quads)
  const quad = (frag, uniforms, extra = {}) => {
    const m = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); mesh.frustumCulled = false;
    const sc = new THREE.Scene(); sc.add(mesh);
    return { m, sc };
  };
  const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const outQ = quad(alpha ? OUT_FRAG_A : OUT_FRAG, { tHDR: { value: null }, exposure: { value: opts.exposure ?? 1.0 }, lift: { value: opts.lift ?? 0.9 } });
  const blendQ = alpha
    ? quad(BLEND_FRAG_A, { t: { value: null }, w: { value: 1 } }, { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.ConstantAlphaFactor, blendDst: THREE.OneMinusConstantAlphaFactor,
      blendSrcAlpha: THREE.ConstantAlphaFactor, blendDstAlpha: THREE.OneMinusConstantAlphaFactor })
    : quad(BLEND_FRAG, { t: { value: null }, w: { value: 1 } }, { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const copyQ = quad(COPY_FRAG, { t: { value: null }, fade: { value: 1 } });
  const idMat = new THREE.ShaderMaterial({ vertexShader: ID_VERT, fragmentShader: ID_FRAG, uniforms: { pid: { value: 0 } }, side: THREE.DoubleSide });

  // ---------------------------------------------------------------- studio
  /* kind: 'main' (the opaque parts), 'glass' (black + two softbox cards + one strip), 'shiny' (sensor, LCD glass) */
  function studioEnv(kind) {
    const env = new THREE.Scene();
    if (kind === 'main' && opts.envSky != null) {
      // daylight: the dome is a sky (envSky) over a ground (envGround), blended across the horizon, not a black studio
      const g = new THREE.SphereGeometry(30, 32, 16), pos = g.attributes.position, col = new Float32Array(pos.count * 3);
      const sky = new THREE.Color(opts.envSky), ground = new THREE.Color(opts.envGround ?? 0x000000), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) { c.copy(ground).lerp(sky, smooth(clamp01(pos.getY(i) / 30 * 2.5 + 0.5))); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    } else env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })));
    // soft: a window that falls off smoothly to its edges (v6: the dome's one big reflection reads as a soft shape, not
    // a hard-edged card)
    let softTex = null;
    const soft = () => {
      if (softTex) return softTex;
      const n = 64, d = new Uint8Array(n * n * 4);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n - 0.5, v = (j + 0.5) / n - 0.5, r = Math.hypot(u, v) * 2;
        const t = Math.min(1, Math.max(0, (r - 0.5) / 0.5)), f = 1 - t * t * (3 - 2 * t);   // v7: a flat-topped window, a soft but defined edge
        d.set([255 * f, 255 * f, 255 * f, 255], (j * n + i) * 4);
      }
      softTex = new THREE.DataTexture(d, n, n); softTex.needsUpdate = true; softTex.magFilter = softTex.minFilter = THREE.LinearFilter;
      return softTex;
    };
    const panel = (w, l, pos, look, along, intensity, tint = 0xffffff, isSoft = false) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide, map: isSoft ? soft() : null }));
      const p = new THREE.Vector3(...pos), n = new THREE.Vector3(...look).sub(p).normalize();
      const a = new THREE.Vector3(...along); a.addScaledVector(n, -a.dot(n)).normalize();
      const s = new THREE.Vector3().crossVectors(a, n);
      m.matrixAutoUpdate = false; m.matrix.makeBasis(s, a, n).setPosition(p); env.add(m);
    };
    if (kind === 'metal') {          // the mount's bayonet and the iris at the exploded key: one broad soft card low and
      // front-right (where a face turned to the lens axis mirrors the exploded view), the overhead strip, a small key
      panel(9.0, 6.0, [5.0, -2.8, 4.4], [0, 0, 0], [0, 1, 0], 0.55, 0xf4f6fa);
      panel(0.45, 10.0, [-0.6, 7.0, 1.2], [0, 0, 0.3], [0, 0, 1], 1.4, 0xffffff);
      panel(3.0, 2.0, [-4.6, 5.0, 3.6], [0, 0, 0], [1, 0, 0], 0.8, 0xfbfcff);
    } else if (kind === 'free') {
      // v7: the free elements hang square to the lens axis, and their studio is fixed in their own frame (the model's;
      // it does not turn with the view), so a drag in the viewer only slides the arcs. Black, and two narrow hard
      // light ribbons, each the exact mirror image (at the exploded key) of the circle of face normals tilted a fixed
      // angle from the axis: every face draws them as thin arcs concentric with its rim (camB2's nested rings), the
      // front faces on one side, the back faces (concave from inside) on the other. The outer ribbon (tilt ~19 deg, a
      // violet-white: the coating's rim colour) lands on the outer part of the radius; the inner one (~10 deg) a green-white.
      // Partial arcs, centred on the faces' upper left. A very dim broad card gives the faces a faint grey body (camB2).
      // No veil, no refraction bands, no rim glow.
      const K = KEYS.wide.exploded, az = (K.az + 2) * D, el = K.el * D;
      const v = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      const rv = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)), uv = new THREE.Vector3().crossVectors(v, rv);
      const lx = -1 / rv.x, ly = (1 - uv.x * lx) / uv.y, phiC = Math.atan2(ly, lx);   // the face's upper left (screen)
      const R0 = new THREE.Vector3(-v.x, -v.y, v.z);
      const ribbon = (tilt, w, span, rot, intensity, tint) => {
        const t = tilt * D, N = 96, pos = [], idx = [], n = new THREE.Vector3(), R = new THREE.Vector3(), R2 = new THREE.Vector3(), sd = new THREE.Vector3();
        const at = (ph, out) => { n.set(Math.sin(t) * Math.cos(ph), Math.sin(t) * Math.sin(ph), Math.cos(t)); return out.copy(n).multiplyScalar(2 * n.dot(v)).sub(v).normalize(); };
        for (let i = 0; i <= N; i++) {
          const ph = phiC + (rot + (i / N - 0.5) * span) * D;
          at(ph, R); at(ph + 0.01, R2); sd.crossVectors(R2.sub(R), R).normalize();
          for (const k of [-1, 1]) { const q = R.clone().addScaledVector(sd, k * w / 9).normalize().multiplyScalar(9); pos.push(q.x, q.y, q.z); }
          if (i < N) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide })));
      };
      ribbon(opts.freeTilt ?? 19, opts.freeW ?? 0.06, opts.freeSpan ?? 170, 0, opts.freeStrip ?? 5.5, opts.freeTint ?? 0xeadfff);        // violet-white: the coated rim arc
      ribbon(opts.freeTilt2 ?? 10, (opts.freeW ?? 0.06) * 0.8, opts.freeSpan2 ?? 130, opts.freeRot2 ?? 180, (opts.freeStrip ?? 5.5) * 0.6, opts.freeTint2 ?? 0xcdffd8);   // green-white: the inner arc
      // a broad, very dim soft card: the faces carry a faint grey body (camB2), not a veil
      if ((opts.freeBody ?? 0.4) > 0) panel(opts.freeBodyW ?? 14, opts.freeBodyW ?? 14, R0.clone().multiplyScalar(9.5).toArray(), [0, 0, 0], uv.toArray(), opts.freeBody ?? 0.4, 0xe8eeeb, true);
    } else if (kind === 'glass') {
      // v6: one large soft window, placed so that on the dome it sits up-left of centre at the hero (the dome's centre
      // mirrors (0.61, -0.17, 0.78); the window is that turned 0.2 rad towards the view's up and left): it lies across
      // the front element as one shape that fades out towards the lower right, as in camA2. No strip arc, no corner key.
      // v7: under half the area (9.5 x 8.5, v6 16 x 14) and further up-left (the dome's centre mirror direction moved 0.32
      // towards the view's up and left): it lies on the upper-left third of the front element, the centre and lower right
      // stay dark (measured at the hero: centre 47, lower right 46, glass median 48 vs camA2's 80)
      const Kh = KEYS.wide.hero, ha = Kh.az * D, he = Kh.el * D;
      const hv = new THREE.Vector3(Math.sin(ha) * Math.cos(he), Math.sin(he), Math.cos(ha) * Math.cos(he));
      const hr = new THREE.Vector3(Math.cos(ha), 0, -Math.sin(ha)), hu = new THREE.Vector3().crossVectors(hv, hr);
      const M = new THREE.Vector3(-hv.x, -hv.y, hv.z).addScaledVector(hu.sub(hr), opts.winOff ?? 0.32).normalize().multiplyScalar(9);
      panel(opts.winW ?? 9.5, opts.winH ?? 8.5, opts.winPos ?? M.toArray(), [0, 0, 0], [0, 1, 0], opts.win ?? 1.3, opts.winTint ?? 0xd6e4dc, true);
      // and a broad, dim soft card round the dome's centre mirror direction: the centre and lower right of the element
      // settle at a dark grey-green (camA2), not black
      if ((opts.glassFill ?? 0.14) > 0) panel(26, 22, new THREE.Vector3(-hv.x, -hv.y, hv.z).multiplyScalar(11).toArray(), [0, 0, 0], [0, 1, 0], opts.glassFill ?? 0.14, 0xc8dcd2, true);
      panel(0.45, 10.0, [-0.6, 7.0, 1.2], [0, 0, 0.3], [0, 0, 1], 0.5, 0xffffff);  // the overhead strip, faint
    } else {
      panel(7.0, 4.6, opts.softboxPos ?? [-3.6, 7.0, 3.4], [0, 0, 0], [1, 0, 0], (opts.softbox ?? 1.6) * (kind === 'shiny' ? 0.6 : 1), 0xfdfcfa);   // large high key softbox, front-left
      panel(0.5, 13, [-0.5, 6.5, 0.4], [0, 0, 0.2], [0, 0, 1], 4.5, 0xffffff);       // overhead strip along the lens axis
      panel(0.55, 12, [0.6, 4.4, -6.2], [0, 0.3, 0], [1, 0, 0], 3.2, 0xe9f0ff);      // strip behind, across X (rims)
      panel(5.0, 1.2, [4.4, -2.6, -0.2], [0, 0.3, 0], [0.3, 0, 1], 0.35, 0xffd6b0);   // warm kicker: low, camera-right, a little behind
      panel(0.25, 9.0, [-6.5, 2.4, -1.5], [0, 0.3, 0], [0, 1, 0.1], opts.sideStrip ?? 0.9, 0xf4f6ff);  // thin side strip: grip-side edge lines
      panel(9.0, 5.5, [-4.3, 1.4, 6.6], [0, 0.2, 0], [0, 1, 0], opts.fill ?? 0.16, 0xf6f4f0);           // broad, low frontal fill (mid-tones)
    }
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, kind === 'main' ? 0.02 : kind === 'shiny' ? 0.006 : kind === 'free' ? 0.006 : 0.02, 0.1, 100, { size: 256 });   // glass: soft-edged windows; 256: ~6 MB each
    pm.dispose();
    env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    softTex?.dispose();
    return rt;                         // the render target: dispose() frees it (its .texture alone would leak)
  }
  function buildLights() {
    const key = new THREE.DirectionalLight(0xffffff, opts.key ?? 10);
    key.position.set(-4, 3.2, 5);
    if (Q.shadows) {
      key.castShadow = true;
      key.shadow.mapSize.set(Q.shadows, Q.shadows);
      key.shadow.radius = 3;
      Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 1, far: 16 });
      key.shadow.bias = -0.0003; key.shadow.normalBias = 0.008;
    }
    const rim = new THREE.DirectionalLight(0xe6eeff, opts.rim ?? 3.5); rim.position.set(0.8, 4.4, -6.0);
    const kick = new THREE.DirectionalLight(0xffc89a, opts.kick ?? 0.7); kick.position.set(4.2, -2.4, 0.2);   // low, camera-right: lens underside, body base
    const xfill = new THREE.DirectionalLight(0xfff8f0, 0); xfill.position.set(-1.0, 5.0, 4.0);               // explode only: top-front fill for the internals
    scene.add(key, key.target, rim, kick, xfill);
    Object.assign(lights, { key, rim, kick, xfill, keyI: key.intensity, kickI: kick.intensity, base: [key, rim, kick, xfill].map((l) => ({ l, p: l.position.clone() })) });
  }
  function turnLights(az) {
    const a = (az - KEYS.wide.hero.az) * D;
    for (const { l, p } of lights.base) l.position.copy(p).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    // round az -94 the turntable key sits exactly where the EVF's grip-side facet (tilted ~22 deg up) mirrors it and
    // the whole facet flares: lift the key towards the zenith there, so the facet falls dark and only the steep
    // chamfers above it catch a line (as in the photographed orbit)
    const lift = (opts.keyLift ?? 60) * D * Math.exp(-(((az + 94) / 26) ** 2));
    if (lift > 1e-4) {
      const k = lights.key.position, r = k.length(), h = Math.hypot(k.x, k.z), el0 = Math.atan2(k.y, h), el = Math.min(Math.PI / 2 - 0.05, el0 + lift);
      k.set(k.x / h * r * Math.cos(el), r * Math.sin(el), k.z / h * r * Math.cos(el));
    }
    scene.environmentRotation.set(0, a, 0);
    for (const m of glassMats) if (!m.userData.fixedEnv) m.envMapRotation.set(0, a, 0);   // v7: the free glass keeps its studio in its own frame
    // the turntable key floods the EVF's grip-side facets (tilted up) round az -90: ease it there
    lights.key.intensity = lights.keyI * (1 - (opts.keyDip ?? 0.3) * Math.exp(-(((az + (opts.keyDipAz ?? 90)) / (opts.keyDipW ?? 22)) ** 2)));
    lights.xfill.intensity = (opts.xfill ?? 2.4) * smooth(ph.explode);
    lights.kick.intensity = lights.kickI * (1 - smooth(clamp01(ph.explode / 0.35)))   // v7: off early in the explode (towards az -62 it sits in the mirror direction of the iris and the bayonet: bronze)
      * (1 - 0.85 * smooth(clamp01((-az - 112) / 30)));                          // v7: nor a warm cast on the grip-side card door at the rear (az -150)
    // the studio's big key softbox mirrors in the EVF's upward side facets round az -95: dip the studio a little there
    scene.environmentIntensity = (opts.env ?? 0.5) * (1 + 0.25 * ph.explode) * (1 - 0.28 * Math.exp(-(((az + 95) / 20) ** 2)));
  }

  // ---------------------------------------------------------------- the uber material: per-vertex PBR + triplanar grain
  function patchUber(m) {
    m.vertexColors = true;
    m.normalMap = null; m.aoMap = null;     // the tiles live on in `tiles` (create() scope): dispose() frees them
    m.roughness = 1; m.metalness = 1;
    m.clearcoat = 0;                       // no clearcoat lobe on the opaque parts (it doubled the specular cost)
    m.defines = { ...(m.defines || {}), ...(Q.paintGrain ? { PAINT_GRAIN: '' } : {}) };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { tLeather: { value: tiles.leather }, tGrain: { value: tiles.grain }, uAlbedo: { value: opts.albedo ?? 0.85 }, uLScale: { value: opts.leatherScale ?? 0.85 }, uLStr: { value: opts.leatherStr ?? 0.9 }, uLRough: { value: opts.leatherRough ?? 0.05 }, uGScale: { value: 0.16 }, uGStr: { value: opts.grainStr ?? 0.14 }, uMM: { value: 177.0 }, uLSpec: { value: opts.leatherSpec ?? 0.32 }, uLF90: { value: opts.leatherF90 ?? 0.75 }, uLCav: { value: opts.leatherCav ?? 0.5 }, uBSpec: { value: opts.barrelSpec ?? 0.55 }, uEdge: { value: opts.edge ?? [0.22, 0.75, 0.55] } });   // uMM: mm per model unit
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 _pbr; varying vec4 vPbr; varying vec3 vObjPos; varying vec3 vObjN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = _pbr; vObjPos = position; vObjN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tLeather; uniform sampler2D tGrain; uniform float uAlbedo; uniform float uLScale; uniform float uLStr; uniform float uLRough; uniform float uGScale; uniform float uGStr; uniform float uMM; uniform float uLSpec; uniform float uLF90; uniform float uLCav; uniform float uBSpec; uniform vec3 uEdge;\nuniform mat3 normalMatrix;\nvarying vec4 vPbr; varying vec3 vObjPos; varying vec3 vObjN;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n\tfloat grain = vColor.a; diffuseColor.a = 1.0; diffuseColor.rgb *= uAlbedo;')
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * vPbr.x;
        float lCav = 1.0;              // leather: 1 on a pebble's crown, lower in the creases (darkens them, occludes their sheen)
        {
          // edge sheen: the surface's bend measured per pixel (rad per mm, from the interpolated normal), so fillets and
          // rounded edges turn glossier and the key draws a thin crisp line on them while flat facets keep the paint's
          // own roughness (a per-vertex bake leaked the sheen across coarse CAD facets)
          vec3 gn = normalize(vNormal);
          float kx = length(dFdx(gn)) / max(length(dFdx(vViewPosition)), 1e-7), ky = length(dFdy(gn)) / max(length(dFdy(vViewPosition)), 1e-7);
          float bend = max(kx, ky) / uMM;
          roughnessFactor *= 1.0 - uEdge.z * vPbr.w * smoothstep(uEdge.x, uEdge.y, bend);   // v6: a tighter, crisper line (v5 0.10-0.55, 0.48)
        }`)
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vPbr.y;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          bool lea = grain > 0.75;
          bool bru = grain > 0.55 && !lea;   // v6: the top plate and EVF: the paint grain stretched 9x along x (a faint brushed satin)
          float sc = lea ? uLScale : uGScale, st = lea ? uLStr : (bru ? uGStr * 0.4 : uGStr);
          vec3 n0 = normalize(vObjN);
          vec3 bw = pow(abs(n0), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
          vec3 p = vObjPos / sc;
          if (bru) p.x *= 0.11;
          vec2 a = p.zy, b = p.xz, c = p.xy;
          vec2 dax = dFdx(a), day = dFdy(a), dbx = dFdx(b), dby = dFdy(b), dcx = dFdx(c), dcy = dFdy(c);
          #ifdef PAINT_GRAIN
          if (grain > 0.25) {
          #else
          if (grain > 0.75) {
          #endif
            vec4 tx = lea ? textureGrad(tLeather, a, dax, day) : textureGrad(tGrain, a, dax, day);
            vec4 ty = lea ? textureGrad(tLeather, b, dbx, dby) : textureGrad(tGrain, b, dbx, dby);
            vec4 tz = lea ? textureGrad(tLeather, c, dcx, dcy) : textureGrad(tGrain, c, dcx, dcy);
            vec3 ax = vec3((tx.xy * 2.0 - 1.0) * st, 1.0), ay = vec3((ty.xy * 2.0 - 1.0) * st, 1.0), az = vec3((tz.xy * 2.0 - 1.0) * st, 1.0);
            vec3 wx = vec3(ax.xy + n0.zy, abs(ax.z) * n0.x).zyx;
            vec3 wy = vec3(ay.xy + n0.xz, abs(ay.z) * n0.y).xzy;
            vec3 wz = vec3(az.xy + n0.xy, abs(az.z) * n0.z);
            vec3 no = normalize(wx * bw.x + wy * bw.y + wz * bw.z);
            normal = normalize(normalMatrix * no) * faceDirection;
            float rr = tx.a * bw.x + ty.a * bw.y + tz.a * bw.z;
            // leather: each pebble's crown its own roughness (0.42-0.56), creases ~0.82, and the tile's cavity (B) darkens
            // the creases; paint: roughness +-0.08 speckle
            roughnessFactor = lea ? clamp(roughnessFactor + (rr - 0.5) + uLRough, 0.3, 0.95) : clamp(roughnessFactor + (rr - 0.5) * (bru ? 0.35 : 0.8), 0.05, 1.0);
            if (lea) { lCav = tx.b * bw.x + ty.b * bw.y + tz.b * bw.z; diffuseColor.rgb *= mix(1.0 - uLCav, 1.0, lCav); }
          }
        }`)
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n\tif (grain > 0.75) { material.specularColor *= uLSpec; material.specularColorBlended *= uLSpec; material.specularF90 *= uLF90; }   // leather: a soft, low sheen (camA2), not grey: r186 takes the direct F0 from specularColorBlended, so both are scaled (v4 scaled only specularColor: no effect)\n\telse if (grain > 0.40 && grain < 0.47) { material.specularColor *= uBSpec; material.specularColorBlended *= uBSpec; material.specularF90 *= uBSpec; }   // v7: the lens barrel paint and the rib flanks (grain 0.44): matte black, a low sheen (camA2)')
        .replace('#include <aomap_fragment>', `{
          float ambientOcclusion = vPbr.z * mix(1.0 - uLCav * 0.6, 1.0, lCav);
          reflectedLight.indirectDiffuse *= ambientOcclusion;
          #if defined( USE_CLEARCOAT )
            clearcoatSpecularIndirect *= ambientOcclusion;
          #endif
          #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
          #endif
          reflectedLight.directDiffuse *= mix(1.0, ambientOcclusion, 0.5);
          reflectedLight.directSpecular = min(reflectedLight.directSpecular * mix(1.0, ambientOcclusion, 0.35), vec3(2.5));   // no star hotspots, no blown facets
        }`);
    };
    m.customProgramCacheKey = () => 'cam3d-uber-9' + (Q.paintGrain ? 'g' : '');
    m.needsUpdate = true;
  }
  /* glass: reflections only from its own studio (no point glints from the direct lights).
     kind 'front' (v6): the front element's body darkens what is behind it more at its centre than at its rim (a dark
       radial falloff into the bore: the deeper rings and elements fade out, the window reflection stays on top).
     kind 'free' (v6): the free elements in the explode: a Fresnel rim, a faked refraction (the studio seen through the
       element: the refracted view ray samples the blurred environment, tinted by the glass) and a soft inner caustic
       ring near the rim, so they read as thick, lit glass (camB2), not dark tinted discs. */
  function patchGlass(m, kind = '') {
    const U = { uFrontA: { value: opts.frontAlpha ?? [0.14, 0.14] },   // v7: no centre veil (v6 0.5 -> 0.15): the dark bore shows through
      uGC: { value: new THREE.Vector3() }, uGA: { value: new THREE.Vector3(0, 0, 1) }, uGS: { value: new THREE.Vector4(0.03, 0.3, 0.3, 0.1) } };
    m.userData.U = U;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      let f = sh.fragmentShader.replace('#include <aomap_fragment>', '#include <aomap_fragment>\n\treflectedLight.directSpecular *= 0.0; reflectedLight.directDiffuse *= 0.0;');
      const uvx = '#ifdef USE_IRIDESCENCE_THICKNESSMAP\n\tfloat gR = vIridescenceThicknessMapUv.x;\n#else\n\tfloat gR = 0.5;\n#endif\n';
      if (kind === 'front') {
        f = f.replace('#include <common>', '#include <common>\nuniform vec2 uFrontA;')
          .replace('#include <opaque_fragment>', uvx + '\tdiffuseColor.a = mix(uFrontA.x, uFrontA.y, smoothstep(0.15, 0.95, gR));\n#include <opaque_fragment>');
      } else if (kind === 'free') {
        // v7: plain thick glass: what is behind passes through, darkened (the material's own alpha); the coating only
        // on the outer ~15% of the radius (thin rim arcs); the only light is the studio strip's arcs. The shading normal
        // is the exact sphere normal of each face (centre and radii from the build, in view space; set per draw): the
        // lathe's interpolated normals bent the arcs into wobbly lines
        f = f.replace('#include <common>', '#include <common>\nuniform vec3 uGC; uniform vec3 uGA; uniform vec4 uGS;')
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec3 P = -vViewPosition, q = P - uGC;
            float ax = dot(q, uGA), rad = length(q - uGA * ax);
            vec3 C = ax > 0.0 ? uGC + uGA * (uGS.x - uGS.y) : uGC - uGA * (uGS.x - uGS.z);
            vec3 nA = normalize(P - C);
            if (rad < uGS.w * 0.99) normal = nA * (dot(nA, vViewPosition) < 0.0 ? -1.0 : 1.0);
          }`)
          .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n' + uvx + '#ifdef USE_IRIDESCENCE\n\tmaterial.iridescence *= smoothstep(0.82, 0.92, gR);\n#endif\n');
      }
      sh.fragmentShader = f;
    };
    m.customProgramCacheKey = () => 'cam3d-glass-3' + kind;
    m.needsUpdate = true;
  }

  // ---------------------------------------------------------------- load
  async function load() {
    if (loaded || disposed) return;
    if (!renderer) throw new Error('camera3d: no renderer');
    // the HDR targets are half-float (MSAA): without a float colour-buffer extension the framebuffer would be
    // incomplete and the canvas black while the scene counts as drawn. Fail instead, so the stage keeps the stills.
    if (renderer.capabilities?.isWebGL2 === false || !(renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'))) {
      throw new Error('camera3d: no half-float render targets (EXT_color_buffer_float)');
    }
    // a minimal GLB reader (./glb.js) instead of GLTFLoader: GLTFLoader pulls three's animation system into the site's
    // shared three chunk for every visitor. opts.parse(buffer, meshoptDecoder) -> { scene } swaps the reader (A/B checks).
    const [{ MeshoptDecoder }, { parseGLB }] = await Promise.all([import('three/addons/libs/meshopt_decoder.module.js'), import('./glb.js')]);
    if (Q.bloom) ({ UnrealBloomPass: Bloom } = await import('three/addons/postprocessing/UnrealBloomPass.js'));
    const url = base + file;
    const buf = opts.loadBuffer ? await opts.loadBuffer(url) : await (await fetch(url)).arrayBuffer();
    const gltf = opts.parse ? await opts.parse(buf, MeshoptDecoder) : await parseGLB(buf, { meshoptDecoder: MeshoptDecoder });
    if (disposed) return;
    envs = { main: studioEnv('main'), glass: studioEnv('glass'), shiny: studioEnv('shiny'), free: studioEnv('free'), metal: studioEnv('metal') };
    scene.environment = envs.main.texture;
    scene.environmentIntensity = opts.env ?? 0.5;
    buildLights();
    model = gltf.scene;
    scene.add(model);
    const root = model.getObjectByName('camera');
    const NOCAST = /^(lens_el_\d|aperture|screws|body_mount|sensor|shutter|lcd|evf_module)$/;     // small or enclosed parts: no shadow pass
    const FREE = /^lens_el_[34]$/;     // v7: two free elements (lens_el_5 rides in the lens)
    let freeMetal = null;
    model.traverse((o) => {
      if (!o.isMesh) return;
      let top = o; while (top.parent && top.parent.name !== 'camera') top = top.parent;
      o.userData.part = top.name;
      meshes.push(o);
      o.castShadow = !!Q.shadows && !NOCAST.test(top.name); o.receiveShadow = !!Q.shadows;
      const m = o.material;
      if (m.name === 'uber' || m.userData?.uber || m.normalMap?.name === 'tile_leather') {
        if (!tiles) tiles = { leather: m.normalMap, grain: m.aoMap };
        if (!m.userData.patched) { tiles.leather.wrapS = tiles.leather.wrapT = tiles.grain.wrapS = tiles.grain.wrapT = THREE.RepeatWrapping; tiles.leather.anisotropy = tiles.grain.anisotropy = 4; patchUber(m); m.userData.patched = true; }
      }
      if (m.name === 'lens_glass' || m.name === 'front_glass' || m.name === 'cover_glass') {
        const front = m.name === 'front_glass', cover = m.name === 'cover_glass';
        let mm = m;
        if (FREE.test(top.name)) {        // the free elements: a little body (they darken what is behind them: a dark interior)
          mm = o.material = m.clone();
          mm.color.setRGB(0.004, 0.007, 0.005); mm.opacity = opts.freeAlpha ?? 0.34; mm.userData.fixedEnv = true;
          o.userData.shape = top.userData.shape;
        }
        Object.assign(mm, { transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor,
          blendDst: THREE.OneMinusSrcAlphaFactor, envMap: cover ? envs.shiny.texture : FREE.test(top.name) ? envs.free.texture : envs.glass.texture, envMapIntensity: (cover ? 0.35 : FREE.test(top.name) ? (opts.freeEnv ?? 1.0) : (front ? 0.9 : 1.2) * (opts.glassEnv ?? 2.0)) });
        if (front) mm.opacity = 0.13;          // a little body: the dome darkens what is behind it (v6: more at its centre)
        mm.specularColor.setRGB(1, 1, 1); mm.specularIntensity = 1;
        patchGlass(mm, FREE.test(top.name) ? 'free' : front ? 'front' : '');
        o.castShadow = false; o.renderOrder = 2;
        glassMats.push(mm);
      }
      // the mount's bayonet, its contacts and the iris blades see their own studio (a broad card where they mirror the
      // exploded view): in the main studio their polished faces mirrored black and the steel read dark (camB2: bright)
      if (o.material.userData.patched && /^(body_mount|aperture)$/.test(top.name)) {
        if (!freeMetal) { freeMetal = m.clone(); patchUber(freeMetal); freeMetal.envMap = envs.metal.texture; freeMetal.envMapIntensity = opts.freeMetalEnv ?? 1.5; glassMats.push(freeMetal); }
        o.material = freeMetal;
      }
      if (m.name === 'sensor_die' || m.name === 'lcd_glass') { m.envMap = envs.shiny.texture; m.envMapIntensity = m.name === 'sensor_die' ? 1.2 : 0.8; glassMats.push(m); }
    });
    // per-element thin-film coatings (film IOR 1.36, measured swatches: 290 nm magenta, 330 blue, 370-400 green, 430 olive,
    // 480 magenta; seen obliquely a film reads ~15% thinner, so the elements seen side-on get thicker films), each its own range
    // v6: the front element runs from a neutral green at its centre (425 nm) to a magenta-violet rim (505 nm) at 38%
    // strength (three's thin film, evaluated: 365-380 nm reads teal, v5's 395-440 at full strength gave the teal blur),
    // so the window's reflection stays grey-green (camA2); the two inner elements are fainter and see the glass studio
    // at 60% (they drew stacked copies of the window: the 'tunnel'); the free elements: green faces, magenta rims (camB2)
    const COAT = { lens_el_0: [...(opts.frontCoat ?? [425, 505]), opts.frontIri ?? 0.38], lens_el_1: [360, 385, 0.4], lens_el_2: [395, 420, 0.4], lens_el_3: [405, 520, 1.0], lens_el_4: [395, 510, 1.0], lens_el_5: [395, 420, 0.4] };   // v7: lens_el_5 rides in the lens (an inner element)
    for (const [n, [a, b, f]] of Object.entries(COAT)) root.getObjectByName(n)?.traverse((o) => {
      if (o.isMesh && o.material.iridescence > 0) {
        if (!FREE.test(n)) {
          o.material = o.material.clone(); patchGlass(o.material, n === 'lens_el_0' ? 'front' : ''); glassMats.push(o.material);
          if (n !== 'lens_el_0') o.material.envMapIntensity *= opts.innerEnv ?? 0.6;
        }
        // the free elements: a partial film (the coating tints the window's reflection at its edges and arcs; at full
        // strength the whole face turned one rainbow sweep, like a disc, not glass)
        o.material.iridescenceThicknessRange = [a, b]; o.material.iridescence = FREE.test(n) ? (opts.freeIri ?? 0.4) : f;   // v7: free: <= 40%, rim only (shader)
      }
    });
    // every part rides in a group at its pivot (mesh quantisation moves node origins; rotations need the real pivot)
    model.updateMatrixWorld(true);
    const groups = {};
    for (const node of [...root.children]) {
      const x = node.userData || {};
      if (!x.pivot) continue;
      const g = new THREE.Group(); g.name = node.name + '_pivot';
      g.position.set(...x.pivot); root.add(g); g.updateMatrixWorld(true); g.attach(node);
      groups[node.name] = { g, x };
    }
    for (const [name, { g, x }] of Object.entries(groups)) {
      if (x.parent && groups[x.parent]) groups[x.parent].g.attach(g);
      if (!x.explode || x.parent) continue;
      const part = { node: g, name, rest: { pos: g.position.clone(), quat: g.quaternion.clone() }, k: 0,
        ex: new THREE.Vector3(...x.explode), rot: x.rot ? new THREE.Euler(...x.rot.map((d) => d * D)) : null, t: x.t };
      parts.push(part);
      if (x.instances) g.traverse((o) => {
        if (!o.isInstancedMesh) return;
        const b = []; for (let i = 0; i < o.count; i++) { const mm = new THREE.Matrix4(); o.getMatrixAt(i, mm); b.push(mm); }
        screws.push({ mesh: o, base: b, inst: x.instances, part });
      });
    }
    // part ids for the occlusion pass (1-based; 0 = nothing)
    const partNames = [...new Set(meshes.map((o) => o.userData.part))];
    for (const o of meshes) {
      o.userData.pid = partNames.indexOf(o.userData.part) + 1;
      o.onBeforeRender = o.userData.shape ? freeHook : idHook;
    }
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh || o.material.transparent) return;
      if (o.isInstancedMesh) { samples.push({ obj: o, inst: true }); return; }
      const pos = o.geometry.attributes.position, n = pos.count, step = Math.max(1, Math.floor(n / 200));
      const pts = new Float32Array(Math.ceil(n / step) * 3); let k = 0;
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i += step) { v.fromBufferAttribute(pos, i); pts[k++] = v.x; pts[k++] = v.y; pts[k++] = v.z; }
      samples.push({ obj: o, pts: pts.subarray(0, k) });
    });
    for (const a of root.userData.anchors || []) {
      const node = root.getObjectByName(a.part);
      if (!node) continue;
      const g = node.parent && node.parent.name.endsWith('_pivot') ? node.parent : node;
      anchorDefs.push({ ...a, node, pid: partNames.indexOf(a.part) + 1, nrm: a.n ? new THREE.Vector3(...a.n).normalize() : null, g, gq: g.getWorldQuaternion(new THREE.Quaternion()).invert(),
        local: node.worldToLocal(new THREE.Vector3(...a.rest)), reveal: a.id in REVEAL ? REVEAL[a.id] : a.part, ox: 0, oy: 0, occ: 1 });
    }
    setSize();
    await prewarm();
    loaded = true; dirty = true;
  }
  /* compile every program and upload every texture now (at idle in the stage), not inside the first visible frame:
     the scene's materials, the shadow depth programs and the bloom passes (one warm-up sample into a 16 px target),
     the post quads and the id pass */
  async function prewarm() {
    const r = renderer;
    applyPose();
    const shWas = r.shadowMap.enabled, rtWas = r.getRenderTarget();
    r.shadowMap.enabled = !!Q.shadows; r.setRenderTarget(rtHDR);
    const par = r.compileAsync && r.extensions.has('KHR_parallel_shader_compile');
    if (par) await r.compileAsync(scene, camera); else r.compile(scene, camera);
    for (const q of [outQ, blendQ, copyQ]) r.compile(q.sc, qcam);
    const texs = new Set([tiles?.leather, tiles?.grain]);
    model.traverse((o) => { if (!o.isMesh) return; const m = o.material; for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'emissiveMap', 'iridescenceThicknessMap']) if (m[k]) texs.add(m[k]); });
    for (const t of texs) if (t) r.initTexture(t);
    r.shadowMap.enabled = shWas; r.setRenderTarget(rtWas);
    // one tiny warm-up frame through the whole chain (shadow depth, bloom, tone map, blend, copy, id)
    const [w0, h0, s0] = [W, H, scaleNow];
    W = 16; H = 16; scaleNow = 1; setTargets();
    const tiny = new THREE.WebGLRenderTarget(16, 16, { type: THREE.UnsignedByteType });
    sample(r); accN = 0;
    copyQ.m.uniforms.t.value = accRT.texture; r.setRenderTarget(tiny); r.render(copyQ.sc, qcam);
    idPass(r, true);
    r.setRenderTarget(rtWas);
    tiny.dispose();
    W = w0; H = h0; scaleNow = s0; setTargets();
  }

  // ---------------------------------------------------------------- sizing
  function setTargets() {
    const w = Math.max(16, Math.round(W * scaleNow)), h = Math.max(16, Math.round(H * scaleNow));
    if (!rtHDR || rtHDR.samples !== msaaNow) {
      rtHDR?.dispose();
      rtHDR = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaaNow });
    } else rtHDR.setSize(w, h);
    if (!rtLDR) {
      rtLDR = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });      // tone-mapped sRGB: 8 bit
      accRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });         // running mean: keeps precision
    } else { rtLDR.setSize(w, h); accRT.setSize(w, h); }
    if (Bloom && !bloom) bloom = new Bloom(new THREE.Vector2(w, h), opts.bloomStrength ?? 0.05, 0.25, opts.bloomThreshold ?? 4.0);
    else if (bloom) bloom.setSize(w, h);
  }
  function setSize() {
    if (!renderer) return;
    scaleNow = opts.scale ?? (mobile ? Math.min(0.8, 1.6 / Math.max(1, dpr)) : 1);
    msaaNow = opts.msaa ?? (mobile || dpr >= 1.5 ? 2 : 4);
    setTargets();
    camera.aspect = W / H;
    dirty = true;
  }
  function resize(w, h, d) {
    W = w; H = h; dpr = d || 1;
    vw = d ? w / d : innerWidth; vh = d ? h / d : innerHeight;
    setSize();
  }

  // ---------------------------------------------------------------- pose: explode + rig + fit
  const portrait = () => camera.aspect < 0.85;
  const mixKey = (a, b, t) => ({ az: lerp(a.az, b.az, t), el: lerp(a.el, b.el, t), fov: lerp(a.fov, b.fov, t), fill: lerp(a.fill, b.fill, t) });
  function rigAt() {
    const K = portrait() ? KEYS.tall : KEYS.wide;
    let r = mixKey(K.start, K.hero, pace(ph.orbit));
    r = mixKey(r, K.column, ph.hand);
    r = mixKey(r, K.exploded, ph.explode);
    r.fill *= 1 + 0.025 * ph.settle;
    r.az += 2.5 * ph.settle;
    if (!reduced) { r.az += ptrS.x * (2.2 + 1.0 * ph.explode); r.el += -ptrS.y * 1.4; }
    r.az += off.az; r.el = Math.max(-25, Math.min(40, r.el + off.el));
    return r;
  }
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _e = new THREE.Euler(), _x = new THREE.Vector3();
  function applyExplode() {
    const e = ph.explode, pr = portrait();
    for (const p of parts) {
      const [a, b] = p.t;
      const k = easeOut(clamp01((e - a) / Math.max(1e-4, b - a)));
      p.k = k;
      const o = exOverride?.[p.name];
      const ex = o?.ex ? _x.set(...o.ex).multiplyScalar(1 / 177) : p.ex;
      const s = pr ? (opts.portraitScale?.[p.name] ?? PORTRAIT_SCALE[p.name] ?? 0.8) : 1;
      p.node.position.copy(p.rest.pos).addScaledVector(ex, k * s);
      p.node.quaternion.copy(p.rest.quat);
      const rot = o?.rot ? _e.set(...o.rot.map((d) => d * D)) : p.rot;
      if (rot) {
        const kr = smooth(clamp01((k - 0.2) / 0.8));
        _e.set(rot.x * kr, rot.y * kr, rot.z * kr);
        p.node.quaternion.multiply(_q.setFromEuler(_e));
      }
    }
    for (const s of screws) {
      s.mesh.visible = !pr;
      s.inst.forEach((it, i) => {
        const k = easeOut(clamp01((e - it.t[0]) / (it.t[1] - it.t[0])));
        _m.copy(s.base[i]); _v.setFromMatrixPosition(_m).add(new THREE.Vector3(...it.explode).multiplyScalar(k)); _m.setPosition(_v);
        s.mesh.setMatrixAt(i, _m);
      });
      s.mesh.instanceMatrix.needsUpdate = true; s.mesh.computeBoundingSphere();
    }
  }
  const _c = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3();
  function gather() {
    const out = [];
    for (const s of samples) {
      if (s.inst) { if (!s.obj.visible) continue; for (let i = 0; i < s.obj.count; i++) { s.obj.getMatrixAt(i, _m); _v.setFromMatrixPosition(_m).applyMatrix4(s.obj.matrixWorld); out.push(_v.x, _v.y, _v.z); } continue; }
      const e = s.obj.matrixWorld.elements, a = s.pts;
      for (let i = 0; i < a.length; i += 3) { const x = a[i], y = a[i + 1], z = a[i + 2]; out.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]); }
    }
    return out;
  }
  /* the zoom on the rect the fit uses (bleed and inset included, so a zoom is a pure scale of the picture about a point):
     css x' = k x + zm.x, y' = k y + zm.y, in NDC */
  const zoomNDC = (R) => R.map((v, i) => v * zm.k + (i < 2 ? zm.k - 1 + 2 * zm.x / vw : 1 - zm.k - 2 * zm.y / vh));
  function rectNDC() {
    if (!rect) return [-1, 1, -1, 1];
    // phones: keep the device clear of the header bar as it lands in the column (the slot starts just under it)
    const top = portrait() ? (opts.insetTop ?? 16) * ph.hand : 0;
    // opts.bleedLeft (off by default): let the explode use some room left of the column. On the site the part list ends
    // ~32 px left of the column at 1440, so the device stays inside its column there.
    const bl = portrait() ? 0 : (opts.bleedLeft ?? 0) * rect.w * smooth(ph.explode) * ph.hand;
    // as the parts spread, a slot that stops short of the viewport's right edge grows to it, and past it by
    // opts.bleedRight x the viewport (v7: default 0; v6's 0.03 let the lens's front ring touch the page edge, which
    // read as a layout bug: now the whole lens keeps the fit's 4% margin); never left into the copy
    const edge = vw - rect.x - rect.w;  // a slot that already reaches the right edge (the full-frame stills) does not bleed
    const br = portrait() || edge < 1 ? 0 : (edge + (opts.bleedRight ?? 0) * vw) * smooth(ph.explode) * ph.hand;
    return zoomNDC([(rect.x - bl) / vw * 2 - 1, (rect.x + rect.w + br) / vw * 2 - 1, 1 - (rect.y + rect.h) / vh * 2, 1 - (rect.y + top) / vh * 2]);
  }
  let jitter = [0, 0], fitInfo = null;
  let view = null;            // debug / art-direction override: { az, el, fov, target: [x, y, z], dist }
  function applyPose() {
    applyExplode();
    const rig = view ? { ...rigAt(), ...view } : rigAt();
    turnLights(rig.az);
    if (view && view.target) {
      camera.fov = rig.fov; camera.aspect = W / H; camera.updateProjectionMatrix();
      model.updateMatrixWorld(true);
      const az = rig.az * D, el = rig.el * D;
      _d.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      camera.position.set(...view.target).addScaledVector(_d, view.dist); camera.up.set(0, 1, 0); camera.lookAt(...view.target);
      camera.near = view.near ?? 0.02; camera.far = view.dist + 6; camera.updateProjectionMatrix();
      // view.shift [x, y] (NDC): where the target lands on screen (default the centre: the hero3d scene floats the camera
      // in the painting's fingertip gap); view.near: a nearer plane than 0.02 wastes depth precision on a far view
      const w = rtHDR ? rtHDR.width : W, h = rtHDR ? rtHDR.height : H, sh = view.shift || [0, 0];
      camera.projectionMatrix.elements[8] = -sh[0] - jitter[0] * 2 / w; camera.projectionMatrix.elements[9] = -sh[1] - jitter[1] * 2 / h;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      return;
    }
    camera.fov = rig.fov; camera.aspect = W / H; camera.updateProjectionMatrix();
    model.updateMatrixWorld(true);
    const R = rectNDC();
    const az = rig.az * D, el = rig.el * D;
    _d.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    _r.set(Math.cos(az), 0, -Math.sin(az)); _u.crossVectors(_d, _r);
    const tanV = Math.tan(rig.fov * D / 2), tanH = tanV * camera.aspect;
    const hw = (R[1] - R[0]) / 2 * rig.fill, hh = (R[3] - R[2]) / 2 * rig.fill;
    const pts = gather();
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9, mnz = 1e9, mxz = -1e9;
    for (let i = 0; i < pts.length; i += 3) { mnx = Math.min(mnx, pts[i]); mxx = Math.max(mxx, pts[i]); mny = Math.min(mny, pts[i + 1]); mxy = Math.max(mxy, pts[i + 1]); mnz = Math.min(mnz, pts[i + 2]); mxz = Math.max(mxz, pts[i + 2]); }
    _c.set((mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2);
    let dist = 1, bw = 0, bh = 0;
    for (let it = 0; it < 4; it++) {
      dist = 0;
      for (let i = 0; i < pts.length; i += 3) {
        const rx = pts[i] - _c.x, ry = pts[i + 1] - _c.y, rz = pts[i + 2] - _c.z;
        const x = rx * _r.x + ry * _r.y + rz * _r.z, y = rx * _u.x + ry * _u.y + rz * _u.z, z = rx * _d.x + ry * _d.y + rz * _d.z;
        dist = Math.max(dist, z + Math.abs(x) / (tanH * hw), z + Math.abs(y) / (tanV * hh));
      }
      let a = 1e9, b = -1e9, c = 1e9, e = -1e9;
      for (let i = 0; i < pts.length; i += 3) {
        const rx = pts[i] - _c.x, ry = pts[i + 1] - _c.y, rz = pts[i + 2] - _c.z;
        const x = rx * _r.x + ry * _r.y + rz * _r.z, y = rx * _u.x + ry * _u.y + rz * _u.z, z = rx * _d.x + ry * _d.y + rz * _d.z;
        const px = x / ((dist - z) * tanH), py = y / ((dist - z) * tanV);
        a = Math.min(a, px); b = Math.max(b, px); c = Math.min(c, py); e = Math.max(e, py);
      }
      const mx = (a + b) / 2, my = (c + e) / 2; bw = (b - a) / 2; bh = (e - c) / 2;
      _c.addScaledVector(_r, mx * tanH * dist).addScaledVector(_u, my * tanV * dist);
    }
    camera.position.copy(_c).addScaledVector(_d, dist);
    camera.up.set(0, 1, 0); camera.lookAt(_c);
    camera.near = Math.max(0.05, dist - 4); camera.far = dist + 6;
    camera.updateProjectionMatrix();
    const w = rtHDR ? rtHDR.width : W, h = rtHDR ? rtHDR.height : H;
    const sx = (R[0] + R[1]) / 2 + jitter[0] * 2 / w, sy = (R[2] + R[3]) / 2 + jitter[1] * 2 / h;
    camera.projectionMatrix.elements[8] = -sx; camera.projectionMatrix.elements[9] = -sy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // the device's screen box (css px; the fit centres it on the rect): drag3d's hit region
    const bx = (R[0] + R[1]) / 2, by = (R[2] + R[3]) / 2;
    fitInfo = { target: _c.toArray(), dist, rig, box: { x0: (bx - bw + 1) / 2 * vw, x1: (bx + bw + 1) / 2 * vw, y0: (1 - by - bh) / 2 * vh, y1: (1 - by + bh) / 2 * vh } };
  }
  function pose() {
    if (!loaded) return;
    const s = signature();
    if (s === posedSig && jitter[0] === 0 && jitter[1] === 0) return;
    jitter = [0, 0]; applyPose(); posedSig = s;
  }

  // ---------------------------------------------------------------- render
  const _cc = new THREE.Color();
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  function signature() {
    return [ph.orbit, ph.hand, ph.explode, ph.settle, ptrS.x, ptrS.y, off.az, off.el, zm.k, zm.x, zm.y, rect ? [rect.x, rect.y, rect.w, rect.h].join(',') : '', W, H, exOverride ? JSON.stringify(exOverride) : ''].map((v) => (typeof v === 'number' ? v.toFixed(5) : v)).join('|');
  }
  function sample(r) {
    // one (jittered) frame -> HDR -> bloom -> tone map into rtLDR -> folded into the running mean
    jitter = accN === 0 ? [0, 0] : [halton(accN + 1, 2) - 0.5, halton(accN + 1, 3) - 0.5];
    applyPose(); posedSig = '';
    const shadowWas = r.shadowMap.enabled, typeWas = r.shadowMap.type, rtWas = r.getRenderTarget(), acWas = r.autoClear;
    r.getClearColor(_cc); const caWas = r.getClearAlpha();
    r.shadowMap.enabled = !!Q.shadows; r.shadowMap.type = THREE.PCFShadowMap;
    r.setRenderTarget(rtHDR); r.setClearColor(0x000000, alpha ? 0 : 1); r.clear();
    const ar = r.info.autoReset; r.info.autoReset = false; r.info.reset();
    r.render(scene, camera);
    lastInfo = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    r.info.autoReset = ar;
    r.setClearColor(_cc, caWas);
    if (bloom) bloom.render(r, null, rtHDR, 0, false);
    outQ.m.uniforms.tHDR.value = rtHDR.texture;
    outQ.m.uniforms.exposure.value = (opts.exposure ?? 1.0) * (1 + (opts.expRamp ?? 0.15) * ph.explode);
    r.setRenderTarget(rtLDR); r.render(outQ.sc, qcam);
    blendQ.m.uniforms.t.value = rtLDR.texture; blendQ.m.uniforms.w.value = 1 / (accN + 1); blendQ.m.blendAlpha = 1 / (accN + 1);
    r.autoClear = false; r.setRenderTarget(accRT); r.render(blendQ.sc, qcam); r.autoClear = acWas;
    r.shadowMap.enabled = shadowWas; r.shadowMap.type = typeWas; r.setRenderTarget(rtWas);
    accN++;
    jitter = [0, 0];
  }
  function accumulate(r, samplesNow = 0, idOK = true) {
    const s = signature();
    if (s !== lastSig || dirty) { accN = 0; lastSig = s; dirty = false; }
    const n = samplesNow || (accN < Q.acc ? 1 : 0);
    for (let i = 0; i < n && accN < Math.max(Q.acc, samplesNow); i++) sample(r);
    // the view has settled (or a still was asked for): test what covers each anchor, once per pose
    if (idOK && (accN >= Q.acc || (samplesNow && opts.idOnSamples !== false)) && idSig !== s) idPass(r);
  }
  function render(r = renderer, target = null, samplesNow = 0) {
    renderer = r || renderer;
    if (!loaded) return false;
    accumulate(renderer, samplesNow);
    copyQ.m.uniforms.t.value = accRT.texture;
    renderer.setRenderTarget(target); renderer.render(copyQ.sc, qcam);
    return true;
  }
  /* opts.alpha: the running mean itself (premultiplied rgba, a = coverage), for the caller to composite; o.id false skips
     the anchors' id pass (a scene without markers) */
  function renderTexture(r = renderer, samplesNow = 0, o = {}) {
    renderer = r || renderer;
    if (!loaded) return null;
    accumulate(renderer, samplesNow, o.id !== false);
    return accRT.texture;
  }

  // ---------------------------------------------------------------- anchors + occlusion (id pass)
  let idOn = false, idSig = '', idBuf = null, idW = 0, idH = 0, idVer = 0, idPose = null;
  function idHook() { if (idOn) { idMat.uniforms.pid.value = this.userData.pid; idMat.uniformsNeedUpdate = true; } }
  const _gw = new THREE.Vector3(), _gq = new THREE.Quaternion();
  function freeHook(r, sc, cam) {         // a free element: its faces' sphere (centre, axis, radii) in view space for this draw
    idHook.call(this);
    const U = this.material?.userData?.U, S = this.userData.shape;
    if (idOn || !U || !S) return;
    let g = this; while (g.parent && !g.name.endsWith('_pivot')) g = g.parent;
    g.getWorldPosition(_gw); g.getWorldQuaternion(_gq);
    U.uGC.value.copy(_gw).applyMatrix4(cam.matrixWorldInverse);
    U.uGA.value.set(0, 0, 1).applyQuaternion(_gq).transformDirection(cam.matrixWorldInverse);
    U.uGS.value.set(S[0], S[1], S[2], S[3]);
  }
  function idPass(r = renderer, warm = false) {
    if (!loaded && !warm) return;
    idW = Math.max(16, Math.min(640, Math.round(vw / 2))); idH = Math.max(16, Math.round(idW * vh / vw));
    if (!idRT) idRT = new THREE.WebGLRenderTarget(idW, idH, { type: THREE.UnsignedByteType });
    else if (idRT.width !== idW || idRT.height !== idH) idRT.setSize(idW, idH);
    jitter = [0, 0]; applyPose(); posedSig = signature();
    const rtWas = r.getRenderTarget(), shWas = r.shadowMap.enabled; r.getClearColor(_cc); const caWas = r.getClearAlpha();
    const bg = scene.background, ov = scene.overrideMaterial;
    scene.background = null; scene.overrideMaterial = idMat; r.shadowMap.enabled = false; idOn = true;
    r.setRenderTarget(idRT); r.setClearColor(0x000000, 1); r.clear();
    r.render(scene, camera);
    idOn = false; scene.background = bg; scene.overrideMaterial = ov; r.shadowMap.enabled = shWas;
    if (!idBuf || idBuf.length !== idW * idH * 4) idBuf = new Uint8Array(idW * idH * 4);
    // (the warm-up reads back too: a software rasteriser builds its read-back path on the first read, which cost
    // ~100 s under load in SwiftShader when it first happened inside a visible frame)
    r.readRenderTargetPixels(idRT, 0, 0, idW, idH, idBuf);
    r.setClearColor(_cc, caWas); r.setRenderTarget(rtWas);
    if (warm) return;
    idSig = signature(); idVer++;
    resolveAnchors();
    const rg = rigAt(); idPose = { az: rg.az, el: rg.el, e: ph.explode, h: ph.hand };
  }
  const idAt = (x, y) => {            // CSS px -> part id under it (0 = background)
    const i = Math.round(x / vw * idW - 0.5), j = idH - 1 - Math.round(y / vh * idH - 0.5);
    if (i < 0 || j < 0 || i >= idW || j >= idH) return -1;
    return idBuf[(j * idW + i) * 4];
  };
  /* each anchor: its pixel must show its own part; if something covers it, move it to the nearest pixel of its own part
     (within 26 px); then keep markers >= SPREAD px apart, again only onto pixels of their own parts */
  function resolveAnchors() {
    const raw = project();
    const placed = [];
    const k = vw / idW;                // CSS px per id pixel
    for (let n = 0; n < anchorDefs.length; n++) {
      const a = anchorDefs[n], p = raw[n];
      a.ox = 0; a.oy = 0; a.occ = 1;
      if (!(p.vis0 > 0.01)) { continue; }
      const own = (x, y) => idAt(x, y) === a.pid;
      // v6: a marker sits inside its part, never on its silhouette edge (one id pixel of its own part all round): the
      // phone hold's IBIS anchor, half covered by the shutter card, landed on the copper's edge and missed it
      const inside = (x, y) => own(x, y) && own(x + k, y) && own(x - k, y) && own(x, y + k) && own(x, y - k);
      const far = (x, y) => placed.every((q) => Math.hypot(q.x - x, q.y - y) >= SPREAD);
      let best = null;
      if (inside(p.x, p.y) && far(p.x, p.y)) best = [p.x, p.y];
      else {
        let bd = 1e9;
        const R = 30;
        for (let dy = -R; dy <= R; dy += k) for (let dx = -R; dx <= R; dx += k) {
          const d = dx * dx + dy * dy; if (d > R * R || d >= bd) continue;
          const x = p.x + dx, y = p.y + dy;
          if (far(x, y) && inside(x, y)) { bd = d; best = [x, y]; }
        }
        if (!best && inside(p.x, p.y)) best = [p.x, p.y];  // own part but crowded: keep it (the label lead spreads it)
      }
      if (!best) { a.occ = 0; continue; }
      a.ox = best[0] - p.x; a.oy = best[1] - p.y;
      placed.push({ x: best[0], y: best[1] });
    }
  }
  const _a = new THREE.Vector3(), _n = new THREE.Vector3(), _tc = new THREE.Vector3(), _wq = new THREE.Quaternion();
  function project() {
    const byName = Object.fromEntries(parts.map((p) => [p.name, p]));
    return anchorDefs.map((a) => {
      a.node.updateWorldMatrix(true, false);
      const w = a.node.localToWorld(_a.copy(a.local));
      const depth = w.distanceTo(camera.position);
      let face = 1;
      if (a.nrm) {                         // the anchor's face, turned with its part: fade when it looks away from the view
        _n.copy(a.nrm).applyQuaternion(a.gq).applyQuaternion(a.g.getWorldQuaternion(_wq));
        face = smooth(clamp01((_n.dot(_tc.copy(camera.position).sub(w).normalize()) + 0.12) / 0.3));
      }
      w.project(camera);
      const rv = a.reveal ? (byName[a.reveal]?.k ?? 1) : 1;
      const show = a.reveal ? smooth(clamp01((rv - 0.55) / 0.35)) : 1;
      const inFrame = Math.abs(w.x) < 1 && Math.abs(w.y) < 1 && w.z < 1;
      return { x: (w.x * 0.5 + 0.5) * vw, y: (0.5 - w.y * 0.5) * vh, depth, vis0: inFrame ? show * face : 0 };
    });
  }
  function anchors(dy = 0) {
    if (!loaded) return [];
    pose();
    const raw = project();
    // the last id pass holds only near the pose it tested: once the view has turned or the parts have moved further
    // than that (a drag in the viewer, the explode still running), a marker hides until the next pass lands when the
    // view settles, rather than showing through whatever now covers its part
    const rg = rigAt();
    const fresh = !!idPose && Math.abs(rg.az - idPose.az) < 6 && Math.abs(rg.el - idPose.el) < 4 && Math.abs(ph.explode - idPose.e) < 0.03 && Math.abs(ph.hand - idPose.h) < 0.03;
    return anchorDefs.map((a, n) => {
      const p = raw[n], ang = LEAD[a.lead] ?? -38;
      return { id: a.id, label: a.label, part: a.part, x: p.x + a.ox, y: p.y + a.oy - dy, depth: p.depth, visible: p.vis0 * (fresh ? a.occ : 0),
        lead: { angle: ang, dx: Math.cos(ang * D), dy: Math.sin(ang * D) } };
    });
  }

  function dispose() {
    disposed = true;
    model?.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      const m = o.material;
      for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'emissiveMap', 'aoMap', 'iridescenceThicknessMap']) m[k]?.dispose();
      m.dispose();
    });
    tiles?.leather.dispose(); tiles?.grain.dispose();
    envs?.main.dispose(); envs?.glass.dispose(); envs?.shiny.dispose(); envs?.free.dispose(); envs?.metal.dispose();   // the PMREM render targets
    lights.key?.dispose(); lights.rim?.dispose(); lights.kick?.dispose(); lights.xfill?.dispose();   // the key's shadow map
    rtHDR?.dispose(); rtLDR?.dispose(); accRT?.dispose(); idRT?.dispose(); bloom?.dispose?.();
    for (const q of [outQ, blendQ, copyQ]) { q.m.dispose(); q.sc.children[0].geometry.dispose(); }
    idMat.dispose();
    scene.clear();
    model = null; loaded = false; envs = null; tiles = null; idBuf = null; idPose = null;
  }

  return {
    scene, camera, quality: Q,
    load,
    get loaded() { return loaded; },
    get idVersion() { return idVer; },
    setProgress(p) { ph = phasesAt(clamp01(p)); },
    setPhases(x) { ph = { orbit: untime(x.orbit ?? 1), hand: x.hand ?? 1, explode: x.explode ?? 0, settle: x.settle ?? 0 }; },
    setLayout(r, w, h) { rect = r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null; if (w) vw = w; if (h) vh = h; },
    setPointer(x, y, k = 0.12) { ptr.set(x, y); ptrS.lerp(ptr, k); if (ptrS.distanceToSquared(ptr) < 1e-6) ptrS.copy(ptr); },
    resize, render, renderTexture, anchors, dispose, pose,
    occlusion() { if (loaded) idPass(renderer); return anchors(); },
    busy() { return loaded && accN < Q.acc; },
    invalidate() { dirty = true; },
    setOffset(az, el) { off.az = az; off.el = el; },
    setZoom(k = 1, x = 0, y = 0) { zm.k = k; zm.x = x; zm.y = y; },
    screenBox() { pose(); return fitInfo?.box || null; },     // the device's screen box (css px, viewport), posed for now
    setFade(f) { copyQ.m.uniforms.fade.value = Math.min(1, Math.max(0, f)); },
    setView(v) { view = v || null; dirty = true; },
    setExplode(o) { exOverride = o || null; dirty = true; },
    retune(o) {                      // art direction (lab only): merge create() options, rebuild the studios, re-apply the glass settings
      Object.assign(opts, o);
      if (!loaded) return;
      const old = envs;
      envs = Object.fromEntries(Object.keys(old).map((k) => [k, studioEnv(k)]));
      const map = new Map(Object.keys(old).map((k) => [old[k].texture, envs[k].texture]));
      scene.environment = envs.main.texture;
      model.traverse((x) => { const m = x.material; if (!x.isMesh || !m) return; if (map.has(m.envMap)) m.envMap = map.get(m.envMap);
        if (m.userData.fixedEnv) { m.opacity = opts.freeAlpha ?? m.opacity; m.envMapIntensity = opts.freeEnv ?? m.envMapIntensity; }
        if (m.envMap === envs.metal.texture) m.envMapIntensity = opts.freeMetalEnv ?? m.envMapIntensity; });
      for (const k of Object.keys(old)) old[k].dispose();
      dirty = true;
    },
    partBoxes() {                    // screen bbox (CSS px) of every part's sampled points, after pose()
      pose(); const out = {}; const v = new THREE.Vector3();
      for (const s of samples) {
        const name = s.obj.userData.part; const b = out[name] || (out[name] = [1e9, 1e9, -1e9, -1e9]);
        const pts = []; if (s.inst) { if (!s.obj.visible) continue; for (let i = 0; i < s.obj.count; i++) { s.obj.getMatrixAt(i, _m); v.setFromMatrixPosition(_m).applyMatrix4(s.obj.matrixWorld); pts.push(v.clone()); } }
        else for (let i = 0; i < s.pts.length; i += 3) pts.push(v.set(s.pts[i], s.pts[i + 1], s.pts[i + 2]).applyMatrix4(s.obj.matrixWorld).clone());
        for (const q of pts) { q.project(camera); const x = (q.x * 0.5 + 0.5) * vw, y = (0.5 - q.y * 0.5) * vh; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
      }
      return out;
    },
    stats() { return { drawCalls: lastInfo?.calls, triangles: lastInfo?.triangles, fit: fitInfo, acc: accN, scale: scaleNow, msaa: msaaNow }; },
  };
}
