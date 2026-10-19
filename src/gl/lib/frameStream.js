/* A scroll-scrubbed frame sequence streamed into one texture.
   - Compressed frames are fetched in "nearest missing to the playhead" order, forward first, inside a ±24-frame
     window; Blobs outside the window are released (a return re-reads them from the HTTP cache), so a stream holds
     at most ~49 compressed frames, never the whole sequence, and never fetches it in one burst.
   - A small LRU of decoded ImageBitmaps (createImageBitmap, off the main thread) sits around the playhead; the
     texture always shows the nearest decoded frame and upgrades when the exact one lands (onShow: the stage redraws).
   - A sequence may change size part-way (the hero film's lg tier does at f_0418): a new size gets a new texture.
   Desktop only: phones take the still path (no streams). */
import { DataTexture } from 'three';
import { texture } from './loaders.js';

export class FrameStream {
  constructor({ dir, count, name = (i) => `f_${String(i + 1).padStart(4, '0')}.webp`, rev = 1, ahead = 24, behind = 24, inflight = 6, decoded = 12, onShow = null }) {
    Object.assign(this, { dir, count, name, rev, ahead, behind, maxInflight: inflight, maxDecoded: decoded, onShow });
    this.blobs = new Array(count);
    this.requested = new Set();
    this.inflight = 0;
    this.held = 0;                 // blobs currently held
    this.bitmaps = new Map();      // i -> ImageBitmap
    this.decoding = new Set();
    this.target = 0;
    this.shown = -1;
    this.tex = null;
    this.size = [1920, 1080];
    this.ready = false;
    this.dead = false;
    this._onFirst = null;
  }
  url(i) { return `${this.dir}/${this.name(i)}?v=${this.rev}`; }
  first() { return new Promise((r) => { this._onFirst = r; this.seek(0); }); }
  /* set the playhead (float frame index); call every frame it is drawn */
  seek(f) {
    if (this.dead) return;
    this.target = Math.max(0, Math.min(this.count - 1, f));
    this.release();
    this.pump();
    this.decodeNear();
    this.show();
  }
  inWindow(i) { const c = Math.round(this.target); return i >= c - this.behind && i <= c + this.ahead; }
  nextToLoad() {
    const c = Math.round(this.target);
    const dir = this._dir || 1;
    for (let d = 0; d <= Math.max(this.ahead, this.behind); d++) {
      const f = c + d * dir, b = c - d * dir;
      if (d <= (dir > 0 ? this.ahead : this.behind) && f >= 0 && f < this.count && !this.blobs[f] && !this.requested.has(f)) return f;
      if (d && d <= (dir > 0 ? this.behind : this.ahead) && b >= 0 && b < this.count && !this.blobs[b] && !this.requested.has(b)) return b;
    }
    return -1;
  }
  pump() {
    while (this.inflight < this.maxInflight) {
      const i = this.nextToLoad();
      if (i < 0) break;
      this.requested.add(i); this.inflight++;
      fetch(this.url(i), { priority: Math.abs(i - this.target) < 6 ? 'high' : 'low' })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => { if (this.dead || !b) return; if (this.inWindow(i)) { this.blobs[i] = b; this.held++; } })
        .catch(() => {})
        .finally(() => { this.requested.delete(i); this.inflight--; if (!this.dead) { this.pump(); this.decodeNear(); } });
    }
  }
  /* drop compressed frames that left the window */
  release() {
    const c = Math.round(this.target);
    if (c === this._relAt) return;
    this._relAt = c;
    if (this.held <= this.ahead + this.behind + 1) return;
    for (let i = 0; i < this.count; i++) if (this.blobs[i] && !this.inWindow(i)) { this.blobs[i] = undefined; this.held--; }
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
        if (this.dead) { bmp.close?.(); return; }
        this.bitmaps.set(i, bmp);
        this.evict();
        if (this.show()) this.onShow?.();
      }).catch(() => this.decoding.delete(i));
    }
  }
  evict() {
    if (this.bitmaps.size <= this.maxDecoded) return;
    const c = this.target;
    const far = [...this.bitmaps.keys()].sort((a, b) => Math.abs(b - c) - Math.abs(a - c));
    while (this.bitmaps.size > this.maxDecoded && far.length) {
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
  /* put the nearest decoded frame on the texture; true when it changed */
  show() {
    const i = this.nearestDecoded();
    if (i < 0 || i === this.shown) return false;
    const bmp = this.bitmaps.get(i);
    if (this.tex && (bmp.width !== this.size[0] || bmp.height !== this.size[1])) { this.tex.dispose(); this.tex = null; }
    if (!this.tex) { this.tex = texture(bmp); this.size = [bmp.width, bmp.height]; }
    else { this.tex.image = bmp; this.tex.needsUpdate = true; }
    this.shown = i;
    if (!this.ready) { this.ready = true; this._onFirst?.(); }
    return true;
  }
  /* placeholder texture until the first frame lands */
  get texture() {
    if (this.tex) return this.tex;
    if (!this._blank) { this._blank = new DataTexture(new Uint8Array([11, 8, 5, 255]), 1, 1); this._blank.needsUpdate = true; }
    return this._blank;
  }
  /* free everything (the stage disposes scenes outside its window) */
  dispose() {
    this.dead = true;
    for (const bmp of this.bitmaps.values()) bmp.close?.();
    this.bitmaps.clear(); this.blobs = []; this.held = 0;
    this.tex?.dispose(); this.tex = null;
    this._blank?.dispose(); this._blank = null;
    this._onFirst?.(); this._onFirst = null;
  }
}
