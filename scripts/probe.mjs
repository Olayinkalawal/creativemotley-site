// node scripts/probe.mjs "<js expression>" [mobile]  → evaluates in the page and prints JSON
import fs_ from 'node:fs';
// Playwright: the project's own (npm i -D playwright) or, in the cloud container, the preinstalled copy
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs_.existsSync(p));
const [expr, mode] = process.argv.slice(2);
const b = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}) });
const c = await b.newContext(mode === 'mobile' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'load' });
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
