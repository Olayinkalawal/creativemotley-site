// The hero's camera stills, rendered from the real-time module (gl/scenes/hero3d.js through its QA hooks) so the DOM's
// stand-ins match the live camera to the pixel (ui/hero.js STILLS):
//   cam-hero   the rest pose (HERO.rest: az -35, el 8), alpha: the first paint's camera in the fingertip gap (<= 40 KB)
//   cam-front  lens-on (az 0, el 2), the same scale and target, alpha: the 2D move's end of the turn (lazy)
//   cam-lens   the front element filling the frame (dist 1.05, a field wide enough to cover 16:9), opaque (<= 60 KB, lazy)
// Alpha from a pair: the same frame over black (B = C·a) and over white (W = C·a + 1 − a): a = 1 − (W − B), C = B / a.
//   node scripts/hero-cam-stills.mjs [--url http://127.0.0.1:5530/] [--out public/assets/scenes/hero]
// Needs a dev or preview server of this repo. Prints the STILLS metadata to paste into src/ui/hero.js (w, h, upx: world
// units per image px at the target's depth, t: the target in image px, lens: the front element's centre, bw: the
// silhouette's width) and writes it beside the files (cam-stills.json).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const A = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const URL0 = (A.url || 'http://127.0.0.1:5530/').replace(/\/?$/, '/');
const OUT = path.resolve(A.out || 'public/assets/scenes/hero');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'herocam-'));
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const REST = { az: -35, el: 8 }, FRONT = { az: 0, el: 2 };
const log = (...a) => console.error('[hero-cam-stills]', ...a);

const browser = await chromium.launch({ ...(fs.existsSync(CHROME) ? { executablePath: CHROME } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => log('pageerror', e.message));
  await page.goto(URL0 + '?tier=2&q=high&hero3d=now', { waitUntil: 'load', timeout: 180000 });
  await page.addStyleTag({ content: 'main, .nav, .rail, .plates, .menu, .skip { visibility: hidden !important; } #stage { opacity: 1 !important; transition: none !important; }' });
  await page.waitForFunction(() => window.__hero3d && window.__stage && (window.__hero3d.state === 'ready' || window.__hero3d.state === 'failed'), null, { timeout: 300000 });
  if (await page.evaluate(() => window.__hero3d.state) !== 'ready') throw new Error('the 3D camera did not load');
  // hold the stage at full resolution (no governor steps while software GL draws slowly)
  await page.evaluate(() => { const st = window.__stage; st.govern = () => {}; st.pendingLevel = -1; if (st.level !== 3) { st.level = 3; st.quality = st.ctx.quality = 'high'; st.resize(); } });
  return page;
}
async function shot(page, force, bg) {
  await page.evaluate(({ force, bg }) => { window.__hero3d.force = force; window.__hero3d.bg = bg; window.__stage.invalidate(); }, { force, bg });
  // let it re-pose, then accumulate every idle sample
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__stage.invalidate());
  await page.waitForFunction(() => window.__hero3d.cam && !window.__hero3d.cam.busy(), null, { timeout: 300000 });
  await page.waitForTimeout(600);
  return page.screenshot({ type: 'png' });
}
async function pair(page, force) {
  const b = await shot(page, force, [0, 0, 0]);
  const w = await shot(page, force, [1, 1, 1]);
  const info = await page.evaluate(() => ({ box: window.__hero3d.box(), pose: window.__hero3d.pose, lens: window.__hero3d.project(window.__hero3d.model.lens), t: window.__hero3d.project(window.__hero3d.model.body) }));
  return { b, w, info };
}
const py = (script, args) => execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf8' });
const ENCODE = String.raw`
import sys, json, numpy as np
from PIL import Image
from io import BytesIO
b, w, out, crop, alpha, maxkb = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4]), sys.argv[5] == '1', int(sys.argv[6])
B = np.asarray(Image.open(b).convert('RGB')).astype(np.float32) / 255
x0, y0, x1, y1 = crop
B = B[y0:y1, x0:x1]
if alpha:
    W = np.asarray(Image.open(w).convert('RGB')).astype(np.float32)[y0:y1, x0:x1] / 255
    a = np.clip(1 - (W - B).mean(axis=2), 0, 1)
    a[a < 2 / 255] = 0
    C = np.where(a[..., None] > 1e-3, B / np.maximum(a[..., None], 1e-3), 0)
    im = Image.fromarray(np.dstack([np.clip(C, 0, 1) * 255, a * 255]).round().astype(np.uint8), 'RGBA')
else:
    im = Image.fromarray((np.clip(B, 0, 1) * 255).round().astype(np.uint8), 'RGB')
def enc(fmt, q):
    buf = BytesIO()
    if fmt == 'avif': im.save(buf, 'AVIF', quality=q, speed=6)
    else: im.save(buf, 'WEBP', quality=q, method=6, **({'alpha_quality': 90} if alpha else {}))
    return buf.getvalue()
res = {}
for fmt, hi, lo in (('avif', 80, 30), ('webp', 90, 40)):
    q, data = hi, enc(fmt, hi)
    while len(data) > maxkb * 1024 and q > lo:
        q -= 4; data = enc(fmt, q)
    open(out + '.' + fmt, 'wb').write(data)
    res[fmt] = [q, len(data)]
print(json.dumps(res))
`;
function encode(name, p, crop, alpha, maxKB) {
  fs.writeFileSync(path.join(TMP, `${name}-b.png`), p.b);
  if (p.w) fs.writeFileSync(path.join(TMP, `${name}-w.png`), p.w);
  const r = JSON.parse(py(ENCODE, [path.join(TMP, `${name}-b.png`), path.join(TMP, `${name}-w.png`), path.join(OUT, name), JSON.stringify(crop), alpha ? '1' : '0', String(maxKB)]));
  log(name, JSON.stringify(r));
  return r;
}

