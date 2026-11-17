// Claw Machine Simulator — bundles src/ into one self-contained index.html.
//   node build.mjs   -> index.html (+ .build/bundle.mjs for syntax checks)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const list = (d, ext) => (fs.existsSync(path.join(dir, d)) ? fs.readdirSync(path.join(dir, d)).filter((f) => f.endsWith(ext)).sort() : []);
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const jsFiles = list('src/js', '.js');
const js = jsFiles.map((f) => `/* ==== ${f} ==== */\n${read('src/js/' + f)}`).join('\n');
const css = list('src/css', '.css').map((f) => `/* ==== ${f} ==== */\n${read('src/css/' + f)}`).join('\n');
const shell = fs.existsSync(path.join(dir, 'src/shell.html'))
  ? read('src/shell.html')
  : '<canvas id="game-canvas"></canvas><div id="ui"></div><div id="loading">Loading…</div>';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#2b1d5c">
<title>Claw Machine Simulator</title>
<meta name="description" content="Grab cute animals from your own 3D claw machine, train with your pets, upgrade your claw and unlock new arcades.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@700;800;900&display=swap">
<style>
${css}
</style>
</head>
<body>
${shell}
<script>
// If the 3D engine (CDN) cannot be loaded the module never runs: tell the player instead of spinning forever.
setTimeout(function () {
  if (window.__cmsBooted) return;
  var m = document.getElementById('loading-msg');
  if (m && !m.textContent) m.textContent = 'Still loading… The game needs an internet connection the first time to download the 3D engine.';
}, 12000);
</script>
<script type="importmap">{ "imports": { "three": "${THREE_URL}" } }</script>
<script type="module">
${js}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(dir, 'index.html'), html);

// --artifact <out.html>: body-only page for hosts that wrap the file in their own document skeleton
const ai = process.argv.indexOf('--artifact');
if (ai > 0 && process.argv[ai + 1]) {
  const start = html.indexOf('<title>'), headEnd = html.indexOf('</head>');
  const bodyStart = html.indexOf('<body>') + '<body>'.length, bodyEnd = html.lastIndexOf('</body>');
  const page = html.slice(start, headEnd).replace('<style>', '<style>\n:root { color-scheme: dark; }') + html.slice(bodyStart, bodyEnd);
  fs.writeFileSync(path.resolve(process.argv[ai + 1]), page);
  console.log('Wrote artifact page', process.argv[ai + 1]);
}
fs.mkdirSync(path.join(dir, '.build'), { recursive: true });
fs.writeFileSync(path.join(dir, '.build/bundle.mjs'), js);
console.log(`Built index.html (${(html.length / 1024).toFixed(0)} KB, ${jsFiles.length} JS modules, ${js.split('\n').length} lines of JS)`);
