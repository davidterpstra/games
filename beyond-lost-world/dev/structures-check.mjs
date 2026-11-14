// node dev/structures-check.mjs [port]  – opens the preview in headless Chromium and runs the contract checks.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../tools/shot.mjs', import.meta.url));
const { chromium } = require('playwright');
const port = process.argv[2] || 5182;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
await page.goto(`http://localhost:${port}/dev/structures-preview.html`);
await page.waitForFunction('window.__ready === true', null, { timeout: 240000 });
const res = await page.evaluate(() => window.__check());
console.log(JSON.stringify(res, null, 2));
if (logs.length) console.log('CONSOLE:', logs.join('\n'));
await browser.close();
process.exit(res.errors.length || logs.length ? 1 : 0);
