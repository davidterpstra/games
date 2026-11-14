// Headless browser check: loads a page, collects console errors, optionally runs JS, saves a screenshot.
//   node tools/shot.mjs <url> <out.png> [--wait 4000] [--size 1280x720] [--eval "js expression or async fn body"] [--keys "KeyW:2000,Space"]
// Prints page console errors/warnings and the --eval result as JSON. Exit code 1 if the page threw.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
if (!url || !out) { console.error('usage: node tools/shot.mjs <url> <out.png> [--wait ms] [--size WxH] [--eval js] [--keys Code:ms,...]'); process.exit(2); }
const [w, h] = opt('size', '1280x720').split('x').map(Number);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(opt('wait', '4000')));
const keys = opt('keys', '');
if (keys) {
  await page.mouse.click(w / 2, h / 2);
  for (const k of keys.split(',')) {
    const [code, ms] = k.split(':');
    await page.keyboard.down(code);
    await page.waitForTimeout(Number(ms || 100));
    await page.keyboard.up(code);
  }
}
const ev = opt('eval', '');
if (ev) {
  try {
    const result = await page.evaluate(`(async () => { ${ev.includes('return') ? ev : 'return (' + ev + ')'} })()`);
    console.log('EVAL:', JSON.stringify(result, null, 2));
  } catch (e) { console.log('EVAL ERROR:', e.message); errors.push('[eval] ' + e.message); }
}
await page.screenshot({ path: out, timeout: 180000 });
await browser.close();
if (errors.length) console.log('CONSOLE:\n' + errors.join('\n'));
console.log('saved', out);
process.exit(errors.some((e) => e.startsWith('[pageerror]')) ? 1 : 0);
