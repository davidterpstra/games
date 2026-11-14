// In-game HUD: crosshair, interaction prompt, mission tracker, compass, stamina, clock/weather,
// torch indicator, saved indicator, FPS readout and the first-time controls hint.
// update(dt) only touches the DOM when a value changed.
import { h, icon, fmtClock, safeStorage } from './dom.js';
import { createCompass } from './Compass.js';

const WEATHER = { clear: 'Helder', cloudy: 'Bewolkt', rain: 'Regen', fog: 'Mist', storm: 'Storm' };
const HINT_KEY = 'beyond.hint.v1';
const store = safeStorage();

export function createHud(ctx) {
  const { bus, game } = ctx;

  // ---- crosshair + prompt ---------------------------------------------------------------------
  const crosshair = h('div', { class: 'crosshair' }, h('span', { class: 'crosshair-dot' }), h('span', { class: 'crosshair-ring' }));
  const promptKey = h('span', { class: 'prompt-key', text: 'E' });
  const promptText = h('span', { class: 'prompt-text' });
  const prompt = h('div', { class: 'prompt', role: 'status' }, promptKey, promptText);

  // ---- clock / weather ------------------------------------------------------------------------
  const wxIcon = h('span', { class: 'wx-icon' }, icon('w_clear'));
  const clockTime = h('span', { class: 'clock-time', text: '--:--' });
  const clockSub = h('span', { class: 'clock-sub', text: '' });
  const clock = h('div', { class: 'hud-card clock' }, wxIcon, h('div', { class: 'clock-col' }, clockTime, clockSub));
  const torchInd = h('div', { class: 'hud-card torch-ind' }, icon('torch'), h('span', { text: 'Toorts' }));

  // ---- mission tracker ------------------------------------------------------------------------
  const trackerTitle = h('div', { class: 'tracker-title' });
  const trackerList = h('ul', { class: 'tracker-list' });
  const tracker = h('div', { class: 'hud-card tracker' },
    h('div', { class: 'tracker-head' }, icon('mission'), h('span', { class: 'tracker-kicker', text: 'MISSIE' })), trackerTitle, trackerList);
  let trackerSig = '';
  let prevObj = new Map();
  function renderTracker(flash = true) {
    const m = game.gameplay?.missions?.active?.();
    if (!m) { tracker.classList.add('is-empty'); trackerSig = ''; return; }
    const sig = JSON.stringify([m.id, m.objectives.map((o) => [o.id, o.done, o.progress])]);
    if (sig === trackerSig) return;
    const newMission = !trackerSig || JSON.parse(trackerSig)[0] !== m.id;
    trackerSig = sig;
    tracker.classList.remove('is-empty');
    trackerTitle.textContent = m.title;
    const next = new Map();
    trackerList.replaceChildren(...m.objectives.map((o) => {
      const key = o.id + '|' + o.done + '|' + (o.progress ? o.progress.join('/') : '');
      next.set(o.id, key);
      const changed = flash && !newMission && prevObj.has(o.id) && prevObj.get(o.id) !== key;
      const li = h('li', { class: `obj ${o.done ? 'done' : ''} ${changed ? 'flash' : ''}` },
        h('span', { class: 'obj-box' }, o.done ? icon('check') : null),
        h('span', { class: 'obj-text', text: o.text }),
        o.progress && !o.done ? h('span', { class: 'obj-progress', text: `[${o.progress[0]}/${o.progress[1]}]` }) : null);
      return li;
    }));
    prevObj = next;
    if (newMission) { tracker.classList.remove('swap'); void tracker.offsetWidth; tracker.classList.add('swap'); }
  }
  for (const ev of ['mission:started', 'mission:updated', 'mission:completed', 'objective:completed', 'game:loaded', 'inventory:changed']) {
    bus.on(ev, () => { if (game.state === 'playing' || ev === 'game:loaded') renderTracker(); });
  }

  // ---- compass --------------------------------------------------------------------------------
  const compass = createCompass();
  const compassEl = h('div', { class: 'compass' }, compass.canvas, h('span', { class: 'compass-needle' }));

  // ---- stamina --------------------------------------------------------------------------------
  const staminaFill = h('div', { class: 'stamina-fill' });
  const stamina = h('div', { class: 'stamina is-full', 'aria-hidden': 'true' }, icon('stamina'), h('div', { class: 'stamina-bar' }, staminaFill));

  // ---- saved indicator / fps / hint -----------------------------------------------------------
  const savedText = h('span', { text: 'Opgeslagen' });
  const saved = h('div', { class: 'saved' }, icon('checkpoint'), savedText);
  let savedTimer = 0;
  const showSaved = (text) => { savedText.textContent = text; saved.classList.add('is-on'); clearTimeout(savedTimer); savedTimer = setTimeout(() => saved.classList.remove('is-on'), 2400); };
  bus.on('game:saved', () => showSaved('Opgeslagen'));
  bus.on('checkpoint:set', ({ name }) => showSaved(name ? `Checkpoint · ${name}` : 'Checkpoint'));

  const fps = h('div', { class: 'fps', text: '' });

  const hintClose = h('button', { class: 'icon-btn hint-close', type: 'button', 'aria-label': 'Verberg hint' }, icon('close'));
  const keys = [['W A S D', 'Lopen'], ['Shift', 'Sprinten'], ['Spatie', 'Springen'], ['E', 'Interactie'], ['F', 'Toorts'], ['Tab', 'Inventaris'], ['M', 'Kaart'], ['Esc', 'Pauze']];
  const hint = h('div', { class: 'hint', role: 'note' },
    h('div', { class: 'hint-head' }, h('span', { class: 'hint-title', text: 'BESTURING' }), hintClose),
    h('div', { class: 'hint-grid' }, keys.map(([k, l]) => h('div', { class: 'hint-row' }, h('kbd', { text: k }), h('span', { text: l })))));
  let hintTimer = 0, hintOn = false;
  const hideHint = (seen = true) => { hint.classList.remove('is-on'); hintOn = false; if (seen) store.set(HINT_KEY, '1'); };
  hintClose.addEventListener('click', () => hideHint());

  // ---- assemble -------------------------------------------------------------------------------
  const el = h('section', { class: 'hud', 'aria-hidden': 'true' },
    h('div', { class: 'hud-tl' }, clock, torchInd),
    h('div', { class: 'hud-tc' }, compassEl),
    h('div', { class: 'hud-tr' }, tracker),
    crosshair, prompt, stamina, saved, fps, hint);

  // ---- focus ---------------------------------------------------------------------------------
  let focus = null;
  bus.on('interaction:focus', (f) => {
    focus = f || null;
    crosshair.classList.toggle('is-focus', !!focus);
    prompt.classList.toggle('is-on', !!focus);
    if (focus) {
      const touch = ctx.isTouch();
      promptKey.textContent = touch ? 'TIK' : (focus.key || 'E');
      promptText.textContent = touch ? (focus.prompt || '') : (focus.prompt || '');
      prompt.classList.toggle('touch', touch);
    }
  });

  // ---- cached per-frame state ----------------------------------------------------------------
  const last = { stam: -1, full: true, clock: '', day: -1, wx: '', night: null, torch: null, fps: '' };
  let acc = 0, trackerAcc = 0;

  function onShow() {
    renderTracker(false);
    if (!store.get(HINT_KEY) || ctx.params.has('hint')) { hint.classList.add('is-on'); hintOn = true; hintTimer = 0; }
    last.stam = -1; last.clock = ''; last.torch = null;
  }
  function onHide() { crosshair.classList.remove('is-focus'); prompt.classList.remove('is-on'); focus = null; if (hintOn) hideHint(true); }

  function update(dt) {
    const p = game.player?.state;
    const env = game.environment;
    if (p) {
      const s = Math.round(Math.max(0, Math.min(1, p.stamina ?? 1)) * 200) / 200;
      if (s !== last.stam) { last.stam = s; staminaFill.style.transform = `scaleX(${s})`; stamina.classList.toggle('is-low', s < 0.25); }
      const full = s >= 0.995;
      if (full !== last.full) { last.full = full; stamina.classList.toggle('is-full', full); }
      const gp = game.gameplay;
      compass.draw(p.yaw || 0, p.position.x, p.position.z, gp?.locations?.list?.());
    }
    if (env) {
      const t = env.getTimeOfDay();
      const c = fmtClock(t);
      if (c !== last.clock) {
        last.clock = c; clockTime.textContent = c;
        const night = t < 5.5 || t >= 20.5;
        if (night !== last.night || env.weather !== last.wx) {
          last.night = night; last.wx = env.weather;
          const name = env.weather === 'clear' && night ? 'w_night' : 'w_' + (env.weather || 'clear');
          wxIcon.replaceChildren(icon(name));
          clockSub.textContent = '';
        }
      }
      const day = env.day;
      const sub = `Dag ${day} · ${WEATHER[env.weather] || ''}`;
      if (sub !== last.sub) { last.sub = sub; clockSub.textContent = sub; }
      const torch = !!env.torchOn;
      if (torch !== last.torch) { last.torch = torch; torchInd.classList.toggle('is-on', torch); }
    }
    if (hintOn) { hintTimer += dt; if (hintTimer > 12) hideHint(true); }
    if (game.settings.get('showFps')) {
      acc += dt;
      if (acc > 0.25) {
        acc = 0;
        const st = game.perf?.stats?.();
        const txt = st ? `${st.fps} FPS · ${st.frameMs} ms${st.drawCalls != null ? ` · ${st.drawCalls} dc` : ''}${st.triangles != null ? ` · ${Math.round(st.triangles / 1000)}k tri` : ''}` : '';
        if (txt !== last.fps) { last.fps = txt; fps.textContent = txt; }
        if (!fps.classList.contains('is-on')) fps.classList.add('is-on');
      }
    } else if (fps.classList.contains('is-on')) { fps.classList.remove('is-on'); last.fps = ''; }
    trackerAcc += dt;
    if (trackerAcc > 0.5) { trackerAcc = 0; renderTracker(); }
  }

  return { el, update, onShow, onHide };
}
