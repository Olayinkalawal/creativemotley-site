// The phase-1 measurement method (docs/v3-status.md §1–2) in one command, against a URL or a build folder.
//   node scripts/perf.mjs --dist dist                      serve a production build here (gzip text, range requests,
//                                                          immutable /assets/, as vercel.json) and measure it
//   node scripts/perf.mjs --url http://127.0.0.1:4173/     measure a server that is already up (a production build:
//                                                          a dev server's bytes and timings mean nothing)
// options: --qm <query> (phone runs; default none)  --out <dir> (default qa/perf/<date-time>)  --only <parts>  --skip <parts>  --runs <n> (LCP runs, default 3)
//          --windows "top,#creators,#method+0.4,…"  (smoothness windows: selector[+fraction of its height]; default: the
//          top, then every [data-chapter] at its start, plus its middle when it is longer than 4 screens)
//          --dur <ms> (wheel time per window, default 10000; the top window gets 1.4×)  --q "tier=2&q=high" (desktop query)
// parts: lengths, first, full, lcp, lcpnet, smooth  (default: all)
// Writes perf.json (every number, plus each request) and perf.md (the tables) into --out, and prints the tables.
//
// The method, part by part:
//  - lengths: each top-level section's height in screens at 1440×900 and 390×844 with WebGL on (desktop ?tier=2&q=high,
//    the phone's own path), the page in screens, where the first chapter title sits, words on the page; and the same
//    with ?tier=0, listed where a section's length differs (a pinned WebGL run can be longer than its still version).
//  - first / full: CDP Network bytes, cold cache, Chromium with SwiftShader WebGL. Desktop 1440×900 at @1× and @2×
//    (?tier=2&q=high, what a real Mac gets; on SwiftShader the stage would otherwise start low), phone 390×844 @2×
//    (Android UA, touch). First load: 10 s after `load`, no input. Full read: scrollTo in half-viewport steps, 1.2 s
//    each, to the bottom (desktop @1×, phone @2×). Media bodies count by dataLength (media loads report
//    encodedDataLength 0), everything else by encodedDataLength (gzip as served).
//  - lcp: unthrottled, desktop 1440×900 @1× and phone 390×844 @2×, WebGL on, cold; the last LCP entry 5 s after load.
//  - lcpnet: the throttled phone profile (Lighthouse's mobile devtools numbers: 562.5 ms latency, 1474.56 kbps down,
//    675 kbps up, 4× CPU), 390×844 @2×, cold; LCP and FCP, the median of --runs.
//  - smooth: a steady wheel of 50 px every 50 ms per window, desktop 1440×900 @1×, with WebGL off (?tier=0 and no
//    WebGL in the browser) and on (SwiftShader: relative numbers only); rAF frame rate and p95 frame time,
//    layout-shift sum during the window, stage renders while wheeling and in 5 s idle after, canvas reallocations.
//    One fresh browser per window. Software GL on shared cores: compare runs on the same machine, at similar load
//    (the load average is recorded per window).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';

const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const A = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const PARTS = ['lengths', 'first', 'full', 'lcp', 'lcpnet', 'smooth'];
const only = A.only ? String(A.only).split(',') : PARTS;
const skip = A.skip ? String(A.skip).split(',') : [];
const want = (p) => only.includes(p) && !skip.includes(p);
const RUNS = +(A.runs || 3);
const DUR = +(A.dur || 10000);
const DQ = A.q || 'tier=2&q=high';
const PQ = A.qm && A.qm !== true ? A.qm : '';   // --qm: the phone runs' query (default none: what a phone gets; e.g. cam3d=1 forces Method's 3D camera on the 4-core test machine)
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const OUT = path.resolve(A.out || `qa/perf/${stamp}`);
fs.mkdirSync(OUT, { recursive: true });

const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const NOGL = ['--disable-3d-apis', '--disable-webgl'];
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const DESK = (dpr = 1) => ({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
const PHONE = (dpr = 2) => ({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent: UA });
const launch = (args) => chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args });
const loadavg = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).join(' '); } catch { return ''; } };
const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const log = (...a) => console.error('[perf]', ...a);

