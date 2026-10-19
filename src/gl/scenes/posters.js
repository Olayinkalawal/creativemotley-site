/* V · Showcase: the seven posters as paper planes on a turning arc, in a dark umber room under one warm
   pool of light. Layout, camera and arc come from src/sections/showcase.js (state.L, arcAt, place), so this
   arc and its CSS-3D proxy (the poster buttons) are one geometry: 1 world unit = 1 CSS px on the plane
   z = 0, the slot the CSS lays out for the centred poster is the origin, and the camera sits D px in front
   of it with an off-axis frustum (the slot can sit right of centre, beside the rail, and follows the pin).
   - posters: one ShaderMaterial for all seven; per-poster values (map, dim, alpha, bow) go in onBeforeRender.
     Vertex: a slight paper bow (a little more while the arc turns) and a lifted lower corner, analytic normals.
     Fragment: warm key light, a soft gradient and sheen across the paper, edge occlusion, and a fade at the
     viewport edges so nothing is ever clipped hard. Paper grain comes from the stage's post pass.
   - room: one full-screen pass that ray-casts a floor and a back wall, a warm pool on both, and a soft
     contact shadow under each poster.
   Click / hover: state.pick ray-casts the posters (the section turns the arc or opens the modal). */
import * as THREE from 'three';
import { texture } from '../lib/loaders.js';
import { state, arcAt, place, N } from '../../sections/showcase.js';

