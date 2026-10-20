/* The real-time scenes' GLB fetch (gl/scenes/camera3d.js, kit3d.js: the runtimes' opts.loadBuffer). The build writes a
   gzipped copy beside every public .glb (vite.config.js, glb.gz): meshopt-compressed buffers still shrink by about 40 %
   under gzip (the Kit's phone GLBs 2.30 → 1.32 MB), and most static hosts serve model/gltf-binary as it is. So: the .gz
   first, inflated here (DecompressionStream), or used as it came when the host already decoded it (Content-Encoding);
   the plain .glb in dev (no .gz there), without DecompressionStream, or when the .gz is missing. */
const GZ = !import.meta.env.DEV && typeof DecompressionStream !== 'undefined';

export async function fetchGLB(url) {
  if (GZ) {
    try {
      const r = await fetch(url + '.gz');
      if (r.ok) {
        const buf = await r.arrayBuffer();
        const b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
        if (b[0] === 0x1f && b[1] === 0x8b) return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        if (b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46) return buf;   // 'glTF': inflated by the host
        // anything else (a host's fallback page): the plain .glb
      }
    } catch { /* the plain .glb below */ }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GLB ${r.status}: ${url}`);
  return r.arrayBuffer();
}
