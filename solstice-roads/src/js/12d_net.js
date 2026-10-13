/* =====================================================================
   Online free roam over Firebase Realtime Database (REST + streaming).
   Each client PUTs its own car state ~8x a second to
   /solstice-roads/v1/players/<id> and streams the whole players node
   with EventSource. Remote cars are smoothed, named and collidable.
   Servers are tried in order (auto) until one answers; the player can
   also pick one in Settings → Online. All incoming data is validated:
   the databases are open, so anything could be written there.
   ===================================================================== */
const NET_SERVERS = [
  'https://device-streaming-34280597-default-rtdb.europe-west1.firebasedatabase.app',
  'https://quizplatform-6be74-default-rtdb.europe-west1.firebasedatabase.app',
  'https://leermaat-ai-default-rtdb.europe-west1.firebasedatabase.app',
  'https://nieuwtablat-default-rtdb.europe-west1.firebasedatabase.app',
  'https://teamsstickerbot-default-rtdb.europe-west1.firebasedatabase.app',
];
const NET_ROOT = '/solstice-roads/v1';
const NET_MAX = 24;
const Net = {
  id: '', idx: -1, url: '', status: 'off', detail: '', es: null, remotes: new Map(),
  sendT: 0, inflight: false, fails: 0, gen: 0, cleanT: 10,
};

function netName() {
  if (!Save.data.name) Save.data.name = 'Driver' + String(Math.floor(1000 + Math.random() * 9000));
  return Save.data.name;
}
function netSetStatus(st, detail = '') {
  Net.status = st; Net.detail = detail;
  const n = [...Net.remotes.values()].filter((r) => r.visible).length;
  const txt = st === 'online' ? `Online · Server ${Net.idx + 1} · ${n + 1} player${n ? 's' : ''}`
    : st === 'connecting' ? `Connecting${detail ? ' · ' + detail : ''}…`
      : st === 'failed' ? detail || 'Offline · no server reachable'
        : 'Offline';
  const el = $('net');
  if (el) { el.textContent = txt; el.className = 'net ' + st; }
  const s = $('netStatus');
  if (s) s.textContent = txt;
}

async function netProbe(i) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4500);
  try {
    const r = await fetch(NET_SERVERS[i] + NET_ROOT + '/ping.json', { signal: ctl.signal, cache: 'no-store' });
    return r.ok;
  } catch (e) {
    return false;
  } finally { clearTimeout(timer); }
}
async function netConnect(startAt = 0) {
  netClose();
  if (!Game.settings.online) { netSetStatus('off'); return; }
  if (!Save.data.netId) { Save.data.netId = Math.random().toString(36).slice(2, 12); Save.write(); }
  Net.id = Save.data.netId;
  const gen = ++Net.gen;
  const pick = Game.settings.server;
  const order = pick === 'auto' || pick === undefined
    ? [0, 1, 2, 3, 4].map((k) => (k + startAt) % NET_SERVERS.length)
    : [pick | 0];
  for (const i of order) {
    netSetStatus('connecting', 'Server ' + (i + 1));
    const ok = await netProbe(i);
    if (gen !== Net.gen) return; // settings changed meanwhile
    if (ok) { netOpen(i); return; }
  }
  netSetStatus('failed', pick === 'auto' || pick === undefined ? 'Offline · no server reachable' : `Offline · Server ${(pick | 0) + 1} unreachable`);
}
function netOpen(i) {
  Net.idx = i; Net.url = NET_SERVERS[i]; Net.fails = 0;
  let es;
  try { es = new EventSource(Net.url + NET_ROOT + '/players.json'); } catch (e) { netLost(); return; }
  Net.es = es;
  es.addEventListener('put', (e) => netEvent(e.data, false));
  es.addEventListener('patch', (e) => netEvent(e.data, true));
  es.addEventListener('cancel', () => netLost());
  es.onopen = () => netSetStatus('online');
  es.onerror = () => { if (es.readyState === 2) netLost(); };
  netSetStatus('online');
  netSend(true);
}
function netClose() {
  if (Net.es) { Net.es.close(); Net.es = null; }
  for (const id of [...Net.remotes.keys()]) netRemove(id);
  Net.idx = -1; Net.url = '';
}
function netLost() {
  const was = Net.idx;
  netClose();
  netSetStatus('connecting', 'reconnecting');
  // auto mode moves on to the next server; a chosen server is retried
  const auto = Game.settings.server === 'auto' || Game.settings.server === undefined;
  setTimeout(() => netConnect(auto ? (was + 1) % NET_SERVERS.length : 0), 1500);
}
function netLeave() {
  if (!Net.url || !Net.id) return;
  try { fetch(Net.url + NET_ROOT + '/players/' + Net.id + '.json', { method: 'DELETE', keepalive: true }); } catch (e) { /* ignore */ }
}

