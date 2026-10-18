// Build a copy of the site for a sub-path host (GitHub Pages: /<repo>/).
//   node scripts/build-pages.mjs [--base /creativemotley-site/] [--out dist-pages]
// Vite prefixes the base on what it bundles; the site also has root-absolute "/assets/" and
// "/fonts/" strings in markup, inline styles and scene code, which this rewrites afterwards.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const A = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const base = A.base || '/creativemotley-site/';
const out = path.resolve(A.out || 'dist-pages');
execFileSync('npx', ['vite', 'build', '--base', base, '--outDir', out, '--emptyOutDir'], { stdio: 'inherit' });
const re = /(["'`(\s=,])\/(assets|fonts)\//g;
let files = 0, hits = 0;
const walk = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/frames|posters|objects|photos|plates|video|teardown/.test(f.name)) walk(p); continue; }
    if (!/\.(html|js|css|json)$/.test(f.name)) continue;
    const s = fs.readFileSync(p, 'utf8');
    const t = s.replace(re, (m, pre, dir) => { hits++; return `${pre}${base}${dir}/`; });
    if (t !== s) { fs.writeFileSync(p, t); files++; }
  }
};
walk(out);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`rewrote ${hits} root-absolute paths in ${files} files → ${out}`);
