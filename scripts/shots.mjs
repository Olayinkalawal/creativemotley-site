// QA screenshots of the local site.
//   node scripts/shots.mjs [--url http://localhost:5173] [--mode desktop|mobile] [--out qa/shots/x]
//        [--at "top,#storytellers,#storytellers+0.5,12000"] [--tier 2] [--wait 1400] [--full]
// "--at" items: a CSS selector (scrolls its top to the viewport top), selector+frac (adds frac
// of the element's height), or a raw scrollY. Without --at it walks the page every 0.75 viewport.
import fs_ from 'node:fs';
// Playwright: the project's own (npm i -D playwright) or, in the cloud container, the preinstalled copy
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs_.existsSync(p));
import fs from 'fs';
const A = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const url = A.url || 'http://localhost:5173/';
const mode = A.mode || 'desktop';
const out = A.out || `qa/shots/${mode}`;
fs.mkdirSync(out, { recursive: true });
const vp = mode === 'mobile' ? { width: 390, height: 844 } : { width: +(A.w || 1440), height: +(A.h || 900) };
const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args: [...(CHROME ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : []), '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mode === 'mobile' ? 2 : 1, isMobile: mode === 'mobile', hasTouch: mode === 'mobile', reducedMotion: A.reduced ? 'reduce' : 'no-preference' });
const page = await ctx.newPage();
await page.routeWebSocket(/.*/, () => {}); // mute Vite HMR reloads during capture (other builders edit files)
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const q = A.tier !== undefined ? `?tier=${A.tier}` : '';
await page.goto(url + q, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(+(A.boot || 3500));
const H = await page.evaluate(() => document.documentElement.scrollHeight);
let stops = [];
if (A.at && A.at !== true) stops = String(A.at).split(',');
else for (let y = 0; y < H - vp.height * 0.5; y += Math.round(vp.height * 0.75)) stops.push(String(y));
let i = 0;
for (const s of stops) {
  const y = await page.evaluate((s) => {
    if (s === 'top') return 0;
    if (/^\d+$/.test(s)) return +s;
    const [sel, frac] = s.split('+');
    const el = document.querySelector(sel);
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.round(r.top + scrollY + (frac ? r.height * parseFloat(frac) : 0));
  }, s);
  await page.evaluate((y) => { window.scrollTo(0, y); }, y);
  await page.waitForTimeout(+(A.wait || 1400));
  const name = `${out}/${String(i).padStart(3, '0')}_${String(s).replace(/[^\w.+-]/g, '')}.jpg`;
  await page.screenshot({ path: name, type: 'jpeg', quality: 80, fullPage: !!A.full });
  i++;
}
const info = await page.evaluate(() => ({ H: document.documentElement.scrollHeight, gl: document.documentElement.classList.contains('gl-ready'), tier: document.documentElement.dataset.tier }));
console.log(JSON.stringify({ shots: i, ...info, errors: errors.slice(0, 20) }));
await browser.close();
