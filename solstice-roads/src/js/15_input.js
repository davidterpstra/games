/* =====================================================================
   Input: keyboard, gamepad (standard mapping) and on-screen touch
   controls. Produces throttle / brake / steer / handbrake in 0..1.
   ===================================================================== */
const Input = { K: {}, touch: { left: 0, right: 0, gas: 0, brake: 0, hb: 0 }, steer: 0, padPrev: [], usedTouch: false };
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

function initInput() {
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    const playing = Game.mode === 'drive' || Game.mode === 'race';
    if (playing && !Game.paused && GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) { Input.K[e.code] = 1; return; }
    Input.K[e.code] = 1;
    audioStart();
    handleKey(e.code, e);
  });
  addEventListener('keyup', (e) => { Input.K[e.code] = 0; });
  addEventListener('blur', () => { Input.K = {}; });
  // stop page scrolling / zoom gestures while playing
  addEventListener('wheel', (e) => { if (!Menu.screen) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (!e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
  // touch buttons
  for (const el of document.querySelectorAll('[data-touch]')) {
    const k = el.dataset.touch;
    const down = (e) => { e.preventDefault(); Input.usedTouch = true; audioStart(); el.classList.add('down'); if (k in Input.touch) Input.touch[k] = 1; else handleKey(k); };
    const up = (e) => { e.preventDefault(); el.classList.remove('down'); if (k in Input.touch) Input.touch[k] = 0; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') Input.usedTouch = true; updateTouchUI(); }, { passive: true });
}
function updateTouchUI() {
  const s = Game.settings.touch || 'auto';
  const on = s === 'on' || (s === 'auto' && (Input.usedTouch || matchMedia('(pointer: coarse)').matches));
  document.body.classList.toggle('touch', on);
}
function handleKey(code, e) {
  const playing = (Game.mode === 'drive' || Game.mode === 'race') && !Game.paused;
  if (code === 'Escape' || code === 'pause') {
    if (Menu.screen === 'results') return;
    if (playing) openPause();
    else if (Menu.screen === 'pause') resumeGame();
    else if (Menu.screen && Menu.screen !== 'mainMenu' && Menu.screen !== 'loading') { SFX.back(); if (Menu.screen === 'settings') { Game.applySettings(); Save.data.settings = Game.settings; Save.write(); } if (Menu.screen === 'garage') clearPreview(); back(); }
    return;
  }
  if (code === 'KeyM') { Game.settings.muted = !Game.settings.muted; applyVolumes(); notify(Game.settings.muted ? 'Sound muted' : 'Sound on', '', 'info', 1200); return; }
  if (code === 'KeyN') { musicToggle(); updateRadioBtn(); return; }
  if (!playing) return;
  if (code === 'KeyC' || code === 'cam') { camSetMode(Cam.mode + 1, Game.camera); Game.settings.camera = Cam.mode; notify('Camera', CAM_NAMES[Cam.mode], 'info', 900); }
  else if (code === 'KeyR' || code === 'reset') resetPlayer();
  else if (code === 'KeyE' || code === 'act') interact();
  else if (code === 'KeyH') { tone(415, 0.35, 'square', 0.12, 'sfx'); tone(523, 0.35, 'square', 0.1, 'sfx'); }
  void e;
}
function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && [...pads].find((g) => g && g.connected);
  if (!p) return null;
  const b = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
  const pressed = (i) => { const now = b(i) > 0.5, was = Input.padPrev[i]; Input.padPrev[i] = now; return now && !was; };
  if (pressed(9)) handleKey('Escape');
  if (pressed(3)) handleKey('KeyC');
  if (pressed(2)) handleKey('KeyE');
  if (pressed(8)) handleKey('KeyR');
  const ax = p.axes[0] || 0;
  return { throttle: b(7), brake: b(6), steer: Math.abs(ax) > 0.12 ? -Math.sign(ax) * ((Math.abs(ax) - 0.12) / 0.88) ** 1.4 : 0, handbrake: b(0) || b(5) };
}
function readControls(dt, car) {
  const K = Input.K, T = Input.touch;
  let thr = K.KeyW || K.ArrowUp || T.gas ? 1 : 0;
  let brk = K.KeyS || K.ArrowDown || T.brake ? 1 : 0;
  const l = K.KeyA || K.ArrowLeft || T.left ? 1 : 0, r = K.KeyD || K.ArrowRight || T.right ? 1 : 0;
  const hb = K.Space || T.hb ? 1 : 0;
  // keyboard steering ramps in, faster back to centre, slower at speed
  const target = l - r;
  const rate = (target === 0 || Math.sign(target) !== Math.sign(Input.steer) ? 6.5 : 3.2) * (1.15 - Math.min(0.5, car.speed / 120));
  Input.steer += clamp(target - Input.steer, -rate * dt, rate * dt);
  let steer = Input.steer;
  const pad = readPad();
  if (pad) {
    thr = Math.max(thr, pad.throttle); brk = Math.max(brk, pad.brake);
    if (Math.abs(pad.steer) > 0.01) steer = pad.steer;
    if (pad.handbrake > 0.5) car.input.handbrake = 1;
  }
  car.input.throttle = thr; car.input.brake = brk; car.input.steer = clamp(steer, -1, 1);
  car.input.handbrake = Math.max(hb, pad && pad.handbrake > 0.5 ? 1 : 0);
}
