// Every visible string on the page must trace to docs/facts.json (or docs/ui-strings.json).
//   node scripts/factcheck.mjs [--url http://127.0.0.1:5173/] [--mode desktop|mobile]
// Loads the page with WebGL off (?tier=0, so it's fast), then checks:
//  - each element's own text (its textContent when it has direct text, so drop caps re-join),
//    falling back to each direct text node on its own;
//  - alt text, aria-label and title attributes, and the document title / meta description.
// A string passes if it is a substring of a fact's claim or source sentence, or a listed UI string.
import fs_ from 'node:fs';
// Playwright: the project's own (npm i -D playwright) or, in the cloud container, the preinstalled copy
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs_.existsSync(p));
import fs from 'fs';
const A = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const url = (A.url || 'http://127.0.0.1:5173/') + '?tier=0';
const norm = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const facts = JSON.parse(fs.readFileSync(new URL('../docs/facts.json', import.meta.url)));
const ui = JSON.parse(fs.readFileSync(new URL('../docs/ui-strings.json', import.meta.url))).strings;
// kind "draft" = drafted copy awaiting client approval (docs/copy-drafts.md): it traces, but is reported until approved
const texts = (f) => [f.claim, f.source_sentence, ...[...(f.note || '').matchAll(/alt text verbatim: '([^']+)'/g)].map((m) => m[1])].filter(Boolean).map(norm);
const corpus = facts.filter((f) => f.kind !== 'draft').flatMap(texts);
const drafts = facts.filter((f) => f.kind === 'draft').map((f) => ({ id: f.id, t: texts(f) }));
const draftHits = new Map();   // id → first string seen
const ok = (s) => {
  const t = norm(s);
  if (!t || /^[\s\p{P}\p{S}\d]*$/u.test(t) && t.length <= 2) return true;   // stray punctuation / a drop-cap letter
  if (ui.some((u) => norm(u) === t)) return true;
  if (corpus.some((c) => c.includes(t))) return true;
  const d = drafts.find((x) => x.t.some((c) => c.includes(t)));
  if (d) { if (!draftHits.has(d.id)) draftHits.set(d.id, t); return true; }
  return false;
};
const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}) });
const ctx = await browser.newContext(A.mode === 'mobile' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1200);
const found = await page.evaluate(() => {
  const out = [];
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg']);
  for (const el of document.body.querySelectorAll('*')) {
    if (skip.has(el.tagName) || el.closest('svg,script,style')) continue;
    const direct = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (direct.length) out.push({ where: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), whole: el.textContent, parts: direct.map((n) => n.textContent) });
    for (const at of ['alt', 'aria-label', 'title']) if (el.getAttribute(at)) out.push({ where: `${el.tagName.toLowerCase()}[${at}]`, whole: el.getAttribute(at), parts: [] });
  }
  out.push({ where: 'title', whole: document.title, parts: [] });
  const md = document.querySelector('meta[name=description]'); if (md) out.push({ where: 'meta', whole: md.content, parts: [] });
  return out;
});
const fails = [];
for (const f of found) {
  if (ok(f.whole)) continue;
  const bad = f.parts.filter((p) => !ok(p));
  if (f.parts.length && !bad.length) continue;
  fails.push({ where: f.where, text: (bad.length ? bad : [f.whole]).map(norm).join(' | ').slice(0, 160) });
}
const uniq = [...new Map(fails.map((f) => [f.where + f.text, f])).values()];
for (const f of uniq) console.log(`✗ ${f.where}: "${f.text}"`);
for (const [id, t] of draftHits) console.log(`⚠ draft ${id}: "${t.slice(0, 120)}"`);
if (draftHits.size) console.log(`${draftHits.size} draft string(s) on the page await client approval (docs/copy-drafts.md)`);
console.log(uniq.length ? `\n${uniq.length} string(s) not traced to facts.json / ui-strings.json` : `✓ every string traces to facts.json (${found.length} checked)`);
await browser.close();
process.exit(uniq.length || ('strict' in A && draftHits.size) ? 1 : 0);
