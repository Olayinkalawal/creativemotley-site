// Watch the work: writes the Showcase cards in src/partials/showcase.html from docs/videos.json (owner: track O1).
//   node src/partials/showcase.videos.mjs           rewrite the cards (<!-- videos:start/end -->) and the line for
//                                                   creators without a card (<!-- more:start/end -->)
//   node src/partials/showcase.videos.mjs --check   exit 1 if either block is out of date (writes nothing)
//   node src/partials/showcase.videos.mjs --verify  also asks YouTube's oEmbed whether each id on the page exists and who
//                                                   uploaded it (needs the network; the page itself never probes YouTube)
// Any other argument prints this and exits 2 (it used to fall through to the write).
// Since 2026-10-31 (the client removed the poster wall) the cards are the whole chapter and its index: one card per
// creator, en-GB alphabetical by name (no editorial order: the F64 rule, nothing beside a name ranks or rates it). A
// card is the creator's name, the video's display title and the video's own YouTube thumbnail; it plays in the shared
// modal (a plain YouTube link without JS).
// A creator gets a card with its first video that has all of: a title fact in docs/facts.json (`url` =
// https://www.youtube.com/watch?v=<id>; kind "draft" until the client approves), a verification level in
// videos.json roster.playable, oembed_checked (--verify found it on the creator's own channel) and a thumb record. Every
// file the thumb record names must exist under public/ (else exit 2). Every creator needs a name fact (videos.json
// "fact", whose claim contains the name, else exit 2).
// Card art: thumb = { source, source_size, crop, widths, path, fetched }: the thumbnail YouTube serves for the id
// (maxresdefault, else sddefault / hqdefault with the letterbox bars cropped), downloaded once at build-prep time,
// cropped to 16:9 and resized only, never upscaled (so widths stop at the source: 640 for an sddefault), self-hosted
// as <path>-<w>.{avif,webp}. The page makes no third-party request until a click. A thumbnail fetched again takes a new
// path, never an old one: vercel.json serves /assets/* immutable for a year.
// A creator with no card (no playable, checked video with a thumbnail) is named in one line under the grid: "On the
// roster" (DC76) and the names, nothing else (the <!-- more --> block is empty while every creator has a card).
// To change a video: edit its id in docs/videos.json, give its display title a fact, run --verify and set
// oembed_checked, fetch its thumbnail (thumb), then run this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const FLAGS = ['--check', '--verify'];
if (args.some((a) => !FLAGS.includes(a))) {
  console.error(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').match(/^(\/\/.*\n)+/)[0].replace(/^\/\/ ?/gm, ''));
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const videos = read('docs/videos.json');
const facts = read('docs/facts.json');
const factFor = (id) => facts.find((f) => !f.retired && typeof f.url === 'string' && new URL(f.url, 'https://x').searchParams.get('v') === id);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const byName = (a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' });
const FMTS = ['avif', 'webp'];
const R = videos.roster || { playable: [] };

const cards = [], more = [];
for (const c of videos.creators) {
  const nf = facts.find((x) => x.id === c.fact);
  if (!nf || nf.retired || !nf.claim.includes(c.creator)) { console.error(`${c.creator} has no name fact (${c.fact})`); process.exit(2); }
  const v = (c.videos || []).find((x) => factFor(x.id) && R.playable.includes(x.verification) && x.oembed_checked);
  if (!v?.thumb) { console.warn(`no card for ${c.creator}: ${v ? `no thumbnail for ${v.id}` : 'no playable, checked video with a title fact'}`); more.push({ name: c.creator }); continue; }
  const { path: base, widths } = v.thumb;
  const missing = widths.flatMap((w) => FMTS.map((f) => `public${base}-${w}.${f}`)).filter((p) => !fs.existsSync(path.join(root, p)));
  if (!widths.includes(640) || missing.length) { console.error(`${c.creator} (${v.id}): thumbnail ${missing.length ? `files missing: ${missing.join(', ')}` : 'has no 640 width'}`); process.exit(2); }
  const f = factFor(v.id);
  cards.push({ id: v.id, name: c.creator, title: f.claim, draft: f.kind === 'draft' ? f.id : '', base, widths });
}
cards.sort(byName); more.sort(byName);

// the card's width: about 37vw (152 px at most) in the phone list, a quarter of the column from 720 px (≈ 21vw on a
// tablet, 16.4vw at 1024–1440, 18.2vw at 1920); the modal asks for the large file itself (showcase.js)
const SIZES = '(max-width: 719px) min(37vw, 152px), (max-width: 1023px) 22vw, 18vw';
const set = (c, f) => c.widths.map((w) => `${c.base}-${w}.${f} ${w}w`).join(', ');
const li = (c) => {
  const w = Math.max(...c.widths), h = Math.round((w * 9) / 16);
  return `      <li class="wv__item"><a class="wv__card" href="https://www.youtube.com/watch?v=${c.id}" target="_blank" rel="noopener" data-wv-yt="${c.id}"><span class="wv__art"><picture>${FMTS.map((f) => `<source type="image/${f}" srcset="${set(c, f)}" sizes="${SIZES}">`).join('')}<img src="${c.base}-640.webp" alt="" width="${w}" height="${h}" loading="lazy" decoding="async"></picture><span class="wv__icon" aria-hidden="true"></span></span><span class="wv__txt"><span class="wv__by">${esc(c.name)}</span><span class="sr-only">, </span><span class="wv__t"${c.draft ? ` data-draft="${c.draft}"` : ''}>${esc(c.title)}</span></span></a></li>`;
};
const block = `<!-- videos:start (generated by src/partials/showcase.videos.mjs from docs/videos.json: edit there, then re-run) -->
${cards.map(li).join('\n')}
      <!-- videos:end -->`;
const mblock = `<!-- more:start (generated by src/partials/showcase.videos.mjs: creators without a card) -->${more.length ? `
    <div class="wv__more">
      <h4 class="wv__more-l" id="wv-more" data-draft="DC76">On the roster</h4>
      <ul class="wv__names" aria-labelledby="wv-more">${more.map((m) => `<li>${esc(m.name)}</li>`).join('')}</ul>
    </div>
    ` : ''}<!-- more:end -->`;

const file = path.join(root, 'src/partials/showcase.html');
const html = fs.readFileSync(file, 'utf8');
const re = /<!-- videos:start[\s\S]*?<!-- videos:end -->/, mre = /<!-- more:start[\s\S]*?<!-- more:end -->/;
if (!re.test(html) || !mre.test(html)) { console.error('markers not found in showcase.html'); process.exit(2); }
const next = html.replace(re, () => block).replace(mre, () => mblock);
if (args.includes('--verify')) {
  let bad = 0;
  for (const c of cards) {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + c.id)}`).catch((e) => ({ ok: false, status: e.message }));
    const j = r.ok ? await r.json().catch(() => ({})) : {};
    console.log(`${r.ok ? 'ok ' : 'BAD'} ${c.id} ${c.name}${r.ok ? ` (uploader: ${j.author_name} ${j.author_url})` : ` (${r.status})`}`);
    if (!r.ok) bad++;
  }
  if (bad) process.exitCode = 1;
}
const summary = `${cards.length} cards, ${more.length} creator(s) without a card`;
if (args.includes('--check')) {
  if (next !== html) { console.error('showcase.html cards are out of date: run node src/partials/showcase.videos.mjs'); process.exit(1); }
  console.log(`ok: ${summary}`);
} else {
  fs.writeFileSync(file, next);
  console.log(summary);
  console.log(`cards: ${cards.map((c) => `${c.name} (${c.id}, ${c.widths.join('/')})`).join(', ')}`);
  if (more.length) console.log(`on the roster line: ${more.map((m) => m.name).join(', ')}`);
}
