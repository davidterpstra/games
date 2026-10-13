/* =====================================================================
   HUD: tachometer + speed + gear, minimap (pre-rendered world map,
   heading-up), location, race panel, drift chain, notifications,
   interaction prompt, countdown.
   ===================================================================== */
const Hud = { map: null, mapScale: 0.5, tach: null, tctx: null, mm: null, mctx: null, loc: '', locT: 0, near: null, fpsT: 0, frames: 0, lastSpeed: -1, lastGear: '' };

function buildWorldMap() {
  const S = 1200, sc = S / WORLD; // px per metre
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const img = x.createImageData(S, S), d = img.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const wx = i / sc - HALF, wz = j / sc - HALF;
    const id = cellId(wx, wz), h = World.H[id], s = World.SURF[id];
    const hx = World.H[id + 1 < World.H.length ? id + 1 : id] - World.H[id > 0 ? id - 1 : id];
    const hz = World.H[Math.min(World.H.length - 1, id + GV)] - World.H[Math.max(0, id - GV)];
    const shade = clamp(1 - (hx * 0.6 + hz * 0.9) * 0.18, 0.55, 1.3);
    let r = 70, g = 96, b = 58;
    const fld = World.FLD[id];
    if (fld) { const t = CROP_TINT[fld - 1]; r *= t[0] * 0.95; g *= t[1] * 0.95; b *= t[2]; }
    if (s === S_ROCK) { r = 110; g = 106; b = 98; }
    if (s === S_SNOW) { r = 225; g = 230; b = 236; }
    if (s === S_MUD || s === S_DIRT) { r = 112; g = 92; b = 66; }
    const td = treeDensityFast(wx, wz);
    if (td > 0.4) { r *= 0.6; g *= 0.72; b *= 0.6; }
    if (s === S_WATER || World.WL[id] > h) { r = 44; g = 96; b = 132; }
    const k = (j * S + i) * 4;
    d[k] = r * shade; d[k + 1] = g * shade; d[k + 2] = b * shade; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // roads
  const order = ['D', 'B', 'M', 'A'];
  for (const pass of [0, 1]) for (const t of order) for (const r of World.roads) {
    if (r.type !== t) continue;
    x.beginPath();
    for (let k = 0; k < r.n; k += 2) { const px = (r.x[k] + HALF) * sc, pz = (r.z[k] + HALF) * sc; if (!k) x.moveTo(px, pz); else x.lineTo(px, pz); }
    x.lineTo((r.x[r.n - 1] + HALF) * sc, (r.z[r.n - 1] + HALF) * sc);
    x.lineCap = 'round'; x.lineJoin = 'round';
    if (pass === 0) { x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = (r.hw * 2 + 3) * sc + 2; }
    else { x.strokeStyle = t === 'D' ? '#c9a878' : t === 'A' ? '#f2f2f2' : '#dcdcdc'; x.lineWidth = Math.max(1.6, r.hw * 2 * sc); if (t === 'D') x.setLineDash([4, 3]); }
    x.stroke(); x.setLineDash([]);
  }
  // plaza + villages
  x.fillStyle = '#ff3d7f'; x.beginPath(); x.arc((PLAZA.x + HALF) * sc, (PLAZA.z + HALF) * sc, PLAZA.r * sc, 0, TAU); x.fill();
  for (const p of PLACES) if (p.kind === 'village') { x.fillStyle = 'rgba(80,60,50,0.55)'; x.beginPath(); x.arc((p.x + HALF) * sc, (p.z + HALF) * sc, p.r * 0.55 * sc, 0, TAU); x.fill(); }
  Hud.map = c; Hud.mapScale = sc;
}

function initHud() {
  Hud.tach = $('tach'); Hud.tctx = Hud.tach.getContext('2d');
  Hud.mm = $('minimap'); Hud.mctx = Hud.mm.getContext('2d');
}

function drawTach(rpm, red, kmh, gear) {
  const c = Hud.tach, x = Hud.tctx, W = c.width, H = c.height;
  x.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 + 8, R = W * 0.42;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const maxR = Math.ceil(red / 1000 + 0.5);
  // track
  x.lineWidth = 10; x.lineCap = 'butt';
  x.strokeStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.arc(cx, cy, R, a0, a1); x.stroke();
  const redA = a0 + (a1 - a0) * (red * 0.92 / 1000) / maxR;
  x.strokeStyle = 'rgba(255,61,90,0.35)'; x.beginPath(); x.arc(cx, cy, R, redA, a1); x.stroke();
  // value
  const f = clamp(rpm / 1000 / maxR, 0, 1);
  const g = x.createLinearGradient(0, H, W, 0);
  g.addColorStop(0, '#ffb02e'); g.addColorStop(1, '#ff3d7f');
  x.strokeStyle = rpm > red * 0.92 ? '#ff3d5a' : g;
  x.beginPath(); x.arc(cx, cy, R, a0, a0 + (a1 - a0) * f); x.stroke();
  // ticks
  x.fillStyle = 'rgba(255,255,255,0.75)'; x.font = '600 13px Saira, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i <= maxR; i++) {
    const a = a0 + (a1 - a0) * i / maxR;
    x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)); x.lineTo(cx + Math.cos(a) * (R - 20), cy + Math.sin(a) * (R - 20)); x.stroke();
    x.fillText(String(i), cx + Math.cos(a) * (R - 31), cy + Math.sin(a) * (R - 31));
  }
  // needle
  const na = a0 + (a1 - a0) * f;
  x.strokeStyle = '#fff'; x.lineWidth = 3; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx + Math.cos(na) * (R - 40), cy + Math.sin(na) * (R - 40)); x.lineTo(cx + Math.cos(na) * (R + 4), cy + Math.sin(na) * (R + 4)); x.stroke();
  if (kmh !== Hud.lastSpeed) { $('spd').textContent = kmh; Hud.lastSpeed = kmh; }
  if (gear !== Hud.lastGear) { $('gear').textContent = gear; Hud.lastGear = gear; }
}