/* ---------- incoming ---------- */
function netEvent(raw, patch) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }
  if (!msg || typeof msg.path !== 'string') return;
  const parts = msg.path.split('/').filter(Boolean);
  if (parts.length === 0) {
    if (!patch) for (const id of [...Net.remotes.keys()]) if (!msg.data || !(id in msg.data)) netRemove(id);
    if (msg.data && typeof msg.data === 'object') for (const [id, d] of Object.entries(msg.data)) netApply(id, d);
  } else if (parts.length === 1) {
    if (patch && msg.data && typeof msg.data === 'object' && Net.remotes.has(parts[0])) netApply(parts[0], { ...Net.remotes.get(parts[0]).last, ...msg.data });
    else netApply(parts[0], msg.data);
  }
  // deeper paths (single fields) are ignored: clients always write whole records
}
const num = (v, lim) => (typeof v === 'number' && isFinite(v) && Math.abs(v) <= lim ? v : null);
function netApply(id, d) {
  if (typeof id !== 'string' || id.length > 40 || id === Net.id) return;
  if (!d || typeof d !== 'object') { netRemove(id); return; }
  const x = num(d.x, 1300), z = num(d.z, 1300), y = num(d.y, 500), h = num(d.h, 100);
  if (x === null || z === null || y === null || h === null) return;
  const rec = {
    n: typeof d.n === 'string' ? d.n.replace(/[^\p{L}\p{N} _.\-]/gu, '').slice(0, 16) || 'Driver' : 'Driver',
    c: clamp(num(d.c, 99) ?? 0, 0, CARS.length - 1) | 0,
    p: (num(d.p, 0xffffff) ?? 0xcccccc) | 0,
    x, z, y, h, vx: num(d.vx, 200) ?? 0, vz: num(d.vz, 200) ?? 0, s: num(d.s, 200) ?? 0,
    t: num(d.t, 1e14) ?? 0, b: d.b ? 1 : 0,
  };
  let r = Net.remotes.get(id);
  if (!r) {
    if (Net.remotes.size >= NET_MAX) return;
    r = netCreateRemote(id, rec);
    if (!r) return;
  } else if (r.c !== rec.c || r.p !== rec.p) {
    netRemove(id); r = netCreateRemote(id, rec); if (!r) return;
  }
  if (r.name !== rec.n) netNameTag(r, rec.n);
  r.last = rec; r.recv = performance.now();
  if (!r.placed) { r.x = rec.x; r.z = rec.z; r.y = rec.y; r.h = rec.h; r.placed = true; }
}
function netCreateRemote(id, rec) {
  const spec = CARS[rec.c];
  const model = makeCar(spec, rec.p, { lite: true });
  Game.scene.add(model.root);
  const r = { id, c: rec.c, p: rec.p, spec, model, name: '', tag: null, x: rec.x, z: rec.z, y: rec.y, h: rec.h, vx: 0, vz: 0, spin: 0, recv: performance.now(), visible: true, hw: spec.wid / 2 * 0.96, hl: spec.len / 2 * 0.97, m: spec.mass };
  Net.remotes.set(id, r);
  netNameTag(r, rec.n);
  return r;
}
function netNameTag(r, name) {
  r.name = name;
  if (r.tag) { r.model.root.remove(r.tag); r.tag.material.map.dispose(); r.tag.material.dispose(); }
  const tex = canvasTex(256, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.font = '700 30px Saira, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const tw = Math.min(w - 8, x.measureText(name).width + 28);
    x.fillStyle = 'rgba(12,14,22,0.72)'; x.beginPath(); x.roundRect((w - tw) / 2, 10, tw, 44, 22); x.fill();
    x.fillStyle = '#ffffff'; x.fillText(name, w / 2, 33);
  }, { repeat: false });
  r.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  r.tag.scale.set(3.2, 0.8, 1);
  r.tag.position.y = r.spec.hgt + 1.1;
  r.model.root.add(r.tag);
}
function netRemove(id) {
  const r = Net.remotes.get(id);
  if (!r) return;
  Game.scene.remove(r.model.root);
  if (r.tag) { r.tag.material.map.dispose(); r.tag.material.dispose(); }
  r.model.dispose();
  Net.remotes.delete(id);
}

