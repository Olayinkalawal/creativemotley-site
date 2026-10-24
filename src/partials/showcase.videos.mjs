// Watch the work and On the roster: writes the video cards and the creator index in src/partials/showcase.html from
// docs/videos.json (owner: track O1).
//   node src/partials/showcase.videos.mjs           rewrite the cards (<!-- videos:start/end -->) and the roster rows
//                                                   (<!-- roster:start/end -->)
//   node src/partials/showcase.videos.mjs --check   exit 1 if either block is out of date (writes nothing)
//   node src/partials/showcase.videos.mjs --verify  also asks YouTube's oEmbed whether each id on the page exists and who
//                                                   uploaded it (needs the network; the page itself never probes YouTube)
// Any other argument prints this and exits 2 (it used to fall through to the write).
// Cards: one per creator with poster art, in videos.json order: the creator's first video (the "use" pick in
// docs/copy-drafts.md). To change a video, edit its id in docs/videos.json, give its display title a fact in
// docs/facts.json (kind "draft" until the client approves; `url` = https://www.youtube.com/watch?v=<id>), and run this
// script. A video whose id has no fact is left out (no untraced copy on the page). The ids are unverified until oEmbed runs.
// Card art: public/assets/thumbs/video/<slug>-{640,1280,1920}.{avif,webp} (the creator's poster, composed 16:9), always:
// the page makes no third-party request until a click. A creator with no poster (poster: null) gets no card.
// Roster: every creator, en-GB alphabetical (docs/videos.json "roster"). A row is the creator's name (its name fact must
// contain it, or the script exits 2) and one action: "Watch" (plays in the shared modal; a plain YouTube link without
// JS) with the card's video, else the first video that has a title fact and a playable verification level; else
// "Channel ↗" with a confirmed or probable channel; else the name alone. The video's title rides on the row as data
// (data-ros-t, shown only as the modal's heading); the row itself shows no title, stat or claim (the F64 rule). The
// action comes before the name in the markup, so the link reads "Watch <name>"; CSS shows it under the name (order).
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

const cards = [];
for (const c of videos.creators) {
  if (!c.poster) continue;   // no poster art, no card (the roster lists the creator)
  const v = (c.videos || []).find((x) => factFor(x.id));
  if (!v) { console.warn(`no traced video for ${c.creator}: skipped`); continue; }
  const f = factFor(v.id);
  const slug = path.basename(c.poster, '.webp');
  cards.push({ id: v.id, slug, name: c.creator, title: f.claim, draft: f.kind === 'draft' ? f.id : '' });
}
const art = (slug, fmt) => [640, 1280, 1920].map((w) => `/assets/thumbs/video/${slug}-${w}.${fmt} ${w}w`).join(', ');
// the card is ~84% of the column on desktop (≈ 860 px at 1440), ~86vw on phones
const SIZES = '(max-width: 719px) 86vw, (max-width: 1023px) 78vw, min(64vw, 960px)';
const li = (c, i) => {
  const n = i + 1, d = (id) => (id ? ` data-draft="${id}"` : '');
  return `            <li class="wv__item" data-yt="${c.id}" data-slug="${c.slug}">
              <article class="wv__card">
                <button class="wv__play" type="button" aria-haspopup="dialog" aria-labelledby="wv-cta-${n} wv-t-${n}" data-wv-play>
                  <picture class="wv__art"><source type="image/avif" srcset="${art(c.slug, 'avif')}" sizes="${SIZES}"><source type="image/webp" srcset="${art(c.slug, 'webp')}" sizes="${SIZES}"><img src="/assets/thumbs/video/${c.slug}-1280.webp" alt="" width="1920" height="1080" loading="lazy" decoding="async"></picture>
                  <span class="wv__icon" aria-hidden="true"></span>
                  <span class="wv__cta" id="wv-cta-${n}" data-draft="DC61">Play video</span>
                </button>
                <div class="wv__meta">
                  <p class="wv__by">${esc(c.name)}</p>
                  <h4 class="wv__t" id="wv-t-${n}"${d(c.draft)}>${esc(c.title)}</h4>
                  <a class="boxlink wv__yt" href="https://www.youtube.com/watch?v=${c.id}" target="_blank" rel="noopener" aria-describedby="wv-t-${n}" data-draft="DC62">Watch on YouTube <span class="ar" aria-hidden="true">↗</span></a>
                </div>
              </article>
            </li>`;
};
const block = `<!-- videos:start (generated by src/partials/showcase.videos.mjs from docs/videos.json: edit there, then re-run) -->
${cards.map(li).join('\n')}
            <!-- videos:end -->`;

