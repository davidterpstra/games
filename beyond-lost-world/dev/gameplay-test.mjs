// Runs dev/gameplay-test.html headless and prints PASS/FAIL per step. Usage: node dev/gameplay-test.mjs [port]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
const port = process.argv[2] || '5184';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
for (const query of ['', '?nosave']) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/dev/gameplay-test.html${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
  const results = await page.evaluate(() => window.__results);
  for (const r of results) { console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n        ' + r.detail}`); if (!r.pass) failed++; }
  if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); failed++; }
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
