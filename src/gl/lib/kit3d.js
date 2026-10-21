/* The Kit's real-time device runtime (three r186, no site imports): one file for the Kit's four devices (console,
   microphone, headphones, phone), each a GLB + a config (./kit3d_devices.js). It is the camera's v5 runtime
   (.lab/cam3d/camera3d.js) made config-driven: the camera's studio (turntable softboxes and strips, one PCF key, rim,
   warm kicker, explode-only top fill), ACES + the 0.9 mid-tone lift, a subtle bloom (4.0 / 0.05 / 0.25), the 15 %
   exposure ramp over the explode, idle supersampling (Halton jitter into a half-float running mean), the prewarm (every
   program compiled and every texture uploaded inside load(), a 16 px warm-up frame through the whole chain), the id pass
   (occlusion) and the anchors API, the quality rules and dispose(). A device differs only through named config keys.

   const dev = create(ctx, { config, base, mobile, tier, reduced, pool })   ctx: the stage's (renderer, tier, reduced, still)
   await dev.load()                       dynamic-imports ./glb.js + the meshopt decoder (+ bloom on desktop), fetches the
                                          GLB, bakes the studio, compiles, uploads, warms up. Throws without half-float
                                          render targets (the stage then keeps the stills)
   dev.setPhases({ orbit, hand, explode, settle })   from the site's clock (tdcore tdShotPhases, each 0 … 1; tdcore's orbit
                                          re-timing 0.72·o + 0.28·easeSine(o) is inverted first); setProgress(p): one scalar
                                          (orbit [0, .40] · hand-off [.40, .52] · explode [.52, .90] · hold [.90, 1])
   dev.setLayout({ x, y, w, h }, vw, vh)  the slot rect (CSS px): the viewport during the orbit, the column after the hand-off
   dev.setPointer(x, y)                   -1 … 1 (a few degrees of parallax drift, eased; off when reduced)
   dev.resize(w, h, dpr)                  drawing-buffer px
   dev.pose()                             applies phases / layout / pointer now (anchors() calls it when anything changed)
   dev.renderTexture(renderer, n, { id }) re-renders on change, else adds one jittered sample; returns the running mean
                                          (premultiplied rgba, display-referred, alpha = coverage, canvas-sized) for a host
                                          shader (the Kit's td:kit puts it over the shot's colour key, with its contact
                                          shadow, and through the cut's wipe). { id: false }: no occlusion pass (a device
                                          that is only passing through, the incoming one in a cut)
   dev.render(renderer, target)           the same, copied into target (rgb × fade over setKey's key; the labs)
   dev.release()                          frees the running mean (a loaded device that is not drawn: the Kit keeps the
                                          neighbours of the shot on screen loaded, but only the drawn ones hold a target)
   dev.busy()                             true while idle samples remain (the stage's ambient())
   dev.anchors(dy = 0)                    [{ id, label, part, x, y, depth, visible, lead: { angle, dx, dy } }], CSS px minus dy;
                                          posed for this frame first; visible = revealed × facing × not occluded (id pass)
   dev.occlusion(), dev.idVersion         the id pass now; bumps when an id pass lands
   dev.setOffset(az, el)                  degrees added to the view (drag to turn: gl/lib/drag3d.js; el clamped to the device's range)
   dev.setZoom(k, x, y)                   the fitted picture scaled by k about a point (css x' = k·x + x): a product-viewer zoom
   dev.screenBox()                        the device's screen box now ({ x0, y0, x1, y1 }, css px): drag3d's hit region
   dev.setFade(f), dev.setKey(c, e, o)    the copy pass only (render()): fade, colour key ('#rrggbb', the Kit's data-td-key)
   dev.dispose()                          frees every GPU resource it made (a pool's shared targets are the pool's)

   createPool(): the targets every device of one host draws through, one sample at a time (the HDR MSAA target, the 8-bit
   tone-mapped target, the bloom chain): the Kit loads up to three devices but draws them through one set, so its GPU
   memory is the camera's plus a running mean per drawn device. pool.dispose() frees them.

   config (per device, ./kit3d_devices.js):
     root, file, mobileFile, unitsMM (mm per model unit)
     keys { wide, tall } × { start, hero, column, exploded }: { az, el, fov, fill }; fillMax (margin clamp, default 0.92);
       settlePush (the hold's slow push, default 0.025)
     tilt / yaw / roll { wide, tall }: the model's pose (degrees; tilt = front up about X, roll about the device's Z);
       tiltEx { wide, tall }: the tilt the pose eases to over the explode; tiltExWideSlot: the exploded tilt for a 16:9 slot
     poseStart / poseEx { wide, tall }: { tilt, roll, yaw, t0, t1 }: the model's pose eased over the orbit / the explode
     explode { part: { ex: [mm], rot: [deg], t: [a, b], scale, rotT } }: overrides of the GLB's extras (art direction)
     parent { part: parentPart }: the part rides in its parent's group (its own explode is then relative to it)
     faceView { part: deg } (+ faceViewTall): as a part explodes, its axis end that faces the exploded view turns towards it
     portraitEx { part: [mm] }, portraitScale, portraitNoRot [names], portraitRot { part: [deg] }, portraitScrews
     reveal { anchorId: part | null }, leads / leadsTall { anchorId: 'ne' | … }, anchorRest { anchorId: [mm] }, anchorNormal
     nocast (RegExp), hideAssembled (RegExp: parts not drawn while closed; the prewarm poses exploded), fitTransparent,
       hugDepth, fitInstancedMax (instanced meshes up to this count join the fit's samples, default 16)
     special { material: kind }: 'mylar', 'cloth', 'glass', 'sapphire', 'screen', 'pcb' (the phone's and the mic's) and the
       console's 'glow', 'sheenGlass', 'lcd', 'board' (below)
     metalParts (RegExp) + metalCard { pos, size, card, strip, key }: those parts see the 'metal' studio (one broad soft card)
     studios ['coat' | 'glass' | 'free']: extra studios; envExtra [{ w, l, pos, look, along, k, tint }]: extra cards in the
       main studio (the phone's band cards, the console's side panels)
     shadowBox, shadowFade { parts (RegExp), t: [a, b], k, castUntil }: the internals' shadows fade as they lift away
     tileA ('foam' | 'leather'), foam*, leather*, grain*, knurl*, brush*, foil*, perfMM, edgeSheen, specClamp, smoothSpec
     light: { key, rim, kick, xfill, env, envRamp, softbox, softboxTint, softboxPos, fill, fillTint, sideStrip, overhead,
       rimStrip, kickPanel, exposure, expRamp, albedo, lift, bloomStrength, bloomThreshold } (camera v5 defaults)
     camera-only (off unless set): keyLift / keyLiftAz, keyDip / keyDipAz / keyDipW, envDip / envDipAz
   Uber material (the camera's; COLOR_0 = linear albedo + surface code in A, _PBR = roughness, metalness, AO, edge sheen
   allowed). Codes: 0 smooth · 0.25 brushed round the part's Z · 0.5 paint grain (triplanar) · 0.58 perforation · 0.66 foil
   · 0.75 / 0.85 diamond knurl round Z / X · 1 tile A (open-cell foam or pebbled leather). Grain is sampled in part space
   (meshopt quantises each mesh into its own unit volume; uQ undoes that per mesh).
   The phone's opt-ins (glass layers: strip env, glassBoxes analytic softboxes, glassMask, glassFade, glassKeyK; screen,
   screenGlow, screenMesh; pcb; codes 0.58 / 0.66; envExtra; smoothSpec; poseStart / poseEx; rotT; hideAssembled;
   fitTransparent; hugDepth; localLight, a near diffuse-only light; the 'coat' studio) are .lab/kit3d/phone's, unchanged.
   The console's dialect (config dialect: 'console'; folded from its own fork, .lab/kit3d/mixer/mixer3d.js, unchanged in
   look): its GLB encodes _PBR.w as emission (backlit keys, divided back out of the exposure ramp) and carries _KUV, a
   planar mm frame per face, so its uber shader (console { grainScale, grainStr, turn, turnSlope, brush, emit, glow,
   screen }) draws real knurl facets (0.25), brushing along _KUV (0.33 … 0.42), turned tops with their radial streak (0.75)
   and its satin grain (0.5); 'glow' cards are light-only additive spill (glowSep: the LEDs' halo shows as the plate lifts
   off them); 'sheenGlass' is the LCD's cover glass, Fresnel × one analytic softbox (sheen { dir, u, len, wid, soft, i },
   studio frame: a crisp band); 'lcd' an emissive panel with no studio and no direct light; 'board' its PCB. */
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
const LIGHT_REF_AZ = -38;       // the studio is built for the camera's hero view (az -38): it turns with every view

export const P_RANGES = { orbit: [0, 0.40], hand: [0.40, 0.52], explode: [0.52, 0.90], hold: [0.90, 1] };
/** p (0 … 1) -> the phases (each 0 … 1) */
export function phasesAt(p) {
  return { orbit: seg(p, ...P_RANGES.orbit), hand: easeIO(seg(p, ...P_RANGES.hand)), explode: 0.5 - 0.5 * Math.cos(Math.PI * seg(p, ...P_RANGES.explode)), settle: smooth(seg(p, ...P_RANGES.hold)) };
}
export const LEAD = { ne: -38, nw: -142, se: 38, sw: 142, n: -90, s: 90, e: 0, w: 180 };
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
void main(){ vec4 t = texture2D(tHDR, vUv); gl_FragColor = vec4(pow(oetf(aces(t.rgb)), vec3(lift)), clamp(t.a, 0.0, 1.0)); }`;   // lift: the camera's mid-tone grade; a = coverage
const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLEND_FRAG = 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }';   // running mean of premultiplied rgba (constant-alpha blend)
const COPY_FRAG = /* glsl */`
uniform sampler2D t; uniform float fade; uniform float keyOn; uniform vec3 keyC; uniform vec3 keyE; uniform vec4 keyRect; varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main(){
  vec4 s = texture2D(t, vUv);
  vec3 c = s.rgb;
  if (keyOn > 0.0) {                 // teardowns.js keyBg: centred on the slot rect, radii 0.62 w x 0.74 h, display-referred
    vec2 d = (gl_FragCoord.xy - keyRect.xy - keyRect.zw * 0.5) / (keyRect.zw * vec2(0.62, 0.74) + 1.0);
    c += mix(keyC, keyE, smoothstep(0.0, 1.0, length(d))) * keyOn * (1.0 - s.a);
  }
  c *= fade; c += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * fade; gl_FragColor = vec4(c, 1.0);
}`;
const ID_VERT = '#include <common>\nvoid main(){\n#include <begin_vertex>\n#include <project_vertex>\n}';
const ID_FRAG = 'uniform float pid; void main(){ gl_FragColor = vec4(pid / 255.0, 0.0, 0.0, 1.0); }';
const NOISE_GLSL = /* glsl */`
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z) * 2.0 - 1.0;
}`;
const hexRGB = (h) => { const m = String(h).replace('#', ''); return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255); };
const warmedReadback = new WeakSet();   // renderers whose read-back path is built (once per page, not once per device)
// (console) light-only additive cards: the backlit keys' and the LEDs' spill (coverage alpha untouched)
const GLOW_VERT = /* glsl */`
attribute vec4 color; varying vec4 vC;
void main(){ vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GLOW_FRAG = /* glsl */`
uniform float gain; uniform float fade; varying vec4 vC;
void main(){ gl_FragColor = vec4(vC.rgb * vC.a * gain * fade, 0.0); }`;

/* the targets every device of one host draws through (one sample at a time: HDR -> bloom -> tone map -> the device's own
   running mean), so several loaded devices cost one set: the HDR MSAA target, the 8-bit tone-mapped target, the bloom chain */
export function createPool() {
  const P = { hdr: null, ldr: null, bloom: null };
  P.size = (w, h, msaa, Bloom, L) => {
    if (!P.hdr || P.hdr.samples !== msaa) { P.hdr?.dispose(); P.hdr = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa }); }
    else P.hdr.setSize(w, h);
    if (!P.ldr) P.ldr = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
    else P.ldr.setSize(w, h);
    if (Bloom && !P.bloom) P.bloom = new Bloom(new THREE.Vector2(w, h), L.bloomStrength, 0.25, L.bloomThreshold);
    else if (P.bloom) P.bloom.setSize(w, h);
    return P;
  };
  P.dispose = () => { P.hdr?.dispose(); P.ldr?.dispose(); P.bloom?.dispose?.(); P.hdr = P.ldr = P.bloom = null; };
  return P;
}

