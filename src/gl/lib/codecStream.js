/* WebCodecs scrubber for our own short-GOP MP4s (scripts/encode-film.sh: one video track, moov first, a keyframe
   every 8 frames, closed GOPs). Seeking a <video> re-decodes the whole GOP on every seek and measured ~100 ms
   median even on an idle page; here each GOP is decoded once, in order, into a small cache of ImageBitmaps around
   the playhead, so scrubbing forward and back shows exact frames from memory, and the decoder keeps a GOP ahead.
   - demux: only what our encodes contain (stsd avc1/avcC or av01/av1C, stts, ctts, stss, stsz, stsc, stco/co64);
   - bytes: the moov first (one Range request), then each GOP's samples (contiguous in the mdat) with a Range request
     when the playhead nears it: a ±3-GOP window (±24 frames), released outside it;
   - the same face as FrameStream (seek / texture / size / ready / first / trim / dispose / onShow), so the film
     scene uses either; open() resolves null when the browser, the file, or (by default) a hardware decoder is not
     available: the caller falls back to the <video> element, then to the frame streams.
   Desktop only (phones take the still path). */
import { texture } from './loaders.js';

const u32 = (d, o) => d.getUint32(o);
const fourcc = (d, o) => String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);

function boxes(d, start, end, out = {}) {
  for (let o = start; o + 8 <= end;) {
    let size = u32(d, o); const type = fourcc(d, o + 4); let hdr = 8;
    if (size === 1) { size = Number(d.getBigUint64(o + 8)); hdr = 16; } else if (size === 0) size = end - o;
    if (size < hdr || o + size > end) break;
    if (CONTAINERS.has(type)) { if (type === 'trak' && out.stsd) break; boxes(d, o + hdr, o + size, out); }
    else if (!out[type]) out[type] = { o: o + hdr, end: o + size };
    o += size;
  }
  return out;
}
const hex = (n) => n.toString(16).padStart(2, '0');

/* moov → { codec, description, width, height, samples: [{ off, size, key, pts }] (decode order), timescale } */
function demux(d, moov) {
  const b = boxes(d, moov.o, moov.end);
  if (!b.stsd || !b.stsz || !b.stco && !b.co64 || !b.stts || !b.mdhd) return null;
  const ver = d.getUint8(b.mdhd.o);
  const timescale = u32(d, b.mdhd.o + (ver === 1 ? 20 : 12));
  // sample entry
  const e = b.stsd.o + 8, etype = fourcc(d, e + 4);
  const width = d.getUint16(e + 32), height = d.getUint16(e + 34);
  const kids = boxes(d, e + 86, e + u32(d, e));
  let codec, description;
  if ((etype === 'avc1' || etype === 'avc3') && kids.avcC) {
    const c = kids.avcC.o;
    codec = `avc1.${hex(d.getUint8(c + 1))}${hex(d.getUint8(c + 2))}${hex(d.getUint8(c + 3))}`;
    description = new Uint8Array(d.buffer, d.byteOffset + c, kids.avcC.end - c).slice();
  } else if (etype === 'av01' && kids.av1C) {
    const c = kids.av1C.o, b1 = d.getUint8(c + 1), b2 = d.getUint8(c + 2);
    const bits = b2 & 0x40 ? (b2 & 0x20 ? 12 : 10) : 8;
    codec = `av01.${b1 >> 5}.${String(b1 & 31).padStart(2, '0')}${b2 & 0x80 ? 'H' : 'M'}.${String(bits).padStart(2, '0')}`;
    description = new Uint8Array(d.buffer, d.byteOffset + c, kids.av1C.end - c).slice();
  } else return null;
  // sizes
  const sz = b.stsz.o, fixed = u32(d, sz + 4), n = u32(d, sz + 8);
  const size = (i) => (fixed || u32(d, sz + 12 + i * 4));
  // chunk offsets + samples per chunk
  const co = b.stco || b.co64, wide = !b.stco, nc = u32(d, co.o + 4);
  const chunkOff = (i) => (wide ? Number(d.getBigUint64(co.o + 8 + i * 8)) : u32(d, co.o + 8 + i * 4));
  const sc = b.stsc.o, nsc = u32(d, sc + 4);
  const samples = new Array(n);
  let s = 0;
  for (let k = 0; k < nsc; k++) {
    const first = u32(d, sc + 8 + k * 12) - 1, per = u32(d, sc + 12 + k * 12);
    const last = k + 1 < nsc ? u32(d, sc + 8 + (k + 1) * 12) - 1 : nc;
    for (let ch = first; ch < last && s < n; ch++) {
      let off = chunkOff(ch);
      for (let j = 0; j < per && s < n; j++) { const z = size(s); samples[s++] = { off, size: z, key: !b.stss, pts: 0 }; off += z; }
    }
  }
  if (s < n) return null;
  if (b.stss) { const ns = u32(d, b.stss.o + 4); for (let k = 0; k < ns; k++) { const i = u32(d, b.stss.o + 8 + k * 4) - 1; if (samples[i]) samples[i].key = true; } }
  // timing: dts from stts, + ctts
  let t = 0, i = 0;
  for (let k = 0, ne = u32(d, b.stts.o + 4); k < ne; k++) {
    const cnt = u32(d, b.stts.o + 8 + k * 8), dl = u32(d, b.stts.o + 12 + k * 8);
    for (let j = 0; j < cnt && i < n; j++) { samples[i++].pts = t; t += dl; }
  }
  if (b.ctts) {
    const cv = d.getUint8(b.ctts.o);
    i = 0;
    for (let k = 0, ne = u32(d, b.ctts.o + 4); k < ne; k++) {
      const cnt = u32(d, b.ctts.o + 8 + k * 8), off = cv ? d.getInt32(b.ctts.o + 12 + k * 8) : u32(d, b.ctts.o + 12 + k * 8);
      for (let j = 0; j < cnt && i < n; j++) samples[i++].pts += off;
    }
  }
  return { codec, description, width, height, samples, timescale };
}