const roomVert = /* glsl */`void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const roomFrag = /* glsl */`
precision highp float;
uniform vec2 res;      // render target px
uniform vec2 view;     // CSS px
uniform vec2 ctr;      // the centred poster's centre on screen (CSS px, from top-left)
uniform float D, floorY, wallZ, poolZ, H, W, gap, lights;
uniform float spill;   // light spilling up from below while the arc is still under the opener
uniform vec4 P[7];     // poster base: x, z, yaw, half width
uniform float S[7];    // shadow strength
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 px = vec2(gl_FragCoord.x * view.x / res.x, (res.y - gl_FragCoord.y) * view.y / res.y);
  vec3 ro = vec3(0.0, 0.0, D);
  vec3 rd = normalize(vec3(px.x - ctr.x, ctr.y - px.y, -D));
  float tw = (wallZ - D) / rd.z;
  float tf = rd.y < -1e-5 ? floorY / rd.y : 1e9;
  vec3 ink = vec3(0.043, 0.031, 0.020);
  vec3 col;
  if (tf < tw) {
    vec3 p = ro + rd * tf;
    vec2 q = vec2(p.x / (W * 1.75), (p.z - poolZ) / (W * 1.1));
    float pool = exp(-dot(q, q) * 1.3);
    vec3 c = mix(ink * 1.15, vec3(0.29, 0.196, 0.104), pool * lights);
    float sh = 0.0;
    for (int k = 0; k < 7; k++) {
      vec2 dd = p.xz - P[k].xy;
      float cs = cos(P[k].z), sn = sin(P[k].z);
      vec2 l = vec2(dd.x * cs - dd.y * sn, dd.x * sn + dd.y * cs);
      l.y += gap * 0.55;                                   // cast a little behind: the key is in front
      vec2 b = abs(l) - vec2(P[k].w * 0.96, gap * 0.2);
      float dist = max(length(max(b, 0.0)) + min(max(b.x, b.y), 0.0), 0.0);
      sh += S[k] * (0.6 * exp(-dist / (gap * 1.15)) + 0.32 * exp(-dist / (H * 0.1)));
    }
    c *= 1.0 - clamp(sh, 0.0, 0.88);
    c *= mix(0.8, 1.0, smoothstep(0.0, H * 0.8, p.z - wallZ));    // the corner where floor meets wall
    col = c;
  } else {
    vec3 p = ro + rd * tw;
    vec2 q = vec2(p.x / (W * 2.2), (p.y - H * 0.1) / (H * 1.0));
    float glow = exp(-dot(q, q) * 1.05);
    float n = noise(p.xy / 260.0) * 0.6 + noise(p.xy / 75.0) * 0.4;
    vec3 c = mix(ink, vec3(0.2, 0.137, 0.071), glow * lights);
    c *= 0.9 + 0.2 * n;                                       // a little plaster in the wall
    col = c;
  }
  vec2 sq = (px - vec2(ctr.x, view.y * 1.08)) / (view.y * vec2(0.95, 0.62));
  col += vec3(0.15, 0.098, 0.05) * spill * exp(-dot(sq, sq));
  gl_FragColor = vec4(col, 1.0);
}`;

const posterVert = /* glsl */`
uniform float bow;     // px the side edges fall back
uniform float curl;    // px the lower-right corner lifts
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec2 p = position.xy;                       // -0.5..0.5; the mesh is scaled to the poster
  float bx = p.x * 2.0;
  float z = -bow * bx * bx;
  float dzdx = -4.0 * bow * bx, dzdy = 0.0;
  float k = clamp((uv.x + (1.0 - uv.y) - 1.42) / 0.58, 0.0, 1.0);
  z += curl * k * k;
  float dk = 2.0 * curl * k / 0.58;
  dzdx += dk; dzdy -= dk;
  vec4 mv = modelViewMatrix * vec4(p, z, 1.0);
  vV = mv.xyz;
  vN = normalize(normalMatrix * vec3(-dzdx, -dzdy, 1.0));
  gl_Position = projectionMatrix * mv;
}`;
const posterFrag = /* glsl */`
precision highp float;
uniform sampler2D map;
uniform float dim, alpha, lights;
uniform float sheenAt;   // where the soft light band crosses the paper; moves as the poster turns
uniform vec2 res;
uniform vec4 edge;     // viewport-edge fade stops (fractions of the width)
uniform vec3 key;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 tex = texture2D(map, vec2(vUv.x, 1.0 - vUv.y)).rgb;
  vec3 n = normalize(vN);
  vec3 V = normalize(-vV);
  vec3 L = normalize(key);
  float lit = 0.6 + 0.47 * max(dot(n, L), 0.0);                       // matte paper under a warm key
  float grad = mix(1.04, 0.9, clamp(vUv.x * 0.35 + (1.0 - vUv.y) * 0.65, 0.0, 1.0));
  float spec = pow(max(dot(n, normalize(L + V)), 0.0), 40.0);
  float band = vUv.x * 0.85 + (1.0 - vUv.y) * 0.4 - sheenAt;
  float sheen = exp(-band * band / 0.018) * 0.055 + spec * 0.05;
  vec2 e = min(vUv, 1.0 - vUv);
  float ao = mix(0.82, 1.0, smoothstep(0.0, 0.028, min(e.x, e.y * 0.8)));
  vec3 c = tex * lit * grad * ao + vec3(1.0, 0.9, 0.74) * sheen;
  c *= vec3(1.03, 0.995, 0.945) * dim * lights;
  float sx = gl_FragCoord.x / res.x;
  float f = smoothstep(edge.x, edge.y, sx) * (1.0 - smoothstep(edge.z, edge.w, sx));
  gl_FragColor = vec4(c, alpha * f);
}`;

export default function register(stage) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 40000);

  const P = Array.from({ length: N }, () => new THREE.Vector4());
  const room = new THREE.ShaderMaterial({
    vertexShader: roomVert, fragmentShader: roomFrag, depthTest: false, depthWrite: false,
    uniforms: {
      res: { value: new THREE.Vector2(1, 1) }, view: { value: new THREE.Vector2(1, 1) }, ctr: { value: new THREE.Vector2() },
      D: { value: 1500 }, floorY: { value: -300 }, wallZ: { value: -2000 }, poolZ: { value: 0 },
      H: { value: 560 }, W: { value: 450 }, gap: { value: 20 }, lights: { value: 1 }, spill: { value: 0 },
      P: { value: P }, S: { value: new Array(N).fill(0) },
    },
  });
  const roomMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), room);
  roomMesh.frustumCulled = false; roomMesh.renderOrder = -100;
  scene.add(roomMesh);

  const blank = new THREE.DataTexture(new Uint8Array([58, 46, 32, 255]), 1, 1);
  blank.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    vertexShader: posterVert, fragmentShader: posterFrag, transparent: true, depthTest: true, depthWrite: true,
    uniforms: {
      map: { value: blank }, dim: { value: 1 }, alpha: { value: 1 }, lights: { value: 1 }, sheenAt: { value: 0.6 },
      bow: { value: 0 }, curl: { value: 0 },
      res: { value: new THREE.Vector2(1, 1) }, edge: { value: new THREE.Vector4(0, 0, 1, 1) },
      key: { value: new THREE.Vector3(-0.36, 0.46, 0.81) },
    },
  });
  const geom = new THREE.PlaneGeometry(1, 1, 32, 40);
  const texs = new Array(N).fill(null);
  const meshes = [];
  // per-poster uniforms: the material is shared, so each mesh writes its own values just before it draws
  function beforeRender() {
    const u = mat.uniforms, d = this.userData;
    u.map.value = texs[d.k] || blank; u.dim.value = d.dim; u.alpha.value = d.alpha;
    u.bow.value = d.bow; u.curl.value = d.curl; u.sheenAt.value = d.sheen;
    mat.uniformsNeedUpdate = true;
  }
  for (let k = 0; k < N; k++) {
    const m = new THREE.Mesh(geom, mat);
    m.userData = { k, dim: 1, alpha: 1, bow: 0, curl: 0, sheen: 0.6 };
    m.onBeforeRender = beforeRender;
    m.frustumCulled = false;
    meshes.push(m); scene.add(m);
  }

  const o = { d: 0, x: 0, z: 0, ry: 0, dim: 1, alpha: 1 };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hits = [];
  let drawn = false, pickKey = NaN, section = null;

  function project(cx, cy, vw, vh, D) {
    // off-axis frustum: world (X, Y, 0) lands on screen (cx + X, cy - Y), whatever the slot's position
    const k = camera.near / D;
    camera.projectionMatrix.makePerspective(-cx * k, (vw - cx) * k, cy * k, -(vh - cy) * k, camera.near, camera.far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.position.set(0, 0, D);
    camera.updateMatrixWorld();
  }
  function pick(x, y) {
    if (!drawn) return -1;
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    hits.length = 0;
    ray.intersectObjects(meshes, false, hits);
    for (let i = 0; i < hits.length; i++) {
      const d = hits[i].object.userData;
      if (hits[i].object.visible && d.alpha > 0.4) return d.k;
    }
    return -1;
  }
  state.pick = pick;

  stage.add({
    id: 'posters', scene, camera,
    post: { grain: 0.05, vignette: 0.3 },
    async load(ctx) {
      const small = ctx.vw < 900;
      const aniso = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
      const opts = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
      await Promise.all(state.items.map(async (it, k) => {
        const res = await fetch(it.src);
        if (!res.ok) throw new Error(`${res.status} ${it.src}`);
        const blob = await res.blob();
        let bmp;
        // phones get a 720 px texture (the centred poster is ~330 CSS px wide there); desktops the 1200 px source
        try { bmp = await createImageBitmap(blob, small ? { ...opts, resizeWidth: 720, resizeHeight: Math.round(720 / it.aspect), resizeQuality: 'high' } : opts); }
        catch { bmp = await createImageBitmap(blob, opts); }
        const t = texture(bmp, { mips: true });
        t.anisotropy = aniso;
        ctx.renderer.initTexture(t);
        texs[k] = t;
      }));
    },
    // outside the stage's mount window: free the seven textures, and hand the posters back to the section's proxy
    // (it shows them again until the scene is back)
    dispose() {
      for (let k = 0; k < N; k++) { texs[k]?.dispose(); texs[k] = null; }
      if (state.gl) { state.gl = false; section?.classList.remove('is-gl'); }
    },
    resize(w, h) { mat.uniforms.res.value.set(w, h); room.uniforms.res.value.set(w, h); },
    activate() { drawn = true; },
    deactivate() { drawn = false; },
    update(ctx, sg) {
      const L = state.L;
      if (!L) return;
      const s = arcAt(ctx.scrollY);
      section = sg.el;
      if (!state.gl) { state.gl = true; state.onGL?.(); }
      const cy = L.cy + s.pinTop;
      project(L.cx, cy, ctx.vw, ctx.vh, L.D);

      const wc = ctx.reduced ? 0 : 1;
      const breathe = Math.sin(ctx.time * 0.55);
      for (let k = 0; k < N; k++) {
        const m = meshes[k], d = m.userData;
        place(k, s.pos, o);
        const w = L.H * state.items[k].aspect;
        const centre = 1 - Math.min(1, Math.abs(o.d) * 1.6);
        // the centred poster leans a touch toward the pointer (fine pointers only; ctx.pointer stays 0 otherwise)
        m.position.set(o.x, 0, o.z);
        m.rotation.set(-ctx.pointer.y * 0.07 * centre * wc, o.ry + ctx.pointer.x * 0.11 * centre * wc, 0);
        m.scale.set(w, L.H, 1);
        m.visible = o.alpha > 0.002;
        m.renderOrder = 100 - Math.round(Math.abs(o.d) * 10);
        d.dim = o.dim; d.alpha = o.alpha;
        d.bow = w * (0.011 + 0.026 * s.flex + 0.003 * breathe * wc);
        d.curl = w * 0.045;
        d.sheen = 0.62 - o.ry * 1.25 - ctx.pointer.x * 0.3 * centre * wc;
        P[k].set(o.x, o.z, o.ry, w * 0.5);
        room.uniforms.S.value[k] = o.alpha * (0.45 + 0.55 * o.dim);
      }
      // hover: re-pick when the pointer moves or the arc turns under it (a still pointer over a still arc costs nothing)
      if (!state.ptr.inside) { state.hover = -1; pickKey = NaN; }
      else {
        const key = state.ptr.x * 7919 + state.ptr.y * 104729 + s.pos * 1299709 + ctx.pointer.x * 31 + ctx.pointer.y * 37;
        if (key !== pickKey) { pickKey = key; state.hover = pick(state.ptr.x, state.ptr.y); }
      }

      const ru = room.uniforms, mu = mat.uniforms, wide = L.H * 0.8;
      ru.view.value.set(ctx.vw, ctx.vh); ru.ctr.value.set(L.cx, cy);
      ru.D.value = L.D; ru.H.value = L.H; ru.W.value = wide; ru.gap.value = L.gap;
      ru.floorY.value = -(L.H * 0.5 + L.gap);
      ru.wallZ.value = -(L.R * 1.25 + L.H * 0.4);
      ru.poolZ.value = -L.R * 0.12;
      ru.lights.value = s.lights;
      ru.spill.value = Math.max(0, Math.min(1, s.pinTop / ctx.vh)) * 0.9;
      mu.lights.value = 0.55 + 0.45 * s.lights;
      mu.edge.value.set(L.edge[0] / ctx.vw, L.edge[1] / ctx.vw, L.edge[2] / ctx.vw, L.edge[3] / ctx.vw);
    },
  });
}