const meta = {};
try {
  // 1. the rest pose and lens-on: a 1200 px square, the camera ~420 px wide, centred on its body's centre
  let page = await open(1200);
  const size = 1200;
  // the distance for a ~420 px silhouette at the rest pose
  await page.evaluate((f) => { window.__hero3d.force = f; window.__stage.invalidate(); }, { s: 0, ...REST, dist: 12, lens: 0 });
  await page.waitForTimeout(1500);
  const bw0 = await page.evaluate(() => { const b = window.__hero3d.box(); return b.x1 - b.x0; });
  const dist = 12 * bw0 / 420;
  const pr = await pair(page, { s: 0, ...REST, dist, lens: 0 });
  const pf = await pair(page, { s: 0, ...FRONT, dist, lens: 0 });
  const C = 260;   // crop: 520 px square on the target
  const cx = Math.round(pr.info.t[0]), cy = Math.round(pr.info.t[1]);
  const crop = [cx - C, cy - C, cx + C, cy + C];
  const upx = (2 * dist * Math.tan((pr.info.pose.fov * Math.PI) / 360)) / size;
  const rh = encode('cam-hero', pr, crop, true, 40);
  const rf = encode('cam-front', pf, crop, true, 40);
  meta.hero = { w: 2 * C, h: 2 * C, upx: +upx.toPrecision(6), t: [C, C], lens: [+(pr.info.lens[0] - crop[0]).toFixed(1), +(pr.info.lens[1] - crop[1]).toFixed(1)], bw: +(pr.info.box.x1 - pr.info.box.x0).toFixed(1), bytes: rh };
  meta.front = { w: 2 * C, h: 2 * C, upx: +upx.toPrecision(6), t: [C, C], lens: [+(pf.info.lens[0] - crop[0]).toFixed(1), +(pf.info.lens[1] - crop[1]).toFixed(1)], bytes: rf };
  meta.fov = pr.info.pose.fov;
  await page.close();
  // 2. the lens close-up: a 1600 px square at dist 1.05, a field that covers a 16:9 screen there (fov 24.6)
  page = await open(1600);
  const fovL = 2 * Math.atan(Math.tan((7 * Math.PI) / 180) * 16 / 9) * 180 / Math.PI;
  const lb = await shot(page, { s: 0.52, az: 0, el: 0, dist: 1.05, lens: 1, fov: +fovL.toFixed(3) }, [0, 0, 0]);
  const rl = encode('cam-lens', { b: lb }, [0, 0, 1600, 1600], false, 60);
  meta.lens = { w: 1600, h: 1600, upx: +((2 * 1.05 * Math.tan((fovL * Math.PI) / 360)) / 1600).toPrecision(6), t: [800, 800], dist: 1.05, fov: +fovL.toFixed(3), bytes: rl };
  await page.close();
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'cam-stills.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(JSON.stringify(meta, null, 1));
