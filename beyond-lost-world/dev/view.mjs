// Renders the full game from given camera spots and saves JPEGs (reads the canvas directly; works under software GL).
//   node dev/view.mjs --port 5173 --quality low --out dir --time 10.5 "name:x,z,yaw,pitch[,y]" ...
// y is optional (default: ground + eye height via player.teleport). yaw 0 = looking north (-Z).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const port = opt('port', '5173'), quality = opt('quality', 'medium'), out = opt('out', 'shots'), time = opt('time', '');
const size = opt('size', '960x540').split('x').map(Number);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${port}/index.html?debug&autostart&nosave&quality=${quality}`);
await page.waitForFunction(() => window.BEYOND && window.BEYOND.game.state === 'playing', null, { timeout: 240000 });
for (const spec of args) {
  const [name, rest] = spec.split(':');
  const [x, z, yaw = 0, pitch = 0, y] = rest.split(',').map(Number);
  const shot = await page.evaluate(({ x, z, yaw, pitch, y, time }) => {
    const B = window.BEYOND;
    if (time) B.environment.setTimeOfDay(+time);
    const gy = Number.isFinite(y) ? y : B.world.getHeightAt(x, z);
    B.player.teleport(new B.THREE.Vector3(x, gy, z), yaw, pitch);
    for (let i = 0; i < 4; i++) { B.environment.update(0.016, B.player.state.position, { simulate: false }); B.world.update(0.016, 1, B.camera.position); B.player.update(0.016); }
    B.lighting?.refreshShadows?.();
    B.renderer.render(B.scene, B.camera);
    B.renderer.render(B.scene, B.camera);
    return B.renderer.domElement.toDataURL('image/jpeg', 0.85);
  }, { x, z, yaw, pitch, y, time });
  fs.writeFileSync(`${out}/${name}.jpg`, Buffer.from(shot.split(',')[1], 'base64'));
  console.log('saved', `${out}/${name}.jpg`);
}
if (errors.length) console.log('errors:', errors.join('\n'));
await browser.close();
