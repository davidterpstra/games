// Runs every tests/*.test.mjs file against its own server (free port), one at a time (software WebGL is memory hungry).
//   npm test                      all files
//   node tests/run-all.mjs boot   only files whose name contains "boot"
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const filter = process.argv.slice(2);

const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const port = await freePort();
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
let up = false;
for (let i = 0; i < 50 && !up; i++) {
  try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); up = r.ok; } catch { /* not yet */ }
  if (!up) await wait(100);
}
if (!up) { console.error('server did not start'); server.kill(); process.exit(2); }
console.log(`server on port ${port}`);

const order = ['boot', 'chapter', 'reachability', 'systems', 'visual'];
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs') && (!filter.length || filter.some((x) => f.includes(x))))
  .sort((a, b) => (order.indexOf(a.split('.')[0]) + 99) % 99 - (order.indexOf(b.split('.')[0]) + 99) % 99);

const summary = [];
let failedChecks = 0, totalChecks = 0, failedFiles = 0;
for (const f of files) {
  const t0 = Date.now();
  console.log(`\n=== ${f} ===`);
  const res = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, f)], { cwd: root, env: { ...process.env, PORT: String(port), BASE_URL: `http://127.0.0.1:${port}` }, stdio: ['ignore', 'pipe', 'inherit'] });
    let pass = 0, fail = 0, buf = '';
    child.stdout.on('data', (d) => {
      process.stdout.write(d); buf += d;
      let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.startsWith('PASS ')) pass++; else if (line.startsWith('FAIL ')) fail++; }
    });
    const timer = setTimeout(() => { console.log(`FAIL  [${f}] timed out after 20 minutes`); child.kill('SIGKILL'); }, 20 * 60 * 1000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, pass, fail }); });
  });
  totalChecks += res.pass + res.fail; failedChecks += res.fail;
  if (res.code !== 0 || res.fail) failedFiles++;
  summary.push({ f, ...res, s: ((Date.now() - t0) / 1000).toFixed(0) });
}
server.kill();

console.log('\n================ SUMMARY ================');
for (const s of summary) console.log(`${s.fail || s.code ? 'FAIL' : 'PASS'}  ${s.f.padEnd(28)} ${String(s.pass).padStart(4)} passed ${String(s.fail).padStart(3)} failed  (${s.s}s)${s.code && !s.fail ? '  exit ' + s.code : ''}`);
console.log(`${totalChecks - failedChecks}/${totalChecks} checks passed in ${files.length} files`);
process.exit(failedFiles ? 1 : 0);
