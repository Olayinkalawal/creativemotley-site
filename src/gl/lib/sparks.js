/* Gold sparks for the "machine" moment: they leave the lens's vanishing point on a logarithmic
   spiral, overshoot, then drift and fade as dust. Everything is computed in the vertex shader from
   one progress uniform, so scrubbing backwards is exact. Drawn additively over the film. */
import * as THREE from 'three';

export function createSparks(count) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seed[i * 4] = Math.random();                 // angle
    seed[i * 4 + 1] = Math.random();             // radius / delay
    seed[i * 4 + 2] = Math.random();             // size
    seed[i * 4 + 3] = Math.random();             // drift
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { prog: { value: 0 }, time: { value: 0 }, aspect: { value: 1 }, centre: { value: new THREE.Vector2(0, 0) }, px: { value: 1 }, alpha: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec4 seed;
      uniform float prog, time, aspect, px; uniform vec2 centre;
      varying float vA; varying float vHot;
      void main() {
        float delay = seed.y * 0.35;
        float t = clamp((prog - delay) / 0.65, 0.0, 1.0);
        float a = seed.x * 6.2831 + t * (3.2 + seed.w * 2.5) + time * 0.05 * (seed.w - 0.5);
        float r = pow(t, 0.75) * (0.25 + seed.y * 1.1) * (1.0 + 0.15 * sin(time * 0.6 + seed.x * 40.0));
        vec2 p = centre + vec2(cos(a) * r / aspect, sin(a) * r * 0.82);
        p.y += t * t * 0.08 * (seed.w - 0.3);
        gl_Position = vec4(p, 0.0, 1.0);
        float life = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.55, 1.0, t));
        vA = life * (0.35 + 0.65 * seed.z);
        vHot = 1.0 - t;
        gl_PointSize = px * (1.0 + seed.z * 2.6) * (1.0 + (1.0 - t) * 1.2);
      }`,
    fragmentShader: /* glsl */`
      uniform float alpha; varying float vA; varying float vHot;
      void main() {
        vec2 q = gl_PointCoord - 0.5; float d = dot(q, q);
        float s = exp(-d * 14.0);
        vec3 col = mix(vec3(0.85, 0.64, 0.33), vec3(1.0, 0.92, 0.74), vHot);
        gl_FragColor = vec4(col * s * vA * alpha, 1.0);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return { points: pts, u: mat.uniforms };
}
