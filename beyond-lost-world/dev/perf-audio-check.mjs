// Counts console warnings/errors during an autostart run with the browser's autoplay policy enforced.
//   node dev/perf-audio-check.mjs [--port 5188]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
const args = process.argv.slice(2);
const port = args[args.indexOf('--port') + 1] || '5188';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=document-user-activation-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const msgs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(m.text().slice(0, 120)); });
await page.goto(`http://localhost:${port}/index.html?debug&autostart&nosave&quality=low`);
await page.waitForFunction(() => window.BEYOND && window.BEYOND.game.state === 'playing', null, { timeout: 240000 });
await page.evaluate(() => { const B = window.BEYOND; for (let i = 0; i < 30; i++) { B.bus.emit('sfx', { name: 'pickup' }); B.bus.emit('player:step', { surface: 'grass' }); } });
await page.waitForTimeout(6000);
const before = msgs.length;
await page.mouse.click(320, 180);           // a real gesture must start audio
await page.waitForTimeout(1500);
const ctxState = await page.evaluate(() => window.BEYOND.environment.audio.ready);
console.log(JSON.stringify({ warningsBeforeGesture: before, warningsTotal: msgs.length, audioRunningAfterGesture: ctxState, sample: [...new Set(msgs)].slice(0, 3) }));
await browser.close();
