// Audio smoke test: plays every SFX name (plain, positional, via bus), footstep events, then runs the ambience
// for all weather types / interiors for a few seconds. Fails on any exception or [audio] warning.
//   node dev/environment-audio-test.mjs [port=5185]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const port = process.argv[2] || 5185;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[audio]'))) problems.push(m.text()); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${port}/dev/environment-preview.html?t=21&w=clear`);
await page.waitForTimeout(2500);
await page.mouse.click(300, 200);
const result = await page.evaluate(async () => {
  const env = window.__env, bus = window.__bus;
  env.audio.unlock();
  await new Promise((r) => setTimeout(r, 400));
  const { SFX_NAMES } = await import('/src/environment/audio/sfx.js');
  const out = { ready: env.audio.ready, played: 0 };
  const THREE = await import('three');
  for (const n of SFX_NAMES) {
    env.audio.play(n);
    env.audio.play(n, { position: new THREE.Vector3(5, 1, -4), volume: 0.7 });
    bus.emit('sfx', { name: n, position: new THREE.Vector3(-3, 1, 2) });
    out.played += 3;
  }
  for (const s of ['grass', 'dirt', 'stone', 'sand', 'wood', 'metal', 'water']) { bus.emit('player:step', { surface: s, sprint: s === 'wood' }); }
  bus.emit('player:jump', {}); bus.emit('player:land', { impact: 6 });
  env.audio.play('does_not_exist'); // must warn but not throw
  // ambience under all states
  for (const w of ['clear', 'rain', 'storm', 'fog']) { env.setWeather(w, true); env.setTimeOfDay(w === 'clear' ? 22 : 12); await new Promise((r) => setTimeout(r, 700)); }
  env.setTorch(true); await new Promise((r) => setTimeout(r, 500)); env.setTorch(false);
  window.__camera.position.set(-30, 5, -10); await new Promise((r) => setTimeout(r, 800));
  return out;
});
console.log(JSON.stringify(result));
await browser.close();
const real = problems.filter((p) => !p.includes('does_not_exist'));
if (real.length) { console.log('PROBLEMS:\n' + real.join('\n')); process.exit(1); }
console.log('audio ok');
