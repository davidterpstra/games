// Build Your Village — bundles src/ into a single self-contained HTML file.
//   node build.mjs            -> index.html (full document, open it in any browser)
//   node build.mjs --fragment <out.html>  -> also writes a body-only fragment
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const jsFiles = fs.readdirSync(path.join(dir, 'src/js')).filter((f) => f.endsWith('.js')).sort();
const js = jsFiles.map((f) => `/* ==== ${f} ==== */\n${read('src/js/' + f)}`).join('\n');
const css = read('src/styles.css');
const shell = read('src/shell.html');

const head = `<title>Build Your Village</title>
<meta name="description" content="A cozy low-poly village builder: gather, build, welcome villagers and grow a hamlet into a Grand City.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800&display=swap">
<style>
${css}
</style>`;
const body = `${shell}
<script type="importmap">{ "imports": { "three": "${THREE_URL}" } }</script>
<script type="module">
${js}
</script>`;

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head}
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(dir, 'index.html'), full);
const fi = process.argv.indexOf('--fragment');
if (fi > 0 && process.argv[fi + 1]) fs.writeFileSync(process.argv[fi + 1], head + '\n' + body + '\n');
console.log(`Built index.html (${(full.length / 1024).toFixed(0)} KB, ${jsFiles.length} modules, ${js.split('\n').length} lines of JS)`);