export function create(ctx = {}, opts = {}) {
  const C = opts.config;
  if (!C) throw new Error('kit3d: opts.config');
  const L = { key: 10, rim: 3.5, kick: 0.7, xfill: 2.4, env: 0.5, envRamp: 0.25, softbox: 1.6, fill: 0.16, sideStrip: 0.9, exposure: 1.0, expRamp: 0.15, albedo: 0.85, lift: 0.9, bloomStrength: 0.05, bloomThreshold: 4.0, ...(C.light || {}) };
  for (const k of [...Object.keys(L), 'softboxTint', 'fillTint', 'rimStrip', 'overhead', 'kickPanel', 'softboxPos']) if (opts[k] !== undefined) L[k] = opts[k];     // lab overrides
  const base = opts.base ?? C.base ?? './';
  const mobile = opts.mobile ?? !!ctx.still;      // the phone/still path only: a short desktop window keeps the desktop model
  const tier = opts.tier ?? ctx.tier ?? 2;
  const reduced = opts.reduced ?? ctx.reduced ?? false;
  const Q = {
    shadows: opts.shadows ?? (mobile ? 0 : tier >= 2 ? 2048 : 1024),
    msaa: opts.msaa ?? (mobile ? 2 : 4),           // 2 as well when dpr >= 1.5 (setSize): the idle accumulation finishes the AA
    bloom: !mobile && tier >= 2 && opts.bloom !== false,
    acc: opts.acc ?? (mobile ? 4 : tier >= 2 ? 12 : 6),
    scale: opts.scale ?? 1,                          // phones: min(0.8, 1.6 / dpr), set in setSize
    paintGrain: opts.paintGrain ?? (!mobile && tier >= 2),
  };
  const U = C.unitsMM ?? 177;
  const file = opts.file ?? (mobile ? C.mobileFile : C.file);
  const KEYS = C.keys;
  const scene = new THREE.Scene();
  scene.background = null;              // cleared to transparent black per sample: alpha = coverage (setKey, renderTexture)
  const camera = new THREE.PerspectiveCamera(16, 16 / 9, 0.1, 80);
  let renderer = ctx.renderer || null;
  let W = 16, H = 16, vw = typeof innerWidth !== 'undefined' ? innerWidth : 1, vh = typeof innerHeight !== 'undefined' ? innerHeight : 1, dpr = 1;
  let model = null, root = null, loaded = false, disposed = false;
  const parts = [], screws = [], anchorDefs = [], samples = [], envMats = [], meshes = [], hinges = [], glassParts = new Set();
  let ph = { orbit: 0, hand: 0, explode: 0, settle: 0 };
  let rect = null;
  const ptr = new THREE.Vector2(), ptrS = new THREE.Vector2();
  let dirty = true, accN = 0, lastSig = '', posedSig = '';
  let rtHDR = null, rtLDR = null, accRT = null, idRT = null, Bloom = null, bloom = null, envs = null, lastInfo = null, tiles = null;
  let scaleNow = Q.scale, msaaNow = Q.msaa;
  const off = { az: 0, el: 0 };
  const zm = { k: 1, x: 0, y: 0 };    // setZoom: the framed rect scaled by k, then moved by (x, y) css px (drag3d's zoom)
  const lights = {};
  let exOverride = null;              // lab art direction: { part: { ex: [mm], rot: [deg] } }
  let forceShow = false;              // (phone) the prewarm draws the hidden internals too
  let poseFor = null;
  const key = { on: 0, c: [0, 0, 0], e: [0, 0, 0], hand: false };
  const pool = opts.pool || null;     // shared HDR / LDR / bloom targets (createPool): the host's; this device's own running mean
  // (console) its dialect: the uber shader of its GLB (emission in _PBR.w, _KUV frames), glow cards, the sheen glass, the LCD
  const CON = C.dialect === 'console' ? { grainScale: 0.055, grainStr: 0.022, turn: 0.12, turnSlope: 0.32, brush: 1.0, emit: 2.0, glow: 0.34, screen: 1.25, ...(C.console || {}), ...(opts.console || {}) } : null;
  const uberShaders = [], glows = [];
  let lcdMat = null;
  const envRot = new THREE.Matrix3(), _m4 = new THREE.Matrix4();

  // ---------------------------------------------------------------- post (fullscreen quads)
  const quad = (frag, uniforms, extra = {}) => {
    const m = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); mesh.frustumCulled = false;
    const sc = new THREE.Scene(); sc.add(mesh);
    return { m, sc };
  };
  const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const outQ = quad(OUT_FRAG, { tHDR: { value: null }, exposure: { value: L.exposure }, lift: { value: L.lift } });
  const blendQ = quad(BLEND_FRAG, { t: { value: null } }, { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.ConstantAlphaFactor, blendDst: THREE.OneMinusConstantAlphaFactor,
    blendSrcAlpha: THREE.ConstantAlphaFactor, blendDstAlpha: THREE.OneMinusConstantAlphaFactor, premultipliedAlpha: true });
  const copyQ = quad(COPY_FRAG, { t: { value: null }, fade: { value: 1 }, keyOn: { value: 0 }, keyC: { value: new THREE.Vector3() }, keyE: { value: new THREE.Vector3() }, keyRect: { value: new THREE.Vector4(0, 0, 1, 1) } });
  const idMat = new THREE.ShaderMaterial({ vertexShader: ID_VERT, fragmentShader: ID_FRAG, uniforms: { pid: { value: 0 } }, side: THREE.DoubleSide });

  // ---------------------------------------------------------------- studio (the camera's v5)
  /* kind: 'main' (the opaque parts), 'shiny' (polished films: the main studio, sharper, softbox at 0.6), 'metal' (one broad
     soft card low and front-right where a face turned to the exploded view mirrors it, the overhead strip, a small key);
     camera-only: 'glass', 'free' */
  function studioEnv(kind) {
    const env = new THREE.Scene();
    // (phone) 'coat': the shiny studio inside a dim dome, so a coated element always has something to tint (a thin film
    // over a black mirror shows nothing: the covers read as voids)
    env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: kind === 'coat' ? new THREE.Color(C.coatDome ?? 0x16161b) : 0x000000, side: THREE.BackSide })));
    const panel = (w, l, pos, look, along, intensity, tint = 0xffffff) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide }));
      const p = new THREE.Vector3(...pos), n = new THREE.Vector3(...look).sub(p).normalize();
      const a = new THREE.Vector3(...along); a.addScaledVector(n, -a.dot(n)).normalize();
      const s = new THREE.Vector3().crossVectors(a, n);
      m.matrixAutoUpdate = false; m.matrix.makeBasis(s, a, n).setPosition(p); env.add(m);
    };
    if (kind === 'metal') {
      const mc = C.metalCard || {};
      panel(...(mc.size ?? [9.0, 6.0]), mc.pos ?? [5.0, -2.8, 4.4], [0, 0, 0], [0, 1, 0], mc.card ?? 0.55, 0xf4f6fa);
      panel(0.45, 10.0, [-0.6, 7.0, 1.2], [0, 0, 0.3], [0, 0, 1], mc.strip ?? 1.4, 0xffffff);
      panel(3.0, 2.0, [-4.6, 5.0, 3.6], [0, 0, 0], [1, 0, 0], mc.key ?? 0.8, 0xfbfcff);
    } else if (kind === 'free') {
      panel(1.1, 4.2, [5.2, -0.6, 4.8], [0, 0.2, 0], [0, 1, 0], 1.6, 0xf6fbff);
      panel(4.4, 0.9, [-4.2, 5.6, 4.6], [0, 0, 0], [1, 0, 0], 1.1, 0xfbfcff);
      panel(12.0, 9.0, [2.5, 1.0, 7.5], [0, 0, 0], [0, 1, 0], L.freeVeil ?? 0.18, 0xe6f2ea);
      panel(0.45, 10.0, [-0.6, 7.0, 1.2], [0, 0, 0.3], [0, 0, 1], 1.6, 0xffffff);
    } else if (kind === 'glass') {
      panel(6.0, 5.0, [3.4, 0.6, 7.2], [0, 0, 0], [0, 1, 0], 0.8, 0xfbfcff);
      panel(3.0, 2.0, [-4.6, 5.0, 3.6], [0, 0, 0], [1, 0, 0], 0.6, 0xfbfcff);
      panel(0.45, 10.0, [-0.6, 7.0, 1.2], [0, 0, 0.3], [0, 0, 1], 2.4, 0xffffff);
      panel(2.6, 1.8, [4.6, 0.6, 5.0], [0, 0.1, 0], [0, 1, 0], 0.30, 0xf2f6ff);
    } else {
      panel(7.0, 4.6, L.softboxPos ?? [-3.6, 7.0, 3.4], [0, 0, 0], [1, 0, 0], L.softbox * (kind === 'shiny' || kind === 'coat' ? 0.6 : 1), L.softboxTint ?? 0xfdfcfa);   // large high key softbox, front-left
      panel(0.5, 13, [-0.5, 6.5, 0.4], [0, 0, 0.2], [0, 0, 1], L.overhead ?? 4.5, 0xffffff);       // overhead strip along the view's depth axis
      panel(0.55, 12, [0.6, 4.4, -6.2], [0, 0.3, 0], [1, 0, 0], L.rimStrip ?? 3.2, 0xe9f0ff);      // strip behind, across X (rims)
      panel(5.0, 1.2, [4.4, -2.6, -0.2], [0, 0.3, 0], [0.3, 0, 1], L.kickPanel ?? 0.35, 0xffd6b0);   // warm kicker: low, camera-right, a little behind
      panel(0.25, 9.0, [-6.5, 2.4, -1.5], [0, 0.3, 0], [0, 1, 0.1], L.sideStrip, 0xf4f6ff);  // thin side strip: edge lines
      panel(9.0, 5.5, [-4.3, 1.4, 6.6], [0, 0.2, 0], [0, 1, 0], L.fill, L.fillTint ?? 0xf6f4f0);           // broad, low frontal fill (mid-tones)
      if (kind === 'main') for (const x of C.envExtra ?? []) panel(x.w, x.l, x.pos, x.look ?? [0, 0, 0], x.along ?? [1, 0, 0], x.k, x.tint ?? 0xffffff);   // (phone) extra cards
    }
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, kind === 'main' ? 0.02 : kind === 'shiny' || kind === 'coat' ? 0.006 : 0.03, 0.1, 100, { size: 256 });   // 256: ~6 MB each
    pm.dispose();
    env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    return rt;                         // the render target: dispose() frees it (its .texture alone would leak)
  }
  /* (phone) the glass layers' own environment: black, one long soft strip (config strip: phoneA3's broad diagonal band)
     and a faint wash, so a cover glass reads as one sheet with one sheen; it turns with the view like the studio */
  function stripEnv() {
    const S = C.strip ?? {};
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x0b0b0c).multiplyScalar(S.dome ?? 1), side: THREE.BackSide })));
    const add = (w, l, pos, look, along, k, soft) => {
      const g = new THREE.PlaneGeometry(w, l, 1, 8);
      const cols = []; const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const v = pa.getY(i) / (l / 2); const f = Math.pow(Math.max(0, 1 - v * v), soft ?? 0.6); cols.push(f, f, f); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfbfaf8).multiplyScalar(k), vertexColors: true, side: THREE.DoubleSide }));
      const p = new THREE.Vector3(...pos), n = new THREE.Vector3(...look).sub(p).normalize();
      const a = new THREE.Vector3(...along); a.addScaledVector(n, -a.dot(n)).normalize();
      const sv = new THREE.Vector3().crossVectors(a, n);
      m.matrixAutoUpdate = false; m.matrix.makeBasis(sv, a, n).setPosition(p); env.add(m);
    };
    add(S.w ?? 4.2, S.l ?? 18, S.pos ?? [-3.8, 6.0, 4.0], [0, 0, 0], S.along ?? [1, 0.2, -0.6], S.k ?? 6.0, S.soft);
    if (S.wash !== 0) add(9, 7, S.washPos ?? [3.5, 5.5, -4.0], [0, 0, 0], [0, 1, 0], S.wash ?? 0.6, 1.0);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0.04, 0.1, 100, { size: 256 });
    pm.dispose(); env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    return rt;
  }
  /* (phone) config.glassBoxes: up to 3 rectangular softboxes at a finite distance, reflected analytically by the cover
     glass (a ray-rectangle test per pixel: the reflection has parallax and a shape, phoneA3's band). 'pre' boxes sit in
     the studio frame round the fit's centre; 'ex' boxes with rel: true sit on the glass's own mirror direction (offset
     by dir in that frame), so they reach it in any pose. Weights crossfade over the explode (glassFade). */
  const NB = 3;
  const boxU = { uBC: { value: Array.from({ length: NB }, () => new THREE.Vector3()) }, uBU: { value: Array.from({ length: NB }, () => new THREE.Vector3()) },
    uBV: { value: Array.from({ length: NB }, () => new THREE.Vector3()) }, uBK: { value: Array.from({ length: NB }, () => new THREE.Vector4()) },
    uMaskR: { value: new THREE.Vector4(0, 0, 0, 0) } };
  const _bc = new THREE.Vector3(), _bu = new THREE.Vector3(), _bv = new THREE.Vector3(), _bn = new THREE.Vector3(), _up = new THREE.Vector3(), _gp = new THREE.Vector3(), _gn = new THREE.Vector3(), _gv = new THREE.Vector3();
  const _cu = new THREE.Vector3(), _cv = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
  const fitC = new THREE.Vector3();
  let glassNode = null;
  /* (phone) config.localLight: a near light that adds diffuse only (in the uber shader, view space), so a flat rough face
     gets a soft gradient (the frosted rear glass) that a light at infinity cannot give, without the sharp specular points
     a point light leaves on glossy faces and rolled edges (single-pixel glints while scrubbing). Its position and level
     ease over the orbit's opening and, with localLight.hold, over the explode. */
  const localU = { uLLPos: { value: new THREE.Vector3() }, uLLK: { value: 0 }, uLLC: { value: new THREE.Color() } };
  function updateBoxes(az) {
    const B = C.glassBoxes; if (!B) return;
    const a = (az - LIGHT_REF_AZ) * D, V = camera.matrixWorldInverse, pr = portrait();
    const [f0, f1] = C.glassFade ?? [0.15, 0.55];
    const wEx = smooth(clamp01((ph.explode - f0) / (f1 - f0))), keyK = key.on ? (C.glassKeyK ?? 0.6) : 1;
    let i = 0;
    for (const b of B) {
      if (i >= NB) break;
      if (b.tall !== undefined && b.tall !== pr) continue;
      const w = b.when === 'ex' ? wEx * keyK : b.when === 'pre' ? 1 - wEx : 1;
      _bn.set(...b.dir).normalize();
      if (b.rel && glassNode) {
        // the glass's mirror direction at its centre (world), then the box's offset in that frame
        glassNode.getWorldPosition(_gp); _gn.set(0, 0, 1).transformDirection(glassNode.matrixWorld);
        _gv.copy(camera.position).sub(_gp).normalize();
        const R = _gn.clone().multiplyScalar(2 * _gn.dot(_gv)).sub(_gv).normalize();
        const e1 = new THREE.Vector3().crossVectors(_Y, R).normalize(), e2 = new THREE.Vector3().crossVectors(R, e1);
        const dir = R.clone().multiplyScalar(_bn.z).addScaledVector(e1, _bn.x).addScaledVector(e2, _bn.y).normalize();
        _up.copy(e2); _bu.crossVectors(_up, dir).normalize(); _bv.crossVectors(dir, _bu);
        const r = (b.rot ?? 0) * D;
        _cu.copy(_bu).multiplyScalar(Math.cos(r)).addScaledVector(_bv, Math.sin(r)); _cv.copy(_bv).multiplyScalar(Math.cos(r)).addScaledVector(_bu, -Math.sin(r));
        _bc.copy(dir).multiplyScalar(b.dist).add(_gp);
      } else {
        _up.set(0, 1, 0); if (Math.abs(_bn.y) > 0.95) _up.set(0, 0, 1);
        _bu.crossVectors(_up, _bn).normalize(); _bv.crossVectors(_bn, _bu);
        const r = (b.rot ?? 0) * D;
        _cu.copy(_bu).multiplyScalar(Math.cos(r)).addScaledVector(_bv, Math.sin(r)).applyAxisAngle(_Y, a);
        _cv.copy(_bv).multiplyScalar(Math.cos(r)).addScaledVector(_bu, -Math.sin(r)).applyAxisAngle(_Y, a);
        _bc.copy(_bn).multiplyScalar(b.dist).applyAxisAngle(_Y, a).add(fitC);
      }
      boxU.uBC.value[i].copy(_bc.applyMatrix4(V));
      boxU.uBU.value[i].copy(_cu.transformDirection(V)).multiplyScalar(b.w / 2);
      boxU.uBV.value[i].copy(_cv.transformDirection(V)).multiplyScalar(b.h / 2);
      boxU.uBK.value[i].set(b.k * w * (opts.boxK ?? 1), b.soft ?? 0.3, b.fall ?? 1.0, 0);
      i++;
    }
    for (; i < NB; i++) boxU.uBK.value[i].set(0, 0, 0, 0);
  }
  function patchGlass(m, boxes, dq) {   // the camera's: a glass layer shows only its environment (no direct key highlight)
    const gm = C.glassMask;               // { hw, hh, r (model units: the printed border's inner edge), k (the layer over it), soft }
    m.onBeforeCompile = (sh) => {
      let rep = '#include <aomap_fragment>\n\treflectedLight.directSpecular *= 0.0; reflectedLight.directDiffuse *= 0.0;';
      if (boxes) {
        Object.assign(sh.uniforms, boxU, { uGQ: { value: new THREE.Vector4(...dq) } });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec4 uGQ; varying vec3 vGObj;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGObj = position * uGQ.w + uGQ.xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uBC[3]; uniform vec3 uBU[3]; uniform vec3 uBV[3]; uniform vec4 uBK[3]; uniform vec4 uMaskR; varying vec3 vGObj;');
        rep += `
        {
          vec3 P = -vViewPosition, I = normalize(P), Nn = normalize(normal);
          vec3 R = reflect(I, Nn);
          float NoV = clamp(dot(Nn, -I), 0.0, 1.0);
          float F = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
          float add = 0.0;
          for (int i = 0; i < 3; i++) {
            if (uBK[i].x <= 0.0) continue;
            vec3 U = uBU[i], V = uBV[i], Nb = normalize(cross(U, V));
            float den = dot(R, Nb);
            if (abs(den) < 1e-4) continue;
            float t = dot(uBC[i] - P, Nb) / den;
            if (t <= 0.0) continue;
            vec3 X = P + t * R - uBC[i];
            float a = dot(X, U) / dot(U, U), b = dot(X, V) / dot(V, V), sft = uBK[i].y;
            float mk = (1.0 - smoothstep(1.0 - sft, 1.0, abs(a))) * (1.0 - smoothstep(1.0 - sft, 1.0, abs(b)));
            add += mk * pow(max(0.0, 1.0 - a * a), uBK[i].z) * uBK[i].x;
          }
          reflectedLight.indirectSpecular += add * F * vec3(1.0, 0.995, 0.985);
          if (uMaskR.w > 0.0) {         // over the printed black border the layer is weaker: the border reads on every edge
            vec2 q = abs(vGObj.xy) - (uMaskR.xy - uMaskR.z);
            float dm = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uMaskR.z;
            reflectedLight.indirectSpecular *= mix(1.0, uMaskR.w, smoothstep(-0.0012, 0.0012, dm));
          }
        }`;
      }
      sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', rep);
    };
    if (boxes && gm) boxU.uMaskR.value.set(gm.hw, gm.hh, gm.r, gm.k ?? 0.4);
    m.customProgramCacheKey = () => 'kit3d-glass-1' + (boxes ? 'b' : '');
    m.needsUpdate = true;
  }
  /* (phone) the screen: an emissive panel (its glow keyed by phase) with an optional sub-pixel mesh through normal and
     roughness (an OLED's pixel grid in the panel's UV space, fading out below a pixel like the perforation) */
  const screenU = { uSMesh: { value: new THREE.Vector3(0, 0, 0) } };
  let screenMat = null;
  function patchScreen(m) {
    const sm = C.screenMesh;
    if (sm) screenU.uSMesh.value.set(C.screenUV?.[0] ?? 1, C.screenUV?.[1] ?? 1, sm.str ?? 0.5);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, screenU);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSMesh; uniform mat3 normalMatrix;')
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float meshCav = 1.0; vec2 meshG = vec2(0.0); float meshK = 0.0;
        #ifdef USE_EMISSIVEMAP
        if (uSMesh.z > 0.0) {
          vec2 pp = vEmissiveMapUv * uSMesh.xy;          // cells (uSMesh.xy = the panel's size in cells)
          vec2 fw = fwidth(pp);
          meshK = 1.0 - smoothstep(0.22, 0.5, max(fw.x, fw.y));
          meshG = fract(pp) - 0.5;
          float ridge = max(smoothstep(0.30, 0.48, abs(meshG.x)), smoothstep(0.30, 0.48, abs(meshG.y))) * meshK;
          meshCav = 1.0 - 0.5 * ridge;
          roughnessFactor = clamp(roughnessFactor + ridge * 0.3, 0.0, 1.0);
        }
        #endif`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (meshK > 0.0) normal = normalize(normal + normalMatrix * vec3(meshG.x, -meshG.y, 0.0) * uSMesh.z * meshK);   // each cell a faint lenslet`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        reflectedLight.indirectSpecular *= mix(1.0, meshCav, 0.7);
        reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(${(C.specClamp ?? 2.5).toFixed(2)}));`);
    };
    m.customProgramCacheKey = () => 'kit3d-screen-1';
    m.needsUpdate = true;
  }
  function buildLights() {
    const k = new THREE.DirectionalLight(0xffffff, L.key);
    k.position.set(-4, 3.2, 5);
    if (Q.shadows) {
      const sb = C.shadowBox ?? 2.2;
      k.castShadow = true;
      k.shadow.mapSize.set(Q.shadows, Q.shadows);
      k.shadow.radius = 3;
      Object.assign(k.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 1, far: 16 });
      k.shadow.bias = -0.0003; k.shadow.normalBias = 0.008;
    }
    const rim = new THREE.DirectionalLight(0xe6eeff, L.rim); rim.position.set(0.8, 4.4, -6.0);
    const kick = new THREE.DirectionalLight(0xffc89a, L.kick); kick.position.set(4.2, -2.4, 0.2);   // low, camera-right: undersides, inner faces
    const xfill = new THREE.DirectionalLight(0xfff8f0, 0); xfill.position.set(-1.0, 5.0, 4.0);       // explode only: top-front fill for the internals
    scene.add(k, k.target, rim, kick, xfill);
    Object.assign(lights, { key: k, rim, kick, xfill, keyI: k.intensity, kickI: kick.intensity, base: [k, rim, kick, xfill].map((l) => ({ l, p: l.position.clone() })) });
    if (C.localLight) {                // (phone) a near light in the studio frame, round the fit's centre (see localU)
      lights.local = { intensity: 0, position: new THREE.Vector3() }; lights.localP = new THREE.Vector3(...C.localLight.pos);
      localU.uLLC.value.set(C.localLight.color ?? 0xf4f6fa);
    }
  }
  const _yAxis = new THREE.Vector3(0, 1, 0);
  function turnLights(az) {
    const a = (az - LIGHT_REF_AZ) * D;
    for (const { l, p } of lights.base) l.position.copy(p).applyAxisAngle(_yAxis, a);
    // camera-only (config): lift the key towards the zenith round one azimuth (the camera's EVF facet), dip it, dip the env
    const lift = (C.keyLift ?? 0) * D * Math.exp(-(((az - (C.keyLiftAz ?? -94)) / 26) ** 2));
    if (lift > 1e-4) {
      const k = lights.key.position, r = k.length(), h = Math.hypot(k.x, k.z), el0 = Math.atan2(k.y, h), el = Math.min(Math.PI / 2 - 0.05, el0 + lift);
      k.set(k.x / h * r * Math.cos(el), r * Math.sin(el), k.z / h * r * Math.cos(el));
    }
    scene.environmentRotation.set(0, a, 0);
    for (const m of envMats) m.envMapRotation.set(0, a, 0);
    lights.key.intensity = lights.keyI * (1 - (C.keyDip ?? 0) * Math.exp(-(((az - (C.keyDipAz ?? -90)) / (C.keyDipW ?? 22)) ** 2)));
    lights.xfill.intensity = L.xfill * smooth(ph.explode);
    if (lights.local) {
      const LL = C.localLight;
      // over the opening; and (LL.hold) a second position it moves to over the explode, for the hold's flat faces
      const kh = LL.hold ? smooth(ph.explode) : 0;
      lights.local.intensity = (LL.k ?? 1) * (1 - smooth(clamp01(ph.orbit / (LL.until ?? 0.5)))) * (1 - ph.explode) + (LL.hold?.k ?? 0) * kh;
      if (LL.hold && !lights.localH) lights.localH = new THREE.Vector3(...LL.hold.pos);
      lights.local.position.copy(lights.localP);
      if (LL.hold) lights.local.position.lerp(lights.localH, kh);
      lights.local.position.applyAxisAngle(_yAxis, a).add(fitC);
    }
    lights.kick.intensity = lights.kickI * (1 - (C.kickFade ?? 0.75) * smooth(ph.explode));
    scene.environmentIntensity = L.env * (1 + L.envRamp * ph.explode) * (1 - (C.envDip ?? 0) * Math.exp(-(((az - (C.envDipAz ?? -95)) / 20) ** 2)));
    envRot.setFromMatrix4(_m4.makeRotationY(-a));          // world -> studio frame (the PMREM's convention): the console's analytic sheen
    if (C.shadowFade && lights.key.castShadow) {
      // (console) the internals' shadows on the tray fade as they lift away (an open tray reads as a lit satin tub, mixerB)
      const SF = C.shadowFade, k = smooth(clamp01((ph.explode - SF.t[0]) / (SF.t[1] - SF.t[0])));
      lights.key.shadow.intensity = 1 - SF.k * k;
      for (const p of parts) if (SF.parts.test(p.name)) p.node.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData.cast0 === undefined) o.userData.cast0 = o.castShadow;
        o.castShadow = o.userData.cast0 && ph.explode < SF.castUntil;
      });
    }
  }
  function lightSources() {             // (console) the lit keys keep their look through the explode's exposure ramp
    const k = 1 / (1 + L.expRamp * ph.explode);
    for (const sh of uberShaders) sh.uniforms.uEmitK.value = k;
    for (const g of glows) g.m.uniforms.gain.value = CON.glow * k;
    if (lcdMat) lcdMat.emissiveIntensity = CON.screen * k;
  }

  // ---------------------------------------------------------------- the uber material: per-vertex PBR + surface codes
  function patchUber(m, dq) {
    m.vertexColors = true;
    m.normalMap = null; m.aoMap = null; m.emissiveMap = null; m.emissive?.setRGB(0, 0, 0);   // the tiles live on in `tiles`: dispose() frees them
    m.roughness = 1; m.metalness = 1;
    m.clearcoat = 0;                       // no clearcoat lobe (it doubled the specular cost); _PBR.w = edge sheen allowed
    const leather = C.tileA === 'leather';
    m.defines = { ...(m.defines || {}), ...(Q.paintGrain ? { PAINT_GRAIN: '' } : {}), ...(leather ? { TILE_LEATHER: '' } : {}) };
    const cav = C.foamCav ?? [0.18, 1.65];
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, {
        tTileA: { value: tiles.a }, tGrain: { value: tiles.grain }, tBrush: { value: tiles.brushed || tiles.grain },
        uAlbedo: { value: L.albedo }, uMM: { value: U },
        uAScale: { value: leather ? (C.leatherScale ?? 0.48) : (C.foamTileMM ?? 11) / U }, uAStr: { value: leather ? (C.leatherStr ?? 1.3) : (opts.foamStr ?? C.foamStr ?? 1.0) },
        uGScale: { value: (C.grainTileMM ?? 9) / U }, uGStr: { value: C.grainStr ?? 0.06 }, uGRough: { value: C.grainRough ?? 0.6 },
        uBScale: { value: 14 / U }, uBStr: { value: C.brushStr ?? 0.18 }, uBRough: { value: C.brushRough ?? 0.6 }, uBEnv: { value: C.brushEnv ?? 1.0 },
        uKP: { value: (C.knurlMM ?? 1.1) / U }, uKD: { value: C.knurlDepth ?? 0.75 },
        uSkin: { value: (C.foamSkinMM ?? 0) / U }, uSkinRim: { value: (C.foamSkinRimMM ?? C.foamSkinMM ?? 0) / U }, uSkinF: { value: U / 2.0 },
        uQ: { value: new THREE.Vector4(...dq) }, uSheen: { value: opts.foamSheen ?? C.foamSheen ?? 0.03 }, uFoamSpec: { value: opts.foamSpec ?? C.foamSpec ?? 0.3 },
        uFRMin: { value: C.foamRoughMin ?? 0.5 }, uFCav: { value: new THREE.Vector2(cav[0], cav[1]) },
        uLRough: { value: C.leatherRough ?? 0.05 }, uLSpec: { value: C.leatherSpec ?? 0.32 }, uLF90: { value: C.leatherF90 ?? 0.75 },
        uEdge: { value: C.edgeSheen ?? 0.48 }, uSpecClamp: { value: C.specClamp ?? 2.5 },
        uPaintMob: { value: C.paintRoughMobile ?? 0.15 }, uPaintMobEnv: { value: C.paintEnvMobile ?? 0.75 },
        // (phone) foil (0.66) and perforation (0.58) codes, the grain's roughness floor and its specular clamp, smoothSpec
        uFoilScale: { value: (C.foilTileMM ?? 24) / U }, uFoilStr: { value: opts.foilStr ?? C.foilStr ?? 1.0 }, uFoilSheen: { value: C.foilSheen ?? 0.0 }, uPerf: { value: (C.perfMM ?? 0.9) / U },
        uGRMin: { value: C.grainRoughMin ?? 0.05 }, uGClamp: { value: C.grainSpecClamp ?? (C.specClamp ?? 2.5) }, uSmoothSpec: { value: opts.smoothSpec ?? C.smoothSpec ?? 1.0 },
      }, localU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 _pbr; varying vec4 vPbr; varying vec3 vObjPos; varying vec3 vObjN; uniform float uSkin; uniform float uSkinRim; uniform float uSkinF; uniform vec4 uQ;\n' + NOISE_GLSL)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          // part space (mesh quantisation scaled and offset each mesh into a unit volume: uQ undoes it)
          vec3 objp = position * uQ.w + uQ.xyz;
          vPbr = _pbr; vObjPos = objp; vObjN = normal;
          #ifdef USE_COLOR_ALPHA
          if (color.a > 0.95 && uSkinRim > 0.0) {   // foam: a soft noise skin, stronger where the surface turns away (the outline)
            vec3 vn = normalize(normalMatrix * normal);
            vec4 mvp = modelViewMatrix * vec4(position, 1.0);
            float rimk = 1.0 - abs(dot(vn, normalize(-mvp.xyz)));
            float amp = mix(uSkin, uSkinRim, smoothstep(0.55, 0.95, rimk));
            float d = vnoise(objp * uSkinF) * 0.75 + vnoise(objp * uSkinF * 2.6) * 0.3 + vnoise(objp * uSkinF * 7.0) * 0.18;
            transformed += normal * d * amp / uQ.w;
          }
          #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D tTileA; uniform sampler2D tGrain; uniform sampler2D tBrush; uniform float uAlbedo; uniform float uMM; uniform float uAScale; uniform float uAStr;
          uniform float uGScale; uniform float uGStr; uniform float uGRough; uniform float uBScale; uniform float uBStr; uniform float uBRough; uniform float uBEnv; uniform float uKP; uniform float uKD;
          uniform float uSheen; uniform float uFoamSpec; uniform float uFRMin; uniform vec2 uFCav; uniform float uLRough; uniform float uLSpec; uniform float uLF90;
          uniform float uEdge; uniform float uSpecClamp; uniform float uPaintMob; uniform float uPaintMobEnv;
          uniform float uFoilScale; uniform float uFoilStr; uniform float uFoilSheen; uniform float uPerf; uniform float uGRMin; uniform float uGClamp; uniform float uSmoothSpec;
          uniform vec3 uLLPos; uniform float uLLK; uniform vec3 uLLC;
          uniform mat3 normalMatrix;
          varying vec4 vPbr; varying vec3 vObjPos; varying vec3 vObjN;
          float knurlTri(float x){ return 1.0 - 2.0 * abs(fract(x) - 0.5); }`)
        .replace('#include <color_fragment>', '#include <color_fragment>\n\tfloat grain = vColor.a; diffuseColor.a = 1.0; diffuseColor.rgb *= uAlbedo; float cavity = 1.0; float envDim = 1.0; float specCap = uSpecClamp; float foilH = -1.0;')
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * vPbr.x;
        {
          // the camera's v5 edge sheen: the surface's bend measured per pixel (rad per mm, from the interpolated normal):
          // fillets and rounded edges turn glossier and the key draws a thin crisp line on them; flat faces keep their roughness
          vec3 gn = normalize(vNormal);
          float kx = length(dFdx(gn)) / max(length(dFdx(vViewPosition)), 1e-7), ky = length(dFdy(gn)) / max(length(dFdy(vViewPosition)), 1e-7);
          float bend = max(kx, ky) / uMM;
          roughnessFactor *= 1.0 - uEdge * vPbr.w * smoothstep(0.10, 0.55, bend);
        }`)
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vPbr.y;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 n0 = normalize(vObjN);
          bool tA = grain > 0.95;
          bool foil = grain > 0.62 && grain < 0.7;     // (phone) the pouch cell's wrinkle tile (tile A, its own scale)
          bool paint = grain > 0.45 && grain < 0.55;
          #ifndef PAINT_GRAIN
          // the phone path has no triplanar grain: the satin paint would turn into a smooth mirror; rougher, less env
          if (paint) { roughnessFactor = min(1.0, roughnessFactor + uPaintMob); envDim = uPaintMobEnv; }
          paint = false;
          #endif
          if (tA || paint || foil) {
            bool ta = tA || foil;
            float sc = tA ? uAScale : foil ? uFoilScale : uGScale, st = tA ? uAStr : foil ? uFoilStr : uGStr;
            vec3 bw = pow(abs(n0), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
            vec3 p = vObjPos / sc;
            vec2 a = p.zy, b = p.xz, c = p.xy;
            vec2 dax = dFdx(a), day = dFdy(a), dbx = dFdx(b), dby = dFdy(b), dcx = dFdx(c), dcy = dFdy(c);
            vec4 tx = ta ? textureGrad(tTileA, a, dax, day) : textureGrad(tGrain, a, dax, day);
            vec4 ty = ta ? textureGrad(tTileA, b, dbx, dby) : textureGrad(tGrain, b, dbx, dby);
            vec4 tz = ta ? textureGrad(tTileA, c, dcx, dcy) : textureGrad(tGrain, c, dcx, dcy);
            vec3 ax = vec3((tx.xy * 2.0 - 1.0) * st, 1.0), ay = vec3((ty.xy * 2.0 - 1.0) * st, 1.0), az = vec3((tz.xy * 2.0 - 1.0) * st, 1.0);
            vec3 wx = vec3(ax.xy + n0.zy, abs(ax.z) * n0.x).zyx;
            vec3 wy = vec3(ay.xy + n0.xz, abs(ay.z) * n0.y).xzy;
            vec3 wz = vec3(az.xy + n0.xy, abs(az.z) * n0.z);
            vec3 no = normalize(wx * bw.x + wy * bw.y + wz * bw.z);
            normal = normalize(normalMatrix * no) * faceDirection;
            float rr = tx.a * bw.x + ty.a * bw.y + tz.a * bw.z;
            if (foil) {
              foilH = rr; cavity = mix(0.84, 1.08, rr); roughnessFactor = clamp(roughnessFactor + (0.5 - rr) * 0.10, 0.05, 1.0);
            } else if (tA) {
              #ifdef TILE_LEATHER
              roughnessFactor = clamp(roughnessFactor + (rr - 0.5) + uLRough, 0.3, 0.95);
              #else
              cavity = mix(uFCav.x, uFCav.y, rr * rr); roughnessFactor = clamp(roughnessFactor + (0.5 - rr) * 0.12, uFRMin, 1.0);
              #endif
            } else { roughnessFactor = clamp(roughnessFactor + (rr - 0.5) * uGRough, uGRMin, 1.0); specCap = uGClamp; }
          } else if (grain > 0.15 && grain < 0.35) {
            // brushed round the part's Z axis (rings, pole faces, copper): streaks along the circumference
            float th = atan(vObjPos.y, vObjPos.x);
            float r = length(vObjPos.xy);
            vec2 uv = vec2(th * 0.5 / 3.14159265 * 6.0, (vObjPos.z + r * step(0.8, abs(n0.z))) / uBScale);
            vec2 gx = dFdx(uv), gy = dFdy(uv);
            if (abs(gx.x) > 3.0) gx.x -= sign(gx.x) * 6.0; if (abs(gy.x) > 3.0) gy.x -= sign(gy.x) * 6.0;
            vec4 t = textureGrad(tBrush, uv, gx, gy);
            vec3 tr = normalize(vec3(-vObjPos.y, vObjPos.x, 0.0) + 1e-6);
            vec3 ax2 = abs(n0.z) > 0.8 ? normalize(vec3(vObjPos.xy, 0.0) + 1e-6) : vec3(0.0, 0.0, 1.0);
            vec2 d = (t.xy * 2.0 - 1.0) * uBStr;
            vec3 no = normalize(n0 + ax2 * d.y + tr * d.x * 0.15);
            normal = normalize(normalMatrix * no) * faceDirection;
            roughnessFactor = clamp(roughnessFactor * (1.0 - 0.5 * uBRough + uBRough * t.a), 0.05, 1.0);
            envDim = uBEnv;                // brushed metals: an art-direction gain on the studio's reflection (config brushEnv)
          } else if (grain > 0.55 && grain < 0.62) {
            // (phone) perforation: a hex grid of round dimples in part XY (shield lids), on the faces that look along +-z;
            // fades out where the grid gets finer than a pixel
            if (abs(n0.z) > 0.7) {
              vec2 pp = vObjPos.xy / uPerf;
              vec2 rr2 = vec2(1.0, 1.7320508), hh = rr2 * 0.5;
              vec2 ga = mod(pp, rr2) - hh, gb = mod(pp - hh, rr2) - hh;
              vec2 g = dot(ga, ga) < dot(gb, gb) ? ga : gb;
              float d = length(g), rad = 0.24;
              float fw = max(fwidth(pp.x), fwidth(pp.y));
              float k = 1.0 - smoothstep(0.18, 0.45, fw);
              float inside = (1.0 - smoothstep(rad - fw, rad + fw, d)) * k;
              vec3 no = normalize(n0 + vec3(-g / rad * 1.1 * inside, 0.0));
              normal = normalize(normalMatrix * no) * faceDirection;
              cavity = mix(1.0, 0.42, inside);
              roughnessFactor = clamp(roughnessFactor + inside * 0.25, 0.05, 1.0);
            }
          } else if (grain > 0.7 && grain < 0.9) {
            // diamond knurl (two crossed helices), procedural; round the part's Z (0.75) or X axis (0.85)
            bool kx = grain > 0.8;
            vec3 ax = kx ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
            float w = dot(vObjPos, ax);
            vec3 q = vObjPos - ax * w;
            float r = length(q);
            vec3 e1 = kx ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), e2 = cross(ax, e1);
            float th = atan(dot(q, e2), dot(q, e1));
            float s = th * r;
            float u = (s + w) / uKP, v = (s - w) / uKP;
            float fw = max(fwidth(u), fwidth(v));
            float ku = knurlTri(u), kv = knurlTri(v);
            float gu = sign(fract(u) - 0.5), gv = sign(fract(v) - 0.5);
            float ds, dw;
            if (ku < kv) { ds = -gu; dw = -gu; } else { ds = -gv; dw = gv; }
            float k = uKD * (1.0 - smoothstep(0.35, 0.8, fw));           // fades where the pattern gets finer than a pixel
            vec3 tg = normalize(cross(ax, q) + 1e-6);
            vec3 nr = normalize(q + 1e-6);
            if (abs(dot(n0, nr)) > 0.6) {
              vec3 no = normalize(nr - (tg * ds + ax * dw) * k);
              normal = normalize(normalMatrix * no) * faceDirection;
              float h = min(ku, kv);
              cavity = mix(1.0, mix(0.55, 1.12, h), clamp(k / uKD, 0.0, 1.0));
              roughnessFactor = clamp(roughnessFactor + (1.0 - clamp(k / uKD, 0.0, 1.0)) * 0.18, 0.05, 1.0);
            }
          }
          diffuseColor.rgb *= cavity;
        }`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
          // r186 takes the direct F0 from specularColorBlended: scale both (the camera's v5 finding)
          if (grain > 0.95) {
            #ifdef TILE_LEATHER
            material.specularColor *= uLSpec; material.specularColorBlended *= uLSpec; material.specularF90 *= uLF90;
            #else
            material.specularColor *= uFoamSpec * cavity; material.specularColorBlended *= uFoamSpec * cavity; material.specularF90 *= uFoamSpec;   // open-cell foam traps the reflection
            #endif
          }`)
        .replace('#include <opaque_fragment>', `
          #ifndef TILE_LEATHER
          if (grain > 0.95) {               // foam: fibre fuzz at grazing angles (a soft sheen rim)
            float f = 1.0 - abs(dot(normalize(geometryNormal), normalize(geometryViewDir)));
            outgoingLight += vec3(0.95, 0.96, 1.0) * uSheen * pow(f, 2.2) * vPbr.z;
          }
          #endif
          if (foilH >= 0.0 && uFoilSheen > 0.0) {   // (phone) the pouch's laminate: a soft rim sheen that follows the wrinkles
            float f = 1.0 - abs(dot(normalize(normal), normalize(geometryViewDir)));
            outgoingLight += vec3(0.86, 0.88, 0.95) * uFoilSheen * pow(f, 3.0) * vPbr.z;
          }
          #include <opaque_fragment>`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          if (uLLK > 0.0) {                 // (phone) the near light: diffuse only
            vec3 lv = uLLPos + vViewPosition; float d2 = max(dot(lv, lv), 1e-5);
            reflectedLight.directDiffuse += BRDF_Lambert(material.diffuseContribution) * uLLC * uLLK * max(dot(normal, lv * inversesqrt(d2)), 0.0) / d2;
          }`)
        .replace('#include <aomap_fragment>', `{
          float ambientOcclusion = vPbr.z * mix(1.0, cavity, 0.6);
          reflectedLight.indirectDiffuse *= ambientOcclusion;
          #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness ) * envDim;
          #endif
          reflectedLight.directDiffuse *= mix(1.0, vPbr.z, 0.5);
          reflectedLight.directSpecular *= mix(uSmoothSpec, 1.0, smoothstep(0.1, 0.5, material.roughness));   // (phone) smoothSpec: mirror metal sees the softboxes, not the point key
          reflectedLight.directSpecular = min(reflectedLight.directSpecular * mix(1.0, vPbr.z, 0.35) * mix(1.0, cavity, 0.5), vec3(specCap));   // no star hotspots, no blown facets (the grain: its own, lower cap)
        }`);
    };
    m.customProgramCacheKey = () => 'kit3d-uber-1p' + (Q.paintGrain ? 'g' : '') + (leather ? 'l' : '');
    m.needsUpdate = true;
  }
  /* special materials: a direct-specular clamp too (the films' point glints) */
  function patchSpecial(m) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>\n\treflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(${(C.specClamp ?? 2.5).toFixed(2)}));`);
    };
    m.customProgramCacheKey = () => 'kit3d-special-1';
    m.needsUpdate = true;
  }
  /* (console) its uber dialect (the console's GLB: _PBR = roughness, metalness, AO, emission; _KUV = a planar mm frame per
     face; codes 0.25 real knurl, faceted · 0.33 … 0.42 brushed along _KUV.x · 0.5 satin grain · 0.75 turned top). Folded
     verbatim from .lab/kit3d/mixer/mixer3d.js: the same program, the same look. */
  function patchUberConsole(m) {
    m.vertexColors = true;
    m.normalMap = null; m.aoMap = null;     // the grain tile lives on in `tiles`: dispose() frees it
    m.roughness = 1; m.metalness = 1;
    m.defines = { ...(m.defines || {}), ...(Q.paintGrain ? { PAINT_GRAIN: '' } : {}) };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { tGrain: { value: tiles.grain }, uAlbedo: { value: L.albedo }, uGScale: { value: CON.grainScale }, uGStr: { value: CON.grainStr },
        uEmit: { value: CON.emit }, uEmitK: { value: 1 }, uTurn: { value: CON.turn }, uTurnSlope: { value: CON.turnSlope }, uBrush: { value: CON.brush } });
      uberShaders.push(sh);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 _pbr; attribute vec2 _kuv; varying vec4 vPbr; varying vec2 vKuv; varying vec3 vObjPos; varying vec3 vObjN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = _pbr; vKuv = _kuv * 0.01; vObjPos = position; vObjN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D tGrain; uniform float uAlbedo; uniform float uGScale; uniform float uGStr; uniform float uEmit; uniform float uEmitK; uniform float uTurn; uniform float uTurnSlope; uniform float uBrush;