/* On the roster */
const R = videos.roster || { playable: [], channel_ok: [] };
const rows = videos.creators.map((c) => {
  const f = facts.find((x) => x.id === c.fact);
  if (!f || f.retired || !f.claim.includes(c.creator)) { console.error(`roster: ${c.creator} has no name fact (${c.fact})`); process.exit(2); }
  const card = cards.find((k) => k.name === c.creator);
  const v = card || (c.videos || []).find((x) => R.playable.includes(x.verification) && factFor(x.id));
  const t = v && factFor(v.id);
  const ch = !v && c.channel_url && R.channel_ok.includes(c.channel_verification) ? c.channel_url : '';
  return { name: c.creator, id: v?.id || '', title: t?.claim || '', draft: t?.kind === 'draft' ? t.id : '', ch };
}).sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
const row = (r) => r.id
  ? `            <li class="ros__item"><a class="ros__row" href="https://www.youtube.com/watch?v=${r.id}" target="_blank" rel="noopener" data-ros-yt="${r.id}" data-ros-t="${esc(r.title)}"${r.draft ? ` data-ros-draft="${r.draft}"` : ''}><span class="ros__act ros__act--watch" data-draft="DC77">Watch</span> <span class="ros__nm">${esc(r.name)}</span></a></li>`
  : r.ch
    ? `            <li class="ros__item"><a class="ros__row" href="${esc(r.ch)}" target="_blank" rel="noopener"><span class="ros__act" data-draft="DC78">Channel <span class="ar" aria-hidden="true">↗</span></span> <span class="ros__nm">${esc(r.name)}</span></a></li>`
    : `            <li class="ros__item"><span class="ros__row"><span class="ros__nm">${esc(r.name)}</span></span></li>`;
const rblock = `<!-- roster:start (generated by src/partials/showcase.videos.mjs from docs/videos.json: edit there, then re-run) -->
${rows.map(row).join('\n')}
            <!-- roster:end -->`;

const file = path.join(root, 'src/partials/showcase.html');
const html = fs.readFileSync(file, 'utf8');
const re = /<!-- videos:start[\s\S]*?<!-- videos:end -->/, rre = /<!-- roster:start[\s\S]*?<!-- roster:end -->/;
if (!re.test(html) || !rre.test(html)) { console.error('markers not found in showcase.html'); process.exit(2); }
const next = html.replace(re, block).replace(rre, rblock).replace(/(data-wv-total>)\d+/g, `$1${String(cards.length).padStart(2, '0')}`);
if (args.includes('--verify')) {
  let bad = 0;
  const seen = new Map();
  for (const c of cards) seen.set(c.id, c.name);
  for (const r of rows) if (r.id) seen.set(r.id, r.name);
  for (const [id, name] of seen) {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`).catch((e) => ({ ok: false, status: e.message }));
    const j = r.ok ? await r.json().catch(() => ({})) : {};
    console.log(`${r.ok ? 'ok ' : 'BAD'} ${id} ${name}${r.ok ? ` (uploader: ${j.author_name} ${j.author_url})` : ` (${r.status})`}`);
    if (!r.ok) bad++;
  }
  if (bad) process.exitCode = 1;
}
const summary = `${cards.length} cards, ${rows.length} roster rows (${rows.filter((r) => r.id).length} watch, ${rows.filter((r) => !r.id && r.ch).length} channel, ${rows.filter((r) => !r.id && !r.ch).length} name only)`;
if (args.includes('--check')) {
  if (next !== html) { console.error('showcase.html video cards or roster are out of date: run node src/partials/showcase.videos.mjs'); process.exit(1); }
  console.log(`ok: ${summary}`);
} else {
  fs.writeFileSync(file, next);
  console.log(summary);
  console.log(`cards: ${cards.map((c) => `${c.name} (${c.id})`).join(', ')}`);
  console.log(`roster: ${rows.map((r) => `${r.name} (${r.id ? 'watch ' + r.id : r.ch ? 'channel' : 'name'})`).join(', ')}`);
}
