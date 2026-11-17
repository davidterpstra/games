// Isolated module test page (lets one builder test a module before the others exist).
//   node tools/harness.mjs --files 04_scene.js[,05_animals.js] [--stubs stubs.js] [--main test.js]
//        [--css] [--shot out.png] [--wait 3000] [--eval check.js] [--size 1280x800] [--mobile]
// Page JS = 00_core.js + stubs file + listed src/js files + main file, as ONE module (same rules as
// the real build). --css includes src/css/*.css and src/shell.html (if present). --eval runs a
// script after --wait ms and prints its JSON return value. Console errors are printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes(n);
const readMaybe = (p) => (p ? fs.readFileSync(path.resolve(p), 'utf8') : '');

const files = ['00_core.js'];
const stubs = readMaybe(opt('--stubs'));
const listed = (opt('--files', '') || '').split(',').map((s) => s.trim()).filter(Boolean).filter((f) => f !== '00_core.js');
let js = `/* core */\n${fs.readFileSync(path.join(root, 'src/js/00_core.js'), 'utf8')}\n/* stubs */\n${stubs}\n`;
for (const f of listed) js += `/* ==== ${f} ==== */\n${fs.readFileSync(path.join(root, 'src/js', f), 'utf8')}\n`;
js += `/* main */\n${readMaybe(opt('--main'))}\n`;
files.push(...listed);

let css = '', shell = '<canvas id="game-canvas"></canvas><div id="ui"></div>';
if (has('--css')) {
  const cdir = path.join(root, 'src/css');
  if (fs.existsSync(cdir)) css = fs.readdirSync(cdir).filter((f) => f.endsWith('.css')).sort().map((f) => fs.readFileSync(path.join(cdir, f), 'utf8')).join('\n');
  if (fs.existsSync(path.join(root, 'src/shell.html'))) shell = fs.readFileSync(path.join(root, 'src/shell.html'), 'utf8');
}
const baseCss = 'html,body{margin:0;height:100%;overflow:hidden;background:#222}#game-canvas{position:fixed;inset:0;width:100%;height:100%;display:block}';
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>${baseCss}\n${css}</style></head><body>${shell}
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }</script>
<script type="module">\n${js}\n</script></body></html>`;
fs.mkdirSync(path.join(root, '.build'), { recursive: true });
const out = path.join(root, `.build/harness-${process.pid}.html`);
fs.writeFileSync(out, html);

const threeLocal = path.join(root, '.cache/three.module.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let ctxOpts = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
if (has('--mobile')) ctxOpts = { ...devices['iPhone 13'] };
const size = opt('--size');
if (size) { const [w, hgt] = size.split('x').map(Number); ctxOpts = { ...ctxOpts, viewport: { width: w, height: hgt } }; }
const context = await browser.newContext(ctxOpts);
await context.route(/cdn\.jsdelivr\.net\/npm\/three@/, (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') errors.push(`[console.${t}] ${m.text()}`); else if (t === 'log' || t === 'info') console.log('[page]', m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
await page.goto('file://' + out + '?debug');
await page.waitForTimeout(Number(opt('--wait', 3000)));
const ev = opt('--eval');
if (ev) {
  try { console.log('EVAL RESULT:', JSON.stringify(await page.evaluate(`(async () => { ${readMaybe(ev)} })()`), null, 2)); }
  catch (e) { console.log('EVAL ERROR:', e.message); }
}
const shot = opt('--shot');
if (shot) { await page.screenshot({ path: shot }); console.log('Screenshot:', shot); }
console.log(errors.length ? `${errors.length} console problem(s):\n` + errors.slice(0, 40).join('\n') : 'No console errors');
await browser.close();
fs.rmSync(out, { force: true });
