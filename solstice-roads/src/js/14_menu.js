/* =====================================================================
   Menus: main menu (cinematic background), garage, events & map,
   settings, pause, results, help. All buttons are real <button>s, so
   keyboard (Tab/Enter) and touch work as well as the mouse.
   ===================================================================== */
const Menu = { screen: null, stack: [], garageSel: 0, garagePaint: null, preview: null, mapSel: null, orbit: 0, tab: 'graphics' };

function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('on', el.id === id);
  Menu.screen = id;
  document.body.classList.toggle('in-menu', !!id);
  const first = id && $(id).querySelector('button:not([disabled])');
  if (first && !('ontouchstart' in window)) first.focus({ preventScroll: true });
}
function bindButtons(root) {
  root.querySelectorAll('button').forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('mouseenter', () => SFX.hover());
    b.addEventListener('click', () => (b.classList.contains('back') ? SFX.back() : SFX.click()));
  });
}

/* ---------- main menu ---------- */
function openMain() {
  Game.mode = 'menu';
  $('mmPlay').textContent = Game.started ? 'Resume' : 'Play';
  $('mmSub').textContent = Game.started ? 'Free roam paused' : 'Open-world countryside festival';
  updateProfile();
  showScreen('mainMenu');
  Menu.orbit = 0;
}
function updateProfile() {
  const lvl = 1 + Math.floor(Math.sqrt(Save.data.xp / 120));
  for (const el of document.querySelectorAll('.credits')) el.textContent = Save.data.credits.toLocaleString('en-GB') + ' CR';
  for (const el of document.querySelectorAll('.level')) el.textContent = 'Level ' + lvl;
  const c = CARS[Game.carIdx];
  $('mmCar').textContent = c.name;
}
function initMenus() {
  $('mmPlay').onclick = () => { if (!Game.started) startFreeRoam(); else resumeGame(); };
  $('mmEvents').onclick = () => openEvents();
  $('mmGarage').onclick = () => openGarage();
  $('mmSettings').onclick = () => openSettings();
  $('mmHelp').onclick = () => { showScreen('help'); };
  $('helpBack').onclick = () => back();
  $('radioBtn').onclick = () => { audioStart(); musicToggle(); updateRadioBtn(); };
  // pause
  $('pResume').onclick = () => resumeGame();
  $('pRestart').onclick = () => { const ev = Race.ev; raceEnd(false); fadeTo(() => raceSetup(ev)); resumeGame(true); };
  $('pLeave').onclick = () => { raceEnd(true); resumeGame(); };
  $('pEvents').onclick = () => openEvents();
  $('pGarage').onclick = () => openGarage();
  $('pSettings').onclick = () => openSettings();
  $('pReset').onclick = () => { resetToRoad(Game.player); camReset(Game.player); resumeGame(); };
  $('pMain').onclick = () => { if (Game.mode === 'race' || Race.ev) raceEnd(true); openMain(); };
  // results
  $('resContinue').onclick = () => { raceEnd(false); closeOverlay(); };
  $('resRestart').onclick = () => { const ev = Race.ev; raceEnd(false); closeOverlay(); fadeTo(() => raceSetup(ev)); };
  // garage
  $('gDrive').onclick = () => garageConfirm();
  $('gBack').onclick = () => { clearPreview(); back(); };
  // events
  $('evBack').onclick = () => back();
  // settings
  $('setBack').onclick = () => { Game.applySettings(); Save.data.settings = Game.settings; Save.write(); back(); };
  for (const t of document.querySelectorAll('.tabs button')) t.onclick = () => { Menu.tab = t.dataset.tab; renderSettings(); };
  bindButtons(document);
}
function back() {
  const prev = Menu.stack.pop();
  if (prev) prev(); else openMain();
}
function updateRadioBtn() { $('radioBtn').classList.toggle('off', !Audio.musicOn); $('radioTitle').textContent = Audio.musicOn ? TRACKS[0].title : 'Radio off'; }

