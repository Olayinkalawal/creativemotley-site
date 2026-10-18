/* Image → GPU helpers. Every texture in this project is uploaded with flipY = false and the
   shaders sample with v flipped (ImageBitmap ignores UNPACK_FLIP_Y, so this keeps one rule). */
import * as THREE from 'three';

export async function bitmap(url, opts = {}) {
  const res = await fetch(url, { priority: opts.priority || 'auto' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const blob = await res.blob();
  return createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: opts.premultiply ? 'premultiply' : 'none' });
}
export function texture(img, { linear = true, mips = false, repeat = false } = {}) {
  const t = new THREE.Texture(img);
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : (linear ? THREE.LinearFilter : THREE.NearestFilter);
  t.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
export async function loadTexture(url, opts) { return texture(await bitmap(url, opts), opts); }
/* a video element as a texture (muted, inline, looped); play/pause is the caller's job */
export function videoTexture(sources) {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  for (const s of sources) { const e = document.createElement('source'); e.src = s.src; if (s.type) e.type = s.type; v.appendChild(e); }
  const t = new THREE.VideoTexture(v);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  return { video: v, texture: t };
}
