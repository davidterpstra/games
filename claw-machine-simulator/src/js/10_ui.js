/* =====================================================================
   10_ui.js — HUD, panel frame, toasts, reveal, confirm  (see ARCHITECTURE.md §6)
   Public: UI. Private top-level names start with _ui.
   ===================================================================== */

/* ---------- private state ---------- */
const _ui = {
  inited: false,
  root: null,
  el: {},
  panels: {},
  panelEl: null,
  panelDef: null,
  mode: 'walk',
  disp: { coins: 0, gems: 0, strength: 0 },
  tgt: { coins: 0, gems: 0, strength: 0 },
  txt: { coins: '', gems: '', strength: '' },
  acc: { poll: 0, sec: 0, goal: 0 },
  cache: {},
  toasts: [],
  revealQ: [],
  reveal: null,
  confirm: null,
  prompt: null,
  refreshTimer: 0, pendingRefresh: false,
  lastRefresh: 0,
  joy: { id: null, cx: 0, cy: 0 },
  dir: { u: false, d: false, l: false, r: false },
};

const _uiEquipIcons = { dumbbell: '🏋️', kettlebell: '🔔', barbell: '🏋️', log: '🪵', iceblock: '🧊', boulder: '🪨', anvil: '⚒️', meteor: '☄️' };
const _uiStationIcons = { machine: '🕹️', training: '💪', upgrades: '⬆️', pets: '🐾', portal: '🌀' };
const _uiNav = [
  { id: 'pets', icon: '🐾', label: 'Pets', key: 'I', cls: 'btn-purple' },
  { id: 'upgrades', icon: '⬆️', label: 'Upgrades', key: 'U', cls: 'btn-green' },
  { id: 'worlds', icon: '🌍', label: 'Worlds', key: 'G', cls: 'btn-blue' },
  { id: 'index', icon: '📖', label: 'Index', key: 'X', cls: 'btn-yellow' },
  { id: 'shop', icon: '💎', label: 'Shop', key: 'B', cls: 'btn-pink' },
];

/* ---------- small helpers ---------- */
function _uiSfx(name) { try { if (typeof Sfx !== 'undefined' && Sfx && Sfx.play) Sfx.play(name); } catch (e) { /* ignore */ } }
function _uiSet(el, key, val, fn) {
  // write to the DOM only when the value changed
  if (_ui.cache[key] === val) return false;
  _ui.cache[key] = val;
  if (el) fn(el, val);
  return true;
}
function _uiText(el, key, val) { return _uiSet(el, key, val, (e, v) => { e.textContent = v; }); }
function _uiMachine() { try { return (typeof Machines !== 'undefined' && Machines && Machines.active) || null; } catch (e) { return null; } }
function _uiStats() { try { return Services.stats() || {}; } catch (e) { return {}; } }
function _uiRarity(animal) { try { return RARITY_BY_ID[animal.rarity] || RARITIES[0]; } catch (e) { return { id: 'common', name: 'Common', color: '#9fb3c8', order: 0 }; } }
function _uiRGB(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _uiRGBA(hex, a) { const c = _uiRGB(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function _uiShade(hex, k) { // k < 0 darker, > 0 lighter
  const c = _uiRGB(hex).map((v) => Math.round(clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function _uiResetVirtual() {
  try { if (typeof Input !== 'undefined' && Input && Input.virtual) { Input.virtual.x = 0; Input.virtual.y = 0; } } catch (e) { /* ignore */ }
}
function _uiPlayCost() {
  try { const w = WORLD_BY_ID[Game.player.worlds.current]; return (w && w.playCost) || 0; } catch (e) { return 0; }
}

/* =====================================================================
   UI
   ===================================================================== */
const UI = {
  currentPanel: null,

  init() {
    if (_ui.inited) return;
    _ui.inited = true;
    const root = $('#ui');
    if (!root) return;
    _ui.root = root;
    if (Game.isTouch) root.classList.add('touch');
    root.classList.add('mode-' + (Game.mode || 'walk'));
    _ui.mode = Game.mode || 'walk';
    _uiBuildHud(root);
    _uiBindInput(root);
    _uiBindBus();
    _uiSyncAll();
    // a hybrid device that gets touched switches to touch controls
    window.addEventListener('touchstart', () => { if (!root.classList.contains('touch')) { root.classList.add('touch'); _uiRenderPrompt(); } }, { passive: true, once: true });
  },

  isBlocking() { return !!(UI.currentPanel || _ui.reveal || _ui.confirm); },

  registerPanel(id, def) { if (id && def) _ui.panels[id] = def; },

  openPanel(id) {
    const def = _ui.panels[id];
    if (!def || !_ui.root) return;
    if (UI.currentPanel) _uiClosePanelNow(true);
    _uiResetHeld();
    const back = h('div', 'panel-backdrop');
    const win = h('div', 'panel-win' + (def.wide ? ' wide' : ''));
    win.setAttribute('role', 'dialog');
    const head = h('div', 'panel-head');
    head.appendChild(h('span', 'ph-icon ph-ico', esc(def.icon || '')));
    head.appendChild(h('h2', 'ph-title', esc(def.title || id)));
    const close = h('button', 'btn btn-red ph-close', '✕');
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => UI.closePanel());
    head.appendChild(close);
    const body = h('div', 'panel-body');
    body.addEventListener('focusout', () => { if (_ui.pendingRefresh) { _ui.pendingRefresh = false; setTimeout(_uiRefreshSoon, 0); } });
    win.appendChild(head); win.appendChild(body); back.appendChild(win);
    back.addEventListener('pointerdown', (e) => { back._down = e.target === back; });
    back.addEventListener('click', (e) => { if (e.target === back && back._down) UI.closePanel(); });
    _ui.root.appendChild(back);
    _ui.panelEl = back; _ui.panelBody = body; _ui.panelDef = def;
    UI.currentPanel = id;
    _uiRenderPanel(false);
    try { if (def.onOpen) def.onOpen(body); } catch (e) { console.error('[UI] onOpen', id, e); }
    _uiSfx('open');
  },

  closePanel() {
    if (!UI.currentPanel) return;
    _uiClosePanelNow(false);
  },

  refreshPanel() { if (UI.currentPanel) _uiRenderPanel(true); },

  toast(text, kind = 'info') {
    if (!text || !_ui.root) return;
    const box = _ui.el.toasts;
    if (!box) return;
    const t = h('div', 'toast toast-' + (kind || 'info'));
    t.textContent = String(text);
    box.appendChild(t);
    _ui.toasts.push(t);
    while (_ui.toasts.length > 4) { const o = _ui.toasts.shift(); if (o.parentNode) o.parentNode.removeChild(o); }
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); const i = _ui.toasts.indexOf(t); if (i >= 0) _ui.toasts.splice(i, 1); }, 260);
    }, 2600);
  },

  showReveal(pet, isNew, animal) {
    if (!pet) return;
    _ui.revealQ.push({ pet, isNew: !!isNew, animal: animal || null });
    if (!_ui.reveal) _uiRevealNext();
  },

  confirm(text, onYes) {
    if (!_ui.root) return;
    _uiCloseConfirm();
    const back = h('div', 'confirm-backdrop');
    const win = h('div', 'confirm-win');
    const p = h('div', 'confirm-text'); p.textContent = String(text || 'Are you sure?');
    const row = h('div', 'confirm-btns');
    const yes = h('button', 'btn btn-green', 'Yes');
    const no = h('button', 'btn btn-red', 'No');
    yes.addEventListener('click', () => { _uiCloseConfirm(); try { if (onYes) onYes(); } catch (e) { console.error('[UI] confirm', e); } });
    no.addEventListener('click', () => _uiCloseConfirm());
    back.addEventListener('click', (e) => { if (e.target === back) _uiCloseConfirm(); });
    row.appendChild(yes); row.appendChild(no); win.appendChild(p); win.appendChild(row); back.appendChild(win);
    _ui.root.appendChild(back);
    _ui.confirm = back;
    _uiSfx('open');
  },

  update(dt) {
    if (!_ui.inited || !_ui.root) return;
    dt = dt > 0 ? Math.min(dt, 0.25) : 0.016;
    // currency count-up
    for (const k of ['coins', 'gems', 'strength']) {
      let d = _ui.disp[k]; const t = _ui.tgt[k];
      if (d !== t) {
        d = damp(d, t, 8, dt);
        if (Math.abs(t - d) < Math.max(0.05, Math.abs(t) * 0.0005)) d = t;
        _ui.disp[k] = d;
      }
      const s = fmt(d);
      if (s !== _ui.txt[k]) { _ui.txt[k] = s; const e = _ui.el[k]; if (e) e.textContent = s; }
    }
    _ui.acc.poll += dt; _ui.acc.sec += dt; _ui.acc.goal += dt;
    if (_ui.acc.poll >= 0.1) {
      _ui.acc.poll = 0;
      if (_ui.mode === 'machine') _uiPollMachine();
      else if (_ui.mode === 'train') _uiPollTrain();
    }
    if (_ui.acc.goal >= 0.5) { _ui.acc.goal = 0; if (_ui.mode === 'walk') _uiUpdateGoal(); }
    if (_ui.acc.sec >= 1) { _ui.acc.sec = 0; _uiUpdateBoosts(); _uiUpdateBadge(); }
  },
};

