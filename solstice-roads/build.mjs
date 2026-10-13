// Solstice Roads — bundles src/ into one self-contained HTML file.
//   node build.mjs   -> index.html (open it in any modern browser)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const THREE_BASE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';

const jsFiles = fs.readdirSync(path.join(dir, 'src/js')).filter((f) => f.endsWith('.js')).sort();
const js = jsFiles.map((f) => `/* ==== ${f} ==== */\n${read('src/js/' + f)}`).join('\n');
const css = read('src/styles.css');
const shell = read('src/shell.html');

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>Solstice Roads</title>
<meta name="description" content="An open-world countryside racing game in the browser: drive, drift and race across a fictional British countryside festival.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700;800;900&family=Saira:wght@400;500;600;700&display=swap">
<style>
${css}
</style>
</head>
<body>
${shell}
<script type="importmap">{ "imports": { "three": "${THREE_BASE}build/three.module.js", "three/addons/": "${THREE_BASE}examples/jsm/" } }</script>
<script type="module">
${js}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(dir, 'index.html'), full);
console.log(`Built index.html (${(full.length / 1024).toFixed(0)} KB, ${jsFiles.length} modules, ${js.split('\n').length} lines of JS)`);