function drawMinimap(car, extra) {
  const c = Hud.mm, x = Hud.mctx, W = c.width, H = c.height, R = W / 2 - 4;
  x.clearRect(0, 0, W, H);
  x.save();
  x.beginPath(); x.arc(W / 2, H / 2, R, 0, TAU); x.clip();
  x.fillStyle = '#1d2a1b'; x.fillRect(0, 0, W, H);
  const zoom = (W / 2) / (150 + Math.min(150, car.speed * 2.2)); // px per metre on the minimap
  const k = zoom / Hud.mapScale;
  x.translate(W / 2, H / 2 + R * 0.25);
  x.rotate(car.h - Math.PI);
  x.scale(k, k);
  const px = (car.x + HALF) * Hud.mapScale, pz = (car.z + HALF) * Hud.mapScale;
  x.globalAlpha = 0.92;
  x.drawImage(Hud.map, -px, -pz);
  x.globalAlpha = 1;
  const M = (wx) => (wx + HALF) * Hud.mapScale;
  // race route
  if (extra.route) {
    const r = extra.route;
    x.strokeStyle = '#ff3d7f'; x.lineWidth = 4 / k * 1.2; x.lineJoin = 'round';
    x.beginPath();
    for (let i = 0; i < r.N; i += 2) { const p = r.pts[i]; if (!i) x.moveTo(M(p[0]) - px, M(p[1]) - pz); else x.lineTo(M(p[0]) - px, M(p[1]) - pz); }
    if (r.closed) x.closePath();
    x.stroke();
  }
  if (extra.cp) { x.fillStyle = '#fff'; x.strokeStyle = '#ff3d7f'; x.lineWidth = 3 / k; x.beginPath(); x.arc(M(extra.cp.x) - px, M(extra.cp.z) - pz, 7 / k, 0, TAU); x.fill(); x.stroke(); }
  // events
  if (extra.markers) for (const m of extra.markers) {
    x.fillStyle = TYPE_COLOR[m.type]; x.strokeStyle = '#111'; x.lineWidth = 2 / k;
    x.beginPath(); x.arc(M(m.x) - px, M(m.z) - pz, 5.5 / k, 0, TAU); x.fill(); x.stroke();
  }
  for (const o of extra.cars || []) { x.fillStyle = '#ffd23a'; x.strokeStyle = '#111'; x.lineWidth = 2 / k; x.beginPath(); x.arc(M(o.x) - px, M(o.z) - pz, 4.5 / k, 0, TAU); x.fill(); x.stroke(); }
  x.restore();
  // player arrow
  x.save();
  x.translate(W / 2, H / 2 + R * 0.25);
  x.fillStyle = '#fff'; x.strokeStyle = '#ff3d7f'; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(0, -10); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.fill(); x.stroke();
  x.restore();
  // ring + north marker
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2; x.beginPath(); x.arc(W / 2, H / 2, R, 0, TAU); x.stroke();
  const ang = car.h - Math.PI; // rotation applied to the map
  const north = { x: Math.sin(ang) * (R - 10), y: -Math.cos(ang) * (R - 10) };
  x.fillStyle = '#ff3d7f'; x.beginPath(); x.arc(W / 2 + north.x, H / 2 + north.y, 9, 0, TAU); x.fill();
  x.fillStyle = '#fff'; x.font = '700 11px Saira, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', W / 2 + north.x, H / 2 + north.y + 0.5);
}