/* =====================================================================
   HUD construction
   ===================================================================== */
function _uiBuildHud(root) {
  const navHtml = _uiNav.map((n) =>
    `<button class="btn nav-btn ${n.cls}" data-open="${n.id}" data-nav="${n.id}" aria-label="${n.label}">` +
    `<kbd class="no-touch">${n.key}</kbd><span class="nb-ico">${n.icon}</span><span class="nb-lbl">${n.label}</span>` +
    (n.id === 'shop' ? '<span class="nav-badge" id="nav-shop-badge" hidden>!</span>' : '') + '</button>').join('');
  root.innerHTML = `
    <div class="hud hud-cur" id="hud-cur">
      <div class="cur cur-coins"><span class="cur-ico">🪙</span><span class="cur-val" id="hud-coins">0</span></div>
      <div class="cur cur-gems"><span class="cur-ico">💎</span><span class="cur-val" id="hud-gems">0</span><button class="cur-plus" data-open="shop" aria-label="Get gems">+</button></div>
      <div class="cur cur-str"><span class="cur-ico">💪</span><span class="cur-val" id="hud-strength">0</span></div>
    </div>
    <div class="hud hud-tr">
      <div class="tr-row"><div class="world-badge" id="hud-world"><span id="hud-world-name"></span></div>
        <button class="btn btn-gray btn-icon" data-open="settings" aria-label="Settings">⚙️</button></div>
      <div class="boosts" id="hud-boosts"></div>
    </div>
    <div class="hud hud-goal only-walk" id="hud-goal"><div class="goal-box"><div class="goal-text" id="goal-text">&nbsp;</div><div class="bar gold"><i id="goal-fill"></i></div></div></div>
    <div class="hud hud-nav only-walk" id="hud-nav">${navHtml}</div>
    <div class="hud hud-pets only-walk" id="hud-pets" data-open="pets"><div class="pets-slots" id="pets-slots"></div><div class="pets-mult" id="pets-mult">🐾 ×1</div></div>
    <div class="hud hud-prompt only-walk no-touch" id="hud-prompt" hidden><div class="pp" id="prompt-pp"></div></div>
    <div class="hud hud-action only-walk only-touch" id="hud-action" hidden><button class="round-btn blue" id="action-btn"><span class="rb-ico" id="action-ico"></span><span class="rb-txt" id="action-txt"></span><span class="rb-sub" id="action-sub"></span></button></div>
    <div class="hud hud-joy only-walk only-touch" id="joy"><div class="joy-base"></div><div class="joy-knob" id="joy-knob"></div><div class="joy-zone" id="joy-zone"></div></div>

    <div class="hud hud-back only-machine" id="m-back"><button class="btn btn-red" id="m-back-btn">⬅ Back</button></div>
    <div class="hud hud-timer only-machine" id="m-timer" hidden><div class="timer-pill" id="m-timer-pill"><div class="tp-num" id="m-timer-num">20</div><div class="tp-lbl">SECONDS</div></div></div>
    <div class="hud hud-hover only-machine" id="m-hover" hidden>
      <div class="hv-name" id="hv-name"></div>
      <div class="hv-row"><span class="tag" id="hv-rar"></span><span class="tag" id="hv-var" hidden></span><span class="hv-mult" id="hv-mult"></span></div>
      <div class="hv-grip"><div>Grip <b id="hv-pct"></b></div><div class="bar" id="hv-bar"><i id="hv-fill"></i></div></div>
    </div>
    <div class="hud hud-dpad only-machine only-touch" id="m-dpad">
      <button class="btn btn-blue dp dp-u" data-dir="u" aria-label="Forward">▲</button>
      <button class="btn btn-blue dp dp-l" data-dir="l" aria-label="Left">◀</button>
      <button class="btn btn-blue dp dp-r" data-dir="r" aria-label="Right">▶</button>
      <button class="btn btn-blue dp dp-d" data-dir="d" aria-label="Back">▼</button>
    </div>
    <div class="hud hud-play only-machine" id="m-play" hidden><button class="round-btn" id="m-play-btn"><span class="rb-txt" id="m-play-txt">PLAY</span><span class="rb-sub" id="m-play-sub"></span></button><div class="play-reason" id="m-reason" hidden></div></div>
    <div class="hud hud-mstats only-machine" id="m-stats"></div>
    <div class="hud hud-hint only-machine no-touch" id="m-hint">WASD / Arrows: move · Space: drop · Click or drag in the machine to aim · Esc: leave</div>

    <div class="hud hud-train only-train" id="t-card">
      <div class="t-title">🏋️ Training</div>
      <div class="t-cur" id="t-cur"></div>
      <div class="t-list" id="t-list"></div>
      <button class="btn btn-green t-train" id="t-train"><span id="t-train-txt">TRAIN</span><small id="t-train-sub"></small><span class="th no-touch">Space / Click</span></button>
      <div class="t-actions"><button class="btn btn-gray btn-sm t-auto" id="t-auto"></button><button class="btn btn-red btn-sm t-leave" id="t-leave">⬅ Leave</button></div>
      <div class="t-mults" id="t-mults"></div>
    </div>
    <div id="toasts"></div>`;
  const q = (s) => $(s, root);
  _ui.el = {
    coins: q('#hud-coins'), gems: q('#hud-gems'), strength: q('#hud-strength'),
    worldName: q('#hud-world-name'), world: q('#hud-world'), boosts: q('#hud-boosts'),
    goalText: q('#goal-text'), goalFill: q('#goal-fill'),
    shopBadge: q('#nav-shop-badge'),
    slots: q('#pets-slots'), petsMult: q('#pets-mult'),
    prompt: q('#hud-prompt'), promptPP: q('#prompt-pp'),
    action: q('#hud-action'), actionBtn: q('#action-btn'), actionIco: q('#action-ico'), actionTxt: q('#action-txt'), actionSub: q('#action-sub'),
    joy: q('#joy'), joyKnob: q('#joy-knob'), joyZone: q('#joy-zone'),
    mBack: q('#m-back-btn'), mTimer: q('#m-timer'), mTimerPill: q('#m-timer-pill'), mTimerNum: q('#m-timer-num'),
    mHover: q('#m-hover'), hvName: q('#hv-name'), hvRar: q('#hv-rar'), hvVar: q('#hv-var'), hvMult: q('#hv-mult'), hvPct: q('#hv-pct'), hvBar: q('#hv-bar'), hvFill: q('#hv-fill'),
    mPlay: q('#m-play'), mPlayBtn: q('#m-play-btn'), mPlayTxt: q('#m-play-txt'), mPlaySub: q('#m-play-sub'), mReason: q('#m-reason'),
    mStats: q('#m-stats'),
    tCard: q('#t-card'), tCur: q('#t-cur'), tList: q('#t-list'), tTrain: q('#t-train'), tTrainTxt: q('#t-train-txt'), tTrainSub: q('#t-train-sub'),
    tAuto: q('#t-auto'), tLeave: q('#t-leave'), tMults: q('#t-mults'),
    toasts: q('#toasts'),
  };
}