/* ── a static server for --dist (as scratchpad/qa/serve.mjs: gzip for text, range requests, immutable /assets/) ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.txt': 'text/plain', '.xml': 'application/xml' };
async function serve(dir, port = 0) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); res.end('404'); return; }
      const type = TYPES[path.extname(file)] || 'application/octet-stream';
      const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': /^\/(assets|fonts)\//.test(p) ? 'public, max-age=31536000, immutable' : 'no-cache' };
      const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
      if (range) {
        const a = range[1] ? +range[1] : 0, b = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
        fs.createReadStream(file, { start: a, end: b }).pipe(res);
        return;
      }
      if (/^(text|application\/(json|xml))|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
        fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
        return;
      }
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      fs.createReadStream(file).pipe(res);
    });
  });
  await new Promise((r) => server.listen(+port, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

let BASE = A.url, srv = null;
if (A.dist) { srv = await serve(A.dist, A.port || 0); BASE = srv.url; log('serving', A.dist, 'at', BASE); }
if (!BASE) { console.error('give --url <server> or --dist <build folder>'); process.exit(2); }
if (!BASE.endsWith('/')) BASE += '/';
const withQ = (q) => BASE + (q ? (BASE.includes('?') ? '&' : '?') + q : '');

const result = { when: new Date().toISOString(), url: BASE, dist: A.dist || null, loadavg: loadavg(), method: 'docs/v3-status.md §1 (scripts/perf.mjs)' };

/* ── lengths: sections in screens, page length, first title, words ───────────────────────────────────────────────── */
async function lengths(mode, still) {
  const b = await launch(still ? NOGL : GL);
  const c = await b.newContext(mode === 'phone' ? PHONE(2) : DESK(1));
  const p = await c.newPage();
  await p.goto(withQ(still ? 'tier=0' : mode === 'phone' ? PQ : DQ), { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(still ? 2500 : 5000);
  const r = await p.evaluate(() => {
    const vh = innerHeight, H = document.documentElement.scrollHeight;
    const secs = [...document.querySelectorAll('main > *')].map((el) => ({ id: el.id || el.className.split(' ')[0] || el.tagName.toLowerCase(), screens: +(el.getBoundingClientRect().height / vh).toFixed(2) }));
    const first = document.querySelector('[data-chapter]');
    const t = first && (document.getElementById(`${first.id}-title`) || first.querySelector('.giant, h2'));
    const top = t ? t.getBoundingClientRect().top + scrollY : null;
    const words = (document.body.innerText || '').split(/\s+/).filter((w) => /\w/.test(w)).length;
    return { vw: innerWidth, vh, screens: +(H / vh).toFixed(1), sections: secs, firstTitle: t ? { chapter: first.id, top: +(top / vh).toFixed(2), inViewAfter: +((top - vh) / vh).toFixed(2) } : null, words, wordsPerScreen: +(words / (H / vh)).toFixed(1), overflowX: document.documentElement.scrollWidth - innerWidth };
  });
  await b.close();
  return r;
}

/* ── bytes: first load and full read (CDP, cold cache) ─────────────────────────────────────────────────────────────── */
const kind = (u) => {
  const p = u.split('?')[0];
  if (/frames\/hero/.test(p)) return 'film-frames';
  if (/\/video\/film\//.test(p)) return 'film-video';
  if (/teardown\/[^/]+\/orbit\//.test(p)) return 'td-orbit';
  if (/teardown\/[^/]+\/(lg|sm)\//.test(p)) return 'td-explode';
  if (/teardown\//.test(p)) return 'td-still';
  if (/\/scenes\//.test(p)) return 'scene-stills';
  if (/\.(mp4|webm)$/.test(p)) return 'video';
  if (/\.(webp|avif|png|jpe?g|svg|gif)$/.test(p)) return 'image';
  if (/\.woff2?$/.test(p)) return 'font';
  if (/\.glb$/.test(p)) return 'model';
  if (/\.m?js$/.test(p) || /\/src\//.test(p) || /node_modules/.test(p)) return 'js';
  if (/\.css$/.test(p)) return 'css';
  if (/\.json$/.test(p)) return 'json';
  if (/^data:|^blob:/.test(u)) return 'inline';
  return 'other';
};
async function bytes(mode, dpr, full) {
  const phone = mode === 'phone';
  const b = await launch(GL);
  const c = await b.newContext(phone ? PHONE(dpr) : DESK(dpr));
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  const reqs = new Map(); let phase = 'load';
  cdp.on('Network.requestWillBeSent', (e) => { if (!reqs.has(e.requestId)) reqs.set(e.requestId, { url: e.request.url, phase }); });
  cdp.on('Network.dataReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.rx = (r.rx || 0) + (e.encodedDataLength || 0); r.raw = (r.raw || 0) + (e.dataLength || 0); } });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.fin = e.encodedDataLength; });
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) r.failed = e.errorText; });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  const t0 = Date.now();
  await p.goto(withQ(phone ? PQ : DQ), { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(10000);
  const size = (r) => Math.max(r.fin || 0, r.rx || 0, /\.(mp4|webm)(\?|$)/.test(r.url) ? r.raw || 0 : 0);
  const total = (f = () => true) => [...reqs.values()].filter(f).reduce((a, r) => a + size(r), 0);
  const out = { mode, dpr, first: { MB: +(total() / 1e6).toFixed(2), n: reqs.size } };
  if (full) {
    phase = 'scroll';
    const vh = phone ? 844 : 900;
    let y = 0, last = -1, stuck = 0;
    while (stuck < 3 && Date.now() - t0 < 20 * 60 * 1000) {
      y += vh / 2;
      await p.evaluate((y) => window.scrollTo(0, y), y);
      await p.waitForTimeout(1200);
      const at = await p.evaluate(() => Math.round(scrollY));
      if (at === last) stuck++; else stuck = 0; last = at;
    }
    await p.waitForTimeout(4000);
    out.full = { MB: +(total() / 1e6).toFixed(2), n: reqs.size, lastY: last };
  }
  const by = {};
  for (const r of reqs.values()) { const k = kind(r.url); const o = (by[k] ||= { n: 0, KB: 0, firstKB: 0 }); o.n++; o.KB += size(r) / 1024; if (r.phase === 'load') o.firstKB += size(r) / 1024; }
  for (const o of Object.values(by)) { o.KB = Math.round(o.KB); o.firstKB = Math.round(o.firstKB); }
  out.byType = by;
  // the entry (the module script and what the HTML modulepreloads) vs everything imported later (the lazy engine and scenes)
  const entry = await p.evaluate(() => [...document.querySelectorAll('script[type=module][src], link[rel=modulepreload][href]')].map((e) => new URL(e.src || e.href, location.href).pathname));
  const isEntry = (r) => entry.includes(new URL(r.url, 'http://x').pathname);
  out.js = { firstKB: Math.round(total((r) => kind(r.url) === 'js' && r.phase === 'load') / 1024), allKB: Math.round(total((r) => kind(r.url) === 'js') / 1024),
    entryKB: Math.round(total((r) => kind(r.url) === 'js' && isEntry(r)) / 1024), lazyKB: Math.round(total((r) => kind(r.url) === 'js' && !isEntry(r)) / 1024), entry };
  out.failed = [...reqs.values()].filter((r) => r.failed && !/ERR_ABORTED/.test(r.failed)).map((r) => `${r.failed} ${r.url.slice(-80)}`).slice(0, 10);
  out.errors = errors.slice(0, 8);
  out.stage = await p.evaluate(() => ({ tier: document.documentElement.dataset.tier, gl: document.documentElement.classList.contains('gl-ready'), q: window.__stage?.quality ?? null, dpr: window.__stage?.ctx?.dpr ?? null }));
  out.requests = [...reqs.values()].map((r) => [r.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 140), size(r), r.phase]).sort((a, b) => b[1] - a[1]);
  await b.close();
  return out;
}

/* ── LCP, unthrottled and on the throttled phone profile ───────────────────────────────────────────────────────────── */
const lcpInit = () => {
  window.__lcp = []; window.__fcp = null;
  const desc = (n) => (n && n.tagName ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '') : null);
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: desc(e.element), url: (e.url || '').slice(-60) }))).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.name === 'first-contentful-paint') window.__fcp = Math.round(e.startTime); })).observe({ type: 'paint', buffered: true });
};
async function lcp(mode, throttled) {
  const phone = mode === 'phone';
  const b = await launch(GL);
  const c = await b.newContext(phone ? PHONE(2) : DESK(1));
  const p = await c.newPage();
  await p.addInitScript(lcpInit);
  if (throttled) {
    const cdp = await c.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1474.56 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const start = Date.now();
  if (throttled) { p.goto(withQ(PQ), { waitUntil: 'load', timeout: 120000 }).catch(() => {}); await p.waitForTimeout(20000); }
  else { await p.goto(withQ(phone ? PQ : DQ), { waitUntil: 'load', timeout: 120000 }); await p.waitForTimeout(5000); }
  const r = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { lcp: window.__lcp, fcp: window.__fcp, load: n ? Math.round(n.loadEventEnd) : null }; });
  await b.close();
  const last = r.lcp[r.lcp.length - 1] || {};
  return { mode, throttled: !!throttled, lcp: last.t ?? null, el: last.el || null, url: last.url || null, fcp: r.fcp, load: r.load, candidates: r.lcp.map((x) => `${x.t} ${x.el}`), ms: Date.now() - start, loadavg: loadavg() };
}