uniform mat3 normalMatrix;
varying vec4 vPbr; varying vec2 vKuv; varying vec3 vObjPos; varying vec3 vObjN;
float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// the _KUV tangent frame (three's perturbNormal2Arb against _KUV, mm in both axes): T along kuv.x, B along kuv.y
void kuvFrame(vec3 n, out vec3 T, out vec3 B){
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(vKuv), st1 = dFdy(vKuv);
  vec3 q1p = cross(q1, n), q0p = cross(n, q0);
  T = q1p * st0.x + q0p * st1.x; B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  T *= sc; B *= sc;
}`)
        .replace('#include <lights_pars_begin>', `#include <lights_pars_begin>
// unresolved micro-grooves seen as an anisotropic highlight: tilt the normal along dir (up to the grooves' slope)
// towards the key's half vector, so the highlight stretches across the grooves (a radial streak on a turned top)
vec3 grooveTilt(vec3 n, vec3 dir, float slope){
  #if NUM_DIR_LIGHTS > 0
  vec3 h = normalize(directionalLights[0].direction + normalize(vViewPosition));
  float t = clamp(dot(h, dir) / max(dot(h, n), 0.05), -slope, slope);
  return normalize(n + dir * t);
  #else
  return n;
  #endif
}`)
        .replace('#include <color_fragment>', '#include <color_fragment>\n\tfloat code = vColor.a; diffuseColor.a = 1.0; diffuseColor.rgb *= uAlbedo;')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vPbr.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vPbr.y;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (code > 0.2 && code < 0.3) {
          // real knurl (pyramids in the mesh, shared vertices): faceted, normals from the derivatives
          normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
        } else if (code > 0.33 && code < 0.42) {
          // brushed: lines along _KUV.x (mm), each line its own height and gloss; the highlight stretches across them
          vec3 T, B; kuvFrame(normal, T, B);
          float y = vKuv.y, x = vKuv.x, fw = max(fwidth(y), 1e-4);
          float a1 = 1.0 - smoothstep(0.4, 1.2, fw / 0.06), a2 = 1.0 - smoothstep(0.4, 1.2, fw / 0.22), a3 = 1.0 - smoothstep(0.4, 1.2, fw / 0.8);
          float g = (vnoise(vec2(y / 0.06, x / 9.0)) - 0.5) * a1 * 0.45 + (vnoise(vec2(y / 0.22 + 17.0, x / 25.0)) - 0.5) * a2 * 0.35 + (vnoise(vec2(y / 0.8 + 5.0, x / 60.0)) - 0.5) * a3 * 0.3;
          roughnessFactor = clamp(roughnessFactor + g * 0.22 * uBrush, 0.05, 1.0);
          diffuseColor.rgb *= 1.0 + g * 0.22 * uBrush;
          vec3 bd = normalize(B + 1e-6);
          normal = normalize(normal + bd * g * 0.12 * uBrush);
          normal = grooveTilt(normal, bd, 0.10 * uBrush);
        } else if (code > 0.7 && code < 0.8) {
          // turned top: concentric tool marks (_KUV = planar mm about the axis) where resolved; unresolved, the radial
          // streak the marks make (mixerA3's tops)
          vec3 T, B; kuvFrame(normal, T, B);
          float r = length(vKuv) + 1e-4;
          vec2 rd = vKuv / r;
          vec3 radV = normalize(T * rd.x + B * rd.y + 1e-6);
          float ph = r / 0.32;
          float aa = 1.0 - smoothstep(0.3, 0.8, fwidth(ph));
          normal = normalize(normal + radV * sin(6.2831853 * ph) * uTurn * aa);
          normal = grooveTilt(normal, radV, uTurnSlope * smoothstep(0.6, 3.0, r));
        }
        {
          vec3 n0 = normalize(vObjN);
          vec3 bw = pow(abs(n0), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
          vec3 p = vObjPos / uGScale;
          vec2 a = p.zy, b = p.xz, c = p.xy;
          #ifdef PAINT_GRAIN
          if (code > 0.45 && code < 0.55) {
            // fine satin grain, faded where a pixel covers more than ~1.5 texels (no sparkle in motion)
            float gf = 1.0 - smoothstep(0.7, 1.6, length(fwidth(vObjPos)) / uGScale * 256.0);
            float st = uGStr * gf;
            vec4 tx = textureGrad(tGrain, a, dFdx(a), dFdy(a)), ty = textureGrad(tGrain, b, dFdx(b), dFdy(b)), tz = textureGrad(tGrain, c, dFdx(c), dFdy(c));
            vec3 ax = vec3((tx.xy * 2.0 - 1.0) * st, 1.0), ay = vec3((ty.xy * 2.0 - 1.0) * st, 1.0), az = vec3((tz.xy * 2.0 - 1.0) * st, 1.0);
            vec3 wx = vec3(ax.xy + n0.zy, abs(ax.z) * n0.x).zyx;
            vec3 wy = vec3(ay.xy + n0.xz, abs(ay.z) * n0.y).xzy;
            vec3 wz = vec3(az.xy + n0.xy, abs(az.z) * n0.z);
            vec3 no = normalize(wx * bw.x + wy * bw.y + wz * bw.z);
            normal = normalize(normalMatrix * no) * faceDirection;
            float rr = tx.a * bw.x + ty.a * bw.y + tz.a * bw.z;
            roughnessFactor = clamp(roughnessFactor + (rr - 0.5) * 0.3 * gf, 0.05, 1.0);
          }
          #endif
        }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.rgb * vPbr.w * uEmit * uEmitK;\n\tdiffuseColor.rgb *= mix(1.0, 0.28, step(0.01, vPbr.w));')
        .replace('#include <aomap_fragment>', `{
          float ambientOcclusion = vPbr.z;
          reflectedLight.indirectDiffuse *= ambientOcclusion;
          #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
          #endif
          reflectedLight.directDiffuse *= mix(1.0, ambientOcclusion, 0.5);
          reflectedLight.directSpecular = min(reflectedLight.directSpecular * mix(1.0, ambientOcclusion, 0.35), vec3(2.5));   // the camera's clamp: no star hotspots before the bloom
        }`);
    };
    m.customProgramCacheKey = () => 'kit3d-uber-2' + (Q.paintGrain ? 'g' : '');
    m.needsUpdate = true;
  }
  /* (console) the LCD: black glass and its UI (emissive), no direct light and no studio on it (its reflections are the
     cover glass's) */
  function patchLcd(m) {
    m.envMapIntensity = 0; m.userData.lcd = true;
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', '#include <aomap_fragment>\n\treflectedLight.directSpecular *= 0.0; reflectedLight.directDiffuse *= 0.0; reflectedLight.indirectDiffuse *= 0.0;'); };
    m.customProgramCacheKey = () => 'kit3d-screen-1';
    m.needsUpdate = true;
  }
  /* (console) the LCD's cover glass: Fresnel x one long narrow softbox, evaluated analytically in the studio frame (a crisp,
     hard-edged band like mixerA3's, at any resolution and with no PMREM); premultiplied over the screen */
  function patchSheenGlass(m) {
    const S = { ...(C.sheen || {}), ...(opts.sheen || {}) };
    const dir = new THREE.Vector3(...S.dir).normalize();
    const Uv = new THREE.Vector3(...S.u); Uv.addScaledVector(dir, -Uv.dot(dir)).normalize();
    const Vv = new THREE.Vector3().crossVectors(dir, Uv);
    m.userData.sheen = { uDir: { value: dir }, uU: { value: Uv }, uV: { value: Vv }, uBox: { value: new THREE.Vector4(S.len, S.wid, S.soft, S.i) }, uEnvRot: { value: envRot } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, m.userData.sheen);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uDir; uniform vec3 uU; uniform vec3 uV; uniform vec4 uBox; uniform mat3 uEnvRot;')
        .replace('#include <opaque_fragment>', `{
          vec3 vd = normalize(vViewPosition);
          vec3 rv = reflect(-vd, normal);
          vec3 re = uEnvRot * inverseTransformDirection(rv, viewMatrix);
          float a = dot(re, uU), b = dot(re, uV), c = dot(re, uDir);
          float box = c > 0.0 ? (1.0 - smoothstep(uBox.x - uBox.z, uBox.x + uBox.z, abs(a))) * (1.0 - smoothstep(uBox.y - uBox.z, uBox.y + uBox.z, abs(b))) : 0.0;
          box *= 0.55 + 0.45 * smoothstep(-uBox.y, uBox.y, b);     // the card is brightest towards its hard edge
          float nv = saturate(dot(normal, vd));
          float F = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
          gl_FragColor = vec4(vec3(box * uBox.w * F) + outgoingLight * 0.0, F + 0.04);
        }`);
    };
    m.customProgramCacheKey = () => 'kit3d-glass-2';
    m.needsUpdate = true;
  }

  // ---------------------------------------------------------------- load
  async function load() {
    if (loaded || disposed) return;
    if (!renderer) throw new Error('kit3d: no renderer');
    // the HDR targets are half-float (MSAA): without a float colour-buffer extension the framebuffer would be incomplete
    // and the canvas black while the scene counts as drawn. Fail instead, so the stage keeps the stills.
    if (renderer.capabilities?.isWebGL2 === false || !(renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'))) {
      throw new Error('kit3d: no half-float render targets (EXT_color_buffer_float)');
    }
    // the camera's minimal GLB reader (./glb.js) instead of GLTFLoader (no animation system in the shared three chunk)
    const [{ MeshoptDecoder }, { parseGLB }] = await Promise.all([import('three/addons/libs/meshopt_decoder.module.js'), import('./glb.js')]);
    if (Q.bloom) ({ UnrealBloomPass: Bloom } = await import('three/addons/postprocessing/UnrealBloomPass.js'));
    const url = base + file;
    const buf = opts.loadBuffer ? await opts.loadBuffer(url) : await (await fetch(url)).arrayBuffer();
    const gltf = opts.parse ? await opts.parse(buf, MeshoptDecoder) : await parseGLB(buf, { meshoptDecoder: MeshoptDecoder });
    if (disposed) return;
    const SPV = Object.values(C.special || {});
    envs = { main: studioEnv('main') };
    if (SPV.includes('screen') || (SPV.includes('mylar') && (C.mylarEnvMap ?? 'shiny') === 'shiny')) envs.shiny = studioEnv('shiny');   // only where a film or the screen sees it
    if (C.metalParts) envs.metal = studioEnv('metal');
    for (const k of C.studios || []) envs[k] = studioEnv(k);
    if (C.special && Object.values(C.special).some((v) => v === 'glass' || v === 'sapphire')) envs.strip = stripEnv();   // (phone)
    scene.environment = envs.main.texture;
    scene.environmentIntensity = L.env;
    buildLights();
    model = gltf.scene;
    scene.add(model);
    root = model.getObjectByName(C.root);
    const NOCAST = C.nocast ?? /^$/;
    model.traverse((o) => {
      if (!o.isMesh) return;
      let top = o; while (top.parent && top.parent !== root) top = top.parent;
      o.userData.part = top.name;
      meshes.push(o);
      o.castShadow = !!Q.shadows && !NOCAST.test(top.name) && !o.isInstancedMesh; o.receiveShadow = !!Q.shadows;
      const m = o.material;
      if ((m.name === 'uber' || m.userData?.uber) && !tiles) {
        tiles = { a: m.normalMap, grain: m.aoMap, brushed: m.emissiveMap };
        for (const t of [tiles.a, tiles.grain, tiles.brushed]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; }
      }
      const sp = C.special?.[m.name];
      if (sp === 'mylar') { m.side = THREE.DoubleSide; m.envMap = envs[C.mylarEnvMap ?? 'shiny'].texture; m.envMapIntensity = opts.mylarEnv ?? C.mylarEnv ?? 1.1; envMats.push(m); patchSpecial(m); }
      if (sp === 'cloth') { m.side = THREE.DoubleSide; m.transparent = true; m.depthWrite = false; o.castShadow = false; o.renderOrder = 1; }
      // (console) light-only glow cards, the sheen glass over its LCD, the LCD, the board
      if (sp === 'glow') {
        const g = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: { gain: { value: CON.glow }, fade: { value: 1 } },
          transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        o.material = g; o.castShadow = false; o.receiveShadow = false; o.renderOrder = 3; o.userData.seeThrough = true;   // not a surface: out of the id pass
        glows.push({ m: g, part: top.name });
        m.dispose();
      } else if (sp === 'sheenGlass') {
        Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
        if (!m.userData.sheen) patchSheenGlass(m);
        o.castShadow = false; o.receiveShadow = false; o.renderOrder = 2;
      } else if (sp === 'lcd') {
        m.emissiveIntensity = CON.screen; lcdMat = m; if (!m.userData.lcd) patchLcd(m);
        if (m.emissiveMap) m.emissiveMap.anisotropy = 8;
        o.receiveShadow = false;
      } else if (sp === 'board') {
        m.envMapIntensity = C.boardEnv ?? 0.9; m.roughness = C.boardRough ?? 0.35;
        for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = 8;
      }
      // (phone) the glass layers, the screen, the board faces
      if (sp === 'glass' || sp === 'sapphire') {
        const sap = sp === 'sapphire';
        Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
          envMap: envs.strip.texture, envMapIntensity: sap ? (opts.sapphireEnv ?? C.sapphireEnv ?? 1.6) : (opts.glassEnv ?? C.glassEnv ?? 1.0) });
        if (sap) m.side = THREE.DoubleSide;
        m.specularColor?.setRGB(1, 1, 1); m.specularIntensity = 1;
        o.userData.glass = sap ? 'sapphire' : 'glass';
        o.castShadow = false; o.receiveShadow = false; o.renderOrder = 2; envMats.push(m);
      } else if (sp === 'screen') {
        m.envMap = envs.shiny.texture; m.envMapIntensity = C.screenEnv ?? 0.25; envMats.push(m); screenMat = m;
        m.emissiveIntensity = opts.screen ?? C.screen ?? 1.0;
        if (C.screenRough != null) m.roughness = C.screenRough;
        if (m.emissiveMap) m.emissiveMap.anisotropy = 4;
        o.receiveShadow = false; patchScreen(m);
      } else if (sp === 'pcb') {
        m.envMapIntensity = C.pcbEnv ?? 0.9;
        if (C.metalParts?.test(top.name)) { m.envMap = envs.metal.texture; envMats.push(m); }   // the board's faces see its parts' studio
        for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = 4;
        patchSpecial(m);
      }
    });
    // every part rides in a group at its pivot (mesh quantisation moves node origins; rotations need the real pivot)
    model.updateMatrixWorld(true);
    const groups = {};
    for (const node of [...root.children]) {
      const x = node.userData || {};
      const piv = x.origin ?? x.pivot;
      if (!piv) continue;
      const g = new THREE.Group(); g.name = node.name + '_pivot';
      g.position.set(...piv); root.add(g); g.updateMatrixWorld(true); g.attach(node);
      groups[node.name] = { g, x: { ...x } };
    }
    for (const [name, gg] of Object.entries(groups)) {        // config overrides of the GLB's choreography (mm, degrees)
      const o = C.explode?.[name];
      if (!o) continue;
      if (o.ex) gg.x.explode = o.ex.map((v) => v / U);
      if (o.rot !== undefined) gg.x.rot = o.rot;
      if (o.t) gg.x.t = o.t;
      if (o.scale) gg.x.scale = o.scale;
      if (o.rotT) gg.x.rotT = o.rotT;
      if (o.instances && gg.x.instances) gg.x.instances = gg.x.instances.map((it, i) => ({ ...it, ...(o.instances[i] || o.instances) }));
    }
    // x.parent (the camera's GLB convention): the part rides in its parent and has no explode of its own; x.rides or
    // config parent: it rides in its parent and its own explode is relative to it (the mic's magnet in its shock mount)
    const ridesOn = (name, x) => C.parent?.[name] ?? x.rides ?? null;
    for (const [name, { g, x }] of Object.entries(groups)) {
      const pn = ridesOn(name, x) ?? x.parent;
      if (pn && groups[pn]) groups[pn].g.attach(g);
    }
    for (const [name, { g, x }] of Object.entries(groups)) {
      if (x.hinge) hinges.push({ node: g, rest: g.quaternion.clone(), axis: new THREE.Vector3(...x.hinge.axis), angle: x.hinge.angle * D, t: x.hinge.t, k: 0, name });
      const pn = ridesOn(name, x);
      if (!x.explode || (x.parent && !pn)) continue;
      const pe = C.portraitEx?.[name];
      const part = { node: g, name, parent: pn || null, rest: { pos: g.position.clone(), quat: g.quaternion.clone(), scale: g.scale.clone() }, k: 0,
        ex: new THREE.Vector3(...x.explode), exP: pe ? new THREE.Vector3(...pe).multiplyScalar(1 / U) : C.portraitScale ? new THREE.Vector3(...x.explode).multiplyScalar(C.portraitScale) : null,
        rot: x.rot ? new THREE.Euler(...x.rot.map((d) => d * D)) : null, rotP: C.portraitRot?.[name] ? new THREE.Euler(...C.portraitRot[name].map((d) => d * D)) : null,
        t: x.t, sc: x.scale ?? 1, face: (C.faceView?.[name] ?? 0) * D, faceP: (C.faceViewTall?.[name] ?? C.faceView?.[name] ?? 0) * D, rotT: x.rotT ?? [0.2, 1.0] };
      parts.push(part);
      if (x.instances) g.traverse((o) => {
        if (!o.isInstancedMesh) return;
        const b = []; for (let i = 0; i < o.count; i++) { const mm = new THREE.Matrix4(); o.getMatrixAt(i, mm); b.push(mm); }
        screws.push({ mesh: o, base: b, inst: x.instances, part });
      });
    }
    model.updateMatrixWorld(true);
    // the uber material per mesh (one program): each clone carries its mesh's dequantisation (part space for the grain)
    const _im = new THREE.Matrix4(), _p = new THREE.Vector3(), _qq = new THREE.Quaternion(), _s = new THREE.Vector3();
    const ubers = [];
    model.traverse((o) => { if (o.isMesh && (o.material.name === 'uber' || o.material.userData?.uber)) ubers.push(o); });
    const METAL = C.metalParts || null;
    for (const o of ubers) {
      let g = o.parent; while (g && g !== root && !g.name.endsWith('_pivot')) g = g.parent;
      _im.copy(g.matrixWorld).invert().multiply(o.matrixWorld).decompose(_p, _qq, _s);
      const m = o.material.clone();
      if (CON) patchUberConsole(m); else patchUber(m, o.isInstancedMesh ? [0, 0, 0, 1] : [_p.x, _p.y, _p.z, _s.x]);
      if (METAL && METAL.test(o.userData.part) && !o.isInstancedMesh) { m.envMap = envs.metal.texture; m.envMapIntensity = C.metalEnv ?? 1.1; envMats.push(m); }
      o.material = m;
    }
    model.traverse((o) => {              // (phone) the glass layers: patched with their own dequantisation
      if (!o.isMesh || !o.userData.glass) return;
      let g = o.parent; while (g && g !== root && !g.name.endsWith('_pivot')) g = g.parent;
      _im.copy(g.matrixWorld).invert().multiply(o.matrixWorld).decompose(_p, _qq, _s);
      const boxes = o.userData.glass === 'glass' && !!C.glassBoxes;
      patchGlass(o.material, boxes, [_p.x, _p.y, _p.z, _s.x]);
      if (boxes && !glassNode) glassNode = g;
    });
    // part ids for the occlusion pass (1-based; 0 = nothing)
    const partNames = [...new Set(meshes.map((o) => o.userData.part))];
    for (const o of meshes) if (o.userData.glass === 'glass') glassParts.add(o.userData.part);
    for (const o of meshes) { o.userData.pid = partNames.indexOf(o.userData.part) + 1; o.onBeforeRender = idHook; }
    model.traverse((o) => {
      if (!o.isMesh || (o.material.transparent && !(C.fitTransparent && o.userData.glass === 'glass'))) return;
      if (o.isInstancedMesh) { if (o.count <= (C.fitInstancedMax ?? 16)) samples.push({ obj: o, inst: true }); return; }
      const pos = o.geometry.attributes.position, n = pos.count, step = Math.max(1, Math.floor(n / 200));
      const pts = new Float32Array(Math.ceil(n / step) * 3); let k = 0;
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i += step) { v.fromBufferAttribute(pos, i); pts[k++] = v.x; pts[k++] = v.y; pts[k++] = v.z; }
      samples.push({ obj: o, pts: pts.subarray(0, k) });
    });
    root.updateMatrixWorld(true);
    for (const a0 of root.userData.anchors || []) {
      const a = { ...a0, ...(C.anchorRest?.[a0.id] ? { rest: C.anchorRest[a0.id].map((v) => v / U) } : {}), ...(C.anchorNormal?.[a0.id] ? { n: C.anchorNormal[a0.id] } : {}) };
      const node = root.getObjectByName(a.part);
      if (!node) continue;
      const g = node.parent && node.parent.name.endsWith('_pivot') ? node.parent : node;
      const nrm = a.n ? new THREE.Vector3(...a.n).normalize().transformDirection(root.matrixWorld) : null;   // root space -> world (at load)
      anchorDefs.push({ ...a, node, pid: partNames.indexOf(a.part) + 1, nrm, g, gq: g.getWorldQuaternion(new THREE.Quaternion()).invert(),
        local: node.worldToLocal(root.localToWorld(new THREE.Vector3(...a.rest))),
        reveal: C.reveal && a.id in C.reveal ? C.reveal[a.id] : a.part, ox: 0, oy: 0, occ: 1 });
    }
    setSize();
    await prewarm();
    loaded = true; dirty = true;
  }
  /* compile every program and upload every texture now (at idle in the stage), not inside the first visible frame:
     the scene's materials, the shadow depth programs and the bloom passes (one warm-up sample into a 16 px target),
     the post quads and the id pass (with its read-back) */
  async function prewarm() {
    const r = renderer;
    // (phone) posed exploded with every part shown, so the internals hidden while closed (hideAssembled) compile too
    const phWas = ph;
    if (C.hideAssembled) { ph = { orbit: 1, hand: 1, explode: 1, settle: 1 }; forceShow = true; }
    applyPose();
    const shWas = r.shadowMap.enabled, rtWas = r.getRenderTarget();
    r.shadowMap.enabled = !!Q.shadows; r.setRenderTarget(rtHDR);
    const par = r.compileAsync && r.extensions.has('KHR_parallel_shader_compile');
    if (par) await r.compileAsync(scene, camera); else r.compile(scene, camera);
    for (const q of [outQ, blendQ, copyQ]) r.compile(q.sc, qcam);
    const texs = new Set([tiles?.a, tiles?.grain, tiles?.brushed]);
    model.traverse((o) => { if (!o.isMesh) return; const m = o.material; for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'emissiveMap', 'iridescenceThicknessMap']) if (m[k]) texs.add(m[k]); });
    for (const t of texs) if (t) r.initTexture(t);
    r.shadowMap.enabled = shWas; r.setRenderTarget(rtWas);
    // one tiny warm-up frame through the whole chain (shadow depth, bloom, tone map, blend, copy, id)
    // (private 16 px targets: a pool's shared ones keep their size; the bloom's programs are cached for the pool's)
    const [w0, h0, s0] = [W, H, scaleNow], keep = [rtHDR, rtLDR, accRT, bloom];
    W = 16; H = 16; scaleNow = 1;
    rtHDR = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: msaaNow });
    rtLDR = new THREE.WebGLRenderTarget(16, 16, { type: THREE.UnsignedByteType, depthBuffer: false });
    accRT = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: false });
    bloom = Bloom ? new Bloom(new THREE.Vector2(16, 16), L.bloomStrength, 0.25, L.bloomThreshold) : null;
    const tiny = new THREE.WebGLRenderTarget(16, 16, { type: THREE.UnsignedByteType });
    sample(r); accN = 0;
    copyQ.m.uniforms.t.value = accRT.texture; r.setRenderTarget(tiny); r.render(copyQ.sc, qcam);
    idPass(r, true);
    r.setRenderTarget(rtWas);
    for (const t of [tiny, rtHDR, rtLDR, accRT]) t.dispose(); bloom?.dispose?.();
    [rtHDR, rtLDR, accRT, bloom] = keep;
    W = w0; H = h0; scaleNow = s0; setTargets();
    if (C.hideAssembled) { ph = phWas; forceShow = false; poseFor = null; applyPose(); }
  }

  // ---------------------------------------------------------------- sizing
  function setTargets() {
    const w = Math.max(16, Math.round(W * scaleNow)), h = Math.max(16, Math.round(H * scaleNow));
    if (pool) { const P = pool.size(w, h, msaaNow, Bloom, L); rtHDR = P.hdr; rtLDR = P.ldr; bloom = P.bloom; }
    else {
      if (!rtHDR || rtHDR.samples !== msaaNow) {
        rtHDR?.dispose();
        rtHDR = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaaNow });
      } else rtHDR.setSize(w, h);
      if (!rtLDR) rtLDR = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });      // tone-mapped sRGB: 8 bit
      else rtLDR.setSize(w, h);
      if (Bloom && !bloom) bloom = new Bloom(new THREE.Vector2(w, h), L.bloomStrength, 0.25, L.bloomThreshold);
      else if (bloom) bloom.setSize(w, h);
    }
    if (accRT) accRT.setSize(w, h);
  }
  function ensureAcc() {                // the running mean: keeps precision (half float); made on the first sample after release()
    const w = rtLDR.width, h = rtLDR.height;
    if (!accRT) { accRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false }); accN = 0; }
    else if (accRT.width !== w || accRT.height !== h) { accRT.setSize(w, h); accN = 0; }
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
    if (loaded || rtHDR) setSize();
  }

  // ---------------------------------------------------------------- pose: model pose + explode + rig + fit
  const portrait = () => camera.aspect < 0.85;
  const mixKey = (a, b, t) => ({ az: lerp(a.az, b.az, t), el: lerp(a.el, b.el, t), fov: lerp(a.fov, b.fov, t), fill: lerp(a.fill, b.fill, t) });
  function rigAt() {
    const K = portrait() ? KEYS.tall : KEYS.wide;
    let r = mixKey(K.start, K.hero, pace(ph.orbit));
    r = mixKey(r, K.column, ph.hand);
    r = mixKey(r, K.exploded, ph.explode);
    r.fill = Math.min(r.fill * (1 + (C.settlePush ?? 0.025) * ph.settle), C.fillMax ?? 0.92);      // the camera's 4% margin each side
    r.az += 2.5 * ph.settle;
    if (!reduced) { r.az += ptrS.x * (2.2 + 1.0 * ph.explode); r.el += -ptrS.y * 1.4; }
    r.az += off.az; r.el = Math.max(-25, Math.min(C.elMax ?? 60, r.el + off.el));
    return r;
  }
  let poseOv = null;
  function applyModelPose() {
    if (C.poseStart || C.poseEx) return applyModelPoseEased();
    const pr = portrait();
    const t0 = (pr ? C.tilt?.tall : C.tilt?.wide) ?? 0;
    let t1 = (pr ? C.tiltEx?.tall : C.tiltEx?.wide) ?? t0;   // tiltEx: the pose eases there over the explode
    // tiltExWideSlot: the exploded tilt for a wide (16:9) slot; a near-square slot (the Kit's column) keeps tiltEx.wide
    if (!pr && C.tiltExWideSlot != null && rect) t1 = lerp(t1, C.tiltExWideSlot, smooth(clamp01((rect.w / rect.h - 1.0) / 0.78)));
    const t = lerp(t0, t1, smooth(ph.explode));
    const key = pr + ':' + t.toFixed(4);
    if (poseFor === key) return;
    poseFor = key;
    const y = (pr ? C.yaw?.tall : C.yaw?.wide) ?? 0, rl = (pr ? C.roll?.tall : C.roll?.wide) ?? 0;
    root.rotation.set(-t * D, y * D, rl * D, 'YXZ');
    root.updateMatrixWorld(true);
  }
  /* (phone) the model's pose eased over the orbit (poseStart -> tilt / roll / yaw) and over the explode (-> poseEx) */
  function applyModelPoseEased() {
    const pr = portrait(), lay = pr ? 'tall' : 'wide';
    let t = C.tilt?.[lay] ?? 0, y = C.yaw?.[lay] ?? 0, rl = C.roll?.[lay] ?? 0;
    const st = C.poseStart?.[lay];
    if (st) { const k = 1 - pace(ph.orbit); t = lerp(t, st.tilt ?? t, k); y = lerp(y, st.yaw ?? y, k); rl = lerp(rl, st.roll ?? rl, k); }
    const ex = C.poseEx?.[lay];
    if (ex) { const k = smooth(clamp01((ph.explode - (ex.t0 ?? 0)) / ((ex.t1 ?? 1) - (ex.t0 ?? 0)))); t = lerp(t, ex.tilt ?? t, k); y = lerp(y, ex.yaw ?? y, k); rl = lerp(rl, ex.roll ?? rl, k); }
    if (poseOv) ({ tilt: t = t, yaw: y = y, roll: rl = rl } = poseOv);
    const sig = `${pr}|${t.toFixed(4)}|${y.toFixed(4)}|${rl.toFixed(4)}`;
    if (poseFor === sig) return;
    poseFor = sig;
    root.rotation.set(-t * D, y * D, rl * D, 'YXZ');
    root.updateMatrixWorld(true);
  }
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _e = new THREE.Euler(), _x = new THREE.Vector3(), _ax = new THREE.Vector3(), _vd = new THREE.Vector3();
  function applyExplode() {
    const e = ph.explode, pr = portrait();
    // "faces the view": the exploded key's view direction in the root's frame (fixed per layout, so the parts do not
    // swivel with the pointer drift)
    const K = (pr ? KEYS.tall : KEYS.wide).exploded, az = K.az * D, el = K.el * D;
    _vd.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).applyQuaternion(_q2.copy(root.quaternion).invert());
    const hideRe = C.hideAssembled;     // (phone) sealed inside: not drawn while the device is closed (performance)
    for (const p of parts) {
      if (hideRe) p.node.visible = forceShow || !(hideRe.test(p.name) && e <= 1e-4);
      const [a, b] = p.t;
      const k = easeOut(clamp01((e - a) / Math.max(1e-4, b - a)));
      p.k = k;
      const o = exOverride?.[p.name];
      const ex = o?.ex ? _x.set(...o.ex).multiplyScalar(1 / U) : pr && p.exP ? p.exP : p.ex;
      p.node.position.copy(p.rest.pos).addScaledVector(ex, k);
      p.node.quaternion.copy(p.rest.quat);
      const kr = smooth(clamp01((k - p.rotT[0]) / (p.rotT[1] - p.rotT[0])));
      const face = o?.face !== undefined ? o.face * D : pr ? p.faceP : p.face;
      if (face && !p.parent) {
        // turn the axis end that faces the view (part Z, in the root's frame) further towards it
        const s = Math.sign(_vd.z) || 1;
        _ax.set(0, 0, s).cross(_vd);
        if (_ax.lengthSq() > 1e-8) p.node.quaternion.premultiply(_q.setFromAxisAngle(_ax.normalize(), face * kr));
      }
      const rot = o?.rot ? _e.set(...o.rot.map((d) => d * D)) : pr && p.rotP ? p.rotP : (pr && C.portraitNoRot?.includes(p.name)) ? null : p.rot;
      if (rot) {
        _e.set(rot.x * kr, rot.y * kr, rot.z * kr, rot.order);
        p.node.quaternion.multiply(_q.setFromEuler(_e));
      }
      const sc = o?.scale ?? p.sc;
      if (sc !== 1) p.node.scale.copy(p.rest.scale).multiplyScalar(lerp(1, sc, kr));
    }
    for (const h of hinges) {
      h.k = smooth(clamp01((e - h.t[0]) / (h.t[1] - h.t[0])));
      h.node.quaternion.copy(h.rest).multiply(_q.setFromAxisAngle(h.axis, h.angle * h.k * (pr ? 0.6 : 1)));
    }
    for (const s of screws) {
      s.mesh.visible = !(pr && C.portraitScrews === false);
      s.inst.forEach((it, i) => {
        const k = easeOut(clamp01((e - it.t[0]) / (it.t[1] - it.t[0])));
        _m.copy(s.base[i]); _v.setFromMatrixPosition(_m).add(_x.set(...it.explode).multiplyScalar(k * (pr && C.portraitScale ? C.portraitScale : 1))); _m.setPosition(_v);
        s.mesh.setMatrixAt(i, _m);
      });
      s.mesh.instanceMatrix.needsUpdate = true; s.mesh.computeBoundingSphere();
    }
    if (C.glowSep) {                    // (console) the LEDs' halo on the board shows as the plate (with its pads) lifts off them
      const G = C.glowSep, a = parts.find((p) => p.name === G.a), b = parts.find((p) => p.name === G.b);
      const sep = a && b ? Math.abs(a.k * a.ex.y - b.k * b.ex.y) : 0;
      for (const g of glows) if (g.part === G.part) g.m.uniforms.fade.value = smooth(clamp01(sep / (G.mm / U)));
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
    const top = portrait() ? (C.insetTop ?? 16) * ph.hand : 0;   // phones: clear of the header bar as it lands in the column
    return zoomNDC([rect.x / vw * 2 - 1, (rect.x + rect.w) / vw * 2 - 1, 1 - (rect.y + rect.h) / vh * 2, 1 - (rect.y + top) / vh * 2]);
  }
  let jitter = [0, 0], fitInfo = null;
  let view = null;            // debug / art-direction override: { az, el, fov, target: [x, y, z], dist }
  function applyPose() {
    applyModelPose();
    applyExplode();
    if (CON) lightSources();
    const rig = view ? { ...rigAt(), ...view } : rigAt();
    turnLights(rig.az);
    camera.fov = rig.fov; camera.aspect = W / H; camera.updateProjectionMatrix();
    model.updateMatrixWorld(true);
    const az = rig.az * D, el = rig.el * D;
    _d.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    if (view && view.target) {
      camera.position.set(...view.target).addScaledVector(_d, view.dist); camera.up.set(0, 1, 0); camera.lookAt(...view.target);
      camera.near = 0.02; camera.far = view.dist + 6; camera.updateProjectionMatrix();
      const w = rtHDR ? rtHDR.width : W, h = rtHDR ? rtHDR.height : H;
      camera.projectionMatrix.elements[8] = -jitter[0] * 2 / w; camera.projectionMatrix.elements[9] = -jitter[1] * 2 / h;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      camera.updateMatrixWorld();
      return;
    }
    const R = rectNDC();
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
    camera.near = Math.max(0.05, dist - 4); camera.far = dist + 6;     // hug the model (depth precision for the id pass)
    if (C.hugDepth) {                  // (phone) hug the fitted depth range (+ a margin for vertices the samples skip)
      let zmn = 1e9, zmx = -1e9;
      for (let i = 0; i < pts.length; i += 3) { const z = (pts[i] - _c.x) * _d.x + (pts[i + 1] - _c.y) * _d.y + (pts[i + 2] - _c.z) * _d.z; zmn = Math.min(zmn, z); zmx = Math.max(zmx, z); }
      const zr = Math.max(0.2, (zmx - zmn) * 0.25);
      camera.near = Math.max(0.05, dist - zmx - zr); camera.far = dist - zmn + zr + 0.5;
    }
    camera.updateProjectionMatrix();
    const w = rtHDR ? rtHDR.width : W, h = rtHDR ? rtHDR.height : H;
    const sx = (R[0] + R[1]) / 2 + jitter[0] * 2 / w, sy = (R[2] + R[3]) / 2 + jitter[1] * 2 / h;
    camera.projectionMatrix.elements[8] = -sx; camera.projectionMatrix.elements[9] = -sy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // the view matrix now, not at the next render: anchors() projects right after pose() (a stale matrixWorldInverse put
    // the first frame's markers one pose behind: 80 px on the scratch site, found by sitetest_kit.mjs)
    camera.updateMatrixWorld();
    // the device's screen box (css px; the fit centres it on the rect): drag3d's hit region
    const bx = (R[0] + R[1]) / 2, by = (R[2] + R[3]) / 2;
    fitInfo = { target: _c.toArray(), dist, rig, box: { x0: (bx - bw + 1) / 2 * vw, x1: (bx + bw + 1) / 2 * vw, y0: (1 - by - bh) / 2 * vh, y1: (1 - by + bh) / 2 * vh } };
    fitC.copy(_c); updateBoxes(rig.az); applyScreen();
    if (lights.local) { localU.uLLK.value = lights.local.intensity; localU.uLLPos.value.copy(lights.local.position).applyMatrix4(camera.matrixWorldInverse); }
  }
  function applyScreen() {             // (phone) the screen's glow keyed by phase: off through the orbit and the hero
    if (!screenMat) return;
    const g = C.screenGlow, base = opts.screen ?? C.screen ?? 1.0;
    const k = g ? smooth(clamp01((ph.explode - (g.t0 ?? 0.3)) / ((g.t1 ?? 0.9) - (g.t0 ?? 0.3)))) : 1;
    screenMat.emissiveIntensity = g ? base * lerp(g.orbit ?? 0, g.hold ?? 1, k) : base;
    if (C.screenMesh) screenU.uSMesh.value.z = (C.screenMesh.str ?? 0.5) * (C.screenMesh.phase === false ? 1 : k);   // the panel's mesh: the loose panel only
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
    // one (jittered) frame -> HDR (alpha = coverage) -> bloom -> tone map into rtLDR -> folded into the running mean
    ensureAcc();
    jitter = accN === 0 ? [0, 0] : [halton(accN + 1, 2) - 0.5, halton(accN + 1, 3) - 0.5];
    applyPose(); posedSig = '';
    const shadowWas = r.shadowMap.enabled, typeWas = r.shadowMap.type, rtWas = r.getRenderTarget(), acWas = r.autoClear;
    r.getClearColor(_cc); const caWas = r.getClearAlpha();
    r.shadowMap.enabled = !!Q.shadows; r.shadowMap.type = THREE.PCFShadowMap;
    r.setRenderTarget(rtHDR); r.setClearColor(0x000000, 0); r.clear();
    const ar = r.info.autoReset; r.info.autoReset = false; r.info.reset();
    r.render(scene, camera);
    lastInfo = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    r.info.autoReset = ar;
    r.setClearColor(_cc, caWas);
    if (bloom) { bloom.strength = L.bloomStrength; bloom.threshold = L.bloomThreshold; bloom.render(r, null, rtHDR, 0, false); }
    outQ.m.uniforms.tHDR.value = rtHDR.texture;
    outQ.m.uniforms.exposure.value = L.exposure * (1 + L.expRamp * ph.explode);
    r.setRenderTarget(rtLDR); r.render(outQ.sc, qcam);
    blendQ.m.uniforms.t.value = rtLDR.texture; blendQ.m.blendAlpha = 1 / (accN + 1);
    r.autoClear = false; r.setRenderTarget(accRT); r.render(blendQ.sc, qcam); r.autoClear = acWas;
    r.shadowMap.enabled = shadowWas; r.shadowMap.type = typeWas; r.setRenderTarget(rtWas);
    accN++;
    jitter = [0, 0];
  }
  function accumulate(r, samplesNow = 0, idOK = true) {
    const s = signature();
    if (s !== lastSig || dirty || !accRT) { accN = 0; lastSig = s; dirty = false; }
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
    const u = copyQ.m.uniforms;
    u.keyOn.value = key.on * (key.hand ? ph.hand : 1);
    if (key.on && rect) {             // the key's rect in the output's px (gl_FragCoord: from the bottom)
      const sx = W / vw, sy = H / vh;
      u.keyRect.value.set(rect.x * sx, (vh - rect.y - rect.h) * sy, rect.w * sx, rect.h * sy);
    } else if (key.on) u.keyRect.value.set(0, 0, W, H);
    renderer.setRenderTarget(target); renderer.render(copyQ.sc, qcam);
    return true;
  }
  function renderTexture(r = renderer, samplesNow = 0, o = {}) {
    renderer = r || renderer;
    if (!loaded) return null;
    accumulate(renderer, samplesNow, o.id !== false);
    return accRT.texture;
  }

  // ---------------------------------------------------------------- anchors + occlusion (id pass)
  let idOn = false, idSig = '', idBuf = null, idW = 0, idH = 0, idVer = 0, idPose = null;
  function idHook() { if (idOn) { idMat.uniforms.pid.value = this.userData.pid; idMat.uniformsNeedUpdate = true; } }
  function idPass(r = renderer, warm = false) {
    if (!loaded && !warm) return;
    idW = Math.max(16, Math.min(640, Math.round(vw / 2))); idH = Math.max(16, Math.round(idW * vh / vw));
    if (!idRT) idRT = new THREE.WebGLRenderTarget(idW, idH, { type: THREE.UnsignedByteType });
    else if (idRT.width !== idW || idRT.height !== idH) idRT.setSize(idW, idH);
    jitter = [0, 0]; applyPose(); posedSig = signature();
    const rtWas = r.getRenderTarget(), shWas = r.shadowMap.enabled; r.getClearColor(_cc); const caWas = r.getClearAlpha();
    const bg = scene.background, ov = scene.overrideMaterial;
    scene.background = null; scene.overrideMaterial = idMat; r.shadowMap.enabled = false; idOn = true;
    const seeThrough = [];             // (phone) glass layers are see-through for the markers ("through glass")
    for (const o of meshes) if ((o.userData.glass || o.userData.seeThrough) && o.visible) { o.visible = false; seeThrough.push(o); }
    r.setRenderTarget(idRT); r.setClearColor(0x000000, 1); r.clear();
    r.render(scene, camera);
    for (const o of seeThrough) o.visible = true;
    idOn = false; scene.background = bg; scene.overrideMaterial = ov; r.shadowMap.enabled = shWas;
    if (!idBuf || idBuf.length !== idW * idH * 4) idBuf = new Uint8Array(idW * idH * 4);
    // (the warm-up reads back too: a software rasteriser builds its read-back path on the first read; once per renderer)
    if (warm && warmedReadback.has(r)) { r.setClearColor(_cc, caWas); r.setRenderTarget(rtWas); return; }
    r.readRenderTargetPixels(idRT, 0, 0, idW, idH, idBuf);
    warmedReadback.add(r);
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
     (within 30 px); then keep markers >= SPREAD px apart, again only onto pixels of their own parts */
  function resolveAnchors() {
    const raw = project();
    const placed = [];
    const k = vw / idW;
    for (let n = 0; n < anchorDefs.length; n++) {
      const a = anchorDefs[n], p = raw[n];
      a.ox = 0; a.oy = 0; a.occ = 1;
      if (!(p.vis0 > 0.01)) continue;
      if (glassParts.has(a.part)) continue;     // (phone) a glass layer is not in the id pass: its marker is not tested
      const own = (x, y) => idAt(x, y) === a.pid;
      const far = (x, y) => placed.every((q) => Math.hypot(q.x - x, q.y - y) >= SPREAD);
      let best = null;
      if (own(p.x, p.y) && far(p.x, p.y)) best = [p.x, p.y];
      else {
        let bd = 1e9;
        const R = 30;
        for (let dy = -R; dy <= R; dy += k) for (let dx = -R; dx <= R; dx += k) {
          const d = dx * dx + dy * dy; if (d > R * R || d >= bd) continue;
          const x = p.x + dx, y = p.y + dy;
          if (own(x, y) && far(x, y) && own(x + k, y) && own(x - k, y) && own(x, y + k) && own(x, y - k)) { bd = d; best = [x, y]; }
        }
        if (!best && own(p.x, p.y)) best = [p.x, p.y];
      }
      if (!best) { a.occ = 0; continue; }
      a.ox = best[0] - p.x; a.oy = best[1] - p.y;
      placed.push({ x: best[0], y: best[1] });
    }
  }
  const _a = new THREE.Vector3(), _n = new THREE.Vector3(), _tc = new THREE.Vector3(), _wq = new THREE.Quaternion();
  function project() {
    const byName = Object.fromEntries([...parts, ...hinges].map((p) => [p.name, p]));
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
    // the last id pass holds only near the pose it tested: once the view has turned or the parts have moved further,
    // a marker hides until the next pass lands (when the view settles) rather than show through what now covers it
    const rg = rigAt();
    const fresh = !!idPose && Math.abs(rg.az - idPose.az) < 6 && Math.abs(rg.el - idPose.el) < 4 && Math.abs(ph.explode - idPose.e) < 0.03 && Math.abs(ph.hand - idPose.h) < 0.03;
    const pr = portrait();
    return anchorDefs.map((a, n) => {
      const p = raw[n], ld = (pr && (C.leadsTall?.[a.id] || a.leadTall)) || C.leads?.[a.id] || a.lead, ang = LEAD[ld] ?? -38;
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
    tiles?.a?.dispose(); tiles?.grain?.dispose(); tiles?.brushed?.dispose();
    if (envs) for (const k of Object.keys(envs)) envs[k].dispose();      // the PMREM render targets
    lights.key?.dispose(); lights.rim?.dispose(); lights.kick?.dispose(); lights.xfill?.dispose();   // the key's shadow map
    if (!pool) { rtHDR?.dispose(); rtLDR?.dispose(); bloom?.dispose?.(); }
    accRT?.dispose(); idRT?.dispose();
    for (const q of [outQ, blendQ, copyQ]) { q.m.dispose(); q.sc.children[0].geometry.dispose(); }
    idMat.dispose();
    scene.clear();
    model = null; root = null; loaded = false; envs = null; tiles = null; idBuf = null; idPose = null; rtHDR = rtLDR = accRT = idRT = null; bloom = null;
  }

  return {
    scene, camera, quality: Q, config: C,
    load,
    get loaded() { return loaded; },
    get idVersion() { return idVer; },
    get texture() { return accRT?.texture ?? null; },
    setProgress(p) { ph = phasesAt(clamp01(p)); },
    setPhases(x) { ph = { orbit: untime(x.orbit ?? 1), hand: x.hand ?? 1, explode: x.explode ?? 0, settle: x.settle ?? 0 }; },
    setRaw(x) { ph = { orbit: x.orbit ?? 1, hand: x.hand ?? 1, explode: x.explode ?? 0, settle: x.settle ?? 0 }; },   // phases as given (no re-timing)
    setLayout(r, w, h) { rect = r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null; if (w) vw = w; if (h) vh = h; },
    setPointer(x, y, k = 0.12) { ptr.set(x, y); ptrS.lerp(ptr, k); if (ptrS.distanceToSquared(ptr) < 1e-6) ptrS.copy(ptr); },
    resize, render, renderTexture, anchors, dispose, pose,
    occlusion() { if (loaded) idPass(renderer); return anchors(); },
    busy() { return loaded && accN < Q.acc; },
    release() { accRT?.dispose(); accRT = null; accN = 0; lastSig = ''; },   // not drawn: free the running mean (the next sample makes it again)
    invalidate() { dirty = true; },
    setOffset(az, el) { off.az = az; off.el = el; },
    setZoom(k = 1, x = 0, y = 0) { zm.k = k; zm.x = x; zm.y = y; },
    screenBox() { pose(); return fitInfo?.box || null; },     // the device's screen box (css px, viewport), posed for now
    setFade(f) { copyQ.m.uniforms.fade.value = Math.min(1, Math.max(0, f)); },
    /** the colour key ('#rrggbb' centre, edge; null = black). o: { amount (0 … 1), hand (true: comes up with the hand-off) } */
    setKey(centre, edge, o = {}) {
      key.on = centre ? (o.amount ?? 1) : 0; key.hand = !!o.hand;
      if (C.glassBoxes) dirty = true;      // (phone) the hold's glass box is scaled on a key (glassKeyK)
      if (centre) { key.c = hexRGB(centre); key.e = hexRGB(edge ?? centre); copyQ.m.uniforms.keyC.value.set(...key.c); copyQ.m.uniforms.keyE.value.set(...key.e); }
    },
    setView(v) { view = v || null; dirty = true; },
    setExplode(o) { exOverride = o || null; dirty = true; },
    setPose(p) { poseOv = p || null; poseFor = null; dirty = true; },     // (phone) lab: the model's pose { tilt, roll, yaw }
    _parts: parts,
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
