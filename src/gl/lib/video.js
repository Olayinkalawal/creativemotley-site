/* A scroll-scrubbed video as a texture (the hero film; any device sequence kept as video).
   Sources are short-GOP encodes (a keyframe every 6 frames, scripts/encode-film.sh), so any frame decodes from at most
   five others: AV1 where canPlayType says so, H.264 for every other browser.
   - seek(f): the playhead in frames (float); at most one seek in flight, the latest target wins (coalesced), so a
     fast scroll skips frames instead of queueing them;
   - the texture is re-uploaded only when the browser has the sought frame ('seeked'; requestVideoFrameCallback
     where it fires for paused seeks), never per tick; onShow lets the stage redraw;
   - stats: seek latency (currentTime set → frame ready), in ms, for QA (window.__stage film scene).
   No playable source (or a decode error): ok = false, and the caller falls back to its frame stream. */
import { Texture, LinearFilter, NoColorSpace } from 'three';

export function playable(sources) {
  const v = document.createElement('video');
  return sources.filter((s) => !s.type || v.canPlayType(s.type) !== '');
}

export class VideoScrub {
  constructor({ sources, fps = 30, count, onShow = null }) {
    this.fps = fps; this.count = count; this.onShow = onShow;
    this.queue = playable(sources);
    this.source = this.queue.shift() || null;
    this.ok = !!this.source;
    this.ready = false; this.target = 0; this.shown = -1; this.pending = -1; this.t0 = 0;
    this.lat = []; this.size = [1920, 1080];
    if (!this.ok) return;
    const v = (this.video = document.createElement('video'));
    // first frame only at load (the first-load budget); the rest buffers once the playhead leaves frame 0 (warm)
    v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.crossOrigin = 'anonymous'; v.disablePictureInPicture = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    const t = (this.tex = new Texture(v));
    t.flipY = false; t.colorSpace = NoColorSpace; t.generateMipmaps = false;
    t.minFilter = t.magFilter = LinearFilter;
    this._done = () => this.landed();
    v.addEventListener('seeked', this._done);
    this.first = new Promise((resolve) => {
      v.addEventListener('loadeddata', () => {
        this.size = [v.videoWidth, v.videoHeight];
        this.ready = true;
        this.seekTo(this.target);
        resolve();
      }, { once: true });
      // a source that fails (missing, or a decoder that refuses it): the next playable one, then give up
      v.addEventListener('error', () => {
        if (this.ready) { this.ok = false; this.onShow?.(); return; }
        this.source = this.queue.shift() || null;
        if (this.source) { v.src = this.source.src; v.load(); }
        else { this.ok = false; resolve(); }
      });
    });
    v.src = this.source.src;
    v.load();
    // a browser that will not decode a first frame on preload="metadata": buffer properly after a moment
    this._warmT = setTimeout(() => { if (!this.ready) this.warm(); }, 1500);
  }
  /* start buffering the whole film (from the first scroll into it) */
  warm() {
    if (this.warmed || !this.video) return;
    this.warmed = true;
    this.video.preload = 'auto';
  }
  timeOf(i) { return (i + 0.5) / this.fps; }
  seek(f) {
    if (!this.ok) return;
    this.target = Math.max(0, Math.min(this.count - 1, Math.round(f)));
    if (this.target > 0) this.warm();
    if (!this.ready || this.pending >= 0 || this.target === this.shown) return;
    this.seekTo(this.target);
  }
  seekTo(i) {
    const v = this.video;
    if (Math.abs(v.currentTime - this.timeOf(i)) < 0.25 / this.fps && !v.seeking && this.shown === i) return;
    this.pending = i; this.t0 = performance.now();
    v.currentTime = this.timeOf(i);
  }
  landed() {
    if (this.pending < 0) return;
    this.lat.push(performance.now() - this.t0); if (this.lat.length > 400) this.lat.shift();
    this.shown = this.pending; this.pending = -1;
    this.tex.needsUpdate = true;
    this.onShow?.();
    if (this.target !== this.shown) this.seekTo(this.target);
  }
  get texture() { return this.tex; }
  stats() {
    const s = [...this.lat].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0;
    return { n: s.length, p50: +q(0.5).toFixed(1), p90: +q(0.9).toFixed(1), max: +q(1).toFixed(1), src: this.source?.src };
  }
  dispose() {
    clearTimeout(this._warmT);
    if (!this.video) return;
    this.video.removeEventListener('seeked', this._done);
    this.video.removeAttribute('src'); this.video.load();   // frees the decoder
    this.tex?.dispose();
    this.ok = false; this.ready = false;
  }
}
