import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

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

export default defineConfig({
  plugins: [includes()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  server: { port: 5173, strictPort: false },
});
