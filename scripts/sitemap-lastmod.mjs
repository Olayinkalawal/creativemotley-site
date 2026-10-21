// The sitemap's <lastmod> is the build's date (public/sitemap.xml carries a placeholder date; a hard-coded one went
// stale). As a Vite plugin (vite.config.js: plugins: [..., sitemapLastmod()]) it rewrites <outDir>/sitemap.xml after
// the bundle is written; scripts/build-pages.mjs calls stampSitemap() on its own output.
import fs from 'node:fs';
import path from 'node:path';

export function stampSitemap(file, date = new Date().toISOString().slice(0, 10)) {
  if (!fs.existsSync(file)) return false;
  const s = fs.readFileSync(file, 'utf8');
  const t = s.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${date}</lastmod>`);
  if (t !== s) fs.writeFileSync(file, t);
  return true;
}

export default function sitemapLastmod() {
  let out = 'dist';
  return {
    name: 'cm-sitemap-lastmod',
    apply: 'build',
    configResolved(c) { out = path.resolve(c.root, c.build.outDir); },
    closeBundle() { stampSitemap(path.join(out, 'sitemap.xml')); },
  };
}