export class CodecStream {
  /* resolves a ready stream, or null (no WebCodecs, an unsupported codec, a file we cannot read) */
  static async open({ sources, count, onShow = null, window: win = 3, decoded = 20, hardware = true }) {
    if (typeof VideoDecoder === 'undefined' || typeof EncodedVideoChunk === 'undefined') return null;
    for (const s of sources) {
      try {
        // the source's declared codec answers "is there a hardware decoder?" before a byte is fetched
        const declared = (s.type || '').match(/codecs="?([^",]+)/)?.[1];
        if (hardware && declared) {
          const q = await VideoDecoder.isConfigSupported({ codec: declared, codedWidth: 1920, codedHeight: 1080, hardwareAcceleration: 'prefer-hardware' }).catch(() => null);
          if (!q?.supported) continue;
        }
        const st = new CodecStream(s.src, count, onShow, win, decoded);
        st.requireHw = hardware;
        if (await st.init()) return st;
        st.dispose();
      } catch { /* the next source */ }
    }
    return null;
  }
  constructor(src, count, onShow, win, decoded) {
    Object.assign(this, { src, count, onShow, win, maxDecoded: decoded });
    this.bitmaps = new Map(); this.bytes = new Map(); this.fetching = new Set();
    this.target = 0; this.shown = -1; this.tex = null; this.size = [1920, 1080]; this.ready = false; this.dead = false;
    this.busy = false; this.dir = 1; this.lastT = 0; this.lat = []; this.asked = new Map();
  }
  async range(a, b) {
    const r = await fetch(this.src, { headers: { Range: `bytes=${a}-${b}` } });
    if (!r.ok) throw new Error(`${r.status}`);
    const buf = await r.arrayBuffer();
    if (r.status === 200) { this.whole = buf; return buf.slice(a, b + 1); }   // a server without ranges: keep it all
    return buf;
  }
  async init() {
    let head = await this.range(0, 65535);
    let d = new DataView(head);
    let moov = null;
    for (let o = 0; o + 8 <= d.byteLength;) {
      const size = u32(d, o), type = fourcc(d, o + 4);
      if (type === 'moov') { moov = { at: o, size }; break; }
      if (size < 8) break;
      o += size;
    }
    if (!moov) return false;
    if (moov.at + moov.size > head.byteLength) { head = await this.range(0, moov.at + moov.size - 1); d = new DataView(head); }
    const m = demux(d, { o: moov.at + 8, end: moov.at + moov.size });
    if (!m) return false;
    const cfg = { codec: m.codec, description: m.description, codedWidth: m.width, codedHeight: m.height, optimizeForLatency: true };
    const sup = await VideoDecoder.isConfigSupported(cfg).catch(() => null);
    if (!sup || !sup.supported) return false;
    // a hardware decoder makes decoding ahead cheap; in software, decode only what the playhead asks for (below)
    this.hw = !!(await VideoDecoder.isConfigSupported({ ...cfg, hardwareAcceleration: 'prefer-hardware' }).catch(() => null))?.supported;
    // measured: with a software decoder, decoding every GOP on the page's own process slowed scrolling more than the
    // <video> element's seeks did (the caller falls back to it), so by default this path runs on hardware decode only
    if (this.requireHw && !this.hw) return false;
    // frames in presentation order; GOPs in decode order (keyframe to keyframe)
    const order = m.samples.map((s, i) => i).sort((a, b) => m.samples[a].pts - m.samples[b].pts);
    this.frameOfPts = new Map(order.map((si, f) => [Math.round((m.samples[si].pts * 1e6) / m.timescale), f]));
    this.samples = m.samples; this.timescale = m.timescale; this.size = [m.width, m.height];
    this.gops = [];
    m.samples.forEach((s, i) => { if (s.key || !this.gops.length) this.gops.push({ from: i, to: i, frames: [] }); this.gops[this.gops.length - 1].to = i; });
    this.gopOf = new Array(order.length);
    this.gops.forEach((g, gi) => { for (let i = g.from; i <= g.to; i++) { const f = this.frameOfPts.get(Math.round((m.samples[i].pts * 1e6) / m.timescale)); g.frames.push(f); this.gopOf[f] = gi; } });
    this.count = Math.min(this.count, order.length);
    this.decoder = new VideoDecoder({ output: (fr) => this.output(fr), error: () => { this.failed = true; } });
    this.decoder.configure(cfg);
    await this.decodeGop(0);
    return this.ready;
  }
  first() { return Promise.resolve(); }
  output(frame) {
    const f = this.frameOfPts.get(frame.timestamp);
    // software decode: keep only the frames the playhead is heading for (each copy-out is a full-frame conversion)
    const near = this.cheap || (f - this.target) * this.dir >= -2 && (f - this.target) * this.dir <= 7;
    if (f === undefined || this.dead || this.bitmaps.has(f) || !near) { frame.close(); return; }
    // copy out and release the decoder's frame at once (a held VideoFrame can stall a hardware decoder's pool)
    const p = createImageBitmap(frame).then((bmp) => { frame.close(); return bmp; }, () => { frame.close(); return null; });
    this.pending.push(p.then((bmp) => {
      if (!bmp) return;
      if (this.dead) { bmp.close(); return; }
      this.bitmaps.set(f, bmp);
    }));
  }
  async gopBytes(gi) {
    const g = this.gops[gi], a = this.samples[g.from].off, last = this.samples[g.to], b = last.off + last.size - 1;
    if (this.whole) return { buf: this.whole, base: 0 };
    let e = this.bytes.get(gi);
    if (!e) { e = { p: this.range(a, b).then((buf) => ({ buf, base: a })) }; this.bytes.set(gi, e); }
    return e.p;
  }
  async decodeGop(gi) {
    const g = this.gops[gi];
    const { buf, base } = await this.gopBytes(gi);
    if (this.dead) return;
    this.pending = [];
    for (let i = g.from; i <= g.to; i++) {
      const s = this.samples[i];
      this.decoder.decode(new EncodedVideoChunk({ type: s.key ? 'key' : 'delta', timestamp: Math.round((s.pts * 1e6) / this.timescale), data: new Uint8Array(buf, s.off - base, s.size) }));
    }
    const t0 = performance.now();
    await this.decoder.flush();
    await Promise.all(this.pending);
    // decoding ahead pays off only where a GOP decodes quickly (hardware, or a fast core)
    this.decodeMs = performance.now() - t0;
    this.cheap = this.hw || this.decodeMs < 40;
    this.evict();
    if (this.show()) this.onShow?.();
  }
  /* the playhead (float frame); call every frame it is drawn */
  seek(f) {
    if (this.dead || !this.gops) return;
    const t = Math.max(0, Math.min(this.count - 1, Math.round(f)));
    if (t !== this.target) { this.dir = Math.sign(t - this.target) || this.dir; this.target = t; if (!this.asked.has(t)) this.asked.set(t, performance.now()); }
    this.prefetch();
    this.pump();
    this.show();
  }
  /* GOP bytes for the window ahead (and one behind), released outside it; at rest on frame 0 only the first two GOPs
     (the first-load budget), the window once the playhead moves */
  prefetch() {
    const g = this.gopOf[this.target] ?? 0;
    if (this.target > 0) this.moved = true;
    const ahead = this.moved ? this.win : 1;
    for (let k = -1; k <= ahead; k++) { const gi = g + k * this.dir; if (gi >= 0 && gi < this.gops.length) this.gopBytes(gi); }
    for (const gi of this.bytes.keys()) if (Math.abs(gi - g) > this.win + 1) this.bytes.delete(gi);
  }
  /* decode the GOP the playhead is in, then the next one in the direction of travel (2 GOPs = 16 frames, inside the
     20-frame cache, so the decoder never chases frames it has just evicted) */
  pump() {
    if (this.busy || this.failed) return;
    const g = this.gopOf[this.target] ?? 0;
    let next = -1;
    for (const gi of this.cheap ? [g, g + this.dir] : [g]) {
      if (gi < 0 || gi >= this.gops.length) continue;
      const want = this.cheap ? this.gops[gi].frames : [this.target];
      if (!want.every((f) => this.bitmaps.has(f))) { next = gi; break; }
    }
    if (next < 0) return;
    this.busy = true;
    this.decodeGop(next).catch(() => { this.failed = true; }).finally(() => { this.busy = false; if (!this.dead) this.pump(); });
  }
  evict() {
    if (this.bitmaps.size <= this.maxDecoded) return;
    const g = this.gopOf[this.target] ?? 0, keep = new Set([g, g + this.dir]);
    const c = this.target, far = [...this.bitmaps.keys()].sort((a, b) => Math.abs(b - c) - Math.abs(a - c));
    while (this.bitmaps.size > this.maxDecoded && far.length) {
      const i = far.shift();
      if (i === this.shown || keep.has(this.gopOf[i])) continue;
      this.bitmaps.get(i).close?.(); this.bitmaps.delete(i);
    }
  }
  trim() { for (const [i, b] of this.bitmaps) if (i !== this.shown) { b.close?.(); this.bitmaps.delete(i); } }
  nearest() {
    if (this.bitmaps.has(this.target)) return this.target;
    let best = -1, bd = 1e9;
    for (const i of this.bitmaps.keys()) { const dd = Math.abs(i - this.target); if (dd < bd) { bd = dd; best = i; } }
    return best;
  }
  show() {
    const i = this.nearest();
    if (i < 0 || i === this.shown) return false;
    const bmp = this.bitmaps.get(i);
    if (!this.tex) this.tex = texture(bmp); else { this.tex.image = bmp; this.tex.needsUpdate = true; }
    this.shown = i; this.ready = true;
    // latency: from the moment the playhead first asked for a frame to the moment that exact frame is on screen
    const now = performance.now(), t0 = this.asked.get(i);
    if (t0 !== undefined && i === this.target) { this.lat.push(now - t0); if (this.lat.length > 400) this.lat.shift(); }
    for (const [f, t] of this.asked) if (f === i || now - t > 3000) this.asked.delete(f);
    return true;
  }
  get texture() { return this.tex; }
  stats() {
    const s = [...this.lat].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0;
    return { n: s.length, p50: +q(0.5).toFixed(1), p90: +q(0.9).toFixed(1), max: +q(1).toFixed(1), src: `webcodecs:${this.src}` };
  }
  dispose() {
    this.dead = true;
    try { this.decoder?.state !== 'closed' && this.decoder?.close(); } catch { /* closed */ }
    for (const b of this.bitmaps.values()) b.close?.();
    this.bitmaps.clear(); this.bytes.clear(); this.whole = null;
    this.tex?.dispose(); this.tex = null;
  }
}
