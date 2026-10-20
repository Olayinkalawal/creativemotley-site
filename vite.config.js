import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import threeSlim from './scripts/three-slim.mjs';

/* <!-- @include partials/name.html --> in index.html is replaced by src/partials/name.html,
   so each chapter's markup lives in its own file (one owner per file). */
function includes() {
  const dir = path.resolve('src/partials');
  const expand = (html, depth = 0) =>
    html.replace(/<!--\s*@include\s+partials\/([\w-]+)\.html\s*-->/g, (_, name) => {
      const file = path.join(dir, `${name}.html`);
      if (!fs.existsSync(file)) return `<!-- missing partial: ${name} -->`;
      return depth > 4 ? '' : expand(fs.readFileSync(file, 'utf8'), depth + 1);
    });
  return {
    name: 'cm-includes',
    transformIndexHtml: { order: 'pre', handler: (html) => expand(html) },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(dir)) server.ws.send({ type: 'full-reload' });
    },
  };
}

/* public/ folders the page no longer uses but that stay in the repo for now (the build leaves them out of the output):
   - assets/teardown/camera, the photoreal camera's frame sets (29 MB, 585 files), replaced by the real-time camera
     (assets/models/camera, assets/teardown/camera3d); the camera lab (.lab/cam3d: build_cam.py, compare.py,
     client_sheets.py) still reads them;
   - assets/teardown/mixer, mic, headphones and phone, the Kit's photoreal frame sets (83 MB, 2,140 files),
     replaced by the four real-time devices (assets/models/<device>, assets/teardown/<device>3d); the device labs
     (.lab/kit3d/<device>/compare.py) still read their hero.webp and poster.webp.
   Delete a folder (git rm) once its lab is done with it, then its line here. */
const RETIRED = ['assets/teardown/camera', 'assets/teardown/mixer', 'assets/teardown/mic', 'assets/teardown/headphones', 'assets/teardown/phone'];
function retired() {
  let out = 'dist';
  return {
    name: 'cm-retired-public',
    apply: 'build',
    configResolved(c) { out = path.resolve(c.root, c.build.outDir); },
    closeBundle() { for (const d of RETIRED) fs.rmSync(path.join(out, d), { recursive: true, force: true }); },
  };
}

export default defineConfig({
  plugins: [includes(), threeSlim(), retired()],   // threeSlim: build only (scripts/three-slim.mjs)
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,   // the lazy stage chunk is three.js (~137 kB gz), loaded after first paint
  },
  server: { port: 5173, strictPort: false },
});