/* ── smoothness: a steady wheel per window, WebGL off and on ───────────────────────────────────────────────────────── */
async function windowsFor() {
  if (A.windows) return String(A.windows).split(',').map((s) => s.trim()).filter(Boolean);
  const b = await launch(NOGL);
  const c = await b.newContext(DESK(1));
  const p = await c.newPage();
  await p.goto(withQ('tier=0'), { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(1500);
  const w = await p.evaluate(() => {
    const out = ['top'];
    for (const el of document.querySelectorAll('[data-chapter]')) {
      if (!el.id) continue;
      out.push(`#${el.id}`);
      if (el.getBoundingClientRect().height / innerHeight > 4) out.push(`#${el.id}+0.5`);
    }
    return out;
  });
  await b.close();
  return w;
}
async function smooth(start, gl) {
  const b = await launch(gl ? GL : NOGL);
  const c = await b.newContext(DESK(1));
  const p = await c.newPage();
  await p.addInitScript(() => {
    window.__ls = []; window.__f = []; window.__realloc = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ls.push({ t: e.startTime, v: e.value, src: (e.sources || []).map((s) => String(s.node && (s.node.className?.baseVal ?? s.node.className ?? s.node.nodeName))).slice(0, 3) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => {
      const cv = document.getElementById('stage');
      if (cv) new MutationObserver((m) => { for (const r of m) if (r.attributeName === 'width' || r.attributeName === 'height') window.__realloc++; }).observe(cv, { attributes: true });
    });
  });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await p.goto(withQ(gl ? DQ : 'tier=0'), { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(6000);
  const y = await p.evaluate((s) => {
    if (s === 'top') return 0;
    if (/^\d+$/.test(s)) return +s;
    const [sel, frac] = s.split('+');
    const el = document.querySelector(sel);
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.round(r.top + scrollY + (frac ? r.height * parseFloat(frac) : 0));
  }, start);
  if (y) { await p.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y); await p.waitForTimeout(4000); }
  await p.mouse.move(720, 450);
  const frames = () => window.__stage?.renderer?.info?.render?.frame ?? -1;
  const r0 = await p.evaluate(frames);
  await p.evaluate(() => { const f = window.__f; const tick = (t) => { f.push(t); requestAnimationFrame(tick); }; requestAnimationFrame(tick); window.__ls0 = window.__ls.length; window.__r0 = window.__realloc; });
  const y0 = await p.evaluate(() => scrollY);
  const dur = start === 'top' ? Math.round(DUR * 1.4) : DUR;
  const tS = Date.now();
  await p.evaluate(() => { window.__f.length = 0; });
  while (Date.now() - tS < dur) { await p.mouse.wheel(0, 50); await p.waitForTimeout(50); }
  await p.waitForTimeout(1200);
  const res = await p.evaluate(() => ({ f: window.__f.slice(), ls: window.__ls.slice(window.__ls0), y: scrollY, realloc: window.__realloc - window.__r0, canvas: (() => { const c = document.getElementById('stage'); return c ? c.width + 'x' + c.height : ''; })(), q: window.__stage?.quality ?? null }));
  const r1 = await p.evaluate(frames);
  await p.waitForTimeout(500);
  const i0 = await p.evaluate(frames);
  await p.waitForTimeout(5000);
  const i1 = await p.evaluate(frames);
  await b.close();
  const d = []; for (let i = 1; i < res.f.length; i++) if (res.f[i] - res.f[0] < dur) d.push(res.f[i] - res.f[i - 1]);
  const s = [...d].sort((a, b) => a - b);
  const pct = (q) => (s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null);
  const span = d.reduce((a, b) => a + b, 0);
  return {
    start, gl, y0, y1: res.y, fps: span ? +(d.length / (span / 1000)).toFixed(1) : null, p50: pct(0.5) && +pct(0.5).toFixed(1), p95: pct(0.95) && +pct(0.95).toFixed(1),
    over33: d.length ? +((100 * d.filter((x) => x > 33.4).length) / d.length).toFixed(1) : null,
    cls: +res.ls.reduce((a, b) => a + b.v, 0).toFixed(4), shifts: res.ls.sort((a, b) => b.v - a.v).slice(0, 3).map((l) => [+l.v.toFixed(4), l.src.join('|')]),
    renders: r0 >= 0 ? r1 - r0 : null, idleRenders5s: i0 >= 0 ? i1 - i0 : null, realloc: res.realloc, canvas: res.canvas, quality: res.q, errors: errors.slice(0, 5), loadavg: loadavg(),
  };
}

/* ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const save = () => fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(result, null, 1));
try {
  if (want('lengths')) {
    log('lengths');
    result.lengths = { desktop: await lengths('desktop'), phone: await lengths('phone'), desktopTier0: await lengths('desktop', true), phoneTier0: await lengths('phone', true) };
    save();
  }
  if (want('first') || want('full')) {
    result.bytes = {};
    const plan = [['desktop', 1, want('full')], ['desktop', 2, false], ['phone', 2, want('full')]];
    for (const [m, dpr, full] of plan) {
      if (!want('first') && !full) continue;
      log(`bytes ${m} @${dpr}×${full ? ' + full read' : ''}`);
      result.bytes[`${m}@${dpr}`] = await bytes(m, dpr, full); save();
    }
  }
  if (want('lcp')) {
    result.lcp = {};
    for (const m of ['desktop', 'phone']) {
      const runs = []; for (let i = 0; i < RUNS; i++) { log(`lcp ${m} ${i + 1}/${RUNS}`); runs.push(await lcp(m, false)); }
      result.lcp[m] = { median: median(runs.map((r) => r.lcp)), fcp: median(runs.map((r) => r.fcp)), el: runs[runs.length - 1].el, runs };
      save();
    }
  }
  if (want('lcpnet')) {
    const runs = []; for (let i = 0; i < RUNS; i++) { log(`lcp throttled phone ${i + 1}/${RUNS}`); runs.push(await lcp('phone', true)); }
    result.lcpnet = { median: median(runs.map((r) => r.lcp)), fcp: median(runs.map((r) => r.fcp)), el: runs[runs.length - 1].el, runs };
    save();
  }
  if (want('smooth')) {
    const wins = await windowsFor();
    result.smooth = [];
    for (const w of wins) for (const gl of [false, true]) { log(`smooth ${w} ${gl ? 'WebGL on' : 'WebGL off'}`); result.smooth.push(await smooth(w, gl)); save(); }
  }
} finally {
  if (srv) srv.server.close();
}

/* ── tables ────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const md = [];
const row = (...c) => md.push(`| ${c.join(' | ')} |`);
const f2 = (x, d = 2) => (x == null ? '—' : (+x).toFixed(d));
md.push(`# Perf run ${result.when}`, '', `${result.url}${result.dist ? ` (served from ${result.dist})` : ''} · load average at start ${result.loadavg} · method: ${result.method}`, '');
const B = result.bytes || {};
const L = result.lengths || {};
md.push('## Against the targets (docs/v3-plan.md §1)', '');
row('Budget', 'Measured', 'Target'); row('---', '---', '---');
if (B['desktop@1']) row('First load, desktop 1440×900 @1×', `${f2(B['desktop@1'].first.MB)} MB / ${B['desktop@1'].first.n} req`, '≤ 1.5 MB');
if (B['desktop@2']) row('First load, desktop @2×', `${f2(B['desktop@2'].first.MB)} MB / ${B['desktop@2'].first.n} req`, '≤ 1.5 MB');
if (B['phone@2']) row('First load, phone 390×844 @2×', `${f2(B['phone@2'].first.MB)} MB / ${B['phone@2'].first.n} req`, '≤ 1.0 MB');
if (B['desktop@1']?.full) row('Full read, desktop @1×', `${f2(B['desktop@1'].full.MB)} MB / ${B['desktop@1'].full.n} req`, '≤ 18 MB');
if (B['phone@2']?.full) row('Full read, phone @2×', `${f2(B['phone@2'].full.MB)} MB / ${B['phone@2'].full.n} req`, '≤ 6 MB');
if (B['desktop@1']) row('JS on the wire (gzip), desktop', `${B['desktop@1'].js.entryKB} KB entry + ${B['desktop@1'].js.lazyKB} KB lazy${B['desktop@1'].full ? ' (every scene a full read loads)' : ' (by 10 s after load)'}`, '≤ 60 KB + ≤ 160 KB lazy');
if (B['phone@2']) row('JS on the wire (gzip), phone', `${B['phone@2'].js.entryKB} KB entry + ${B['phone@2'].js.lazyKB} KB lazy`, '');
if (result.lcp) row('LCP unthrottled, desktop / phone', `${result.lcp.desktop ? (result.lcp.desktop.median / 1000).toFixed(2) : '—'} s / ${result.lcp.phone ? (result.lcp.phone.median / 1000).toFixed(2) : '—'} s (median of ${RUNS}; ${result.lcp.desktop?.el} / ${result.lcp.phone?.el})`, '≤ 1.0 s');
if (result.lcpnet) row('LCP throttled phone (4× CPU, 562.5 ms, 1.47 Mb/s)', `${(result.lcpnet.median / 1000).toFixed(2)} s (FCP ${(result.lcpnet.fcp / 1000).toFixed(2)} s; runs ${result.lcpnet.runs.map((r) => r.lcp).join(', ')} ms; ${result.lcpnet.el})`, '≤ 2.5 s');
if (L.desktop) row('Page length, desktop / phone', `${L.desktop.screens} / ${L.phone?.screens ?? '—'} screens`, '≈ 40');
if (L.desktop?.firstTitle) row('First chapter title (top, in screens)', `desktop ${L.desktop.firstTitle.top} (in view after ${L.desktop.firstTitle.inViewAfter}); phone ${L.phone?.firstTitle?.top ?? '—'} (after ${L.phone?.firstTitle?.inViewAfter ?? '—'})`, '≤ 2 screens');
if (L.desktop) row('Words per screen, desktop / phone', `${L.desktop.wordsPerScreen} / ${L.phone?.wordsPerScreen ?? '—'} (${L.desktop.words} words)`, '≈ 40–60');
if (result.smooth?.length) {
  const off = result.smooth.filter((s) => !s.gl), on = result.smooth.filter((s) => s.gl);
  row('Steady wheel, WebGL off (min / median fps)', `${Math.min(...off.map((s) => s.fps))} / ${median(off.map((s) => s.fps))}`, '≥ 50 everywhere');
  row('CLS while scrolling (max of any window)', `${Math.max(...result.smooth.map((s) => s.cls))}`, '< 0.01');
}
md.push('');
if (Object.keys(B).length) {
  md.push('## Bytes by type (KB on the wire; first load / whole run)', '');
  const types = [...new Set(Object.values(B).flatMap((b) => Object.keys(b.byType)))].sort();
  row('Type', ...Object.keys(B).map((k) => k + (B[k].full ? ' (first / full)' : ''))); row('---', ...Object.keys(B).map(() => '---:'));
  for (const t of types) row(t, ...Object.values(B).map((b) => { const o = b.byType[t]; return o ? (b.full ? `${o.firstKB} / ${o.KB}` : `${o.firstKB}`) : '—'; }));
  md.push('');
  for (const [k, b] of Object.entries(B)) {
    md.push(`Largest requests, ${k}${b.full ? ', full read' : ''}: ${b.requests.slice(0, 6).map(([u, s]) => `${u.split('/').slice(-2).join('/')} ${Math.round(s / 1024)} KB`).join(' · ')}`);
    if (b.errors.length || b.failed.length) md.push(`  - console errors / failed requests: ${[...b.errors, ...b.failed].join(' · ')}`);
  }
  md.push('');
}
if (L.desktop) {
  md.push('## Section lengths (screens, WebGL on; ?tier=0 in brackets where it differs)', '');
  row('Section', 'Desktop 1440×900', 'Phone 390×844'); row('---', '---:', '---:');
  const ids = [...new Set([...L.desktop.sections.map((s) => s.id), ...(L.phone?.sections || []).map((s) => s.id)])];
  const cell = (a, b, id) => { const x = a?.sections.find((s) => s.id === id)?.screens, y = b?.sections.find((s) => s.id === id)?.screens; return f2(x) + (y != null && x != null && Math.abs(x - y) > 0.05 ? ` (${f2(y)})` : ''); };
  for (const id of ids) row(id, cell(L.desktop, L.desktopTier0, id), cell(L.phone, L.phoneTier0, id));
  row('**page**', `**${L.desktop.screens}**${L.desktopTier0 && Math.abs(L.desktopTier0.screens - L.desktop.screens) > 0.05 ? ` (${L.desktopTier0.screens})` : ''}`, `**${L.phone?.screens ?? '—'}**${L.phoneTier0 && L.phone && Math.abs(L.phoneTier0.screens - L.phone.screens) > 0.05 ? ` (${L.phoneTier0.screens})` : ''}`);
  md.push('', `Horizontal overflow: desktop ${L.desktop.overflowX}px, phone ${L.phone?.overflowX ?? '—'}px.`, '');
}
if (result.smooth?.length) {
  md.push(`## Smoothness by window (desktop 1440×900, steady wheel 50 px / 50 ms, ${DUR / 1000} s; the top window ${(DUR * 1.4) / 1000} s)`, '');
  row('Window', 'fps off', 'p95 ms off', 'fps on', 'p95 ms on', 'CLS off / on', 'renders on (wheel / 5 s idle)', 'quality', 'load avg'); row('---', '---:', '---:', '---:', '---:', '---:', '---:', '---', '---');
  for (const w of [...new Set(result.smooth.map((s) => s.start))]) {
    const off = result.smooth.find((s) => s.start === w && !s.gl) || {}, on = result.smooth.find((s) => s.start === w && s.gl) || {};
    row(w, f2(off.fps, 1), f2(off.p95, 1), f2(on.fps, 1), f2(on.p95, 1), `${f2(off.cls, 4)} / ${f2(on.cls, 4)}`, `${on.renders ?? '—'} / ${on.idleRenders5s ?? '—'}`, `${on.quality ?? '—'}${on.realloc ? ` (${on.realloc} reallocs)` : ''}`, `${off.loadavg?.split(' ')[0] ?? ''} / ${on.loadavg?.split(' ')[0] ?? ''}`);
  }
  const errs = result.smooth.flatMap((s) => s.errors.map((e) => `${s.start} ${s.gl ? 'gl' : 'nogl'}: ${e}`));
  if (errs.length) md.push('', 'Console errors: ' + errs.slice(0, 8).join(' · '));
  md.push('', 'WebGL on is SwiftShader (software): compare within a column, not with a GPU.', '');
}
fs.writeFileSync(path.join(OUT, 'perf.md'), md.join('\n') + '\n');
save();
console.log(md.join('\n'));
console.error(`[perf] wrote ${path.join(OUT, 'perf.json')} and perf.md`);
