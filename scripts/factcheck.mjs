// Every visible string on the page must trace to docs/facts.json (or docs/ui-strings.json).
//   node scripts/factcheck.mjs [--url http://127.0.0.1:5173/] [--mode desktop|mobile] [--drafts 0] [--strict]
// Loads the page with WebGL off (?tier=0, so it's fast), then checks:
//  - each element's own text (its textContent when it has direct text, so drop caps re-join),
//    falling back to each direct text node on its own;
//  - alt text, aria-label and title attributes, and the document title / meta description.
// A string passes if it is a substring of a fact's claim or source sentence, or a listed UI string.
// Drafts (kind "draft", docs/copy-drafts.md) trace but are listed: the ids seen, grouped by chapter, plus any draft text
// that is not inside its [data-draft="DCxx"] element (and any data-draft id that does not match its text).
//   --drafts 0  loads ?drafts=0 (html.no-drafts hides every [data-draft]) and fails on any draft text still showing.
//   --strict    fails on any draft on the page.
import fs_ from 'node:fs';
// Playwright: the project's own (npm i -D playwright) or, in the cloud container, the preinstalled copy
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs_.existsSync(p));
import fs from 'fs';
const A = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const noDrafts = A.drafts === '0';
const url = (A.url || 'http://127.0.0.1:5173/') + '?tier=0' + (noDrafts ? '&drafts=0' : '');
const norm = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const facts = JSON.parse(fs.readFileSync(new URL('../docs/facts.json', import.meta.url)));
const ui = JSON.parse(fs.readFileSync(new URL('../docs/ui-strings.json', import.meta.url))).strings;
// kind "draft" = drafted copy awaiting client approval (docs/copy-drafts.md): it traces, but is reported until approved
const texts = (f) => [f.claim, f.source_sentence, ...[...(f.note || '').matchAll(/alt text verbatim: '([^']+)'/g)].map((m) => m[1])].filter(Boolean).map(norm);
// a fact with "retired" (what it described is gone from the page, e.g. F135, the old Results TV) no longer traces
const corpus = facts.filter((f) => f.kind !== 'draft' && !f.retired).flatMap(texts);
const drafts = facts.filter((f) => f.kind === 'draft').map((f) => ({ id: f.id, t: texts(f) }));
const draftIds = new Set(drafts.map((d) => d.id));
const draftHits = new Map();   // id → { t: first string seen, ch: chapters it was seen in, tagged: inside its [data-draft] }
let where = null;              // the element being checked (its chapter and data-draft id), for draftHits
const ok = (s) => {
  const t = norm(s);
  if (!t || /^[\s\p{P}\p{S}\d]*$/u.test(t) && t.length <= 2) return true;   // stray punctuation / a drop-cap letter
  if (ui.some((u) => norm(u) === t)) return true;
  // a draft: the one its element names (data-draft) first, even where a fact has the same words; else a fact; else
  // the first draft whose text contains it
  const named = where?.draft && drafts.find((x) => where.draft.includes(x.id) && x.t.some((c) => c.includes(t)));
  if (!named && corpus.some((c) => c.includes(t))) return true;
  const d = named || drafts.find((x) => x.t.some((c) => c.includes(t)));
  if (d) {
    const h = draftHits.get(d.id) || { t, ch: new Set(), tagged: true, at: [] };
    if (where) { h.ch.add(where.ch); if (!where.draft?.includes(d.id)) { h.tagged = false; h.at.push(`${where.ch} ${where.where}`); } }
    draftHits.set(d.id, h);
    return true;
  }
  return false;
};
const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}) });
const ctx = await browser.newContext(A.mode === 'mobile' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1200);
// a dev server reloads the page when a partial changes (other people editing): retry on a navigation mid-walk
const walk = async (fn) => { for (let i = 0; ; i++) { try { return await page.evaluate(fn); } catch (e) { if (i >= 3 || !/context was destroyed|navigation/i.test(String(e))) throw e; await page.waitForLoadState('load'); await page.waitForTimeout(1200); } } };
const found = await walk(() => {
  const out = [];
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg']);
  const hidden = document.documentElement.classList.contains('no-drafts');   // ?drafts=0: [data-draft] is display: none
  // the chapter an element belongs to: its [data-chapter] section, the hero (#top), else the chrome around them
  const chapterOf = (el) => el.closest('[data-chapter]')?.id || (el.closest('#top') ? 'hero' : el.closest('main') ? 'main' : 'chrome');
  const tags = [];
  // data-draft holds one id, or several separated by spaces (a wrapper around a block of drafts)
  for (const el of document.querySelectorAll('[data-draft]')) for (const id of el.dataset.draft.split(/\s+/).filter(Boolean)) tags.push({ id, ch: chapterOf(el), text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) });
  for (const el of document.body.querySelectorAll('*')) {
    if (skip.has(el.tagName) || el.closest('svg,script,style')) continue;
    if (hidden && el.closest('[data-draft]')) continue;
    const direct = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    // every draft id named by this element or a wrapper around it
    const ids = []; for (let n = el.closest('[data-draft]'); n; n = n.parentElement?.closest('[data-draft]')) ids.push(...n.dataset.draft.split(/\s+/).filter(Boolean));
    const ctx = { ch: chapterOf(el), draft: ids.length ? ids : null };
    if (direct.length) out.push({ where: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), whole: el.textContent, parts: direct.map((n) => n.textContent), ...ctx });
    for (const at of ['alt', 'aria-label', 'title']) if (el.getAttribute(at)) out.push({ where: `${el.tagName.toLowerCase()}[${at}]`, whole: el.getAttribute(at), parts: [], ...ctx });
  }
  out.push({ where: 'title', whole: document.title, parts: [], ch: 'head' });
  const md = document.querySelector('meta[name=description]'); if (md) out.push({ where: 'meta', whole: md.content, parts: [], ch: 'head' });
  return { out, tags };
});
const fails = [];
for (const f of found.out) {
  where = f;
  if (ok(f.whole)) continue;
  const bad = f.parts.filter((p) => !ok(p));
  if (f.parts.length && !bad.length) continue;
  fails.push({ where: f.where, text: (bad.length ? bad : [f.whole]).map(norm).join(' | ').slice(0, 160) });
}
where = null;
const uniq = [...new Map(fails.map((f) => [f.where + f.text, f])).values()];
for (const f of uniq) console.log(`✗ ${f.where}: "${f.text}"`);
// drafts, grouped by chapter: the data-draft ids tagged on the page, and the draft texts found
const order = ['hero', ...new Set(found.out.map((f) => f.ch))];
const byCh = new Map();
const add = (ch, id) => { if (!byCh.has(ch)) byCh.set(ch, new Set()); byCh.get(ch).add(id); };
if (!noDrafts) for (const t of found.tags) add(t.ch, t.id);
for (const [id, h] of draftHits) for (const ch of h.ch) add(ch, id);
const sortId = (a, b) => a.localeCompare(b, 'en', { numeric: true });
if (byCh.size) {
  console.log(`\ndrafts on the page, by chapter (docs/copy-drafts.md; ?drafts=0 hides them):`);
  for (const ch of [...byCh.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b))) console.log(`  ${ch.padEnd(13)} ${[...byCh.get(ch)].sort(sortId).join(' ')}`);
}
const warn = [];
for (const t of found.tags) if (!draftIds.has(t.id)) warn.push(`data-draft="${t.id}" (${t.ch}) is not a draft in docs/facts.json: "${t.text}"`);
if (!noDrafts) for (const t of found.tags) if (draftIds.has(t.id) && !draftHits.has(t.id)) warn.push(`data-draft="${t.id}" (${t.ch}): none of its text is that draft's: "${t.text}"`);
for (const [id, h] of draftHits) if (!h.tagged) warn.push(`draft ${id} shows outside a [data-draft="${id}"] element (${[...new Set(h.at)].slice(0, 3).join('; ')}): "${h.t.slice(0, 80)}"`);
for (const w of warn) console.log(`⚠ ${w}`);
const shown = noDrafts ? [...draftHits.keys()] : [];
if (noDrafts) console.log(shown.length ? `✗ with ?drafts=0, ${shown.length} draft(s) still show: ${shown.sort(sortId).join(' ')}` : `✓ with ?drafts=0 no draft copy shows`);
else if (draftHits.size || found.tags.length) console.log(`${new Set([...draftHits.keys(), ...found.tags.map((t) => t.id)]).size} draft id(s) on the page await client approval`);
console.log(uniq.length ? `\n${uniq.length} string(s) not traced to facts.json / ui-strings.json` : `✓ every string traces to facts.json (${found.out.length} checked)`);
await browser.close();
process.exit(uniq.length || shown.length || ('strict' in A && draftHits.size) ? 1 : 0);
