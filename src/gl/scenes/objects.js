/* VI · Process: the seven objects as cut-out planes over a paper desk. Layout, camera and poses come from
   src/sections/process.js (state.L, trackAt, place), so this desk and its CSS-3D proxy (the list's images) are one
   geometry: 1 world unit = 1 CSS px on the plane z = 0 through the slot, the camera sits D px in front of it with an
   off-axis frustum (the slot follows the pin as it arrives and leaves).
   - ground: one full-screen pass that ray-casts the tilted desk: the paper colour with faint world-anchored mottling
     (so the desk visibly travels with the row) and a soft vignette. Above the arriving sheet's torn edge it paints the
     dark room (the stage dissolves the umber room into that, not into paper), and below the sheet that tears off into
     Results it paints ink.
   - shadows: one quad per object lying on the desk: its own silhouette, pre-blurred on a canvas and blurred further
     (mip bias) the higher it floats, plus a soft ambient pool (a blurred ellipse drawn on a canvas). The shadow is
     tight and dark when the object settles, offset, wide and faint when it lifts.
   - objects: premultiplied cut-outs; the active one turns to face you under a soft light band, the resting ones are
     washed a little toward the paper so they recede. Paper grain comes from the stage's post pass. */
import * as THREE from 'three';
import { texture } from '../lib/loaders.js';
import { geo } from '../../core/layout.js';
import { state, trackAt, place, N } from '../../sections/process.js';

/* the reading paper as it renders (--paper under the shell's .paper-grain), so the desk and the sheets match */
const PAPER = [220 / 255, 215 / 255, 197 / 255];