function hudUpdate(dt, car) {
  const kmh = Math.round(car.speed * 3.6);
  const gear = car.reverse ? 'R' : car.speed < 0.5 && car.input.throttle < 0.05 ? 'N' : String(car.gear + 1);
  drawTach(car.rpm, car.spec.eng.red, kmh, gear);
  const extra = { cars: [], markers: Game.mode === 'race' ? null : Events.markers };
  if (Game.mode === 'race' && Race.ev) {
    extra.route = Race.route;
    extra.cars = Race.ai.map((d) => d.v);
    const pr = Game.player.race;
    if (pr && !pr.done) extra.cp = Race.cps[pr.cp];
  }
  drawMinimap(car, extra);
  // location
  Hud.locT -= dt;
  if (Hud.locT <= 0) {
    Hud.locT = 0.5;
    const p = placeName(car.x, car.z);
    const rq = roadAt(car.x, car.z);
    const road = rq && rq.d < 6 ? rq.road.name : '';
    const txt = [road, p ? p.name : road ? '' : 'Wendmoor countryside'].filter(Boolean).join(' · ');
    if (txt !== Hud.loc) { Hud.loc = txt; $('loc').textContent = txt; }
  }
  // drift chain
  const dc = $('drift');
  if (Skill.chain && Skill.pts > 20) {
    dc.classList.add('on');
    $('driftPts').textContent = Math.round(Skill.pts * Skill.mult).toLocaleString('en-GB');
    $('driftMul').textContent = Skill.mult > 1 ? 'x' + Skill.mult : '';
  } else dc.classList.remove('on');
  // race panel
  if (Game.mode === 'race' && Race.ev) {
    const pos = racePositions().indexOf(Game.player) + 1;
    const pr = Game.player.race;
    $('rPos').innerHTML = `${pos}<small>/${Race.cars.length}</small>`;
    $('rLap').textContent = Race.route.closed && Race.laps > 1 ? `Lap ${Math.min(Race.laps, pr.lap + 1)}/${Race.laps}` : `${TYPE_LABEL[Race.ev.type]}`;
    $('rTime').textContent = fmtTime(Race.phase === 'countdown' ? 0 : pr.done ? pr.time : Race.t);
    $('rCp').textContent = `Checkpoint ${Math.min(Race.ncp, pr.cp + 1 + pr.lap * Race.ncp)}/${Race.ncp * (Race.route.closed ? Race.laps : 1)}`;
    // wrong way
    const ri = nearestRouteIdx(Race.route, car.x, car.z, Race.pIdx ?? 0, 10, 30);
    Race.pIdx = ri.i;
    const dir = Race.route.dirs[ri.i];
    const wrong = car.speed > 5 && Math.cos(wrapAngle(Math.atan2(car.vx, car.vz) - dir)) < -0.3;
    Race.wrongT = wrong ? (Race.wrongT || 0) + dt : 0;
    $('wrong').classList.toggle('on', Race.wrongT > 1.2);
  }
  // fps
  if (Game.settings.showFps) {
    Hud.frames++; Hud.fpsT += dt;
    if (Hud.fpsT > 0.5) { $('fps').textContent = Math.round(Hud.frames / Hud.fpsT) + ' fps · ' + (Game.dprNow || 1).toFixed(2) + 'x'; Hud.frames = 0; Hud.fpsT = 0; }
  }
}
function hudRace(on) {
  $('racePanel').classList.toggle('on', on);
  if (!on) $('wrong').classList.remove('on');
}

/* ---------- notifications ---------- */
function notify(title, sub = '', kind = 'info', ms = 2800) {
  const box = $('notes');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'note ' + kind;
  el.innerHTML = `<b></b><span></span>`;
  el.querySelector('b').textContent = title;
  el.querySelector('span').textContent = sub;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
}
function bigCount(t) {
  const el = $('count');
  el.textContent = t;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function showPrompt(m) {
  const el = $('prompt');
  if (!m) { el.classList.remove('on'); Hud.near = null; return; }
  if (Hud.near === m) return;
  Hud.near = m;
  if (m.garage) {
    el.innerHTML = `<div class="ptype" style="--c:#fff">Festival</div><h3>Garage</h3><p>Change car, inspect stats and pick a paint colour.</p><div class="pkey"><kbd>E</kbd> Enter garage</div>`;
  } else {
    const ev = m.ev;
    const best = Save.data.best[(ev.route ? 'ev_' : 'st_') + ev.id];
    const meta = ev.route
      ? `${(ev.length / 1000).toFixed(1)} km · ${ev.laps > 1 ? ev.laps + ' laps · ' : ''}${ev.ai} rivals · ${ev.reward.toLocaleString('en-GB')} CR${best ? ' · Best ' + fmtTime(best) : ''}`
      : `Stars at ${ev.stars.map((s) => s.toLocaleString('en-GB')).join(' / ')}${ev.type === 'drift' ? ' pts' : ' km/h'}${best ? ' · Best ' + best.toLocaleString('en-GB') : ''}`;
    el.innerHTML = `<div class="ptype" style="--c:${TYPE_COLOR[ev.type]}">${TYPE_LABEL[ev.type]}</div><h3></h3><p></p><div class="pmeta"></div>${ev.route ? '<div class="pkey"><kbd>E</kbd> Start event</div>' : '<div class="pkey">Drive through the gate to start</div>'}`;
    el.querySelector('h3').textContent = ev.name;
    el.querySelector('p').textContent = ev.desc;
    el.querySelector('.pmeta').textContent = meta;
  }
  el.classList.add('on');
}