/* ---------- pause ---------- */
function openPause() {
  Game.paused = true;
  const inRace = !!Race.ev;
  $('pRestart').hidden = !inRace; $('pLeave').hidden = !inRace;
  $('pGarage').hidden = inRace; $('pEvents').hidden = inRace;
  bindButtons($('pause'));
  $('pTitle').textContent = inRace ? Race.ev.name : 'Paused';
  Menu.stack = [];
  showScreen('pause');
}
function resumeGame(keepFade) {
  Game.paused = false;
  Game.mode = Race.ev ? 'race' : 'drive';
  showScreen(null);
  Menu.stack = [];
  audioStart();
  musicPlay();
  void keepFade;
}
function closeOverlay() { showScreen(null); Game.paused = false; Game.mode = Race.ev ? 'race' : 'drive'; }
function fadeTo(fn) {
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 120); }, 380);
}

/* ---------- garage ---------- */
function openGarage() {
  const from = Menu.screen;
  Menu.stack.push(from === 'pause' ? openPause : from === 'mainMenu' ? openMain : () => resumeGame());
  Game.mode = 'garage';
  Menu.garageSel = Game.carIdx;
  Menu.garagePaint = Game.paint;
  renderGarage();
  showScreen('garage');
}
function renderGarage() {
  const list = $('gList');
  list.innerHTML = '';
  CARS.forEach((c, i) => {
    const pi = carPI(c);
    const b = document.createElement('button');
    b.className = 'gcar' + (i === Menu.garageSel ? ' sel' : '');
    const own = ownsCar(c);
    b.innerHTML = `<span class="cls c-${pi.cls}">${pi.cls}<i>${pi.v}</i></span><span class="gname"><b></b><small></small></span>${own ? '' : '<span class="price"></span>'}`;
    b.querySelector('b').textContent = c.name;
    b.querySelector('small').textContent = `${c.year} · ${c.drive} · ${c.power} kW`;
    if (!own) b.querySelector('.price').textContent = c.price.toLocaleString('en-GB') + ' CR';
    b.onclick = () => { Menu.garageSel = i; Menu.garagePaint = Save.data.paint[c.id] ?? c.col; renderGarage(); };
    list.appendChild(b);
  });
  bindButtons(list);
  const c = CARS[Menu.garageSel];
  const pi = carPI(c);
  $('gName').textContent = c.name;
  $('gMaker').textContent = `${c.maker} · ${c.year}`;
  $('gDesc').textContent = c.desc;
  $('gClass').className = 'cls big c-' + pi.cls;
  $('gClass').innerHTML = `${pi.cls}<i>${pi.v}</i>`;
  const st = carStats(c);
  $('gStats').innerHTML = Object.entries(st).map(([k, v]) => `<div class="stat"><span>${k}</span><div class="bar"><i style="width:${v * 10}%"></i></div><b>${v.toFixed(1)}</b></div>`).join('');
  $('gSpecs').innerHTML = [['Power', `${c.power} kW (${Math.round(c.power * 1.341)} hp)`], ['Weight', `${c.mass.toLocaleString('en-GB')} kg`], ['Drivetrain', c.drive], ['Top speed', `${c.vmax} km/h`], ['Engine', `${c.eng.cyl} cyl · ${c.eng.red} rpm`]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  const sw = $('gPaint');
  sw.innerHTML = '';
  const cur = Menu.garagePaint ?? (Save.data.paint[c.id] ?? c.col);
  for (const p of [c.col, ...PAINTS.filter((q) => q !== c.col)]) {
    const b = document.createElement('button');
    b.className = 'swatch' + (p === cur ? ' sel' : '');
    b.style.background = '#' + p.toString(16).padStart(6, '0');
    b.setAttribute('aria-label', 'Paint #' + p.toString(16).padStart(6, '0'));
    b.onclick = () => { Menu.garagePaint = p; renderGarage(); };
    sw.appendChild(b);
  }
  bindButtons(sw);
  const own = ownsCar(c);
  $('gDrive').disabled = !own && Save.data.credits < c.price;
  $('gDrive').textContent = !own ? (Save.data.credits >= c.price ? `Buy · ${c.price.toLocaleString('en-GB')} CR` : `Need ${(c.price - Save.data.credits).toLocaleString('en-GB')} more CR`) : Menu.garageSel === Game.carIdx && cur === Game.paint ? 'Drive' : 'Select & drive';
  $('gWallet').textContent = Save.data.credits.toLocaleString('en-GB') + ' CR';
  setPreview(Menu.garageSel, cur);
}
function setPreview(idx, paint) {
  const key = idx + ':' + paint;
  if (Menu.preview && Menu.preview.key === key) return;
  if (Menu.preview) { Game.scene.remove(Menu.preview.model.root); Menu.preview.model.dispose(); }
  const model = makeCar(CARS[idx], paint);
  const spot = Festival.previewSpot;
  model.root.position.set(spot.x, spot.y, spot.z);
  Game.scene.add(model.root);
  Menu.preview = { key, model, a: Menu.preview ? Menu.preview.a : 0.6 };
}
function clearPreview() {
  if (Menu.preview) { Game.scene.remove(Menu.preview.model.root); Menu.preview.model.dispose(); Menu.preview = null; }
}
function ownsCar(c) {
  if (!Save.data.owned) Save.data.owned = CARS.filter((k) => !k.price).map((k) => k.id).concat(CARS[Save.data.car | 0].id);
  return Save.data.owned.includes(c.id);
}
function garageConfirm() {
  const c = CARS[Menu.garageSel];
  if (!ownsCar(c)) {
    if (Save.data.credits < c.price) return;
    Save.data.credits -= c.price;
    Save.data.owned.push(c.id);
    Save.write();
    SFX.finish();
    notify('New car!', `${c.name} is now in your garage`, 'skill', 3500);
    updateProfile();
    renderGarage();
    return;
  }
  Save.data.paint[c.id] = Menu.garagePaint;
  Save.data.car = Menu.garageSel;
  Save.write();
  Game.setPlayerCar(Menu.garageSel, Menu.garagePaint);
  clearPreview();
  if (!Game.started) startFreeRoam();
  else {
    // drive out of the garage
    const s = Festival.garageSpot;
    Game.player.reset(s.x, s.z, Math.atan2(PLAZA.x - s.x, PLAZA.z - s.z));
    camReset(Game.player);
    resumeGame();
  }
}

/* ---------- events & map ---------- */
function openEvents() {
  const from = Menu.screen;
  Menu.stack.push(from === 'pause' ? openPause : openMain);
  renderEvents();
  showScreen('events');
}
function renderEvents() {
  const list = $('evList');
  list.innerHTML = '';
  const add = (label, sub, color, onSel, sel) => {
    const b = document.createElement('button');
    b.className = 'evitem' + (sel ? ' sel' : '');
    b.style.setProperty('--c', color);
    b.innerHTML = '<i></i><span><b></b><small></small></span>';
    b.querySelector('b').textContent = label;
    b.querySelector('small').textContent = sub;
    b.onclick = onSel;
    list.appendChild(b);
  };
  const head = (t) => { const h = document.createElement('h4'); h.textContent = t; list.appendChild(h); };
  head('Events');
  for (const ev of EVENTS.filter((e) => e.route)) {
    const best = Save.data.best['ev_' + ev.id];
    add(ev.name, `${TYPE_LABEL[ev.type]} · ${(ev.length / 1000).toFixed(1)} km${best ? ' · Best ' + fmtTime(best) : ''}`, TYPE_COLOR[ev.type], () => { Menu.mapSel = ev; renderEvents(); }, Menu.mapSel === ev);
  }
  head('PR Stunts');
  for (const ev of EVENTS.filter((e) => !e.route)) {
    const best = Save.data.best['st_' + ev.id];
    const stars = best ? ev.stars.filter((s) => best >= s).length : 0;
    add(ev.name, `${TYPE_LABEL[ev.type]} · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, TYPE_COLOR[ev.type], () => { Menu.mapSel = ev; renderEvents(); }, Menu.mapSel === ev);
  }
  head('Fast travel');
  for (const ft of FAST_TRAVEL) add(ft.name, 'Travel here', '#ffffff', () => { Menu.mapSel = ft; renderEvents(); }, Menu.mapSel === ft);
  bindButtons(list);
  // details
  const d = $('evDetail');
  const s = Menu.mapSel;
  if (!s) d.innerHTML = '<p class="muted">Select an event or a location. Events are also marked in the world with light columns — drive up to one and press <kbd>E</kbd>.</p>';
  else if (s.type) {
    d.innerHTML = `<div class="ptype" style="--c:${TYPE_COLOR[s.type]}">${TYPE_LABEL[s.type]}</div><h3></h3><p></p><div class="pmeta"></div><button class="primary" id="evGo"></button>`;
    d.querySelector('h3').textContent = s.name;
    d.querySelector('p').textContent = s.desc;
    d.querySelector('.pmeta').textContent = s.route ? `${(s.length / 1000).toFixed(1)} km · ${s.laps > 1 ? s.laps + ' laps · ' : ''}${s.ai} rivals · Reward ${s.reward.toLocaleString('en-GB')} CR` : `Stars: ${s.stars.join(' / ')}${s.type === 'drift' ? ' points' : ' km/h'}`;
    $('evGo').textContent = s.route ? 'Travel & start' : 'Travel to start gate';
    $('evGo').onclick = () => {
      Menu.stack = [];
      if (s.route) { if (Race.ev) raceEnd(false); if (!Game.started) startFreeRoam(true); fadeTo(() => raceSetup(s)); resumeGame(); }
      else { const g = s.gates[0]; const bx = g.x - Math.sin(g.h) * 120, bz = g.z - Math.cos(g.h) * 120; travelTo(bx, bz, g.h); }
    };
  } else {
    d.innerHTML = `<div class="ptype" style="--c:#fff">Location</div><h3></h3><p class="muted">Fast travel and continue in free roam.</p><button class="primary" id="evGo">Travel here</button>`;
    d.querySelector('h3').textContent = s.name;
    $('evGo').onclick = () => { Menu.stack = []; travelTo(s.x, s.z, s.h); };
  }
  bindButtons(d);
  drawBigMap();
}
function travelTo(x, z, h) {
  if (Race.ev) raceEnd(false);
  if (!Game.started) startFreeRoam(true);
  fadeTo(() => {
    const k = nearestRoadSample(x, z);
    const road = World.roads[World.SROAD[k]], i = k - road.i0;
    let hh = Math.atan2(road.tx[i], road.tz[i]);
    if (Math.cos(wrapAngle(hh - h)) < 0) hh += Math.PI;
    Game.player.reset(road.x[i], road.z[i], hh);
    camReset(Game.player);
  });
  resumeGame();
}
function drawBigMap() {
  const c = $('bigMap'), x = c.getContext('2d');
  const S = c.width;
  x.clearRect(0, 0, S, S);
  x.drawImage(Hud.map, 0, 0, S, S);
  const M = (v) => (v + HALF) / WORLD * S;
  x.font = '600 12px Saira, sans-serif'; x.textAlign = 'center';
  for (const p of PLACES) {
    if (p.kind === 'river') continue;
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillText(p.name, M(p.x) + 1, M(p.z) + 1);
    x.fillStyle = '#fff'; x.fillText(p.name, M(p.x), M(p.z));
  }
  if (Menu.mapSel && Menu.mapSel.route) {
    const r = Events.routes[Menu.mapSel.id];
    x.strokeStyle = TYPE_COLOR[Menu.mapSel.type]; x.lineWidth = 4; x.beginPath();
    r.pts.forEach((p, i) => (i ? x.lineTo(M(p[0]), M(p[1])) : x.moveTo(M(p[0]), M(p[1]))));
    if (r.closed) x.closePath();
    x.stroke();
  }
  for (const m of Events.markers) {
    const sel = Menu.mapSel && (Menu.mapSel === m.ev);
    x.fillStyle = TYPE_COLOR[m.type]; x.strokeStyle = sel ? '#fff' : '#111'; x.lineWidth = sel ? 3 : 2;
    x.beginPath(); x.arc(M(m.x), M(m.z), sel ? 9 : 6, 0, TAU); x.fill(); x.stroke();
  }
  if (Menu.mapSel && !Menu.mapSel.type && Menu.mapSel.x !== undefined) { x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.arc(M(Menu.mapSel.x), M(Menu.mapSel.z), 10, 0, TAU); x.stroke(); }
  if (Game.started) {
    const p = Game.player;
    x.save(); x.translate(M(p.x), M(p.z)); x.rotate(-p.h + Math.PI);
    x.fillStyle = '#fff'; x.strokeStyle = '#ff3d7f'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(-6, 7); x.closePath(); x.fill(); x.stroke();
    x.restore();
  }
}
function mapClick(e) {
  const c = $('bigMap'), r = c.getBoundingClientRect();
  const wx = (e.clientX - r.left) / r.width * WORLD - HALF, wz = (e.clientY - r.top) / r.height * WORLD - HALF;
  let best = null, bd = 60;
  for (const m of Events.markers) { const d = Math.hypot(m.x - wx, m.z - wz); if (d < bd && m.ev) { bd = d; best = m.ev; } }
  if (best) { Menu.mapSel = best; SFX.click(); renderEvents(); }
  else { Menu.mapSel = { name: placeName(wx, wz)?.name || 'Map location', x: wx, z: wz, h: 0 }; SFX.click(); renderEvents(); }
}

/* ---------- settings ---------- */
function openSettings() {
  const from = Menu.screen;
  Menu.stack.push(from === 'pause' ? openPause : openMain);
  renderSettings();
  showScreen('settings');
}
function renderSettings() {
  const s = Game.settings;
  for (const t of document.querySelectorAll('.tabs button')) t.classList.toggle('sel', t.dataset.tab === Menu.tab);
  const box = $('setBody');
  box.innerHTML = '';
  const row = (label, ctrl) => { const r = document.createElement('div'); r.className = 'srow'; const l = document.createElement('label'); l.textContent = label; r.append(l, ctrl); box.appendChild(r); };
  const choice = (key, opts, after) => {
    const w = document.createElement('div'); w.className = 'seg';
    for (const [v, t] of opts) {
      const b = document.createElement('button'); b.textContent = t; b.className = s[key] === v ? 'sel' : '';
      b.onclick = () => { s[key] = v; if (after) after(v); Game.applySettings(); renderSettings(); };
      w.appendChild(b);
    }
    return w;
  };
  const slider = (key, min, max, step, fmt, after) => {
    const w = document.createElement('div'); w.className = 'slide';
    const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = s[key];
    const o = document.createElement('output'); o.textContent = fmt(s[key]);
    i.oninput = () => { s[key] = +i.value; o.textContent = fmt(s[key]); if (after) after(); };
    i.onchange = () => Game.applySettings();
    w.append(i, o);
    return w;
  };
  const toggle = (key, after) => choice(key, [[true, 'On'], [false, 'Off']], after);
  const pct = (v) => Math.round(v * 100) + '%';
  if (Menu.tab === 'graphics') {
    row('Quality preset', choice('quality', Object.entries(QUALITY).map(([k, q]) => [k, q.name])));
    row('Resolution scale', slider('resScale', 0.5, 1.25, 0.05, pct));
    row('Dynamic resolution', toggle('autoRes'));
    row('Show FPS', toggle('showFps', () => { $('fps').hidden = !s.showFps; }));
    const q = QUALITY[s.quality];
    const info = document.createElement('p'); info.className = 'muted';
    info.textContent = `${q.name}: shadows ${q.shadows ? q.shadows + 'px' : 'off'} · post-processing ${q.post ? 'on' : 'off'} · grass ${q.grass ? (q.grass / 1000) + 'k blades' : 'off'} · tree distance ${q.treeFar} m · view ${q.view} m`;
    box.appendChild(info);
  } else if (Menu.tab === 'world') {
    row('Weather', choice('weather', WEATHERS.map((w) => [w.id, w.name]), (v) => setWeather(v)));
    row('Day/night cycle', toggle('dynamicTime'));
    row('Cycle speed', slider('timeSpeed', 0.25, 4, 0.25, (v) => v + '× (' + Math.round(24 / v) + ' min/day)'));
  } else if (Menu.tab === 'audio') {
    row('Master', slider('master', 0, 1, 0.05, pct, applyVolumes));
    row('Music (radio)', slider('music', 0, 1, 0.05, pct, applyVolumes));
    row('Engine', slider('engine', 0, 1, 0.05, pct, applyVolumes));
    row('Effects', slider('sfx', 0, 1, 0.05, pct, applyVolumes));
    row('Ambience', slider('ambient', 0, 1, 0.05, pct, applyVolumes));
    row('Mute all (M)', toggle('muted', applyVolumes));
    row('Radio (N)', (() => { const b = document.createElement('button'); b.className = 'seg1'; b.textContent = Audio.musicOn ? 'Turn radio off' : 'Turn radio on'; b.onclick = () => { audioStart(); musicToggle(); updateRadioBtn(); renderSettings(); }; return b; })());
  } else if (Menu.tab === 'gameplay') {
    row('Steering & drift assist', toggle('assist'));
    row('AI difficulty', choice('difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]));
    row('Camera shake', toggle('shake'));
    row('Camera', choice('camera', CAM_NAMES.map((n, i) => [i, n]), (v) => camSetMode(v, Game.camera)));
    row('Touch controls', choice('touch', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]));
  } else if (Menu.tab === 'online') {
    row('Play online', toggle('online', () => netConnect()));
    const name = document.createElement('input');
    name.type = 'text'; name.id = 'netName'; name.className = 'textin'; name.maxLength = 16; name.value = netName();
    name.onchange = () => { const v = name.value.replace(/[^\p{L}\p{N} _.\-]/gu, '').slice(0, 16).trim(); Save.data.name = v || netName(); name.value = Save.data.name; Save.write(); netSend(); };
    row('Your name', name);
    row('Server', choice('server', [['auto', 'Auto'], [0, '1'], [1, '2'], [2, '3'], [3, '4'], [4, '5']], () => netConnect()));
    const st = document.createElement('p'); st.id = 'netStatus'; st.className = 'muted';
    box.appendChild(st);
    const again = document.createElement('button'); again.className = 'seg1'; again.textContent = 'Reconnect'; again.onclick = () => netConnect();
    row('Connection', again);
    const info = document.createElement('p'); info.className = 'muted';
    info.textContent = 'Auto tries server 1 first and moves on to the next one when a server does not answer. You drive together in free roam; other players appear with their name above their car.';
    box.appendChild(info);
    netSetStatus(Net.status, Net.detail);
  } else {
    const t = document.createElement('div'); t.className = 'keys';
    t.innerHTML = $('help').querySelector('.keys').innerHTML;
    box.appendChild(t);
  }
  bindButtons(box);
}

/* ---------- results ---------- */
function openResults(res) {
  Game.paused = true;
  $('resTitle').textContent = res.pos === 1 ? 'Victory!' : `${ordinal(res.pos)} place`;
  $('resEvent').textContent = res.ev.name;
  $('resTable').innerHTML = res.rows.map((r) => `<tr class="${r.me ? 'me' : ''}"><td>${r.pos}</td><td>${r.me ? '<b>You</b>' : r.name}</td><td>${r.car}</td><td>${fmtTime(r.t)}</td><td>${isFinite(r.best) ? fmtTime(r.best) : '–'}</td></tr>`).join('');
  $('resRewards').innerHTML = `<div><span>Credits</span><b>+${res.credits.toLocaleString('en-GB')} CR</b></div><div><span>XP</span><b>+${res.xp}</b></div>${res.newBest ? '<div class="pb"><b>New personal best</b></div>' : ''}`;
  updateProfile();
  showScreen('results');
}