const fullVert = /* glsl */`void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const groundFrag = /* glsl */`
precision highp float;
uniform vec2 res;      // render target px
uniform vec2 view;     // CSS px
uniform vec2 ctr;      // the slot centre on screen (CSS px, from top-left)
uniform float D, Zd, st, ct, off;
uniform float topY, botY;   // screen y: dark above topY (the room the sheet arrives over) and below botY (Results)
uniform float pool;
uniform vec3 paper;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 px = vec2(gl_FragCoord.x * view.x / res.x, (res.y - gl_FragCoord.y) * view.y / res.y);
  vec3 ink = vec3(0.043, 0.031, 0.020);
  if (px.y < topY) {
    vec2 q = (px - vec2(ctr.x, topY)) / view.y * vec2(0.75, 1.7);
    gl_FragColor = vec4(mix(ink, vec3(0.15, 0.1, 0.054), exp(-dot(q, q)) * 0.85), 1.0);
    return;
  }
  if (px.y > botY) { gl_FragColor = vec4(ink, 1.0); return; }
  // the desk: the plane through (0, 0, -Zd) with normal (0, st, ct), seen from (0, 0, D)
  vec3 rd = normalize(vec3(px.x - ctr.x, ctr.y - px.y, -D));
  float t = -(Zd + D) * ct / dot(rd, vec3(0.0, st, ct));
  vec3 p = vec3(0.0, 0.0, D) + rd * t;
  vec2 w = vec2(p.x + off, p.y * ct - (p.z + Zd) * st);
  float m = noise(w / 520.0) * 0.6 + noise(w / 170.0 + 7.3) * 0.3 + noise(w / 46.0 + 3.1) * 0.1 - 0.5;
  vec3 c = paper * (1.0 + m * 0.03);
  // a soft key: a touch brighter around the slot, falling off toward the edges
  vec2 q = (px - ctr) / view.y * vec2(0.62, 1.0);
  c *= 1.0 + pool * (exp(-dot(q, q) * 2.2) - 0.55);
  gl_FragColor = vec4(c, 1.0);
}`;

const quadVert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const shadowFrag = /* glsl */`
precision highp float;
uniform sampler2D smap;    // the object's silhouette, pre-blurred, with padding
uniform sampler2D ell;     // a blurred ellipse
uniform vec2 texel;        // 1 / canvas size
uniform float lod, sil, amb, alpha;
uniform vec2 res;
uniform vec4 edge;
uniform vec3 tone;
varying vec2 vUv;
float A(vec2 uv, float l) { return texture2D(smap, vec2(uv.x, 1.0 - uv.y), l).a; }
void main() {
  vec2 o = texel * exp2(lod) * 0.75;
  float a = 0.25 * (A(vUv + vec2(o.x, o.y * 0.35), lod) + A(vUv - vec2(o.x, o.y * 0.35), lod)
                  + A(vUv + vec2(-o.x * 0.35, o.y), lod) + A(vUv + vec2(o.x * 0.35, -o.y), lod));
  float wide = A(vUv, lod + 2.5);
  float e = texture2D(ell, vUv).a;
  float s = sil * a + amb * e * min(1.0, wide * 2.4);
  float sx = gl_FragCoord.x / res.x;
  float f = smoothstep(edge.x, edge.y, sx) * (1.0 - smoothstep(edge.z, edge.w, sx));
  gl_FragColor = vec4(tone, s * f * alpha);
}`;
const objFrag = /* glsl */`
precision highp float;
uniform sampler2D map;     // premultiplied
uniform float alpha, fog, lit, sheen, sheenAt;
uniform vec2 res;
uniform vec4 edge;
uniform vec3 paper;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vec2(vUv.x, 1.0 - vUv.y));
  vec3 c = t.rgb * lit;
  float band = vUv.x * 0.8 + (1.0 - vUv.y) * 0.45 - sheenAt;
  c += vec3(1.0, 0.95, 0.86) * exp(-band * band / 0.03) * sheen * t.a;
  c = mix(c, paper * t.a, fog);
  float sx = gl_FragCoord.x / res.x;
  float f = smoothstep(edge.x, edge.y, sx) * (1.0 - smoothstep(edge.z, edge.w, sx));
  float k = alpha * f;
  gl_FragColor = vec4(c * k, t.a * k);
}`;

/* the object's silhouette, blurred on a canvas with room around it to spread */
const SW0 = 160, PAD = 40;
function silhouette(img) {
  const w = SW0, h = Math.max(8, Math.round((SW0 * img.height) / img.width));
  const s = document.createElement('canvas'); s.width = w; s.height = h;
  const sg = s.getContext('2d');
  sg.drawImage(img, 0, 0, w, h);
  sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, w, h);
  const c = document.createElement('canvas'); c.width = w + PAD * 2; c.height = h + PAD * 2;
  const g = c.getContext('2d');
  if (typeof g.filter === 'string') { g.filter = 'blur(2.5px)'; g.drawImage(s, PAD, PAD); }
  else {   // no canvas filters: down, then up again
    const m = document.createElement('canvas'); m.width = Math.ceil(w / 4); m.height = Math.ceil(h / 4);
    const mg = m.getContext('2d'); mg.imageSmoothingQuality = 'high'; mg.drawImage(s, 0, 0, m.width, m.height);
    g.imageSmoothingQuality = 'high'; g.drawImage(m, PAD, PAD, w, h);
  }
  return c;
}
function ellipse() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 8; i++) { const x = i / 8; gr.addColorStop(x, `rgba(0,0,0,${Math.exp(-x * x * 3.2) * (1 - x)})`); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}

export default function register(stage) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 40000);

  const ground = new THREE.ShaderMaterial({
    vertexShader: fullVert, fragmentShader: groundFrag, depthTest: false, depthWrite: false,
    uniforms: {
      res: { value: new THREE.Vector2(1, 1) }, view: { value: new THREE.Vector2(1, 1) }, ctr: { value: new THREE.Vector2() },
      D: { value: 1500 }, Zd: { value: 500 }, st: { value: 0.48 }, ct: { value: 0.88 }, off: { value: 0 },
      topY: { value: -1 }, botY: { value: 1e6 }, pool: { value: 0.035 }, paper: { value: new THREE.Vector3(...PAPER) },
    },
  });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ground);
  groundMesh.frustumCulled = false; groundMesh.renderOrder = -1000;
  scene.add(groundMesh);

  const quad = new THREE.PlaneGeometry(1, 1);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
  let ellTex = blank;
  const edge = new THREE.Vector4(0, 0, 1, 1), res = new THREE.Vector2(1, 1), paper = new THREE.Vector3(...PAPER);
  const objs = [], shadows = [];
  for (let k = 0; k < N; k++) {
    const om = new THREE.ShaderMaterial({
      vertexShader: quadVert, fragmentShader: objFrag, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      uniforms: {
        map: { value: blank }, alpha: { value: 0 }, fog: { value: 0 }, lit: { value: 1 }, sheen: { value: 0 }, sheenAt: { value: 0.5 },
        res: { value: res }, edge: { value: edge }, paper: { value: paper },
      },
    });
    const sm = new THREE.ShaderMaterial({
      vertexShader: quadVert, fragmentShader: shadowFrag, transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        smap: { value: blank }, ell: { value: blank }, texel: { value: new THREE.Vector2(0.01, 0.01) },
        lod: { value: 0 }, sil: { value: 0 }, amb: { value: 0 }, alpha: { value: 0 },
        res: { value: res }, edge: { value: edge }, tone: { value: new THREE.Vector3(0.17, 0.115, 0.06) },
      },
    });
    const o = new THREE.Mesh(quad, om); o.frustumCulled = false;
    const s = new THREE.Mesh(quad, sm); s.frustumCulled = false; s.renderOrder = -500 + k;
    objs.push(o); shadows.push(s);
    scene.add(s); scene.add(o);
  }

  const o = {};
  let ready = false;
  function project(cx, cy, vw, vh, D) {
    // off-axis frustum: world (X, Y, 0) lands on screen (cx + X, cy - Y), wherever the slot is
    const k = camera.near / D;
    camera.projectionMatrix.makePerspective(-cx * k, (vw - cx) * k, cy * k, -(vh - cy) * k, camera.near, camera.far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.position.set(0, 0, D);
    camera.updateMatrixWorld();
  }

  stage.add({
    id: 'objects', scene, camera,
    post: { grain: 0.04, vignette: 0.3, fringe: 0.5 },
    async load(ctx) {
      const aniso = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
      const opts = { colorSpaceConversion: 'none', premultiplyAlpha: 'premultiply' };
      ellTex = texture(ellipse(), { mips: false });
      await Promise.all(state.items.map(async (it, k) => {
        const r = await fetch(it.src);
        if (!r.ok) throw new Error(`${r.status} ${it.src}`);
        const bmp = await createImageBitmap(await r.blob(), opts);
        const t = texture(bmp, { mips: true }); t.anisotropy = aniso;
        ctx.renderer.initTexture(t);
        const sc = silhouette(bmp);
        const st = texture(sc, { mips: true });
        ctx.renderer.initTexture(st);
        const om = objs[k].material.uniforms, sm = shadows[k].material.uniforms;
        om.map.value = t;
        sm.smap.value = st; sm.ell.value = ellTex;
        sm.texel.value.set(1 / sc.width, 1 / sc.height);
        shadows[k].userData.pad = [sc.width / (sc.width - PAD * 2), sc.height / (sc.height - PAD * 2)];
      }));
      ready = true;
    },
    resize(w, h) { res.set(w, h); ground.uniforms.res.value.set(w, h); },
    update(ctx) {
      const L = state.L;
      if (!L || !ready) return;
      const s = trackAt(ctx.scrollY);
      if (!state.gl) { state.gl = true; state.onGL?.(); }
      const cy = L.cy + s.pinTop;
      project(L.cx, cy, ctx.vw, ctx.vh, L.D);
      edge.set(L.edge[0] / ctx.vw, L.edge[1] / ctx.vw, L.edge[2] / ctx.vw, L.edge[3] / ctx.vw);

      const live = ctx.reduced ? 0 : 1, px = ctx.pointer.x * live, py = ctx.pointer.y * live, tm = ctx.time;
      for (let k = 0; k < N; k++) {
        place(k, s.pos, s.lift, o);
        const a = o.a, m = objs[k], sh = shadows[k];
        // the active object breathes a little and leans toward a fine pointer
        m.position.set(o.x, o.y + Math.sin(tm * 0.8 + k) * 2.5 * a * live, o.z);
        m.rotation.set(o.rx - py * 0.1 * a, o.ry + px * 0.16 * a, o.rz + Math.sin(tm * 0.55 + k * 1.7) * 0.006 * a * live);
        m.scale.set(o.w, o.hgt, 1);
        m.renderOrder = Math.round(o.z) + 2000;
        const far = Math.max(0, Math.abs(o.d) - 1);
        const ou = m.material.uniforms;
        ou.alpha.value = 1 - Math.min(1, Math.max(0, Math.abs(o.d) - 2.4) / 0.8);
        ou.fog.value = Math.min(0.3, 0.12 + 0.07 * far) * (1 - a);
        ou.lit.value = 0.975 + 0.045 * a;
        ou.sheen.value = 0.09 * Math.sin(Math.PI * a) + 0.025 * a;
        ou.sheenAt.value = 1.25 - 0.95 * a - px * 0.18 * a;
        // its shadow on the desk: tight and dark when it rests, wide, offset and faint when it lifts
        const hn = o.h / (L.SW * 0.9);                  // 0 resting … ~1 lifted
        const pad = sh.userData.pad || [1.5, 1.5];
        const grow = 1 + 0.12 * hn;
        sh.position.set(o.su, o.sv * L.ct + 0.5 * L.st, -L.Zd - o.sv * L.st + 0.5 * L.ct);
        sh.rotation.set(-L.tau, 0, o.rz * (1 - 0.5 * a));
        sh.scale.set(o.w * pad[0] * grow, o.hgt * pad[1] * grow * (1 - 0.08 * a), 1);
        const su = sh.material.uniforms;
        const hc = Math.min(1, hn);
        su.lod.value = 0.2 + hc * 3.0;
        su.sil.value = 0.42 * (1 - 0.64 * hc);
        su.amb.value = 0.22 * (1 - 0.7 * hc);
        su.alpha.value = ou.alpha.value;
      }
      const gu = ground.uniforms;
      gu.view.value.set(ctx.vw, ctx.vh); gu.ctr.value.set(L.cx, cy);
      gu.D.value = L.D; gu.Zd.value = L.Zd; gu.st.value = L.st; gu.ct.value = L.ct;
      gu.off.value = s.pos * L.S;
      gu.topY.value = s.pinTop > 0 ? s.pinTop : -1;
      gu.botY.value = s.bottom < ctx.vh + 30 ? s.bottom : 1e6;
      // the post vignette: the room's while it dissolves in, soft over the desk, the next painting's as the sheet
      // tears off into Results (the switches happen while paper covers the screen)
      const panelTop = geo(L.run).bottom - ctx.scrollY;
      this.post.vignette = panelTop <= 0 ? 0.32 : 0.3 - (0.3 - 0.07) * (1 - s.cover);
    },
  });
}