/* ---------- outgoing + per-frame ---------- */
function netSend(force) {
  if (!Net.url || Net.inflight || !Game.player) return;
  const p = Game.player;
  const body = {
    n: netName(), c: Game.carIdx, p: Game.paint,
    x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), h: +p.h.toFixed(3),
    vx: +p.vx.toFixed(2), vz: +p.vz.toFixed(2), s: +p.speed.toFixed(1), b: p.brakeOn ? 1 : 0, t: Date.now(),
  };
  Net.inflight = true;
  fetch(Net.url + NET_ROOT + '/players/' + Net.id + '.json', { method: 'PUT', body: JSON.stringify(body), keepalive: !!force })
    .then((r) => { Net.fails = r.ok ? 0 : Net.fails + 1; })
    .catch(() => { Net.fails++; })
    .finally(() => { Net.inflight = false; if (Net.fails >= 6) netLost(); });
}
function netUpdate(dt) {
  if (!Net.url) return;
  const driving = (Game.mode === 'drive' || Game.mode === 'race') && !Game.paused;
  Net.sendT -= dt;
  if (Net.sendT <= 0) { Net.sendT = driving ? 0.12 : 1.0; netSend(); }
  const now = performance.now();
  let shown = 0;
  for (const r of Net.remotes.values()) {
    const L = r.last;
    if (!L) continue;
    const age = (now - r.recv) / 1000;
    r.visible = age < 8;
    r.model.root.visible = r.visible;
    if (!r.visible) continue;
    shown++;
    // extrapolate a little along the reported velocity, then ease towards it
    const ex = Math.min(age, 0.4);
    const tx = L.x + L.vx * ex, tz = L.z + L.vz * ex;
    const k = 1 - Math.exp(-dt * 10);
    if (Math.hypot(tx - r.x, tz - r.z) > 30) { r.x = tx; r.z = tz; } else { r.x += (tx - r.x) * k; r.z += (tz - r.z) * k; }
    r.h += wrapAngle(L.h - r.h) * k;
    r.y = groundAt(r.x, r.z, L.y + 1);
    r.vx = L.vx; r.vz = L.vz;
    const m = r.model;
    m.root.position.set(r.x, r.y, r.z);
    m.root.rotation.set(0, r.h, 0, 'YXZ');
    r.spin += (L.s || 0) / r.spec.tyreR * dt;
    for (const w of m.wheels) w.spin.rotation.x = r.spin;
    m.brake.emissiveIntensity = L.b ? 4 : 0.4 + Sky.night * 0.9;
    m.head.emissiveIntensity = 0.5 + Sky.night * 3;
    for (const lm of m.lampMats) lm.emissiveIntensity = 0.3 + Sky.night * 2.2;
  }
  // refresh the status chip now and then
  Net.chipT = (Net.chipT || 0) - dt;
  if (Net.chipT <= 0) { Net.chipT = 1; if (Net.status === 'online') netSetStatus('online'); }
  // tidy up records of players whose game closed without saying goodbye
  Net.cleanT -= dt;
  if (Net.cleanT <= 0) {
    Net.cleanT = 15;
    for (const [id, r] of Net.remotes) if (now - r.recv > 120000) { fetch(Net.url + NET_ROOT + '/players/' + id + '.json', { method: 'DELETE' }).catch(() => {}); netRemove(id); }
  }
  void shown;
}
/* Player vs remote cars (free roam only): we bounce, they are driven by their own client. */
function collideRemotes(player) {
  if (Race.ev || !Net.url) return;
  for (const c of Net.remotes.values()) {
    if (!c.visible) continue;
    const dx = c.x - player.x, dz = c.z - player.z;
    if (dx * dx + dz * dz > 49 || Math.abs(c.y - player.y) > 3) continue;
    const r = boxVsCollider(player.x, player.z, player.h, player.hw, player.hl, { t: 1, x: c.x, z: c.z, hx: c.hw, hz: c.hl, c: Math.cos(c.h), s: Math.sin(c.h) });
    if (!r) continue;
    const nx = r.n[0], nz = r.n[1];
    player.x += nx * r.d; player.z += nz * r.d;
    const vrel = (player.vx - c.vx) * nx + (player.vz - c.vz) * nz;
    if (vrel < 0) {
      const k = c.m / (c.m + player.m);
      player.vx -= nx * vrel * (1.2 * k + 0.1); player.vz -= nz * vrel * (1.2 * k + 0.1);
      if (-vrel > 2) Bus.emit('hit', { car: player, v: -vrel });
    }
  }
}