/* ---------- input wiring ---------- */
function _uiResetHeld() {
  _ui.dir.u = _ui.dir.d = _ui.dir.l = _ui.dir.r = false;
  $$('.dp.pressed', _ui.root).forEach((b) => b.classList.remove('pressed'));
  _ui.joy.id = null;
  if (_ui.el.joyKnob) _ui.el.joyKnob.style.transform = '';
  _uiResetVirtual();
}

function _uiBindInput(root) {
  const el = _ui.el;
  // delegated clicks: panel openers + click sound
  root.addEventListener('click', (e) => {
    const t = e.target;
    const btn = t.closest && t.closest('button, .btn, [data-open], .pp');
    if (!btn || !root.contains(btn)) return;
    if (btn.disabled || btn.classList.contains('disabled')) return;
    if (!btn.hasAttribute('data-nosfx') && !btn.classList.contains('dp')) _uiSfx('click');
    const op = btn.closest('[data-open]');
    if (op) {
      const id = op.getAttribute('data-open');
      if (UI.currentPanel === id) UI.closePanel(); else UI.openPanel(id);
    }
  });

  // interaction prompt (desktop pill + touch round button)
  const interact = () => Bus.emit('input:action', { name: 'interact' });
  el.promptPP.addEventListener('click', interact);
  el.actionBtn.addEventListener('click', interact);

  // machine HUD
  el.mBack.addEventListener('click', () => Bus.emit('input:action', { name: 'back' }));
  el.mPlayBtn.addEventListener('click', () => Bus.emit('input:action', { name: 'primary' }));
  el.tTrain.addEventListener('click', () => Bus.emit('input:action', { name: 'primary' }));
  el.tLeave.addEventListener('click', () => Bus.emit('input:action', { name: 'back' }));

  // d-pad
  const applyDir = () => {
    const d = _ui.dir;
    try { if (typeof Input !== 'undefined' && Input.virtual) { Input.virtual.x = (d.r ? 1 : 0) - (d.l ? 1 : 0); Input.virtual.y = (d.u ? 1 : 0) - (d.d ? 1 : 0); } } catch (e) { /* ignore */ }
  };
  $$('.dp', root).forEach((b) => {
    const k = b.getAttribute('data-dir');
    const down = (e) => { e.preventDefault(); _ui.dir[k] = true; b.classList.add('pressed'); applyDir(); _uiSfx('click'); };
    const up = () => { if (!_ui.dir[k]) return; _ui.dir[k] = false; b.classList.remove('pressed'); applyDir(); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // joystick
  const J = _ui.joy;
  const R = 52;
  const moveKnob = (e) => {
    let dx = e.clientX - J.cx, dy = e.clientY - J.cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    el.joyKnob.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    let vx = dx / R, vy = -dy / R;
    const m = Math.hypot(vx, vy);
    if (m < 0.12) { vx = 0; vy = 0; }
    try { if (typeof Input !== 'undefined' && Input.virtual) { Input.virtual.x = vx; Input.virtual.y = vy; } } catch (err) { /* ignore */ }
  };
  const endJoy = (e) => {
    if (J.id === null || (e && e.pointerId !== J.id)) return;
    J.id = null;
    el.joyKnob.style.transform = '';
    _uiResetVirtual();
  };
  el.joyZone.addEventListener('pointerdown', (e) => {
    if (J.id !== null) return;
    e.preventDefault();
    J.id = e.pointerId;
    const r = el.joy.getBoundingClientRect();
    J.cx = r.left + r.width / 2; J.cy = r.top + r.height / 2;
    try { el.joyZone.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    moveKnob(e);
  });
  el.joyZone.addEventListener('pointermove', (e) => { if (e.pointerId === J.id) { e.preventDefault(); moveKnob(e); } });
  el.joyZone.addEventListener('pointerup', endJoy);
  el.joyZone.addEventListener('pointercancel', endJoy);
  el.joyZone.addEventListener('lostpointercapture', endJoy);

  // training list + auto toggle
  el.tList.addEventListener('click', (e) => {
    const it = e.target.closest('[data-eq]');
    if (!it) return;
    try { const r = Remote.invoke('train:select', { id: it.getAttribute('data-eq') }); if (r && !r.ok && r.err) UI.toast(r.err, 'bad'); } catch (err) { console.error(err); }
    _uiPollTrain(true);
  });
  el.tAuto.addEventListener('click', () => {
    const p = Game.player;
    if (!p) return;
    if (!(p.shop && p.shop.autoTrain)) { UI.openPanel('shop'); return; }
    try { const r = Remote.invoke('train:auto', { on: !(p.training && p.training.auto) }); if (r && !r.ok && r.err) UI.toast(r.err, 'bad'); } catch (err) { console.error(err); }
    _uiPollTrain(true);
  });
}

/* ---------- bus wiring ---------- */
function _uiBindBus() {
  Bus.on('currency:changed', (d) => { if (d) { _ui.tgt.coins = d.coins || 0; _ui.tgt.gems = d.gems || 0; _ui.tgt.strength = d.strength || 0; } });
  Bus.on('mode:changed', (d) => _uiSetMode(d && d.mode));
  Bus.on('world:entered', () => _uiSyncWorld());
  Bus.on('world:changed', () => { _uiSyncWorld(); _uiRenderPrompt(); });
  Bus.on('toast', (d) => { if (d) UI.toast(d.text, d.kind); });
  Bus.on('reveal', (d) => { if (d && d.pet) UI.showReveal(d.pet, d.isNew, d.animal); });
  Bus.on('interact:prompt', (d) => { _ui.prompt = d && d.key ? d : null; _uiRenderPrompt(); });
  Bus.on('equip:changed', () => _uiRenderPets());
  Bus.on('pets:changed', () => _uiRenderPets());
  Bus.on('shop:bought', () => { _uiRenderPets(); });
  Bus.on('daily:claimed', () => _uiUpdateBadge());
  const refresh = () => _uiRefreshSoon();
  ['pets:changed', 'currency:changed', 'upgrade:bought', 'world:unlocked', 'world:changed', 'shop:bought', 'index:claimed', 'daily:claimed', 'equip:changed'].forEach((n) => Bus.on(n, refresh));
  Bus.on('input:action', (d) => {
    if (!d) return;
    const n = d.name;
    if (n === 'closePanel') {
      if (_ui.confirm) _uiCloseConfirm();
      else if (_ui.reveal) _uiRevealPress(true);
      else if (UI.currentPanel) UI.closePanel();
      return;
    }
    if (n === 'primary') { if (_ui.reveal) _uiRevealPress(false); return; }
    if (n && n.indexOf('panel:') === 0) {
      if (_ui.reveal || _ui.confirm) return;
      const id = n.slice(6);
      if (!_ui.panels[id]) return;
      if (UI.currentPanel === id) UI.closePanel(); else UI.openPanel(id);
    }
  });
}

function _uiSyncAll() {
  const p = Game.player;
  if (p) {
    _ui.tgt = { coins: p.coins || 0, gems: p.gems || 0, strength: p.strength || 0 };
    _ui.disp = { ..._ui.tgt };
    for (const k of ['coins', 'gems', 'strength']) { _ui.txt[k] = fmt(_ui.disp[k]); if (_ui.el[k]) _ui.el[k].textContent = _ui.txt[k]; }
  }
  _uiSyncWorld(); _uiRenderPets(); _uiUpdateBoosts(); _uiUpdateBadge(); _uiUpdateGoal(); _uiRenderPrompt();
  _uiSetMode(Game.mode || 'walk');
}

function _uiSyncWorld() {
  try {
    const w = WORLD_BY_ID[Game.player.worlds.current];
    if (!w) return;
    if (_ui.el.worldName) _ui.el.worldName.textContent = w.name;
    const acc = (w.theme && w.theme.accent) || '#ffb02e';
    document.documentElement.style.setProperty('--accent', acc);
    _ui.cache.worldId = w.id;
  } catch (e) { /* ignore */ }
}

function _uiSetMode(mode) {
  mode = mode === 'machine' || mode === 'train' ? mode : 'walk';
  const root = _ui.root;
  if (!root) return;
  root.classList.remove('mode-walk', 'mode-machine', 'mode-train');
  root.classList.add('mode-' + mode);
  _ui.mode = mode;
  _uiResetHeld();
  _ui.cache.m = {}; _ui.cache.t = {};
  if (mode === 'machine') { _ui.cache.msig = ''; _uiPollMachine(true); }
  else if (mode === 'train') { _uiPollTrain(true); }
  else { _uiUpdateGoal(); _uiRenderPets(); _uiRenderPrompt(); }
}

/* ---------- currency / goal / boosts / badge ---------- */
function _uiUpdateGoal() {
  let g = null;
  try { g = Services.nextGoal(); } catch (e) { /* ignore */ }
  if (!g) return;
  _uiText(_ui.el.goalText, 'goalText', g.text || '');
  const w = Math.round(clamp(g.progress || 0, 0, 1) * 100) + '%';
  _uiSet(_ui.el.goalFill, 'goalW', w, (e, v) => { e.style.width = v; });
}

function _uiUpdateBoosts() {
  const p = Game.player, box = _ui.el.boosts;
  if (!p || !box) return;
  const now = Date.now(), b = p.boosts || {};
  let sig = '', html = '';
  const add = (cls, ico, name, until) => {
    if (until > now) { const s = `${ico} ${name} ${fmtDur((until - now) / 1000)}`; sig += s + '|'; html += `<span class="boost-chip ${cls}">${esc(s)}</span>`; }
  };
  add('boost-luck', '🍀', 'Luck', b.luck || 0);
  add('boost-coins', '🪙', 'Coins', b.coins || 0);
  _uiSet(box, 'boosts', sig, (e) => { e.innerHTML = html; });
}

function _uiUpdateBadge() {
  let ready = false;
  try { const d = Services.dailyInfo(); ready = !!(d && d.ready); } catch (e) { /* ignore */ }
  _uiSet(_ui.el.shopBadge, 'badge', ready, (e, v) => { e.hidden = !v; });
}

/* ---------- pets bar ---------- */
function _uiRenderPets() {
  const box = _ui.el.slots;
  if (!box || !Game.player) return;
  const st = _uiStats();
  const n = Math.max(1, st.equipSlots || 1);
  const p = Game.player;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const uid = p.equipped && p.equipped[i];
    const pet = uid ? (p.pets || []).find((x) => x.uid === uid) : null;
    parts.push(pet ? pet.id + ':' + pet.variant : '-');
  }
  const sig = parts.join(',');
  if (_ui.cache.petsSig !== sig) {
    _ui.cache.petsSig = sig;
    box.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const uid = p.equipped && p.equipped[i];
      const pet = uid ? (p.pets || []).find((x) => x.uid === uid) : null;
      const animal = pet && ANIMAL_BY_ID[pet.id];
      const s = h('div', 'pslot');
      if (animal) {
        const r = _uiRarity(animal);
        s.classList.add('r-' + r.id);
        let src = '';
        try { src = AnimalFactory.thumbnail(pet.id, pet.variant); } catch (e) { /* ignore */ }
        if (src) { const im = h('img'); im.src = src; im.alt = animal.name; im.draggable = false; s.appendChild(im); }
        else s.textContent = '🐾';
        if (pet.variant === 'golden') s.appendChild(h('span', 'pv', '✨'));
        else if (pet.variant === 'rainbow') s.appendChild(h('span', 'pv', '🌈'));
        s.title = animal.name;
      } else { s.classList.add('empty'); s.textContent = '+'; }
      box.appendChild(s);
    }
  }
  _uiText(_ui.el.petsMult, 'petsMult', '🐾 ' + fmtMult(st.petMult || 1));
}

/* ---------- interaction prompt ---------- */
function _uiRenderPrompt() {
  const pr = _ui.prompt, el = _ui.el;
  if (!el.prompt) return;
  if (!pr) {
    el.prompt.hidden = true; el.action.hidden = true;
    _ui.cache.promptSig = '';
    return;
  }
  let label = pr.label || '';
  let sub = '';
  if (pr.key === 'machine') {
    const c = _uiPlayCost();
    sub = c > 0 ? '🪙 ' + fmt(c) : 'Free';
  }
  const sig = pr.key + '|' + label + '|' + sub;
  el.prompt.hidden = false; el.action.hidden = false;
  if (_ui.cache.promptSig === sig) return;
  _ui.cache.promptSig = sig;
  el.promptPP.innerHTML = `<kbd>E</kbd><span>${esc(label)}${sub ? ' <span class="muted" style="color:#ffe27a">(' + esc(sub) + ')</span>' : ''}</span>`;
  el.actionIco.textContent = _uiStationIcons[pr.key] || '✋';
  el.actionTxt.textContent = label;
  el.actionSub.textContent = sub ? '(' + sub + ')' : '';
  el.actionSub.hidden = !sub;
}

/* =====================================================================
   Machine HUD
   ===================================================================== */
function _uiPollMachine(force) {
  const m = _uiMachine(), el = _ui.el;
  const state = m ? m.state : 'idle';
  const busy = m ? !!(m.isBusy && m.isBusy()) : false;
  _uiSet(el.mBack, 'm.back', busy, (e, v) => { e.disabled = v; });

  // timer
  const aim = state === 'aim';
  const tl = m && aim ? Math.max(0, Math.ceil(m.timeLeft || 0)) : 0;
  _uiSet(el.mTimer, 'm.timerShow', aim, (e, v) => { e.hidden = !v; });
  if (aim) {
    _uiText(el.mTimerNum, 'm.timerNum', String(tl));
    _uiSet(el.mTimerPill, 'm.urgent', tl <= 5, (e, v) => e.classList.toggle('urgent', v));
  }

  // play / drop button
  let mode = 'hide', txt = '', sub = '', reason = '', ok = true;
  if (m && state === 'idle') {
    let cs = null;
    try { cs = m.canStart(); } catch (e) { cs = { ok: true, cost: 0 }; }
    ok = !!(cs && cs.ok);
    mode = 'play'; txt = 'PLAY';
    const cost = cs && cs.cost != null ? cs.cost : _uiPlayCost();
    sub = cost > 0 ? '🪙 ' + fmt(cost) : 'FREE';
    if (!ok) reason = (cs && cs.err) || 'Cannot play now';
  } else if (m && aim) { mode = 'drop'; txt = 'DROP'; }
  const psig = mode + '|' + txt + '|' + sub + '|' + ok + '|' + reason;
  if (_uiSet(el.mPlay, 'm.play', psig, () => {
    el.mPlay.hidden = mode === 'hide';
    el.mPlayBtn.classList.toggle('red', mode === 'drop');
    el.mPlayBtn.disabled = mode === 'play' && !ok;
    el.mPlayTxt.textContent = txt; el.mPlaySub.textContent = sub; el.mPlaySub.hidden = !sub;
    el.mReason.textContent = reason; el.mReason.hidden = !reason;
  })) { /* applied */ }

  // hover card
  let hv = null;
  if (m && (state === 'aim' || state === 'idle') && m.getHover) { try { hv = m.getHover(); } catch (e) { hv = null; } }
  if (!hv || !hv.animal) {
    _uiSet(el.mHover, 'm.hvSig', '', (e) => { e.hidden = true; });
  } else {
    const entry = hv.entry || {}, an = hv.animal;
    const pct = Math.round(clamp(hv.chance || 0, 0, 1) * 100);
    const sig = (entry.pid || an.id) + '|' + entry.variant + '|' + pct;
    _uiSet(el.mHover, 'm.hvSig', sig, (e) => {
      const r = _uiRarity(an);
      e.hidden = false;
      e.className = 'hud hud-hover only-machine r-' + r.id;
      el.hvName.textContent = an.name;
      el.hvRar.textContent = r.name; el.hvRar.className = 'tag r-' + r.id;
      const v = entry.variant;
      if (v && v !== 'normal') { el.hvVar.hidden = false; el.hvVar.textContent = v === 'golden' ? '✨ Golden' : v === 'rainbow' ? '🌈 Rainbow' : v; el.hvVar.className = 'tag'; }
      else el.hvVar.hidden = true;
      let mult = an.mult || 1;
      try { mult = Services.petMultOf({ id: an.id, variant: v || 'normal' }); } catch (err) { /* ignore */ }
      el.hvMult.textContent = fmtMult(mult);
      el.hvPct.textContent = pct + '%';
      el.hvBar.className = 'bar ' + (pct >= 65 ? 'g-good' : pct >= 35 ? 'g-mid' : 'g-bad');
      el.hvFill.style.width = pct + '%';
    });
  }

  // stats strip
  const st = _uiStats();
  const fu = (id, v) => { try { return FORMULAS.formatUpgrade(id, v); } catch (e) { return String(Math.round(v * 100) / 100); } };
  const chips = [
    ['💪', 'Grip', fu('strength', st.gripPower)],
    ['⚡', 'Speed', fu('speed', st.clawSpeed)],
    ['🛡️', 'Protect', fu('protection', st.protection)],
    ['📦', 'Capacity', fu('capacity', st.capacity)],
  ];
  const ssig = chips.map((c) => c[2]).join('|');
  _uiSet(el.mStats, 'm.stats', ssig, (e) => {
    e.innerHTML = chips.map((c) => `<span class="ms-chip">${c[0]}<span class="ms-l"> ${c[1]}</span> <b>${esc(c[2])}</b></span>`).join('');
  });
}

/* =====================================================================
   Training HUD
   ===================================================================== */
function _uiPollTrain(force) {
  const p = Game.player, el = _ui.el;
  if (!p || !el.tList) return;
  const tr = p.training || {};
  const sel = tr.selected;
  const unlocked = (p.worlds && p.worlds.unlocked) || [];
  const eqs = (typeof TRAINING_EQUIPMENT !== 'undefined' ? TRAINING_EQUIPMENT : []).filter((e) => unlocked.indexOf(e.world) >= 0);
  const str = p.strength || 0;
  const st = _uiStats();
  const autoOwned = !!(p.shop && p.shop.autoTrain);
  const sig = [sel, eqs.map((e) => e.id + (str >= e.requires ? '1' : '0')).join(''), autoOwned, !!tr.auto].join('|');
  if (_uiSet(el.tList, 't.list', sig, () => {
    const cur = EQUIPMENT_BY_ID[sel];
    el.tCur.innerHTML = 'Using: <b>' + esc(cur ? cur.name : '—') + '</b>';
    el.tList.innerHTML = eqs.map((e) => {
      const locked = str < e.requires;
      return `<button class="t-item${e.id === sel ? ' sel' : ''}${locked ? ' locked' : ''}" data-eq="${esc(e.id)}" style="--eq:${esc(e.color || '#888')}">` +
        `<span class="ti-ico">${locked ? '🔒' : (_uiEquipIcons[e.model] || '🏋️')}</span><span class="ti-txt"><span class="ti-name">${esc(e.name)}</span>` +
        `<span class="ti-sub">${locked ? '💪 requires ' + fmt(e.requires) : 'Power ' + fmt(e.power)}</span></span></button>`;
    }).join('');
    el.tAuto.className = 'btn btn-sm t-auto ' + (autoOwned ? (tr.auto ? 'btn-green' : 'btn-gray') : 'btn-gray');
    el.tAuto.textContent = autoOwned ? (tr.auto ? '🔁 Auto Train: ON' : '🔁 Auto Train: OFF') : '🔒 Auto Train (Shop)';
  })) { const s = el.tList.querySelector('.sel'); if (s && s.scrollIntoView && !_ui.cache.t_scrolled) { _ui.cache.t_scrolled = 1; try { s.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ } } }

  let gain = 0;
  try { gain = FORMULAS.trainGain({ equipmentId: sel, trainMult: st.trainMult || 1 }); } catch (e) { /* ignore */ }
  _uiText(el.tTrainSub, 't.gain', '+' + fmt(gain) + ' 💪 per rep');
  let tm = 1, wm = 1;
  try { tm = FORMULAS.upgradeValue('trainer', (p.upgrades && p.upgrades.trainer) || 0); } catch (e) { /* ignore */ }
  try { wm = (WORLD_BY_ID[p.worlds.current] || {}).trainMult || 1; } catch (e) { /* ignore */ }
  _uiText(el.tMults, 't.mults', `🐾 Pets ${fmtMult(st.petMult || 1)} · 🏋️ Trainer ${fmtMult(tm)} · 🌍 World ${fmtMult(wm)}`);
}

/* =====================================================================
   Panel frame
   ===================================================================== */
function _uiRenderPanel(keepScroll) {
  const body = _ui.panelBody, def = _ui.panelDef;
  if (!body || !def) return;
  const sy = keepScroll ? body.scrollTop : 0;
  body.innerHTML = '';
  try { def.render(body); } catch (e) { console.error('[UI] render', UI.currentPanel, e); body.innerHTML = '<div class="card">Something went wrong showing this panel.</div>'; }
  if (keepScroll) body.scrollTop = sy;
}

function _uiClosePanelNow(silent) {
  const def = _ui.panelDef;
  try { if (def && def.onClose) def.onClose(); } catch (e) { console.error('[UI] onClose', e); }
  if (_ui.panelEl && _ui.panelEl.parentNode) _ui.panelEl.parentNode.removeChild(_ui.panelEl);
  _ui.panelEl = null; _ui.panelBody = null; _ui.panelDef = null;
  UI.currentPanel = null;
  clearTimeout(_ui.refreshTimer); _ui.refreshTimer = 0; _ui.pendingRefresh = false;
  if (!silent) _uiSfx('close');
}

function _uiRefreshSoon() {
  if (!UI.currentPanel) return;
  if (_ui.reveal) return; // the reveal owns the single PetViewer; the panel is rebuilt when the reveal closes
  // never rebuild the panel under a text field the player is typing in (focus + caret would be lost)
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') && _ui.panelBody && _ui.panelBody.contains(ae)) { _ui.pendingRefresh = true; return; }
  const now = performance.now();
  const wait = 250 - (now - _ui.lastRefresh);
  if (wait <= 0) { _ui.lastRefresh = now; UI.refreshPanel(); return; }
  if (_ui.refreshTimer) return;
  _ui.refreshTimer = setTimeout(() => {
    _ui.refreshTimer = 0; _ui.lastRefresh = performance.now();
    if (UI.currentPanel) UI.refreshPanel();
  }, wait);
}

function _uiCloseConfirm() {
  if (_ui.confirm && _ui.confirm.parentNode) _ui.confirm.parentNode.removeChild(_ui.confirm);
  const had = !!_ui.confirm;
  _ui.confirm = null;
  if (had) _uiSfx('close');
}

/* =====================================================================
   Reveal (capsule opening)
   ===================================================================== */
function _uiRevealNext() {
  if (_ui.reveal || !_ui.revealQ.length || !_ui.root) return;
  const it = _ui.revealQ.shift();
  const pet = it.pet;
  const animal = it.animal || ANIMAL_BY_ID[pet.id];
  if (!animal) { _uiRevealNext(); return; }
  const rar = _uiRarity(animal);
  const order = rar.order != null ? rar.order : 0;
  const big = order >= 4;
  const col = rar.id === 'secret' ? '#d46bff' : rar.color;

  const ov = h('div', 'reveal r-' + rar.id + ' t-' + rar.id);
  ov.style.setProperty('--rcA', _uiRGBA(col, 0.5));
  ov.style.setProperty('--rcB', _uiRGBA(col, 0.75));
  ov.style.setProperty('--rcL', _uiShade(col, 0.45));
  ov.style.setProperty('--rcS', col);
  ov.style.setProperty('--rcD', _uiShade(col, -0.35));
  ov.style.setProperty('--rg', col);
  let variantTag = '';
  if (pet.variant === 'golden') variantTag = '<span class="rv-var golden">✨ Golden</span>';
  else if (pet.variant === 'rainbow') variantTag = '<span class="rv-var rainbow">🌈 Rainbow</span>';
  let mult = animal.mult || 1;
  try { mult = Services.petMultOf(pet); } catch (e) { /* ignore */ }
  ov.innerHTML =
    '<div class="rv-rays"></div>' +
    '<div class="rv-stage"><div class="rv-burst"></div><div class="rv-cap"><div class="half top"></div><div class="half bot"></div></div><div class="rv-viewer"></div></div>' +
    '<div class="rv-info">' + (it.isNew ? '<div class="rv-new">NEW!</div>' : '') +
    `<div class="rv-name">${esc(animal.name)}</div><div class="rv-rar">${esc(rar.name)}</div>${variantTag}` +
    `<div class="rv-mult">${esc(fmtMult(mult))} <small>pet multiplier</small></div>` +
    '<button class="btn btn-green btn-lg rv-btn" data-nosfx="1">Awesome!</button></div>' +
    '<div class="rv-flash"></div><div class="rv-tip">Tap to skip</div>';
  // floating particles for the top rarities
  if (order >= 4) {
    const n = order >= 6 ? 26 : order >= 5 ? 20 : 12;
    const syms = rar.id === 'secret' ? ['✦', '★', '✧', '❖'] : ['✦', '★', '✧'];
    for (let i = 0; i < n; i++) {
      const s = h('span', 'rv-p', syms[i % syms.length]);
      s.style.left = (Math.random() * 100).toFixed(1) + '%';
      s.style.setProperty('--d', (4 + Math.random() * 4).toFixed(1) + 's');
      s.style.setProperty('--dl', (-Math.random() * 6).toFixed(1) + 's');
      s.style.fontSize = (14 + Math.random() * 22).toFixed(0) + 'px';
      s.style.color = rar.id === 'secret' ? ['#ff6a6a', '#ffd23f', '#6df06a', '#6cc4ff', '#d46bff'][i % 5] : col;
      ov.appendChild(s);
    }
  }
  _ui.root.appendChild(ov);

  const rv = { ov, pet, animal, rar, order, big, timers: [], opened: false, closable: false, mounted: false };
  rv.cap = $('.rv-cap', ov); rv.viewer = $('.rv-viewer', ov); rv.info = $('.rv-info', ov);
  rv.btn = $('.rv-btn', ov); rv.flash = $('.rv-flash', ov); rv.burst = $('.rv-burst', ov); rv.tip = $('.rv-tip', ov);
  _ui.reveal = rv;
  _uiResetHeld();
  const later = (ms, fn) => { rv.timers.push(setTimeout(fn, ms)); };
  rv.later = later;

  ov.addEventListener('click', (e) => {
    if (e.target.closest('.rv-btn')) { _uiRevealPress(true); return; }
    _uiRevealPress(false);
  });

  // timeline
  const shakes = big ? 4 : 2;
  const shakeMs = big ? 700 : 480;
  const gap = big ? 160 : 120;
  later(40, () => { rv.cap.classList.add('drop'); });
  if (big) later(60, () => ov.classList.add('glow'));
  let t = 720;
  for (let i = 0; i < shakes; i++) {
    const k = i;
    later(t, () => {
      rv.cap.classList.remove('drop'); rv.cap.classList.remove('shake'); void rv.cap.offsetWidth;
      rv.cap.style.setProperty('--sd', shakeMs + 'ms');
      rv.cap.style.setProperty('--glow', (big ? 10 + k * 16 : 8 + k * 6) + 'px');
      rv.cap.classList.add('shake');
      _uiSfx('capsule');
      if (big && k === shakes - 1) ov.classList.add('glow');
    });
    t += shakeMs + gap;
  }
  later(t + 60, () => _uiRevealOpen(rv));
}

function _uiRevealOpen(rv) {
  if (rv.opened || _ui.reveal !== rv) return;
  rv.opened = true;
  rv.timers.forEach(clearTimeout); rv.timers = [];
  const later = rv.later;
  const { ov, cap, rar, order } = rv;
  cap.classList.remove('drop', 'shake'); cap.style.transform = 'none'; cap.style.setProperty('--glow', '30px');
  void cap.offsetWidth;
  cap.classList.add('open');
  ov.classList.add('glow', 'opened');
  rv.burst.classList.add('go');
  if (rv.big) { rv.flash.classList.add('go'); }
  _uiSfx('reveal');
  if (order >= 2) _uiSfx(rar.id);
  rv.tip.hidden = true;
  later(120, () => {
    try { if (typeof PetViewer !== 'undefined') { PetViewer.mount(rv.viewer, rv.pet.id, rv.pet.variant || 'normal'); rv.mounted = true; } } catch (e) { console.error('[UI] PetViewer', e); }
    rv.viewer.classList.add('show');
  });
  later(450, () => { rv.info.classList.add('show'); rv.btn.classList.add('show'); });
  later(800, () => { rv.closable = true; });
}

function _uiRevealPress(forceClose) {
  const rv = _ui.reveal;
  if (!rv) return;
  if (!rv.opened) { _uiRevealOpen(rv); return; }
  if (!rv.closable && !forceClose) return;
  if (!rv.closable) return;
  _uiRevealClose(rv);
}

function _uiRevealClose(rv) {
  rv.timers.forEach(clearTimeout); rv.timers = [];
  try { if (rv.mounted && typeof PetViewer !== 'undefined') PetViewer.unmount(); } catch (e) { /* ignore */ }
  rv.ov.classList.add('closing');
  _ui.reveal = null;
  _uiSfx('close');
  // the reveal's PetViewer replaced the one inside an open panel (only one viewer may exist): rebuild the panel so it remounts
  if (UI.currentPanel) UI.refreshPanel();
  setTimeout(() => { if (rv.ov.parentNode) rv.ov.parentNode.removeChild(rv.ov); }, 260);
  setTimeout(() => { if (!_ui.reveal) _uiRevealNext(); }, 280);
}
