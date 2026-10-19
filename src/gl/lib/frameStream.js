/* A scroll-scrubbed frame sequence streamed into one texture.
   - Compressed frames are fetched into a Blob cache in "nearest missing to the playhead" order,
     biased forward, inside a window (ported from the live site's pump: a visit costs what you watch).
   - A small LRU of decoded ImageBitmaps (createImageBitmap, off the main thread) sits around the
     playhead; the texture always shows the nearest decoded frame and upgrades when the exact one lands.
   Phones use the 1100 px tier; desktops the full tier. */
import * as THREE from 'three';
import { texture } from './loaders.js';

export class FrameStream {
  constructor({ dir, count, name = (i) => `f_${String(i + 1).padStart(4, '0')}.webp`, rev = 1, ahead = 120, behind = 30, inflight = 8, decoded = 14 }) {
    Object.assign(this, { dir, count, name, rev, ahead, behind, maxInflight: inflight, maxDecoded: decoded });
    this.blobs = new Array(count);
    this.requested = new Set();
    this.inflight = 0;
    this.fetched = 0;
    this.bitmaps = new Map();      // i -> ImageBitmap
    this.decoding = new Set();
    this.target = 0;
    this.shown = -1;
    this.tex = null;
    this.size = [1920, 1080];
    this.ready = false;
    this._onFirst = null;
  }
  /* every frame fetched (compressed, in the blob cache) */
  get complete() { return this.fetched >= this.count; }
  url(i) { return `${this.dir}/${this.name(i)}?v=${this.rev}`; }
  first() { return new Promise((r) => { this._onFirst = r; this.seek(0); }); }
  /* set the playhead (float frame index); call every frame */
  seek(f) {
    this.target = Math.max(0, Math.min(this.count - 1, f));
    this.pump();
    this.decodeNear();
    this.show();
  }
  nextToLoad() {
    const c = Math.round(this.target);
    for (let d = 0; d <= this.ahead; d++) {
      const f = c + d;
      if (f < this.count && !this.blobs[f] && !this.requested.has(f)) return f;
      if (d && d <= this.behind) { const b = c - d; if (b >= 0 && !this.blobs[b] && !this.requested.has(b)) return b; }
    }
    return -1;
  }
  pump() {
    while (this.inflight < this.maxInflight) {
      const i = this.nextToLoad();
      if (i < 0) break;
      this.requested.add(i); this.inflight++;
      fetch(this.url(i), { priority: Math.abs(i - this.target) < 8 ? 'high' : 'low' })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => { this.blobs[i] = b; if (b) this.fetched++; })
        .catch(() => { this.requested.delete(i); })
        .finally(() => { this.inflight--; this.pump(); this.decodeNear(); });
    }
  }
  decodeNear() {
    const c = Math.round(this.target);
    const dir = this._lastT === undefined ? 1 : Math.sign(this.target - this._lastT) || this._dir || 1;
    this._dir = dir; this._lastT = this.target;
    const order = [c, c + dir, c + 2 * dir, c - dir, c + 3 * dir, c + 4 * dir];
    for (const i of order) {
      if (i < 0 || i >= this.count || this.bitmaps.has(i) || this.decoding.has(i) || !this.blobs[i]) continue;
      if (this.decoding.size >= 3) break;
      this.decoding.add(i);
      createImageBitmap(this.blobs[i], { colorSpaceConversion: 'none' }).then((bmp) => {
        this.decoding.delete(i);
        this.bitmaps.set(i, bmp);
        this.evict();
        this.show();
      }).catch(() => this.decoding.delete(i));
    }
  }
  evict() {
    if (this.bitmaps.size <= this.maxDecoded) return;
    const c = this.target;
    const far = [...this.bitmaps.keys()].sort((a, b) => Math.abs(b - c) - Math.abs(a - c));
    while (this.bitmaps.size > this.maxDecoded) {
      const i = far.shift();
      if (i === this.shown) continue;
      this.bitmaps.get(i).close?.(); this.bitmaps.delete(i);
    }
  }
  /* release every decoded frame except the one on screen (a scene that is not being drawn keeps only its blobs;
     seeking again decodes from them) */
  trim() {
    if (this.bitmaps.size <= 1) return;
    for (const [i, bmp] of this.bitmaps) if (i !== this.shown) { bmp.close?.(); this.bitmaps.delete(i); }
  }
  nearestDecoded() {
    const c = Math.round(this.target);
    if (this.bitmaps.has(c)) return c;
    let best = -1, bd = 1e9;
    for (const i of this.bitmaps.keys()) { const d = Math.abs(i - c); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  show() {
    const i = this.nearestDecoded();
    if (i < 0 || i === this.shown) return;
    const bmp = this.bitmaps.get(i);
    // a sequence may change resolution part-way (the hero film's lg tier does at f_0418): an allocated GPU
    // texture cannot grow in place, so a new size gets a new texture (scenes read .texture every frame)
    if (this.tex && (bmp.width !== this.size[0] || bmp.height !== this.size[1])) { this.tex.dispose(); this.tex = null; }
    if (!this.tex) { this.tex = texture(bmp); this.size = [bmp.width, bmp.height]; }
    else { this.tex.image = bmp; this.tex.needsUpdate = true; }
    this.shown = i;
    if (!this.ready) { this.ready = true; this._onFirst?.(); }
  }
  /* placeholder texture until the first frame lands */
  get texture() {
    if (this.tex) return this.tex;
    if (!this._blank) { this._blank = new THREE.DataTexture(new Uint8Array([11, 8, 5, 255]), 1, 1); this._blank.needsUpdate = true; }
    return this._blank;
  }
}
