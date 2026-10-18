/* The depth diorama: one painted plate (image, frame stream or video) drawn full-screen with
   cover fit, and moved like a camera using its depth map:
   - pointer parallax: near pixels shift more than far ones (iterated lookup, so silhouettes hold)
   - push: a depth-weighted dolly toward a focus point (near things grow faster than far)
   - zoom / focus: a plain crop move, used for the "camera keys" of each chapter
   Uniforms are set by the scene each frame. */
import * as THREE from 'three';

const vert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const frag = /* glsl */`
precision highp float;
uniform sampler2D map;
uniform sampler2D depth;
uniform float hasDepth;
uniform vec2 res;        // canvas px
uniform vec2 imgSize;    // plate px
uniform vec2 pointer;    // eased, -1..1
uniform float strength;  // parallax amount (uv units)
uniform float zoom;      // >= 1
uniform vec2 focus;      // uv of the zoom/push centre
uniform float push;      // depth-weighted dolly
uniform float exposure;
uniform vec3 tint;
uniform float tintAmt;
uniform float alpha;
varying vec2 vUv;

vec2 cover(vec2 uv) {
  float ra = res.x / res.y, ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
float D(vec2 p) { return texture2D(depth, vec2(p.x, 1.0 - p.y)).r; }
void main() {
  vec2 uv = cover(vUv);
  uv = focus + (uv - focus) / zoom;
  vec2 p = uv;
  if (hasDepth > 0.5) {
    for (int i = 0; i < 5; i++) {
      float d = D(p);
      p = uv + pointer * strength * (d - 0.42) - (uv - focus) * push * (d - 0.3);
    }
  }
  p = clamp(p, vec2(0.001), vec2(0.999));
  vec3 c = texture2D(map, vec2(p.x, 1.0 - p.y)).rgb * exposure;
  c = mix(c, c * tint, tintAmt);
  gl_FragColor = vec4(c, alpha);
}
`;

export function plateMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false, transparent: true,
    uniforms: {
      map: { value: null }, depth: { value: null }, hasDepth: { value: 0 },
      res: { value: new THREE.Vector2(1, 1) }, imgSize: { value: new THREE.Vector2(1920, 1080) },
      pointer: { value: new THREE.Vector2() }, strength: { value: 0.018 },
      zoom: { value: 1.06 }, focus: { value: new THREE.Vector2(0.5, 0.5) }, push: { value: 0 },
      exposure: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) }, tintAmt: { value: 0 }, alpha: { value: 1 },
    },
  });
}
export function fullscreenQuad(material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  m.frustumCulled = false;
  return m;
}
