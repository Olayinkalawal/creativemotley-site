// Build a copy of the site for a sub-path host (GitHub Pages: /<repo>/).
//   node scripts/build-pages.mjs [--base /creativemotley-site/] [--out dist-pages]
// Vite prefixes the base on what it bundles; the site also has root-absolute "/assets/" and
// "/fonts/" strings in markup, inline styles and scene code, which this rewrites afterwards.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { stampSitemap } from './sitemap-lastmod.mjs';
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
// the 404 page's way home and its own links are root-absolute too: "/" → the base
const p404 = path.join(out, '404.html');
if (fs.existsSync(p404)) {
  fs.writeFileSync(p404, fs.readFileSync(p404, 'utf8').replace(/(href|src)="\/(?!\/)/g, `$1="${base}`));
}
// a preview is not the site: no search engine indexes it (its robots.txt sits under the sub-path, where crawlers never
// look, so the page says so itself)
let noindex = 0;
for (const f of ['index.html', '404.html']) {
  const p = path.join(out, f);
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  if (/<meta name="robots"/.test(s)) continue;
  fs.writeFileSync(p, s.replace(/<meta charset="utf-8">/i, (m) => `${m}\n  <meta name="robots" content="noindex">`));
  noindex++;
}
stampSitemap(path.join(out, 'sitemap.xml'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`rewrote ${hits} root-absolute paths in ${files} files, noindex on ${noindex} page(s), sitemap dated → ${out}`);
