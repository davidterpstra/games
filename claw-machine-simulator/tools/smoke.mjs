// Headless smoke test.
//   node tools/smoke.mjs [--shot out.png] [--wait 4000] [--mobile] [--eval script.js] [--fresh] [--no-build]
// Loads index.html?debug from file://, serves three.js from .cache/three.module.js (the CDN is
// not reachable in CI), prints console errors / page errors, optionally runs a script in the page
// (its return value is printed as JSON) and saves a screenshot.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes(n);

if (!has('--no-build')) execSync('node build.mjs', { cwd: root, stdio: 'inherit' });
const threeLocal = path.join(root, '.cache/three.module.js');
if (!fs.existsSync(threeLocal)) { console.error('Missing .cache/three.module.js (run: npm pack three@0.160.0 and copy build/three.module.js)'); process.exit(2); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctxOpts = has('--mobile') ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
const context = await browser.newContext(ctxOpts);
await context.route(/cdn\.jsdelivr\.net\/npm\/three@/, (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[console.${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
const url = 'file://' + path.join(root, 'index.html') + '?debug';
await page.goto(url);
if (has('--fresh')) { await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload(); }
await page.waitForTimeout(Number(opt('--wait', 4000)));
const evalFile = opt('--eval');
if (evalFile) {
  const code = fs.readFileSync(evalFile, 'utf8');
  try {
    const res = await page.evaluate(`(async () => { ${code} })()`);
    console.log('EVAL RESULT:', JSON.stringify(res, null, 2));
  } catch (e) { console.log('EVAL ERROR:', e.message); }
}
const shot = opt('--shot');
if (shot) { await page.screenshot({ path: shot }); console.log('Screenshot:', shot); }
console.log(errors.length ? `${errors.length} console problem(s):\n` + errors.slice(0, 40).join('\n') : 'No console errors');
await browser.close();
